package main

import "time"

// City represents a city in the database.
type City struct {
	ID                    string  `json:"id"`
	Name                  string  `json:"name"`
	Country               string  `json:"country"`
	CountryCode           string  `json:"countryCode"`
	Lat                   float64 `json:"lat"`
	Lng                   float64 `json:"lng"`
	TotalClicks           int64   `json:"totalClicks"`
	ContributorCount      int     `json:"contributorCount"`
	HighestEverPopulation int64   `json:"highestEverPopulation"`
	TotalDead             int64   `json:"totalDead"`
	MissileStockpile      int     `json:"missileStockpile"`
}

// User represents a registered player.
type User struct {
	ID                     string     `json:"id"`
	Name                   string     `json:"name"`
	CityID                 string     `json:"cityId"`
	TotalClicks            int64      `json:"totalClicks"`
	CreatedAt              time.Time  `json:"createdAt"`
	LastClickAt            *time.Time `json:"lastClickAt,omitempty"`
	Role                   string     `json:"role"`
	TotalKills             int64      `json:"totalKills"`
	Best10s                int        `json:"best10s"`
	Best1Day               int        `json:"best1day"`
	ClickMissileClicks     int        `json:"clickMissileClicks"`
	LastCumulativeThreshold int       `json:"lastCumulativeThreshold"`
}

// CityDetail is the response for GET /api/cities/:id, includes top contributors.
type CityDetail struct {
	City
	TopContributors []Contributor `json:"topContributors"`
}

// Contributor is a summary of a user's clicks for a city.
type Contributor struct {
	Name        string `json:"name"`
	TotalClicks int64  `json:"totalClicks"`
}

// RegisterRequest is the POST body for /api/register.
type RegisterRequest struct {
	Name   string `json:"name"`
	CityID string `json:"cityId"`
}

// RegisterResponse is returned after registration.
type RegisterResponse struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	CityID string `json:"cityId"`
}

// GlobalStats is the response for GET /api/stats.
type GlobalStats struct {
	WorldPopulation      int64   `json:"worldPopulation"`
	CityCount            int     `json:"cityCount"`
	HighestEverCity      string  `json:"highestEverCity"`
	HighestEverPop       int64   `json:"highestEverPop"`
	AvgPopulation        float64 `json:"avgPopulation"`
	DailyChangePercent   float64 `json:"dailyChangePercent"`
	WorldMissileStockpile int    `json:"worldMissileStockpile"`
}

// Missile represents a missile held or fired by a user.
type Missile struct {
	ID           string     `json:"id"`
	UserID       string     `json:"userId"`
	MissileType  string     `json:"missileType"`
	Source       string     `json:"source"`
	RangeKM      int        `json:"rangeKm"`
	DamageLower  int        `json:"damageLower"`
	DamageUpper  int        `json:"damageUpper"`
	Fired        bool       `json:"fired"`
	FiredAt      *time.Time `json:"firedAt,omitempty"`
	TargetCityID *string    `json:"targetCityId,omitempty"`
	DamageDealt  int        `json:"damageDealt"`
}

// Subscription represents a user's subscription record.
type Subscription struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Plan      string    `json:"plan"`
	StartedAt time.Time `json:"startedAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// --- WebSocket messages ---

// WSIncoming is a message from client to server.
type WSIncoming struct {
	Type string `json:"type"` // "click"
}

// WSOutgoing is a message from server to client.
type WSOutgoing struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
}

// CityUpdate is the data payload for city_update messages.
type CityUpdate struct {
	CityID                string `json:"cityId"`
	TotalClicks           int64  `json:"totalClicks"`
	ContributorCount      int    `json:"contributorCount"`
	HighestEverPopulation int64  `json:"highestEverPopulation"`
}

// CityClick is the data payload for city_click messages (same-city room broadcast).
type CityClick struct {
	CityID   string `json:"cityId"`
	UserName string `json:"userName"`
}

// MissileStrike is broadcast when a missile is fired.
type MissileStrike struct {
	AttackerName string `json:"attackerName"`
	TargetCityID string `json:"targetCityId"`
	MissileType  string `json:"missileType"`
	Damage       int    `json:"damage"`
	FromLat      float64 `json:"fromLat"`
	FromLng      float64 `json:"fromLng"`
	ToLat        float64 `json:"toLat"`
	ToLng        float64 `json:"toLng"`
}

// AchievementEarned is sent to the clicking user when they earn an achievement.
type AchievementEarned struct {
	AchievementName string `json:"achievementName"`
	MissileType     string `json:"missileType,omitempty"`
}
