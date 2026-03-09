package main

import (
	"database/sql"
	"fmt"
	"log/slog"

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

	if err := createSchema(); err != nil {
		return err
	}

	return runMigrations()
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

const cityCols = `id, name, country, country_code, lat, lng, total_clicks, contributor_count, COALESCE(highest_ever_population, 0), COALESCE(total_dead, 0), COALESCE(missile_stockpile, 0)`

func scanCity(scanner interface{ Scan(...interface{}) error }) (City, error) {
	var c City
	err := scanner.Scan(&c.ID, &c.Name, &c.Country, &c.CountryCode, &c.Lat, &c.Lng, &c.TotalClicks, &c.ContributorCount, &c.HighestEverPopulation, &c.TotalDead, &c.MissileStockpile)
	return c, err
}

// getAllCities returns all cities ordered by total clicks descending.
func getAllCities() ([]City, error) {
	rows, err := db.Query(`SELECT ` + cityCols + ` FROM cities ORDER BY total_clicks DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cities := make([]City, 0)
	for rows.Next() {
		c, err := scanCity(rows)
		if err != nil {
			return nil, err
		}
		cities = append(cities, c)
	}
	return cities, rows.Err()
}

// getCityDetail returns a single city with its top 10 contributors.
func getCityDetail(cityID string) (*CityDetail, error) {
	c, err := scanCity(db.QueryRow(`SELECT `+cityCols+` FROM cities WHERE id = ?`, cityID))
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
	rows, err := db.Query(`SELECT `+cityCols+` FROM cities WHERE total_clicks > 0 ORDER BY total_clicks DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cities := make([]City, 0)
	for rows.Next() {
		c, err := scanCity(rows)
		if err != nil {
			return nil, err
		}
		cities = append(cities, c)
	}
	return cities, rows.Err()
}

const userCols = `id, name, city_id, total_clicks, created_at, last_click_at, COALESCE(role, 'builder'), COALESCE(total_kills, 0), COALESCE(best_10s, 0), COALESCE(best_1day, 0), COALESCE(click_missile_clicks, 0), COALESCE(last_cumulative_threshold, 0)`

func scanUser(scanner interface{ Scan(...interface{}) error }) (*User, error) {
	var u User
	var lastClick sql.NullTime
	err := scanner.Scan(&u.ID, &u.Name, &u.CityID, &u.TotalClicks, &u.CreatedAt, &lastClick,
		&u.Role, &u.TotalKills, &u.Best10s, &u.Best1Day, &u.ClickMissileClicks, &u.LastCumulativeThreshold)
	if err != nil {
		return nil, err
	}
	if lastClick.Valid {
		u.LastClickAt = &lastClick.Time
	}
	return &u, nil
}

// getUser returns a user by ID.
func getUser(userID string) (*User, error) {
	return scanUser(db.QueryRow(`SELECT `+userCols+` FROM users WHERE id = ?`, userID))
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

// recordClick atomically increments user + city click counts. multiplier is 1 for builders, 2 for warriors.
// Returns updated city stats.
func recordClick(userID, cityID string, multiplier int) (*CityUpdate, error) {
	if multiplier < 1 {
		multiplier = 1
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE users SET total_clicks = total_clicks + ?, last_click_at = CURRENT_TIMESTAMP WHERE id = ?`, multiplier, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(`UPDATE cities SET total_clicks = total_clicks + ?, highest_ever_population = MAX(COALESCE(highest_ever_population, 0), total_clicks + ?) WHERE id = ?`, multiplier, multiplier, cityID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	var update CityUpdate
	update.CityID = cityID
	err = db.QueryRow(`SELECT total_clicks, contributor_count, COALESCE(highest_ever_population, 0) FROM cities WHERE id = ?`, cityID).
		Scan(&update.TotalClicks, &update.ContributorCount, &update.HighestEverPopulation)
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
		slog.Warn("cityExists check failed", "error", err, "cityId", cityID)
		return false
	}
	return true
}

// getGlobalStats returns aggregated world statistics.
func getGlobalStats() (*GlobalStats, error) {
	var stats GlobalStats

	err := db.QueryRow(`SELECT COALESCE(SUM(total_clicks), 0), COUNT(*) FROM cities WHERE total_clicks > 0`).
		Scan(&stats.WorldPopulation, &stats.CityCount)
	if err != nil {
		return nil, err
	}

	if stats.CityCount > 0 {
		stats.AvgPopulation = float64(stats.WorldPopulation) / float64(stats.CityCount)
	}

	// Highest ever city
	err = db.QueryRow(`SELECT COALESCE(name, ''), COALESCE(highest_ever_population, 0) FROM cities ORDER BY highest_ever_population DESC LIMIT 1`).
		Scan(&stats.HighestEverCity, &stats.HighestEverPop)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// World missile stockpile
	db.QueryRow(`SELECT COALESCE(SUM(missile_stockpile), 0) FROM cities`).Scan(&stats.WorldMissileStockpile)

	stats.DailyChangePercent = getGlobalDailyChangePercent()

	return &stats, nil
}

const missileCols = `id, user_id, missile_type, source, range_km, damage_lower, damage_upper, fired, fired_at, target_city_id, damage_dealt`

func scanMissile(scanner interface{ Scan(...interface{}) error }) (Missile, error) {
	var m Missile
	var firedInt int
	var firedAt sql.NullTime
	var targetCity sql.NullString
	err := scanner.Scan(&m.ID, &m.UserID, &m.MissileType, &m.Source, &m.RangeKM, &m.DamageLower, &m.DamageUpper,
		&firedInt, &firedAt, &targetCity, &m.DamageDealt)
	if err != nil {
		return m, err
	}
	m.Fired = firedInt != 0
	if firedAt.Valid {
		m.FiredAt = &firedAt.Time
	}
	if targetCity.Valid {
		m.TargetCityID = &targetCity.String
	}
	return m, nil
}

// getUserUnfiredMissiles returns all unfired missiles for a user.
func getUserUnfiredMissiles(userID string) ([]Missile, error) {
	rows, err := db.Query(`SELECT `+missileCols+` FROM missiles WHERE user_id = ? AND fired = 0`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	missiles := make([]Missile, 0)
	for rows.Next() {
		m, err := scanMissile(rows)
		if err != nil {
			return nil, err
		}
		missiles = append(missiles, m)
	}
	return missiles, rows.Err()
}

// getUserUnfiredMissileBySource returns a user's unfired missile from a specific source.
func getUserUnfiredMissileBySource(userID, source string) (*Missile, error) {
	m, err := scanMissile(db.QueryRow(`SELECT `+missileCols+` FROM missiles WHERE user_id = ? AND source = ? AND fired = 0 LIMIT 1`, userID, source))
	if err != nil {
		return nil, err
	}
	return &m, nil
}
