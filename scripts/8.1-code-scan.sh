#!/bin/bash
# 8.1 Code Scan - No hardcoded values in domain logic
# Version 1.0.0 | Created 2026-01-01
#
# This script scans for hardcoded numeric values in domain files.
# All values should come from KB queries.

set -e

echo "=== 8.1 Code Scan: No Hardcoded Values ==="
echo ""

VIOLATIONS=0
DOMAIN_DIR="src/domain"

if [ ! -d "$DOMAIN_DIR" ]; then
  echo "Domain directory not found: $DOMAIN_DIR"
  echo "SKIPPED - No domain files to scan"
  exit 0
fi

echo "Scanning $DOMAIN_DIR for hardcoded values..."
echo ""

# Pattern: variable = 0.XX or similar numeric assignments
while IFS= read -r file; do
  matches=$(grep -nE "= [0-9]+\.[0-9]+" "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "VIOLATION in $file:"
    echo "$matches" | while read -r line; do
      echo "  $line"
      VIOLATIONS=$((VIOLATIONS + 1))
    done
    echo ""
  fi
done < <(find "$DOMAIN_DIR" -name "*.ts" -o -name "*.js")

# Also check for magic numbers in conditionals
while IFS= read -r file; do
  matches=$(grep -nE "(> [0-9]+|< [0-9]+|>= [0-9]+|<= [0-9]+|== [0-9]+)" "$file" 2>/dev/null | grep -v "\.length" || true)
  if [ -n "$matches" ]; then
    echo "POTENTIAL MAGIC NUMBER in $file:"
    echo "$matches" | head -5
    echo ""
  fi
done < <(find "$DOMAIN_DIR" -name "*.ts" -o -name "*.js")

echo "================================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo "PASS: No hardcoded values found"
  exit 0
else
  echo "FAIL: $VIOLATIONS hardcoded value(s) found"
  echo ""
  echo "Fix: Replace hardcoded values with KB queries:"
  echo "  const rate = await kb.search('withdrawal rate');"
  exit 1
fi
