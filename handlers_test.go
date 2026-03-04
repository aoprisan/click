package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func newTestRouter() *chi.Mux {
	r := chi.NewRouter()
	r.Route("/api", func(r chi.Router) {
		r.Get("/cities", handleGetCities)
		r.Get("/cities/{id}", handleGetCity)
		r.Get("/leaderboard", handleGetLeaderboard)
		r.Post("/register", handleRegister)
		r.Get("/me", handleGetMe)
	})
	return r
}

func TestHandleGetCities(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "a-us", "CityA", "US", "US")

	r := newTestRouter()
	req := httptest.NewRequest("GET", "/api/cities", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var cities []City
	if err := json.Unmarshal(w.Body.Bytes(), &cities); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(cities) != 1 {
		t.Errorf("expected 1 city, got %d", len(cities))
	}
}

func TestHandleGetCity(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "berlin-de", "Berlin", "Germany", "DE")

	r := newTestRouter()

	// Found
	req := httptest.NewRequest("GET", "/api/cities/berlin-de", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// Not found
	req = httptest.NewRequest("GET", "/api/cities/nonexistent", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandleGetLeaderboard(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "a-us", "CityA", "US", "US")

	r := newTestRouter()

	// Default limit
	req := httptest.NewRequest("GET", "/api/leaderboard", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// Custom limit
	req = httptest.NewRequest("GET", "/api/leaderboard?limit=5", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandleRegister(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "rome-it", "Rome", "Italy", "IT")

	r := newTestRouter()

	// Valid registration
	body, _ := json.Marshal(RegisterRequest{Name: "TestUser", CityID: "rome-it"})
	req := httptest.NewRequest("POST", "/api/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp RegisterResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Name != "TestUser" || resp.CityID != "rome-it" || resp.UserID == "" {
		t.Errorf("unexpected response: %+v", resp)
	}

	// Should have set a cookie
	cookies := w.Result().Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == cookieName {
			found = true
			if c.Value != resp.UserID {
				t.Errorf("cookie value mismatch: %s != %s", c.Value, resp.UserID)
			}
		}
	}
	if !found {
		t.Error("expected user_id cookie to be set")
	}
}

func TestHandleRegisterValidation(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "rome-it", "Rome", "Italy", "IT")

	r := newTestRouter()

	tests := []struct {
		name string
		body RegisterRequest
		code int
	}{
		{"empty name", RegisterRequest{Name: "", CityID: "rome-it"}, http.StatusBadRequest},
		{"name too long", RegisterRequest{Name: "a very long name that exceeds the thirty character limit for sure", CityID: "rome-it"}, http.StatusBadRequest},
		{"invalid city", RegisterRequest{Name: "Bob", CityID: "fake-xx"}, http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest("POST", "/api/register", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.code {
				t.Errorf("expected %d, got %d: %s", tc.code, w.Code, w.Body.String())
			}
		})
	}
}

func TestHandleRegisterInvalidJSON(t *testing.T) {
	setupTestDB(t)

	r := newTestRouter()
	req := httptest.NewRequest("POST", "/api/register", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleGetMe(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "rome-it", "Rome", "Italy", "IT")
	createUser("u1", "Alice", "rome-it")

	r := newTestRouter()

	// No cookie → 401
	req := httptest.NewRequest("GET", "/api/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}

	// Invalid cookie → 401
	req = httptest.NewRequest("GET", "/api/me", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: "nonexistent"})
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid user, got %d", w.Code)
	}

	// Valid cookie → 200
	req = httptest.NewRequest("GET", "/api/me", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: "u1"})
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var user User
	json.Unmarshal(w.Body.Bytes(), &user)
	if user.Name != "Alice" {
		t.Errorf("expected Alice, got %s", user.Name)
	}
}
