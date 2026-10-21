#!/usr/bin/env bash
# Installs dependencies when a Claude Code cloud session starts.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" && corepack enable >/dev/null 2>&1; pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install
