package main

import (
	"log/slog"

	"github.com/google/uuid"
)

// checkCumulativeAchievements returns names of newly earned cumulative achievements.
func checkCumulativeAchievements(user *User) []string {
	var earned []string
	totalClicks := user.TotalClicks
	lastThreshold := user.LastCumulativeThreshold

	// "A Good Start" at 200
	if totalClicks >= 200 && lastThreshold < 200 {
		earned = append(earned, "A Good Start")
		lastThreshold = 200
	}

	// "New Champion" at 1000
	if totalClicks >= 1000 && lastThreshold < 1000 {
		earned = append(earned, "New Champion")
		lastThreshold = 1000
	}

	// "Local Hero" every 5000 starting at 5000
	if totalClicks >= 5000 {
		nextHeroThreshold := 5000
		if lastThreshold >= 5000 {
			nextHeroThreshold = ((lastThreshold / 5000) + 1) * 5000
		}
		for int64(nextHeroThreshold) <= totalClicks {
			earned = append(earned, "Local Hero")
			lastThreshold = nextHeroThreshold
			nextHeroThreshold += 5000
		}
	}

	if lastThreshold != user.LastCumulativeThreshold {
		db.Exec(`UPDATE users SET last_cumulative_threshold = ? WHERE id = ?`, lastThreshold, user.ID)
	}

	return earned
}

// awardAchievementMissile awards a role-specific missile for an achievement.
// Builders get Imp I, Warriors get Titan I. Replaces any existing unfired achievement missile.
func awardAchievementMissile(userID, role string) *Missile {
	// Delete existing unfired achievement missile
	result, _ := db.Exec(`DELETE FROM missiles WHERE user_id = ? AND source = 'achievement' AND fired = 0`, userID)
	deletedRows, _ := result.RowsAffected()
	if deletedRows > 0 {
		updateCityStockpile(userID, -1)
	}

	// Role-specific missile type per spec
	var typeName string
	switch role {
	case "warrior":
		typeName = "Titan I"
	default:
		typeName = "Imp I"
	}

	selectedType := getMissileTypeDef(typeName)
	if selectedType == nil {
		return nil
	}

	missile := &Missile{
		ID:          uuid.New().String(),
		UserID:      userID,
		MissileType: selectedType.Name,
		Source:       "achievement",
		RangeKM:     selectedType.RangeKM,
		DamageLower: selectedType.DamageLower,
		DamageUpper: selectedType.DamageUpper,
	}

	_, err := db.Exec(`INSERT INTO missiles (id, user_id, missile_type, source, range_km, damage_lower, damage_upper)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		missile.ID, missile.UserID, missile.MissileType, missile.Source, missile.RangeKM, missile.DamageLower, missile.DamageUpper)
	if err != nil {
		slog.Error("failed to insert achievement missile", "error", err)
		return nil
	}

	updateCityStockpile(userID, +1)
	return missile
}

// updateUserBest10s atomically updates the user's best 10-second score if beaten.
func updateUserBest10s(userID string, count int) (bool, error) {
	result, err := db.Exec(`UPDATE users SET best_10s = ? WHERE id = ? AND COALESCE(best_10s, 0) < ?`, count, userID, count)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// updateUserBest1Day atomically updates the user's best 1-day score if beaten.
func updateUserBest1Day(userID string, count int) (bool, error) {
	result, err := db.Exec(`UPDATE users SET best_1day = ? WHERE id = ? AND COALESCE(best_1day, 0) < ?`, count, userID, count)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
