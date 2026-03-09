package main

import (
	"context"
	"flag"
	"log/slog"
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
	addr := flag.String("addr", envOr("ADDR", ":8080"), "Listen address")
	dbPath := flag.String("db", envOr("DB_PATH", "clickcity.db"), "SQLite database path")
	wsOrigins := flag.String("ws-origins", envOr("WS_ORIGINS", "*"), "Comma-separated WebSocket origin patterns")
	flag.Parse()

	if err := initDB(*dbPath); err != nil {
		slog.Error("Failed to init DB", "error", err)
		os.Exit(1)
	}

	if *seed {
		if err := seedCities(); err != nil {
			slog.Error("Seed failed", "error", err)
			os.Exit(1)
		}
		slog.Info("Seeding complete")
		return
	}

	// Start background workers
	startSnapshotWorker()
	startSubscriptionExpiryChecker()

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
		r.Get("/stats", handleGetStats)
		r.Post("/register", handleRegister)
		r.Get("/me", handleGetMe)
		r.Get("/me/missiles", handleGetMyMissiles)
		r.Post("/missiles/{id}/fire", wsHub.handleFireMissile)
		r.Post("/subscribe", handleSubscribe)
		r.Get("/me/subscription", handleGetSubscription)
		r.Post("/subscribe/renew", handleRenewSubscription)
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
		slog.Info("Listening", "addr", *addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Listen failed", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Shutdown error", "error", err)
	}
	db.Close()
	slog.Info("Server stopped")
}

// envOr returns the value of the environment variable or the fallback.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
