package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func initDB(path string) error {
	var err error
	db, err = sql.Open("sqlite", path)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}

	// WAL mode for better concurrent reads
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return fmt.Errorf("set WAL: %w", err)
	}
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		return fmt.Errorf("set busy_timeout: %w", err)
	}

	return createSchema()
}

func createSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS cities (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		country TEXT NOT NULL,
		country_code TEXT NOT NULL,
		lat REAL NOT NULL,
		lng REAL NOT NULL,
		total_clicks INTEGER DEFAULT 0,
		contributor_count INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		city_id TEXT NOT NULL REFERENCES cities(id),
		total_clicks INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		last_click_at DATETIME
	);

	CREATE INDEX IF NOT EXISTS idx_users_city ON users(city_id);
	CREATE INDEX IF NOT EXISTS idx_cities_clicks ON cities(total_clicks DESC);
	`
	_, err := db.Exec(schema)
	return err
}

// getAllCities returns all cities ordered by total clicks descending.
func getAllCities() ([]City, error) {
	rows, err := db.Query(`SELECT id, name, country, country_code, lat, lng, total_clicks, contributor_count FROM cities ORDER BY total_clicks DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cities := make([]City, 0)
	for rows.Next() {
		var c City
		if err := rows.Scan(&c.ID, &c.Name, &c.Country, &c.CountryCode, &c.Lat, &c.Lng, &c.TotalClicks, &c.ContributorCount); err != nil {
			return nil, err
		}
		cities = append(cities, c)
	}
	return cities, rows.Err()
}

// getCityDetail returns a single city with its top 10 contributors.
func getCityDetail(cityID string) (*CityDetail, error) {
	var c City
	err := db.QueryRow(`SELECT id, name, country, country_code, lat, lng, total_clicks, contributor_count FROM cities WHERE id = ?`, cityID).
		Scan(&c.ID, &c.Name, &c.Country, &c.CountryCode, &c.Lat, &c.Lng, &c.TotalClicks, &c.ContributorCount)
	if err != nil {
		return nil, err
	}

	rows, err := db.Query(`SELECT name, total_clicks FROM users WHERE city_id = ? AND total_clicks > 0 ORDER BY total_clicks DESC LIMIT 10`, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	contributors := make([]Contributor, 0)
	for rows.Next() {
		var co Contributor
		if err := rows.Scan(&co.Name, &co.TotalClicks); err != nil {
			return nil, err
		}
		contributors = append(contributors, co)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &CityDetail{City: c, TopContributors: contributors}, nil
}

// getLeaderboard returns the top N cities by total clicks.
func getLeaderboard(limit int) ([]City, error) {
	rows, err := db.Query(`SELECT id, name, country, country_code, lat, lng, total_clicks, contributor_count FROM cities WHERE total_clicks > 0 ORDER BY total_clicks DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cities := make([]City, 0)
	for rows.Next() {
		var c City
		if err := rows.Scan(&c.ID, &c.Name, &c.Country, &c.CountryCode, &c.Lat, &c.Lng, &c.TotalClicks, &c.ContributorCount); err != nil {
			return nil, err
		}
		cities = append(cities, c)
	}
	return cities, rows.Err()
}

// getUser returns a user by ID.
func getUser(userID string) (*User, error) {
	var u User
	var lastClick sql.NullTime
	err := db.QueryRow(`SELECT id, name, city_id, total_clicks, created_at, last_click_at FROM users WHERE id = ?`, userID).
		Scan(&u.ID, &u.Name, &u.CityID, &u.TotalClicks, &u.CreatedAt, &lastClick)
	if err != nil {
		return nil, err
	}
	if lastClick.Valid {
		u.LastClickAt = &lastClick.Time
	}
	return &u, nil
}

// createUser inserts a new user and increments the city's contributor count.
func createUser(id, name, cityID string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO users (id, name, city_id) VALUES (?, ?, ?)`, id, name, cityID); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE cities SET contributor_count = contributor_count + 1 WHERE id = ?`, cityID); err != nil {
		return err
	}
	return tx.Commit()
}

// recordClick atomically increments user + city click counts. Returns updated city stats.
func recordClick(userID, cityID string) (*CityUpdate, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE users SET total_clicks = total_clicks + 1, last_click_at = CURRENT_TIMESTAMP WHERE id = ?`, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(`UPDATE cities SET total_clicks = total_clicks + 1 WHERE id = ?`, cityID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	var update CityUpdate
	update.CityID = cityID
	err = db.QueryRow(`SELECT total_clicks, contributor_count FROM cities WHERE id = ?`, cityID).
		Scan(&update.TotalClicks, &update.ContributorCount)
	if err != nil {
		return nil, err
	}
	return &update, nil
}

// cityExists checks if a city ID is valid.
func cityExists(cityID string) bool {
	var exists int
	err := db.QueryRow(`SELECT 1 FROM cities WHERE id = ? LIMIT 1`, cityID).Scan(&exists)
	if err != nil {
		log.Printf("cityExists check: %v", err)
		return false
	}
	return true
}
