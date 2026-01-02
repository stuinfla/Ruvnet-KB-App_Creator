#!/bin/bash
# 8.3 Source Returns - All functions return kbSources
# Version 1.0.0 | Created 2026-01-01
#
# Every domain function must include kbSources in its return.

set -e

echo "=== 8.3 Source Returns: kbSources Required ==="
echo ""

VIOLATIONS=0
DOMAIN_DIR="src/domain"

if [ ! -d "$DOMAIN_DIR" ]; then
  echo "Domain directory not found: $DOMAIN_DIR"
  echo "SKIPPED - No domain files to check"
  exit 0
fi

echo "Checking kbSources in return statements..."
echo ""

while IFS= read -r file; do
  # Count functions that have return statements
  RETURN_COUNT=$(grep -c "return {" "$file" 2>/dev/null || echo "0")

  # Count returns that include kbSources
  SOURCE_COUNT=$(grep -c "kbSources" "$file" 2>/dev/null || echo "0")

  if [ "$RETURN_COUNT" -gt 0 ] && [ "$SOURCE_COUNT" -lt "$RETURN_COUNT" ]; then
    echo "MISSING kbSources in $file"
    echo "  Returns: $RETURN_COUNT, With sources: $SOURCE_COUNT"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(find "$DOMAIN_DIR" -name "*.ts" -o -name "*.js")

echo ""
echo "================================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo "PASS: All returns include kbSources"
  exit 0
else
  echo "FAIL: $VIOLATIONS file(s) missing kbSources"
  echo ""
  echo "Fix: Add kbSources to every return:"
  echo "  return {"
  echo "    result: data,"
  echo "    kbSources: sources"
  echo "  };"
  exit 1
fi
