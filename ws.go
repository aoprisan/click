package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

type client struct {
	conn     *websocket.Conn
	userID   string
	cityID   string
	userName string
}

type hub struct {
	mu             sync.Mutex
	clients        map[*client]struct{}
	limiter        *rateLimiter
	originPatterns []string
}

func newHub(originPatterns []string) *hub {
	return &hub{
		clients:        make(map[*client]struct{}),
		limiter:        newRateLimiter(),
		originPatterns: originPatterns,
	}
}

func (h *hub) addClient(c *client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *hub) removeClient(c *client) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

func (h *hub) broadcast(msg WSOutgoing) {
	h.sendToClients(msg, nil)
}

// broadcastToCity sends a message only to clients in the given city, excluding the sender.
func (h *hub) broadcastToCity(msg WSOutgoing, cityID string, exclude *client) {
	h.sendToClients(msg, func(c *client) bool {
		return c.cityID == cityID && c != exclude
	})
}

func (h *hub) sendToClients(msg WSOutgoing, filter func(*client) bool) {
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("broadcast marshal failed", "error", err)
		return
	}

	h.mu.Lock()
	clients := make([]*client, 0, len(h.clients))
	for c := range h.clients {
		if filter == nil || filter(c) {
			clients = append(clients, c)
		}
	}
	h.mu.Unlock()

	for _, c := range clients {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := c.conn.Write(ctx, websocket.MessageText, data)
		cancel()
		if err != nil {
			h.removeClient(c)
			c.conn.Close(websocket.StatusNormalClosure, "")
		}
	}
}

func (h *hub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}

	user, err := getUser(cookie.Value)
	if err != nil {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: h.originPatterns,
	})
	if err != nil {
		slog.Warn("ws accept failed", "error", err)
		return
	}

	c := &client{
		conn:     conn,
		userID:   user.ID,
		cityID:   user.CityID,
		userName: user.Name,
	}
	h.addClient(c)
	defer func() {
		h.removeClient(c)
		conn.Close(websocket.StatusNormalClosure, "")
	}()

	for {
		_, data, err := conn.Read(r.Context())
		if err != nil {
			return
		}

		var msg WSIncoming
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		if msg.Type != "click" {
			continue
		}

		if !h.limiter.allow(c.userID) {
			continue // silently drop excess clicks
		}

		update, err := recordClick(c.userID, c.cityID)
		if err != nil {
			slog.Error("recordClick failed", "error", err, "user", c.userID, "city", c.cityID)
			continue
		}

		h.broadcast(WSOutgoing{
			Type: "city_update",
			Data: update,
		})

		// Notify same-city players about the click (excluding the sender)
		h.broadcastToCity(WSOutgoing{
			Type: "city_click",
			Data: CityClick{CityID: c.cityID, UserName: c.userName},
		}, c.cityID, c)
	}
}
