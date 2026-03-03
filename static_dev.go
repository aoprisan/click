//go:build dev

package main

import "net/http"

// In dev mode, Vite serves the frontend on :5173.
// This handler is unused but satisfies the interface.
func staticHandler() http.Handler {
	return http.NotFoundHandler()
}
