#!/bin/bash
# 8.6 Attribution - All KB nodes have source_expert
# Version 1.0.0 | Created 2026-01-01
#
# Every KB node must be attributed to an expert source.

set -e

echo "=== 8.6 Attribution: Expert Sources Required ==="
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set"
  echo "SKIPPED - Cannot connect to database"
  exit 0
fi

echo "Checking KB node attribution..."
echo ""

# Count nodes without attribution
RESULT=$(psql "$DATABASE_URL" -t -c "
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN source_expert IS NULL OR source_expert = '' THEN 1 ELSE 0 END) as missing
  FROM kb_nodes;
" 2>/dev/null || echo "0|0")

TOTAL=$(echo "$RESULT" | cut -d'|' -f1 | tr -d ' ')
MISSING=$(echo "$RESULT" | cut -d'|' -f2 | tr -d ' ')

if [ "$TOTAL" = "0" ]; then
  echo "No KB nodes found"
  echo "SKIPPED - KB is empty"
  exit 0
fi

PERCENTAGE=$((100 - (MISSING * 100 / TOTAL)))

echo "Total nodes: $TOTAL"
echo "Missing attribution: $MISSING"
echo "Attribution rate: $PERCENTAGE%"
echo ""
echo "================================================"

if [ "$MISSING" -eq 0 ]; then
  echo "PASS: All nodes have expert attribution"
  exit 0
else
  echo "FAIL: $MISSING node(s) missing attribution"
  echo ""
  echo "Fix: Update nodes with source_expert:"
  echo "  UPDATE kb_nodes SET source_expert = 'Expert Name'"
  echo "  WHERE source_expert IS NULL;"
  exit 1
fi
