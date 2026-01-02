#!/bin/bash
# 8.2 Import Check - All domain files import KB
# Version 1.0.0 | Created 2026-01-01
#
# Every domain file must import the KB module.

set -e

echo "=== 8.2 Import Check: KB Import Required ==="
echo ""

VIOLATIONS=0
DOMAIN_DIR="src/domain"

if [ ! -d "$DOMAIN_DIR" ]; then
  echo "Domain directory not found: $DOMAIN_DIR"
  echo "SKIPPED - No domain files to check"
  exit 0
fi

echo "Checking KB imports in $DOMAIN_DIR..."
echo ""

while IFS= read -r file; do
  if ! grep -q "from.*kb\|import.*kb\|require.*kb" "$file" 2>/dev/null; then
    echo "MISSING KB IMPORT: $file"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(find "$DOMAIN_DIR" -name "*.ts" -o -name "*.js")

echo ""
echo "================================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo "PASS: All domain files import KB"
  exit 0
else
  echo "FAIL: $VIOLATIONS file(s) missing KB import"
  echo ""
  echo "Fix: Add to each domain file:"
  echo "  import { kb } from '../kb';"
  exit 1
fi
