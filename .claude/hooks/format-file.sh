#!/usr/bin/env bash
# Formats and fixes, with Biome, the file Claude just edited.
file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json) npx --no-install biome check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1 || true ;;
esac
exit 0
