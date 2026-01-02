#!/bin/bash
# 8.7 Confidence - All KB nodes have confidence scores
# Version 1.0.0 | Created 2026-01-01
#
# Every KB node must have a confidence score (0.0 - 1.0).

set -e

echo "=== 8.7 Confidence: Confidence Scores Required ==="
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set"
  echo "SKIPPED - Cannot connect to database"
  exit 0
fi

echo "Checking KB node confidence scores..."
echo ""

# Check for nodes without confidence
RESULT=$(psql "$DATABASE_URL" -t -c "
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN confidence IS NULL OR confidence = 0 THEN 1 ELSE 0 END) as missing,
    COALESCE(AVG(confidence), 0) as avg_confidence
  FROM kb_nodes;
" 2>/dev/null || echo "0|0|0")

TOTAL=$(echo "$RESULT" | cut -d'|' -f1 | tr -d ' ')
MISSING=$(echo "$RESULT" | cut -d'|' -f2 | tr -d ' ')
AVG=$(echo "$RESULT" | cut -d'|' -f3 | tr -d ' ')

if [ "$TOTAL" = "0" ]; then
  echo "No KB nodes found"
  echo "SKIPPED - KB is empty"
  exit 0
fi

echo "Total nodes: $TOTAL"
echo "Missing confidence: $MISSING"
echo "Average confidence: $AVG"
echo ""
echo "================================================"

if [ "$MISSING" -eq 0 ]; then
  echo "PASS: All nodes have confidence scores"
  exit 0
else
  echo "FAIL: $MISSING node(s) missing confidence"
  echo ""
  echo "Fix: Update nodes with confidence:"
  echo "  UPDATE kb_nodes SET confidence = 0.85"
  echo "  WHERE confidence IS NULL OR confidence = 0;"
  exit 1
fi
