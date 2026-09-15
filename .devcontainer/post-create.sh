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

echo "==> Fixing SSH key permissions (bind mounts can lose strict perms)"
if [ -d "$HOME/.ssh" ]; then
  chmod 700 "$HOME/.ssh" || true
  chmod 600 "$HOME"/.ssh/id_* 2>/dev/null || true
  chmod 644 "$HOME"/.ssh/*.pub 2>/dev/null || true
fi

echo "==> Installing npm dependencies"
if [ -f "package.json" ]; then
  npm install
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
"$HOME/.local/bin/specify" --version 2>/dev/null || true
docker version --format '{{.Client.Version}}' 2>/dev/null || echo "docker CLI not yet ready (check docker-outside-of-docker feature)"

cat <<'EOF'

==> Next steps
  1. supabase login                 (or set SUPABASE_ACCESS_TOKEN)
  2. supabase link --project-ref wdxbkldmaayidydsnuya
  3. specify init --here            (if not already run)
  4. claude-yolo                    (Claude Code, permission prompts skipped)

EOF
