#!/bin/bash
# 8.5 Fallback Check - No || DEFAULT patterns
# Version 1.0.0 | Created 2026-01-01
#
# Domain logic must not use fallback defaults. KB is the source of truth.

set -e

echo "=== 8.5 Fallback Check: No Default Values ==="
echo ""

VIOLATIONS=0
DOMAIN_DIR="src/domain"

if [ ! -d "$DOMAIN_DIR" ]; then
  echo "Domain directory not found: $DOMAIN_DIR"
  echo "SKIPPED - No domain files to check"
  exit 0
fi

echo "Checking for fallback patterns in $DOMAIN_DIR..."
echo ""

# Pattern: || followed by a default value
PATTERNS=(
  '\|\| DEFAULT'
  '\|\| \[\]'
  '\|\| \{\}'
  '\|\| null'
  '\|\| 0'
  '\|\| ""'
  '\|\| '\'''\'''
  '\?\? \[\]'
  '\?\? \{\}'
  '\?\? 0'
)

for pattern in "${PATTERNS[@]}"; do
  while IFS= read -r file; do
    matches=$(grep -n "$pattern" "$file" 2>/dev/null || true)
    if [ -n "$matches" ]; then
      echo "FALLBACK PATTERN in $file:"
      echo "$matches" | while read -r line; do
        echo "  $line"
        VIOLATIONS=$((VIOLATIONS + 1))
      done
    fi
  done < <(find "$DOMAIN_DIR" -name "*.ts" -o -name "*.js")
done

echo ""
echo "================================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo "PASS: No fallback patterns found"
  exit 0
else
  echo "FAIL: Fallback patterns detected"
  echo ""
  echo "Fix: Remove fallbacks, require KB to have the data:"
  echo "  // BAD: const rate = kbRate || 0.04;"
  echo "  // GOOD: const rate = kbRate; // KB required"
  exit 1
fi
