#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_FILE="$SCRIPT_DIR/skill-runner.sh"
TARGET_DIR="${SKILL_RUNNER_INSTALL_DIR:-$HOME/.agent}"
TARGET_FILE="$TARGET_DIR/skill-runner.sh"
ZSHRC="${ZDOTDIR:-$HOME}/.zshrc"
SOURCE_LINE="[[ -f \"$TARGET_FILE\" ]] && source \"$TARGET_FILE\""

mkdir -p "$TARGET_DIR"
cp "$SOURCE_FILE" "$TARGET_FILE"

rm -f "$HOME/.scriptdrop/scriptdrop-launcher.zsh"
rmdir "$HOME/.scriptdrop" 2>/dev/null || true

if [[ ! -f "$ZSHRC" ]]; then
  touch "$ZSHRC"
fi

# Remove legacy and duplicate loader lines, then append exactly one loader.
awk -v target="$TARGET_FILE" '
  $0 == "# scriptdrop launcher" { next }
  $0 == "# Script drop folder launcher" { next }
  $0 == "# skill runner" { next }
  $0 ~ /scriptdrop-launcher\.zsh/ { next }
  index($0, target) > 0 { next }
  { print }
' "$ZSHRC" > "$ZSHRC.tmp"
mv "$ZSHRC.tmp" "$ZSHRC"

{
  echo ""
  echo "# skill runner"
  echo "$SOURCE_LINE"
} >> "$ZSHRC"

echo "Installed skill runner to $TARGET_FILE"
echo "Reload zsh with: source \"$ZSHRC\""
