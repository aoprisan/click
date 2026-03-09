package main

import (
	"log/slog"
	"time"
)

// startSnapshotWorker runs a background goroutine that takes daily city population snapshots.
func startSnapshotWorker() {
	// Take initial snapshot on startup if none exists for today
	takeSnapshotIfNeeded()

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			takeSnapshotIfNeeded()
		}
	}()
}

func takeSnapshotIfNeeded() {
	today := time.Now().UTC().Format("2006-01-02")

	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM city_snapshots WHERE snapshot_date = ?`, today).Scan(&count)
	if err != nil {
		slog.Error("snapshot check failed", "error", err)
		return
	}
	if count > 0 {
		return
	}

	slog.Info("Taking daily city snapshot", "date", today)

	_, err = db.Exec(`INSERT INTO city_snapshots (city_id, snapshot_date, population)
		SELECT id, ?, total_clicks FROM cities WHERE total_clicks > 0`, today)
	if err != nil {
		slog.Error("snapshot insert failed", "error", err)
	}
}

// getDailyChangePercent returns the % change in population for a city compared to yesterday.
func getDailyChangePercent(cityID string) float64 {
	today := time.Now().UTC().Format("2006-01-02")
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")

	var todayPop, yesterdayPop int64
	err := db.QueryRow(`SELECT COALESCE((SELECT population FROM city_snapshots WHERE city_id = ? AND snapshot_date = ?), 0)`, cityID, today).Scan(&todayPop)
	if err != nil {
		return 0
	}
	err = db.QueryRow(`SELECT COALESCE((SELECT population FROM city_snapshots WHERE city_id = ? AND snapshot_date = ?), 0)`, cityID, yesterday).Scan(&yesterdayPop)
	if err != nil || yesterdayPop == 0 {
		return 0
	}

	return float64(todayPop-yesterdayPop) / float64(yesterdayPop) * 100
}

// getGlobalDailyChangePercent returns the % change in average city population compared to yesterday.
func getGlobalDailyChangePercent() float64 {
	today := time.Now().UTC().Format("2006-01-02")
	yesterday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")

	var avgToday, avgYesterday float64
	db.QueryRow(`SELECT COALESCE(AVG(population), 0) FROM city_snapshots WHERE snapshot_date = ?`, today).Scan(&avgToday)
	db.QueryRow(`SELECT COALESCE(AVG(population), 0) FROM city_snapshots WHERE snapshot_date = ?`, yesterday).Scan(&avgYesterday)

	if avgYesterday == 0 {
		return 0
	}
	return (avgToday - avgYesterday) / avgYesterday * 100
}
