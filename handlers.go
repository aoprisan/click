package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const cookieName = "user_id"

func handleGetCities(w http.ResponseWriter, r *http.Request) {
	cities, err := getAllCities()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, cities)
}

func handleGetCity(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	detail, err := getCityDetail(id)
	if err == sql.ErrNoRows {
		http.Error(w, "city not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, detail)
}

func handleGetLeaderboard(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 10
	if n, err := strconv.Atoi(limitStr); err == nil && n > 0 && n <= 100 {
		limit = n
	}

	cities, err := getLeaderboard(limit)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, cities)
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 30 {
		http.Error(w, "name must be 1-30 characters", http.StatusBadRequest)
		return
	}
	if !cityExists(req.CityID) {
		http.Error(w, "invalid city", http.StatusBadRequest)
		return
	}

	userID := uuid.New().String()
	if err := createUser(userID, req.Name, req.CityID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    userID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   365 * 24 * 60 * 60,
	})

	writeJSON(w, RegisterResponse{
		UserID: userID,
		Name:   req.Name,
		CityID: req.CityID,
	})
}

func handleGetMe(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}

	user, err := getUser(cookie.Value)
	if err == sql.ErrNoRows {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, user)
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
