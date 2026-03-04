package main

import (
	"testing"
)

func TestRateLimiterAllow(t *testing.T) {
	rl := newRateLimiter()

	// First burst should be allowed (burst=10)
	for i := 0; i < 10; i++ {
		if !rl.allow("user1") {
			t.Fatalf("expected allow on call %d", i+1)
		}
	}

	// After burst, should be rate-limited
	denied := 0
	for i := 0; i < 10; i++ {
		if !rl.allow("user1") {
			denied++
		}
	}
	if denied == 0 {
		t.Error("expected some requests to be denied after burst")
	}
}

func TestRateLimiterIndependentUsers(t *testing.T) {
	rl := newRateLimiter()

	// Exhaust user1's burst
	for i := 0; i < 10; i++ {
		rl.allow("user1")
	}

	// user2 should still have full burst available
	for i := 0; i < 10; i++ {
		if !rl.allow("user2") {
			t.Fatalf("user2 should not be limited, denied on call %d", i+1)
		}
	}
}
