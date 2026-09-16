#!/usr/bin/env bash
set -euo pipefail

echo "==> Wiring up git config (host config + user.email override)"
if [ -f "$HOME/.gitconfig-host" ]; then
  cat > "$HOME/.gitconfig" <<'EOF'
[include]
	path = /home/node/.gitconfig-host
[user]
	email = erdanielli@gmail.com
EOF
  echo "    git user.email overridden to erdanielli@gmail.com"
else
  echo "    no host .gitconfig mounted, skipping"
fi

echo "==> Wiring git to authenticate through gh (no SSH keys in this container)"
if gh auth status >/dev/null 2>&1; then
  gh auth setup-git
else
  echo "    gh not authenticated yet — run 'gh auth login' then 'gh auth setup-git'"
fi

# Rewrite any git@github.com:... remotes to https so the gh credential
# helper above actually intercepts them (it only hooks https:// URLs).
git config --global url."https://github.com/".insteadOf "git@github.com:"

echo "==> Installing npm dependencies"
if [ -f "package.json" ]; then
  npm install
fi

# Downloads the browser build matching the @playwright/test version just
# installed above (hence after npm install, and without a pinned version here),
# plus the shared libraries it needs via sudo apt-get. Only chromium: that is
# the single project in playwright.config.ts, and it is what CI installs too.
#
# RES_OPTIONS=no-aaaa forces IPv4-only name resolution for this command. With
# `--network=host` (see devcontainer.json) the container inherits the host's
# network, and on a host that advertises IPv6 without working IPv6 routing the
# connection just hangs. Playwright's downloader tries AAAA addresses first with
# a 5s per-attempt budget, and that budget surfaces as an aborted request rather
# than a fall back to IPv4, so the download fails with a misleading
# "Request to https://cdn.playwright.dev/... timed out" every time. Dropping
# AAAA from the lookup sidesteps it; on a healthy network it costs nothing.
echo "==> Installing Playwright browser (chromium + OS deps)"
if [ -d "node_modules/@playwright/test" ]; then
  RES_OPTIONS=no-aaaa npx playwright install --with-deps chromium
fi

echo "==> Handy aliases"
{
  echo 'alias claude-yolo="claude --dangerously-skip-permissions"'
  echo 'export PATH="$HOME/.local/bin:$PATH"'
} >> "$HOME/.bashrc"
{
  echo 'alias claude-yolo="claude --dangerously-skip-permissions"'
  echo 'export PATH="$HOME/.local/bin:$PATH"'
} >> "$HOME/.zshrc" 2>/dev/null || true

echo "==> Versions"
node -v
npm -v
supabase --version || true
npx playwright --version 2>/dev/null || true
"$HOME/.local/bin/specify" --version 2>/dev/null || true
docker version --format '{{.Client.Version}}' 2>/dev/null || echo "docker CLI not yet ready (check docker-outside-of-docker feature)"

cat <<'EOF'

==> Next steps
  1. supabase login                 (or set SUPABASE_ACCESS_TOKEN)
  2. supabase link --project-ref wdxbkldmaayidydsnuya
  3. specify init --here            (if not already run)
  4. claude-yolo                    (Claude Code, permission prompts skipped)

EOF
