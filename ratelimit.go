package main

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// rateLimiter manages per-user token bucket rate limiters with TTL eviction.
type rateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rateLimiterEntry
	rate     rate.Limit
	burst    int
}

type rateLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newRateLimiter() *rateLimiter {
	rl := &rateLimiter{
		limiters: make(map[string]*rateLimiterEntry),
		rate:     rate.Limit(100.0 / 60.0), // 100 per 60 seconds
		burst:    10,
	}
	go rl.cleanup()
	return rl
}

// allow checks if a click from userID should be accepted.
func (rl *rateLimiter) allow(userID string) bool {
	rl.mu.Lock()
	entry, ok := rl.limiters[userID]
	if !ok {
		entry = &rateLimiterEntry{
			limiter: rate.NewLimiter(rl.rate, rl.burst),
		}
		rl.limiters[userID] = entry
	}
	entry.lastSeen = time.Now()
	rl.mu.Unlock()
	return entry.limiter.Allow()
}

// cleanup periodically removes stale entries (not seen in 5 minutes).
func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-5 * time.Minute)
		for id, entry := range rl.limiters {
			if entry.lastSeen.Before(cutoff) {
				delete(rl.limiters, id)
			}
		}
		rl.mu.Unlock()
	}
}
