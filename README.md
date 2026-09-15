# docelembranca

Personal webapp: Google-login-gated inventory with photo uploads, hosted on
GitHub Pages, backed by Supabase (Postgres + Auth + Storage).

## Stack

- **Frontend**: Vite + React + TypeScript, static build deployed to GitHub Pages
- **Backend**: Supabase (Google OAuth, Postgres table, Storage bucket) — no
  server of your own to run
- **Dev environment**: devcontainer (IntelliJ IDEA via JetBrains Gateway),
  Docker-outside-of-docker, Claude Code, GitHub Spec Kit, Supabase CLI

## Setup

Already done for this project — kept here as reference in case the
devcontainer needs to be rebuilt or reopened on another machine.

### 1. Open in the devcontainer

Open this repo in IntelliJ IDEA with the [Gateway / Dev Containers
plugin](https://www.jetbrains.com/help/idea/connect-to-devcontainer.html), or
in VS Code with the Dev Containers extension. The container build installs
Node 24, the Supabase CLI, `uv` + Spec Kit's `specify` CLI, Claude Code, and
the GitHub CLI, and mounts your host SSH keys, git config, and Claude auth
state (see [Mounts caveats](#mounts-caveats) below).

### 2. Supabase project

Project: https://supabase.com/dashboard/project/wdxbkldmaayidydsnuya

Inside the container:

```bash
supabase login
supabase link --project-ref wdxbkldmaayidydsnuya
supabase db push   # applies migrations under supabase/migrations/
```

Add migration files under `supabase/migrations/` as the schema grows. Any
table or storage bucket you add should be locked down with Row Level
Security policies restricting access to `giselypasquini@gmail.com` — **that RLS
policy is the actual access control**, since the frontend's email check
(`LoginGate`) is only a UX nicety and anyone can read the client-side JS.

In the Supabase dashboard, also enable **Google** under Authentication →
Providers, using a Google Cloud OAuth Client ID with redirect URI:

```
https://wdxbkldmaayidydsnuya.supabase.co/auth/v1/callback
```

### 2b. Local database (tests)

The hosted project above is the deployment target. Tests never run against it —
pgTAP creates and destroys rows and impersonates roles — so they run against a
local stack instead:

```bash
supabase start          # first run pulls ~12 images
supabase test db        # pgTAP: RPCs, views, triggers, RLS policies
npm run gen:types       # regenerate src/lib/database.types.ts from the local schema
supabase migration up   # apply supabase/migrations/ locally
supabase stop           # free the containers when done (--no-backup to discard data)
```

Local URLs once it is up: API `localhost:54321`, Postgres `localhost:54322`,
Studio `localhost:54323`, Mailpit `localhost:54324`.

**This requires the devcontainer's host networking** (`"runArgs":
["--network=host"]` in `.devcontainer/devcontainer.json`). The CLI runs in the
container but the stack is created by the host's Docker daemon and published on
the host's loopback; without a shared network namespace the CLI's health check
hits an empty `127.0.0.1:54322`, fails with `ECONNREFUSED`, and stops the stack
it just started. If you ever see that error, check that `runArgs` is still there
and rebuild the container.

For the same reason `.devcontainer/devcontainer.json` declares no `forwardPorts`:
with a shared namespace the IDE's forwarders would bind 54321-54324 on the host
loopback first, and `supabase start` would fail with `address already in use`.

### 3. Environment variables

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_ANON_KEY` from the Supabase dashboard's API settings
page (the anon/public key — safe to expose in a static frontend as long as
RLS is on).

### 4. Run it

```bash
npm install
npm run dev
```

### 5. Deploy to GitHub Pages

1. In the GitHub repo: Settings → Pages → Source → **GitHub Actions**.
2. Add repo secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (Settings → Secrets and variables → Actions).
3. Push to `main` — `.github/workflows/deploy.yml` builds and deploys
   automatically.

## GitHub Spec Kit

This project uses [Spec Kit](https://github.com/github/spec-kit) for
spec-driven development. Already initialized and validated in this repo
(`specify init`, `specify check`) — no need to redo that.

Use Spec Kit's slash commands with Claude Code (`/speckit-specify`,
`/speckit-plan`, `/speckit-tasks`, `/speckit-implement`, etc.) to drive
feature work from specs. The project's governing principles live in
`.specify/memory/constitution.md`.

## Claude Code

Installed globally in the container. Auth state is shared from your host's
`~/.claude` via a bind mount, so you shouldn't need to log in again inside
the container. Run:

```bash
claude-yolo   # alias for: claude --dangerously-skip-permissions
```

`--dangerously-skip-permissions` means Claude will act without asking for
per-tool confirmation — reasonable for a disposable dev container working on
a personal project, but worth knowing that's what the alias does.

## Mounts caveats

- **SSH**: mounted read-only from `~/.ssh`. Works immediately if your key
  has no passphrase. If it does, agent forwarding via `SSH_AUTH_SOCK` is
  attempted but is Linux-host-reliable only — on macOS/Windows with Docker
  Desktop you may need to unlock the key manually once inside the
  container, or switch to a passphrase-less deploy key for this repo.
- **Git config**: your host `~/.gitconfig` is included, then `user.email`
  is overridden to `erdanielli@gmail.com` (see `.devcontainer/post-create.sh`).
- **Claude auth**: mounted read-write from `~/.claude`. If that directory
  doesn't exist yet on your host, Docker will silently create an empty one
  — just run `claude login` (or `claude-yolo` and follow the prompt) once
  inside the container.
- **Docker**: uses `docker-outside-of-docker`, so `docker` commands inside
  the container talk to your host's existing Docker daemon. Nothing extra
  to configure since Docker is already running on your host.

## Data model

No tables yet — add migration files under `supabase/migrations/` as the
schema grows. That's the "migrations tracked in repo" workflow the Supabase
CLI gives you.
