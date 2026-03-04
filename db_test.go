package main

import (
	"testing"
)

func setupTestDB(t *testing.T) {
	t.Helper()
	if err := initDB(":memory:"); err != nil {
		t.Fatalf("initDB: %v", err)
	}
	t.Cleanup(func() {
		db.Close()
	})
}

func seedTestCity(t *testing.T, id, name, country, code string) {
	t.Helper()
	_, err := db.Exec(`INSERT INTO cities (id, name, country, country_code, lat, lng) VALUES (?, ?, ?, ?, 0, 0)`, id, name, country, code)
	if err != nil {
		t.Fatalf("seed city %s: %v", id, err)
	}
}

func TestCreateSchema(t *testing.T) {
	setupTestDB(t)

	// Verify tables exist by querying them
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM cities`).Scan(&count); err != nil {
		t.Fatalf("cities table not created: %v", err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		t.Fatalf("users table not created: %v", err)
	}
}

func TestCreateUser(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "berlin-de", "Berlin", "Germany", "DE")

	if err := createUser("u1", "Alice", "berlin-de"); err != nil {
		t.Fatalf("createUser: %v", err)
	}

	// Verify user was created
	u, err := getUser("u1")
	if err != nil {
		t.Fatalf("getUser: %v", err)
	}
	if u.Name != "Alice" || u.CityID != "berlin-de" || u.TotalClicks != 0 {
		t.Errorf("unexpected user: %+v", u)
	}

	// Verify contributor count was incremented
	detail, err := getCityDetail("berlin-de")
	if err != nil {
		t.Fatalf("getCityDetail: %v", err)
	}
	if detail.ContributorCount != 1 {
		t.Errorf("expected contributor_count=1, got %d", detail.ContributorCount)
	}
}

func TestRecordClick(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "paris-fr", "Paris", "France", "FR")
	if err := createUser("u1", "Alice", "paris-fr"); err != nil {
		t.Fatal(err)
	}

	update, err := recordClick("u1", "paris-fr")
	if err != nil {
		t.Fatalf("recordClick: %v", err)
	}
	if update.TotalClicks != 1 {
		t.Errorf("expected city totalClicks=1, got %d", update.TotalClicks)
	}
	if update.ContributorCount != 1 {
		t.Errorf("expected contributorCount=1, got %d", update.ContributorCount)
	}

	// User clicks should also increment
	u, err := getUser("u1")
	if err != nil {
		t.Fatal(err)
	}
	if u.TotalClicks != 1 {
		t.Errorf("expected user totalClicks=1, got %d", u.TotalClicks)
	}

	// Multiple clicks
	for i := 0; i < 4; i++ {
		if _, err := recordClick("u1", "paris-fr"); err != nil {
			t.Fatal(err)
		}
	}
	update, _ = recordClick("u1", "paris-fr")
	if update.TotalClicks != 6 {
		t.Errorf("expected totalClicks=6, got %d", update.TotalClicks)
	}
}

func TestGetAllCities(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "a-us", "CityA", "US", "US")
	seedTestCity(t, "b-de", "CityB", "DE", "DE")

	cities, err := getAllCities()
	if err != nil {
		t.Fatal(err)
	}
	if len(cities) != 2 {
		t.Fatalf("expected 2 cities, got %d", len(cities))
	}
}

func TestGetLeaderboard(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "a-us", "CityA", "US", "US")
	seedTestCity(t, "b-de", "CityB", "DE", "DE")
	seedTestCity(t, "c-fr", "CityC", "FR", "FR")

	// No clicks yet — leaderboard should be empty
	lb, err := getLeaderboard(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(lb) != 0 {
		t.Errorf("expected empty leaderboard, got %d", len(lb))
	}

	// Add clicks to two cities
	if err := createUser("u1", "Alice", "b-de"); err != nil {
		t.Fatal(err)
	}
	if err := createUser("u2", "Bob", "a-us"); err != nil {
		t.Fatal(err)
	}
	recordClick("u1", "b-de")
	recordClick("u1", "b-de")
	recordClick("u2", "a-us")

	lb, err = getLeaderboard(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(lb) != 2 {
		t.Fatalf("expected 2 in leaderboard, got %d", len(lb))
	}
	// b-de should be first (2 clicks > 1 click)
	if lb[0].ID != "b-de" {
		t.Errorf("expected b-de first, got %s", lb[0].ID)
	}

	// Limit works
	lb, _ = getLeaderboard(1)
	if len(lb) != 1 {
		t.Errorf("expected limit=1 to return 1, got %d", len(lb))
	}
}

func TestCityExists(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "london-gb", "London", "UK", "GB")

	if !cityExists("london-gb") {
		t.Error("expected london-gb to exist")
	}
	if cityExists("nowhere-xx") {
		t.Error("expected nowhere-xx to not exist")
	}
}

func TestGetCityDetail(t *testing.T) {
	setupTestDB(t)
	seedTestCity(t, "tokyo-jp", "Tokyo", "Japan", "JP")
	createUser("u1", "Alice", "tokyo-jp")
	createUser("u2", "Bob", "tokyo-jp")
	recordClick("u1", "tokyo-jp")
	recordClick("u1", "tokyo-jp")
	recordClick("u2", "tokyo-jp")

	detail, err := getCityDetail("tokyo-jp")
	if err != nil {
		t.Fatal(err)
	}
	if detail.TotalClicks != 3 {
		t.Errorf("expected 3 total clicks, got %d", detail.TotalClicks)
	}
	if detail.ContributorCount != 2 {
		t.Errorf("expected 2 contributors, got %d", detail.ContributorCount)
	}
	if len(detail.TopContributors) != 2 {
		t.Fatalf("expected 2 top contributors, got %d", len(detail.TopContributors))
	}
	// Alice has more clicks, should be first
	if detail.TopContributors[0].Name != "Alice" {
		t.Errorf("expected Alice first, got %s", detail.TopContributors[0].Name)
	}
}

func TestGetCityDetailNotFound(t *testing.T) {
	setupTestDB(t)

	_, err := getCityDetail("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent city")
	}
}
