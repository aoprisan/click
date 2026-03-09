package main

import (
	"database/sql"
	"log/slog"

	"github.com/google/uuid"
)

// checkClickMissiles checks if a warrior has earned or upgraded a click missile.
func (h *hub) checkClickMissiles(c *client, user *User) {
	// Increment click_missile_clicks
	_, err := db.Exec(`UPDATE users SET click_missile_clicks = click_missile_clicks + 1 WHERE id = ?`, user.ID)
	if err != nil {
		return
	}

	var clickMissileClicks int
	db.QueryRow(`SELECT click_missile_clicks FROM users WHERE id = ?`, user.ID).Scan(&clickMissileClicks)

	// Find the highest threshold reached
	var targetType string
	for _, threshold := range clickMissileThresholds {
		if clickMissileClicks >= threshold.Clicks {
			targetType = threshold.Type
		}
	}

	if targetType == "" {
		return // Haven't reached any threshold yet
	}

	// Check existing unfired click missile
	existing, err := getUserUnfiredMissileBySource(user.ID, "click")
	if err == sql.ErrNoRows {
		// No existing click missile - create one
		mt := getMissileTypeDef(targetType)
		if mt == nil {
			return
		}

		missile := Missile{
			ID:          uuid.New().String(),
			UserID:      user.ID,
			MissileType: mt.Name,
			Source:       "click",
			RangeKM:     mt.RangeKM,
			DamageLower: mt.DamageLower,
			DamageUpper: mt.DamageUpper,
		}

		_, err = db.Exec(`INSERT INTO missiles (id, user_id, missile_type, source, range_km, damage_lower, damage_upper)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			missile.ID, missile.UserID, missile.MissileType, missile.Source, missile.RangeKM, missile.DamageLower, missile.DamageUpper)
		if err != nil {
			slog.Error("failed to insert click missile", "error", err)
			return
		}

		updateCityStockpile(user.ID, +1)

		h.sendToClient(WSOutgoing{
			Type: "missile_awarded",
			Data: map[string]interface{}{
				"missileType": mt.Name,
				"source":      "click",
			},
		}, c)
		return
	}

	if err != nil {
		return
	}

	// Existing click missile - upgrade if target type is different
	if existing.MissileType == targetType {
		return // Already at this level
	}

	mt := getMissileTypeDef(targetType)
	if mt == nil {
		return
	}

	_, err = db.Exec(`UPDATE missiles SET missile_type = ?, range_km = ?, damage_lower = ?, damage_upper = ? WHERE id = ?`,
		mt.Name, mt.RangeKM, mt.DamageLower, mt.DamageUpper, existing.ID)
	if err != nil {
		slog.Error("failed to upgrade click missile", "error", err)
		return
	}

	h.sendToClient(WSOutgoing{
		Type: "missile_upgraded",
		Data: map[string]interface{}{
			"missileType": mt.Name,
			"source":      "click",
		},
	}, c)
}
