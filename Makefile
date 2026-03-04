.PHONY: dev-server dev-client seed build clean test

dev-server:
	go run -tags dev . -addr :8080

dev-client:
	cd client && npm run dev

seed:
	go run -tags dev . -seed

build:
	cd client && npm run build
	go build -o clickcity .

test:
	go test ./...
	cd client && npx vitest run

clean:
	rm -f clickcity clickcity.db
	rm -rf client/dist client/node_modules
