#!/usr/bin/env bash
# Formate et corrige avec Biome le fichier que Claude vient de modifier.
file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json) npx --no-install biome check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1 || true ;;
esac
exit 0
