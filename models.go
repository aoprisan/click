package main

import "time"

// City represents a city in the database.
type City struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Country          string  `json:"country"`
	CountryCode      string  `json:"countryCode"`
	Lat              float64 `json:"lat"`
	Lng              float64 `json:"lng"`
	TotalClicks      int64   `json:"totalClicks"`
	ContributorCount int     `json:"contributorCount"`
}

// User represents a registered player.
type User struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	CityID      string     `json:"cityId"`
	TotalClicks int64      `json:"totalClicks"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastClickAt *time.Time `json:"lastClickAt,omitempty"`
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

// --- WebSocket messages ---

// WSIncoming is a message from client to server.
type WSIncoming struct {
	Type string `json:"type"` // "click"
}

// WSOutgoing is a message from server to client.
type WSOutgoing struct {
	Type string      `json:"type"` // "city_update"
	Data interface{} `json:"data,omitempty"`
}

// CityUpdate is the data payload for city_update messages.
type CityUpdate struct {
	CityID           string `json:"cityId"`
	TotalClicks      int64  `json:"totalClicks"`
	ContributorCount int    `json:"contributorCount"`
}
