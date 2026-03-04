package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	seed := flag.Bool("seed", false, "Download and seed city data, then exit")
	addr := flag.String("addr", ":8080", "Listen address")
	dbPath := flag.String("db", "clickcity.db", "SQLite database path")
	wsOrigins := flag.String("ws-origins", "*", "Comma-separated WebSocket origin patterns")
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

	origins := strings.Split(*wsOrigins, ",")
	wsHub := newHub(origins)

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

	srv := &http.Server{Addr: *addr, Handler: r}

	// Graceful shutdown on SIGINT/SIGTERM
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Listening on %s", *addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-done
	log.Println("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
	db.Close()
	log.Println("Server stopped")
}
