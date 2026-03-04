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

func TestWSRejectsUnauthenticated(t *testing.T) {
	setupTestDB(t)
	h := newHub([]string{"*"})

	r := chi.NewRouter()
	r.Get("/ws", h.handleWebSocket)
	srv := httptest.NewServer(r)
	defer srv.Close()

	// Attempt to connect without cookie
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, resp, err := websocket.Dial(ctx, srv.URL+"/ws", nil)
	if err == nil {
		t.Fatal("expected connection to be rejected")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
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
