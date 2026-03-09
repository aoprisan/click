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
	conn          *websocket.Conn
	userID        string
	cityID        string
	userName      string
	role          string
	roleRefreshed time.Time
	spectator     bool
}

type dailyCounter struct {
	count int
	date  string
}

type hub struct {
	mu             sync.Mutex
	clients        map[*client]struct{}
	limiter        *rateLimiter
	originPatterns []string

	// Separate mutex for achievement tracking (avoids contention with broadcast)
	achMu           sync.Mutex
	clickWindows    map[string][]time.Time   // Fast Finger: click timestamps per user (last 60s)
	lastBest10sTime map[string]time.Time     // Fast Finger: cooldown tracker
	dailyClicks     map[string]*dailyCounter // Relentless: daily click counter per user
}

func newHub(originPatterns []string) *hub {
	return &hub{
		clients:         make(map[*client]struct{}),
		limiter:         newRateLimiter(),
		originPatterns:  originPatterns,
		clickWindows:    make(map[string][]time.Time),
		lastBest10sTime: make(map[string]time.Time),
		dailyClicks:     make(map[string]*dailyCounter),
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
	if !c.spectator && c.userID != "" {
		// Clean up tracking maps if no other connections for this user
		hasOther := false
		for other := range h.clients {
			if other.userID == c.userID {
				hasOther = true
				break
			}
		}
		if !hasOther {
			h.achMu.Lock()
			delete(h.clickWindows, c.userID)
			delete(h.lastBest10sTime, c.userID)
			delete(h.dailyClicks, c.userID)
			h.achMu.Unlock()
		}
	}
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

// sendToClient sends a message to a specific client.
func (h *hub) sendToClient(msg WSOutgoing, target *client) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := target.conn.Write(ctx, websocket.MessageText, data); err != nil {
		h.removeClient(target)
		target.conn.Close(websocket.StatusNormalClosure, "")
	}
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
	// Check for auth cookie - spectators don't need one
	var user *User
	cookie, err := r.Cookie(cookieName)
	if err == nil {
		user, _ = getUser(cookie.Value)
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: h.originPatterns,
	})
	if err != nil {
		slog.Warn("ws accept failed", "error", err)
		return
	}

	var c *client
	if user != nil {
		c = &client{
			conn:     conn,
			userID:   user.ID,
			cityID:   user.CityID,
			userName: user.Name,
			role:     user.Role,
		}
	} else {
		c = &client{
			conn:      conn,
			spectator: true,
		}
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

		// Spectators can't send actions
		if c.spectator {
			continue
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

		// Refresh role from DB periodically (may have changed via subscription API)
		if time.Since(c.roleRefreshed) > 30*time.Second {
			if u, err := getUser(c.userID); err == nil {
				c.role = u.Role
				c.roleRefreshed = time.Now()
			}
		}

		multiplier := 1
		if c.role == "warrior" {
			multiplier = 2
		}

		update, err := recordClick(c.userID, c.cityID, multiplier)
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

		// Check achievements after click (Phase 2)
		h.checkAchievementsAfterClick(c, multiplier)
	}
}

// checkAchievementsAfterClick checks and awards achievements after a click.
func (h *hub) checkAchievementsAfterClick(c *client, multiplier int) {
	user, err := getUser(c.userID)
	if err != nil {
		return
	}

	// Check cumulative achievements
	earned := checkCumulativeAchievements(user)
	for _, ach := range earned {
		missile := awardAchievementMissile(user.ID, user.CityID, user.Role)
		msg := AchievementEarned{AchievementName: ach}
		if missile != nil {
			msg.MissileType = missile.MissileType
		}
		h.sendToClient(WSOutgoing{Type: "achievement_earned", Data: msg}, c)
	}

	// Check Fast Finger (best 10s personal best)
	h.checkFastFinger(c, user)

	// Check Relentless (best 1 day personal best)
	h.checkRelentless(c, user)

	// Check click missiles for warriors (Phase 4)
	if c.role == "warrior" {
		h.checkClickMissiles(c, user)
	}
}

// sendTimedAchievement awards an achievement missile and notifies the client.
func (h *hub) sendTimedAchievement(c *client, user *User, name string) {
	missile := awardAchievementMissile(user.ID, user.CityID, user.Role)
	msg := AchievementEarned{AchievementName: name}
	if missile != nil {
		msg.MissileType = missile.MissileType
	}
	h.sendToClient(WSOutgoing{Type: "achievement_earned", Data: msg}, c)
}

// checkFastFinger tracks clicks in a 10s window and awards "Fast Finger" if a new personal best.
func (h *hub) checkFastFinger(c *client, user *User) {
	now := time.Now()
	userID := c.userID

	h.achMu.Lock()
	// Append current click timestamp
	h.clickWindows[userID] = append(h.clickWindows[userID], now)

	// Trim to last 60s
	cutoff := now.Add(-60 * time.Second)
	timestamps := h.clickWindows[userID]
	trimIdx := 0
	for trimIdx < len(timestamps) && timestamps[trimIdx].Before(cutoff) {
		trimIdx++
	}
	h.clickWindows[userID] = timestamps[trimIdx:]

	// Count clicks in last 10s
	tenSecAgo := now.Add(-10 * time.Second)
	count := 0
	for _, ts := range h.clickWindows[userID] {
		if !ts.Before(tenSecAgo) {
			count++
		}
	}

	// 10s cooldown since last award
	lastCheck := h.lastBest10sTime[userID]
	h.achMu.Unlock()

	if count <= user.Best10s {
		return
	}
	if now.Sub(lastCheck) < 10*time.Second {
		return
	}

	updated, err := updateUserBest10s(userID, count)
	if err != nil || !updated {
		return
	}

	h.achMu.Lock()
	h.lastBest10sTime[userID] = now
	h.achMu.Unlock()

	h.sendTimedAchievement(c, user, "Fast Finger")
}

// checkRelentless tracks daily clicks and awards "Relentless" if a new personal best.
func (h *hub) checkRelentless(c *client, user *User) {
	userID := c.userID
	today := time.Now().UTC().Format("2006-01-02")

	h.achMu.Lock()
	dc := h.dailyClicks[userID]
	if dc == nil || dc.date != today {
		dc = &dailyCounter{count: 0, date: today}
		h.dailyClicks[userID] = dc
	}
	dc.count++
	currentCount := dc.count
	h.achMu.Unlock()

	if currentCount <= user.Best1Day {
		return
	}

	updated, err := updateUserBest1Day(userID, currentCount)
	if err != nil || !updated {
		return
	}

	h.sendTimedAchievement(c, user, "Relentless")
}
