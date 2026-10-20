#!/usr/bin/env bash
# Installe les dépendances au démarrage d'une session cloud Claude Code.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" && corepack enable >/dev/null 2>&1; pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install
