package main

import (
	"database/sql"
	"fmt"
	"log/slog"
)

// runMigrations applies all pending schema migrations sequentially.
func runMigrations() error {
	// Ensure schema_version table exists
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`); err != nil {
		return fmt.Errorf("create schema_version: %w", err)
	}

	var version int
	err := db.QueryRow(`SELECT version FROM schema_version LIMIT 1`).Scan(&version)
	if err == sql.ErrNoRows {
		if _, err := db.Exec(`INSERT INTO schema_version (version) VALUES (0)`); err != nil {
			return fmt.Errorf("init schema_version: %w", err)
		}
		version = 0
	} else if err != nil {
		return fmt.Errorf("read schema_version: %w", err)
	}

	migrations := []func(*sql.Tx) error{
		migration1,
	}

	for i, migrate := range migrations {
		targetVersion := i + 1
		if version >= targetVersion {
			continue
		}

		slog.Info("Running migration", "version", targetVersion)
		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("begin migration %d: %w", targetVersion, err)
		}

		if err := migrate(tx); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d failed: %w", targetVersion, err)
		}

		if _, err := tx.Exec(`UPDATE schema_version SET version = ?`, targetVersion); err != nil {
			tx.Rollback()
			return fmt.Errorf("update schema_version to %d: %w", targetVersion, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %d: %w", targetVersion, err)
		}

		slog.Info("Migration complete", "version", targetVersion)
		version = targetVersion
	}

	return nil
}

// hasColumn checks if a table already has a specific column.
func hasColumn(tx *sql.Tx, table, column string) bool {
	rows, err := tx.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull int
		var dfltValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			continue
		}
		if name == column {
			return true
		}
	}
	return false
}

// addColumnIfNotExists safely adds a column to a table.
func addColumnIfNotExists(tx *sql.Tx, table, column, definition string) error {
	if hasColumn(tx, table, column) {
		return nil
	}
	_, err := tx.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition))
	return err
}

// migration1: Phase 1 - Add new columns to cities/users, create new tables.
func migration1(tx *sql.Tx) error {
	// Cities: new columns
	if err := addColumnIfNotExists(tx, "cities", "highest_ever_population", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "cities", "total_dead", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "cities", "missile_stockpile", "INTEGER DEFAULT 0"); err != nil {
		return err
	}

	// Users: new columns
	if err := addColumnIfNotExists(tx, "users", "role", "TEXT DEFAULT 'builder'"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "users", "total_kills", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "users", "best_10s", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "users", "best_1day", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "users", "last_10s_reset", "DATETIME"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "users", "last_1day_reset", "DATETIME"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "users", "click_missile_clicks", "INTEGER DEFAULT 0"); err != nil {
		return err
	}
	if err := addColumnIfNotExists(tx, "users", "last_cumulative_threshold", "INTEGER DEFAULT 0"); err != nil {
		return err
	}

	// Missiles table
	if _, err := tx.Exec(`CREATE TABLE IF NOT EXISTS missiles (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id),
		missile_type TEXT NOT NULL,
		source TEXT NOT NULL,
		range_km INTEGER NOT NULL,
		damage_lower INTEGER NOT NULL,
		damage_upper INTEGER NOT NULL,
		fired INTEGER DEFAULT 0,
		fired_at DATETIME,
		target_city_id TEXT,
		damage_dealt INTEGER DEFAULT 0
	)`); err != nil {
		return err
	}

	// Subscriptions table
	if _, err := tx.Exec(`CREATE TABLE IF NOT EXISTS subscriptions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id),
		plan TEXT NOT NULL,
		started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME NOT NULL
	)`); err != nil {
		return err
	}

	// City snapshots table for daily % change
	if _, err := tx.Exec(`CREATE TABLE IF NOT EXISTS city_snapshots (
		city_id TEXT NOT NULL REFERENCES cities(id),
		snapshot_date TEXT NOT NULL,
		population INTEGER NOT NULL,
		PRIMARY KEY (city_id, snapshot_date)
	)`); err != nil {
		return err
	}

	// Indexes
	if _, err := tx.Exec(`CREATE INDEX IF NOT EXISTS idx_missiles_user ON missiles(user_id)`); err != nil {
		return err
	}
	if _, err := tx.Exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`); err != nil {
		return err
	}
	if _, err := tx.Exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_date ON city_snapshots(snapshot_date)`); err != nil {
		return err
	}

	// Initialize highest_ever_population from current total_clicks
	if _, err := tx.Exec(`UPDATE cities SET highest_ever_population = total_clicks WHERE highest_ever_population = 0 AND total_clicks > 0`); err != nil {
		return err
	}

	return nil
}
