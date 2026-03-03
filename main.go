package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	seed := flag.Bool("seed", false, "Download and seed city data, then exit")
	addr := flag.String("addr", ":8080", "Listen address")
	dbPath := flag.String("db", "clickcity.db", "SQLite database path")
	flag.Parse()

	if err := initDB(*dbPath); err != nil {
		log.Fatalf("Failed to init DB: %v", err)
	}

	if *seed {
		if err := seedCities(); err != nil {
			log.Fatalf("Seed failed: %v", err)
		}
		log.Println("Seeding complete.")
		return
	}

	wsHub := newHub()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/cities", handleGetCities)
		r.Get("/cities/{id}", handleGetCity)
		r.Get("/leaderboard", handleGetLeaderboard)
		r.Post("/register", handleRegister)
		r.Get("/me", handleGetMe)
	})

	// WebSocket
	r.Get("/ws", wsHub.handleWebSocket)

	// Static files (embedded in production, not-found in dev)
	r.Handle("/*", staticHandler())

	log.Printf("Listening on %s", *addr)
	if err := http.ListenAndServe(*addr, r); err != nil {
		log.Fatal(err)
	}
}
