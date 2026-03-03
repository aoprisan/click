package main

import (
	"sync"

	"golang.org/x/time/rate"
)

// rateLimiter manages per-user token bucket rate limiters.
type rateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
	rate     rate.Limit
	burst    int
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     rate.Limit(100.0 / 60.0), // 100 per 60 seconds
		burst:    10,
	}
}

// allow checks if a click from userID should be accepted.
func (rl *rateLimiter) allow(userID string) bool {
	rl.mu.Lock()
	limiter, ok := rl.limiters[userID]
	if !ok {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[userID] = limiter
	}
	rl.mu.Unlock()
	return limiter.Allow()
}
