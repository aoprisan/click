//go:build !dev

package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:client/dist
var clientDist embed.FS

func staticHandler() http.Handler {
	sub, err := fs.Sub(clientDist, "client/dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file directly
		f, err := sub.Open(r.URL.Path[1:]) // strip leading /
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		// SPA fallback: serve index.html for client-side routes
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
