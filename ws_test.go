package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
)

func TestWSAcceptsSpectator(t *testing.T) {
	setupTestDB(t)
	h := newHub([]string{"*"})

	r := chi.NewRouter()
	r.Get("/ws", h.handleWebSocket)
	srv := httptest.NewServer(r)
	defer srv.Close()

	// Connect without cookie — should be accepted as spectator
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, srv.URL+"/ws", nil)
	if err != nil {
		t.Fatalf("spectator connection should be accepted, got error: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// Spectator should not be able to send clicks that are processed
	clickMsg, _ := json.Marshal(WSIncoming{Type: "click"})
	if err := conn.Write(ctx, websocket.MessageText, clickMsg); err != nil {
		t.Fatalf("write: %v", err)
	}

	// No response expected (click is ignored for spectators)
	shortCtx, shortCancel := context.WithTimeout(ctx, 300*time.Millisecond)
	defer shortCancel()
	_, _, err = conn.Read(shortCtx)
	if err == nil {
		t.Error("spectator should not receive any broadcast from their own click")
	}
}

func TestWSAcceptsAuthenticated(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "test-us", "Test", "US", "US")
	createUser("ws-user", "WSUser", "test-us")
	h := newHub([]string{"*"})

	r := chi.NewRouter()
	r.Get("/ws", h.handleWebSocket)
	srv := httptest.NewServer(r)
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, srv.URL+"/ws", &websocket.DialOptions{
		HTTPHeader: http.Header{
			"Cookie": []string{"user_id=ws-user"},
		},
	})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// Send a click and read the broadcast back
	clickMsg, _ := json.Marshal(WSIncoming{Type: "click"})
	err = conn.Write(ctx, websocket.MessageText, clickMsg)
	if err != nil {
		t.Fatalf("write: %v", err)
	}

	// Read the city_update broadcast
	readCtx, readCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer readCancel()
	_, data, err := conn.Read(readCtx)
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	var msg WSOutgoing
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if msg.Type != "city_update" {
		t.Errorf("expected city_update, got %s", msg.Type)
	}
}

func TestHubBroadcast(t *testing.T) {
	h := newHub([]string{"*"})

	msg := WSOutgoing{
		Type: "city_update",
		Data: &CityUpdate{CityID: "test", TotalClicks: 1, ContributorCount: 1},
	}

	// Should not panic with no clients
	h.broadcast(msg)
}

func TestWSCityClickBroadcast(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "city-a", "CityA", "US", "US")
	seedTestCity(t, "city-b", "CityB", "US", "US")
	createUser("user-a1", "Alice", "city-a")
	createUser("user-a2", "Bob", "city-a")
	createUser("user-b1", "Charlie", "city-b")
	h := newHub([]string{"*"})

	r := chi.NewRouter()
	r.Get("/ws", h.handleWebSocket)
	srv := httptest.NewServer(r)
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Connect all three users
	dialWith := func(userID string) *websocket.Conn {
		conn, _, err := websocket.Dial(ctx, srv.URL+"/ws", &websocket.DialOptions{
			HTTPHeader: http.Header{"Cookie": []string{"user_id=" + userID}},
		})
		if err != nil {
			t.Fatalf("dial %s: %v", userID, err)
		}
		return conn
	}

	connA1 := dialWith("user-a1")
	defer connA1.Close(websocket.StatusNormalClosure, "")
	connA2 := dialWith("user-a2")
	defer connA2.Close(websocket.StatusNormalClosure, "")
	connB1 := dialWith("user-b1")
	defer connB1.Close(websocket.StatusNormalClosure, "")

	// user-a1 sends a click
	clickMsg, _ := json.Marshal(WSIncoming{Type: "click"})
	if err := connA1.Write(ctx, websocket.MessageText, clickMsg); err != nil {
		t.Fatalf("write click: %v", err)
	}

	// user-a1 should get city_update (broadcast to all)
	readMsg := func(conn *websocket.Conn) WSOutgoing {
		rCtx, rCancel := context.WithTimeout(ctx, 3*time.Second)
		defer rCancel()
		_, data, err := conn.Read(rCtx)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		var msg WSOutgoing
		json.Unmarshal(data, &msg)
		return msg
	}

	msg1 := readMsg(connA1)
	if msg1.Type != "city_update" {
		t.Errorf("user-a1 expected city_update, got %s", msg1.Type)
	}

	// user-a2 (same city) should get city_update then city_click
	msg2 := readMsg(connA2)
	if msg2.Type != "city_update" {
		t.Errorf("user-a2 first msg expected city_update, got %s", msg2.Type)
	}
	msg3 := readMsg(connA2)
	if msg3.Type != "city_click" {
		t.Errorf("user-a2 second msg expected city_click, got %s", msg3.Type)
	}

	// user-b1 (different city) should get city_update but NOT city_click
	msg4 := readMsg(connB1)
	if msg4.Type != "city_update" {
		t.Errorf("user-b1 expected city_update, got %s", msg4.Type)
	}

	// Verify no additional message for user-b1 within a short timeout
	shortCtx, shortCancel := context.WithTimeout(ctx, 200*time.Millisecond)
	defer shortCancel()
	_, _, err := connB1.Read(shortCtx)
	if err == nil {
		t.Error("user-b1 should not have received city_click")
	}
}
