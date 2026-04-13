- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Architecture

OpenCode is a monorepo. Key packages:

| Package | Purpose |
|---|---|
| `packages/opencode` | Core CLI + Hono HTTP server (port 4096), TUI, Effect-TS services, SQLite via Drizzle |
| `packages/app` | Web UI — SolidJS/Vite, connects to the backend API |
| `packages/desktop` | Tauri native desktop app (wraps `packages/app`) |
| `packages/desktop-electron` | Electron native desktop app |
| `packages/sdk/js` | JavaScript/TypeScript SDK — auto-generated, do not edit directly |
| `packages/plugin` | Plugin system source (`@opencode-ai/plugin`) |
| `packages/ui` | Shared UI components |
| `packages/console` | Admin console (SST-based) |

**Runtime modes** — the `opencode` binary (or `bun dev`) supports:
- Default (no subcommand): TUI in the current/specified directory
- `serve`: Headless API server, port 4096 (fallback: random). JSON/WebSocket API.
- `web`: Headless API server + opens browser to `app.opencode.ai` (or local dev app)
- Key flags: `--port`, `--hostname` (default `127.0.0.1`), `--mdns`

**Per-package AGENTS.md files** contain package-specific rules — always check them:
- `packages/opencode/AGENTS.md` — database, Effect-TS patterns, `InstanceState` vs `makeRuntime`
- `packages/app/AGENTS.md` — SolidJS, local dev (backend on :4096, app on :4444)
- `packages/desktop/AGENTS.md` — never call `invoke` directly; use generated bindings
- `packages/desktop-electron/AGENTS.md` — renderer only calls `window.api` from preload

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.

## Build and Docker

See `CONTRIBUTING.md` for local dev setup and `bun dev` usage.

**CLI binaries** — built by `packages/opencode/script/build.ts`, output to `packages/opencode/dist/`. The `dist/` directory is ephemeral: created by the build script (`rm -rf dist` at start), only lives during a CI run, and is absent in a clean checkout. That is expected and normal.

**opencode Docker image** — `ghcr.io/anomalyco/opencode:{version|latest|beta}` — multi-arch (linux/amd64 + linux/arm64), based on Alpine. Built in `packages/opencode/script/publish.ts` after binaries are ready. The Dockerfile (`packages/opencode/Dockerfile`) copies the musl-static Linux binaries (`dist/opencode-linux-x64-baseline-musl` for amd64, `dist/opencode-linux-arm64-musl` for arm64). Building locally requires a Linux environment (WSL2 or CI) for musl cross-compilation.

**CI containers** — prebuilt GitHub Actions images in `packages/containers/` (base → bun-node → rust → tauri-linux → publish), pushed to `ghcr.io/anomalyco/build/*`. Rebuilt only when `packages/containers/**` changes. See `packages/containers/README.md`.

### Running as a Docker container with an exposed local port

Pull the published image and run the headless API server or web mode:

```bash
# Headless API server on host port 4096
docker run -p 4096:4096 \
  -e OPENCODE_SERVER_PASSWORD=changeme \
  ghcr.io/anomalyco/opencode:latest \
  serve --hostname 0.0.0.0 --port 4096

# Web mode (server only — no auto-open inside container)
docker run -p 4096:4096 \
  -e OPENCODE_SERVER_PASSWORD=changeme \
  ghcr.io/anomalyco/opencode:latest \
  web --hostname 0.0.0.0 --port 4096
```

Then open `http://localhost:4096` (API) or point the web app dev server at it.

**Required**: `--hostname 0.0.0.0` — the default is `127.0.0.1` which is unreachable outside the container.  
**Security**: always set `OPENCODE_SERVER_PASSWORD`; basic-auth is enforced when it is present. `OPENCODE_SERVER_USERNAME` defaults to `"opencode"`.  
**Provider keys**: pass AI provider credentials as env vars (e.g., `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) or mount a config file via `-v ~/.config/opencode:/root/.config/opencode`.
