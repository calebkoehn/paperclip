---
title: Docker
summary: Docker Compose quickstart
---

Run Paperclip in Docker without installing Node or pnpm locally.

## Compose Quickstart (Recommended)

```sh
docker compose -f docker-compose.quickstart.yml up --build
```

Open [http://localhost:3100](http://localhost:3100).

Defaults:

- Host port: `3100`
- Data directory: `./data/docker-paperclip`

Override with environment variables:

```sh
PAPERCLIP_PORT=3200 PAPERCLIP_DATA_DIR=./data/pc \
  docker compose -f docker-compose.quickstart.yml up --build
```

## Manual Docker Build

```sh
docker build -t paperclip-local .
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

## Data Persistence

All data is persisted under the bind mount (`./data/docker-paperclip`):

- Embedded PostgreSQL data
- Uploaded assets
- Local secrets key
- Agent workspace data

## Claude and Codex Adapters in Docker

The Docker image pre-installs:

- `claude` (Anthropic Claude Code CLI)
- `codex` (OpenAI Codex CLI)

Pass API keys to enable local adapter runs inside the container:

```sh
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-... \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

Without API keys, the app runs normally — adapter environment checks will surface missing prerequisites.

## Troubleshooting Workspace Resolution Failures

If Docker build fails in the `deps` stage with an error like:

```text
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND
```

it usually means a `workspace:*` dependency points at a package that is missing from the Docker build context or no longer exists in the workspace.

Recommended checks:

```sh
pnpm check:workspace-deploy
```

```sh
docker build --target deps -t paperclip-deps-preflight .
```

CI runs both checks in PR and release verification to fail fast before full build/test steps.

## Render-specific build failure note

If Render fails during server build with TypeScript errors such as:

```text
TS2307: Cannot find module '@paperclipai/adapter-gemini-local/server'
```

this indicates package contract drift: server source imports an adapter package that is missing in `server/package.json` dependencies.

Run:

```sh
pnpm check:workspace-deploy
pnpm --filter @paperclipai/server build
```

The first command validates workspace/deploy consistency, and the second confirms the server package compiles in isolation.
