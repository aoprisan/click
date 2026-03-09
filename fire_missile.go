package main

import (
	"database/sql"
	"encoding/json"
	"math/rand"
	"net/http"

	"github.com/go-chi/chi/v5"
)


// handleFireMissile processes a missile fire request.
func (h *hub) handleFireMissile(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}

	missileID := chi.URLParam(r, "id")

	var req struct {
		TargetCityID string `json:"targetCityId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	// Get the missile
	m, err := scanMissile(db.QueryRow(`SELECT `+missileCols+` FROM missiles WHERE id = ?`, missileID))
	if err == sql.ErrNoRows {
		http.Error(w, "missile not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Validate ownership
	if m.UserID != cookie.Value {
		http.Error(w, "not your missile", http.StatusForbidden)
		return
	}

	// Already fired?
	if m.Fired {
		http.Error(w, "missile already fired", http.StatusBadRequest)
		return
	}

	// Get attacker's home city
	user, err := getUser(cookie.Value)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Get source city coords and name
	var fromLat, fromLng float64
	var fromCityName string
	err = db.QueryRow(`SELECT lat, lng, name FROM cities WHERE id = ?`, user.CityID).Scan(&fromLat, &fromLng, &fromCityName)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Get target city
	var toLat, toLng float64
	var targetName string
	err = db.QueryRow(`SELECT lat, lng, name FROM cities WHERE id = ?`, req.TargetCityID).Scan(&toLat, &toLng, &targetName)
	if err == sql.ErrNoRows {
		http.Error(w, "target city not found", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Check range
	dist := haversineDistance(fromLat, fromLng, toLat, toLng)
	if dist > float64(m.RangeKM) {
		http.Error(w, "target out of range", http.StatusBadRequest)
		return
	}

	// Calculate damage
	damage := m.DamageLower + rand.Intn(m.DamageUpper-m.DamageLower+1)

	// Apply damage in transaction
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Mark missile as fired
	if _, err := tx.Exec(`UPDATE missiles SET fired = 1, fired_at = CURRENT_TIMESTAMP, target_city_id = ?, damage_dealt = ? WHERE id = ?`,
		req.TargetCityID, damage, m.ID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Subtract population (floor at 0)
	if _, err := tx.Exec(`UPDATE cities SET total_clicks = MAX(0, total_clicks - ?), total_dead = total_dead + ? WHERE id = ?`,
		damage, damage, req.TargetCityID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Increment attacker's kills
	if _, err := tx.Exec(`UPDATE users SET total_kills = total_kills + ? WHERE id = ?`, damage, user.ID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Decrement attacker's city missile stockpile
	if _, err := tx.Exec(`UPDATE cities SET missile_stockpile = MAX(0, missile_stockpile - 1) WHERE id = (SELECT city_id FROM users WHERE id = ?)`, user.ID); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// If this was a click missile, reset click_missile_clicks
	if m.Source == "click" {
		if _, err := tx.Exec(`UPDATE users SET click_missile_clicks = 0 WHERE id = ?`, user.ID); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Get updated target city stats for broadcast
	var update CityUpdate
	update.CityID = req.TargetCityID
	db.QueryRow(`SELECT total_clicks, contributor_count, COALESCE(highest_ever_population, 0) FROM cities WHERE id = ?`, req.TargetCityID).
		Scan(&update.TotalClicks, &update.ContributorCount, &update.HighestEverPopulation)

	// Broadcast missile strike to all clients
	strike := MissileStrike{
		AttackerName:     user.Name,
		AttackerCityName: fromCityName,
		TargetCityID:     req.TargetCityID,
		MissileType:  m.MissileType,
		Damage:       damage,
		FromLat:      fromLat,
		FromLng:      fromLng,
		ToLat:        toLat,
		ToLng:        toLng,
	}
	h.broadcast(WSOutgoing{Type: "missile_strike", Data: strike})

	// Broadcast city update
	h.broadcast(WSOutgoing{Type: "city_update", Data: update})

	// Notify target city clients
	h.broadcastToCity(WSOutgoing{
		Type: "missile_incoming",
		Data: strike,
	}, req.TargetCityID, nil)

	writeJSON(w, map[string]interface{}{
		"damage":      damage,
		"missileType": m.MissileType,
		"targetCity":  targetName,
	})
}
