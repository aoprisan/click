# Repository Guidelines

## Project Structure & Module Organization
The Go backend lives at the repository root. Key areas include `main.go` for server startup and routing, `handlers.go` for REST endpoints, `ws.go` for WebSocket flow, and `db.go`/`migrations.go` for SQLite access and schema changes. Keep new backend code close to the feature it supports.

The frontend lives in `client/`. Use `client/src/components/` for UI, `client/src/hooks/` for reusable stateful logic, `client/src/api.ts` for HTTP calls, and `client/src/styles/` for shared CSS. Tests sit beside the code as `*.test.ts` or `*.test.tsx`. Build and helper scripts are in `scripts/`. Seed input data is under `data/`. Production serves the embedded `client/dist` bundle via `static.go`.

## Build, Test, and Development Commands
Use the existing Make targets:

- `make seed` downloads GeoNames data and populates the SQLite database for first run.
- `make dev-server` starts the Go app in dev mode on `:8080` with Air hot reload.
- `make dev-client` starts Vite on `:5173` and proxies `/api` and `/ws` to the backend.
- `make build` builds the frontend and then compiles the Go binary.
- `make test` runs `go test ./...` and `cd client && npx vitest run`.
- `./scripts/build.sh` produces the production `globalconflict` binary with embedded frontend assets.

## Coding Style & Naming Conventions
Format Go with `gofmt`; keep exported names in `CamelCase` and package-local helpers in `camelCase`. Use tabs in Go files, matching the existing codebase.

Frontend code uses TypeScript, React function components, and 2-space indentation with no semicolons. Name components in `PascalCase` (`PlayerPanel.tsx`), hooks with `use...` (`useWebSocket.ts`), and colocated tests with the same base name plus `.test.ts(x)`.

## Testing Guidelines
Backend tests use Go’s standard `testing` package and live in root `*_test.go` files such as `handlers_test.go` and `ws_test.go`. Frontend tests use Vitest with Testing Library and JSDOM via `client/src/test/setup.ts`.

Add or update tests with each behavior change. Run focused checks with `go test -run TestName ./...` or `cd client && npx vitest run src/components/ClickButton.test.tsx`.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Add structured logging...` and `Simplify: ...`. Follow that pattern, but avoid vague messages like `fixes`; explain the behavior changed.

Pull requests should include a brief summary, test evidence (`make test` or targeted commands), linked issue/spec when applicable, and screenshots or short recordings for UI changes. Call out schema, seed-data, or API contract changes explicitly.
