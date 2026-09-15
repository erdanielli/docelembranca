FROM mcr.microsoft.com/devcontainers/typescript-node:1-24-bookworm

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        unzip \
        jq \
    && rm -rf /var/lib/apt/lists/*

# --- Supabase CLI ---------------------------------------------------------
# Installed as a static binary per Supabase's own recommendation (they no
# longer support a global npm install).
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH}" in \
        amd64) SUPA_ARCH="linux_amd64" ;; \
        arm64) SUPA_ARCH="linux_arm64" ;; \
        *) echo "unsupported arch: ${TARGETARCH}"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/supabase/cli/releases/latest/download/supabase_${SUPA_ARCH}.tar.gz" -o /tmp/supabase.tar.gz; \
    tar -xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase; \
    chmod +x /usr/local/bin/supabase; \
    rm /tmp/supabase.tar.gz

# --- uv (needed to run GitHub Spec Kit's `specify` CLI) -------------------
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

# --- Claude Code CLI --------------------------------------------------------
RUN npm install -g @anthropic-ai/claude-code

USER node

# Pre-create this as an empty file (not a directory) so the ~/.claude.json
# bind mount in devcontainer.json attaches to a file, matching the host.
RUN touch /home/node/.claude.json

# --- GitHub Spec Kit --------------------------------------------------------
# Installed from PyPI as a persistent uv tool, exposed on PATH as `specify`.
RUN uv tool install specify-cli \
    && echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/node/.bashrc \
    && echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/node/.zshrc

WORKDIR /workspace
