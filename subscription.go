package main

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// planDuration returns the duration for a subscription plan.
func planDuration(plan string) time.Duration {
	switch plan {
	case "monthly":
		return 30 * 24 * time.Hour
	default:
		return 7 * 24 * time.Hour
	}
}

// createSubscription creates a new subscription and upgrades the user to warrior.
func createSubscription(userID, plan string) (*Subscription, error) {
	if plan != "weekly" && plan != "monthly" {
		plan = "weekly"
	}
	duration := planDuration(plan)

	now := time.Now().UTC()
	sub := &Subscription{
		ID:        uuid.New().String(),
		UserID:    userID,
		Plan:      plan,
		StartedAt: now,
		ExpiresAt: now.Add(duration),
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO subscriptions (id, user_id, plan, started_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
		sub.ID, sub.UserID, sub.Plan, sub.StartedAt, sub.ExpiresAt); err != nil {
		return nil, err
	}

	// Upgrade role to warrior and reset timed achievement bests
	if _, err := tx.Exec(`UPDATE users SET role = 'warrior', best_10s = 0, best_1day = 0, click_missile_clicks = 0 WHERE id = ?`, userID); err != nil {
		return nil, err
	}

	return sub, tx.Commit()
}

// renewSubscription renews an existing subscription with optional early renewal discount.
func renewSubscription(userID string) (*Subscription, error) {
	// Find the latest subscription
	var currentExpires time.Time
	var plan string
	err := db.QueryRow(`SELECT plan, expires_at FROM subscriptions WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1`, userID).
		Scan(&plan, &currentExpires)
	if err != nil {
		return nil, err
	}

	duration := planDuration(plan)

	now := time.Now().UTC()
	var startFrom time.Time
	if currentExpires.After(now) {
		startFrom = currentExpires // Stack on top of existing

		// Early renewal discount: 20% more time if renewing within 48h of expiry
		if time.Until(currentExpires) <= 48*time.Hour {
			duration = duration + duration/5
		}
	} else {
		startFrom = now
	}

	sub := &Subscription{
		ID:        uuid.New().String(),
		UserID:    userID,
		Plan:      plan,
		StartedAt: now,
		ExpiresAt: startFrom.Add(duration),
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO subscriptions (id, user_id, plan, started_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
		sub.ID, sub.UserID, sub.Plan, sub.StartedAt, sub.ExpiresAt); err != nil {
		return nil, err
	}

	// Reset timed achievement bests and click missile progress on renewal
	if _, err := tx.Exec(`UPDATE users SET role = 'warrior', best_10s = 0, best_1day = 0, click_missile_clicks = 0 WHERE id = ?`, userID); err != nil {
		return nil, err
	}

	return sub, tx.Commit()
}

// startSubscriptionExpiryChecker runs a background goroutine that downgrades expired warriors.
func startSubscriptionExpiryChecker() {
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			checkExpiredSubscriptions()
		}
	}()
}

func checkExpiredSubscriptions() {
	now := time.Now().UTC()

	// Find warriors whose latest subscription has expired
	rows, err := db.Query(`SELECT u.id FROM users u
		WHERE u.role = 'warrior'
		AND NOT EXISTS (
			SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.expires_at > ?
		)`, now)
	if err != nil {
		slog.Error("subscription expiry check failed", "error", err)
		return
	}
	defer rows.Close()

	var expiredUsers []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		expiredUsers = append(expiredUsers, userID)
	}

	for _, userID := range expiredUsers {
		// Downgrade to builder
		if _, err := db.Exec(`UPDATE users SET role = 'builder' WHERE id = ?`, userID); err != nil {
			slog.Error("failed to downgrade user", "error", err, "user", userID)
			continue
		}
		// Remove unfired click missile
		db.Exec(`DELETE FROM missiles WHERE user_id = ? AND source = 'click' AND fired = 0`, userID)
		// Reset click_missile_clicks
		db.Exec(`UPDATE users SET click_missile_clicks = 0 WHERE id = ?`, userID)

		slog.Info("Downgraded expired warrior", "user", userID)
	}
}

// getUserSubscription returns the user's active subscription, if any.
func getUserSubscription(userID string) (*Subscription, error) {
	var sub Subscription
	err := db.QueryRow(`SELECT id, user_id, plan, started_at, expires_at FROM subscriptions
		WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1`, userID).
		Scan(&sub.ID, &sub.UserID, &sub.Plan, &sub.StartedAt, &sub.ExpiresAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func handleSubscribe(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}

	var req struct {
		Plan string `json:"plan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Plan = "weekly"
	}

	sub, err := createSubscription(cookie.Value, req.Plan)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, sub)
}

func handleGetSubscription(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}

	sub, err := getUserSubscription(cookie.Value)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if sub == nil {
		writeJSON(w, nil)
		return
	}
	writeJSON(w, sub)
}

func handleRenewSubscription(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		http.Error(w, "not registered", http.StatusUnauthorized)
		return
	}

	sub, err := renewSubscription(cookie.Value)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, sub)
}
