#!/bin/bash
# 8.8 Gap Logging - Missing queries logged to kb_gaps
# Version 1.0.0 | Created 2026-01-01
#
# The application must log queries that KB cannot answer.

set -e

echo "=== 8.8 Gap Logging: Unanswered Queries ==="
echo ""

# Check 1: kb_gaps table exists
if [ -n "$DATABASE_URL" ]; then
  echo "Checking database for kb_gaps table..."

  TABLE_EXISTS=$(psql "$DATABASE_URL" -t -c "
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'kb_gaps'
    );
  " 2>/dev/null | tr -d ' ')

  if [ "$TABLE_EXISTS" != "t" ]; then
    echo ""
    echo "================================================"
    echo "FAIL: kb_gaps table does not exist"
    echo ""
    echo "Fix: Create the gaps table:"
    echo "  CREATE TABLE kb_gaps ("
    echo "    id SERIAL PRIMARY KEY,"
    echo "    query TEXT NOT NULL,"
    echo "    context JSONB,"
    echo "    created_at TIMESTAMP DEFAULT NOW()"
    echo "  );"
    exit 1
  fi

  echo "kb_gaps table exists"
fi

# Check 2: Code has gap logging implementation
echo ""
echo "Checking source code for gap logging..."

GAP_LOGGING_FOUND=false

if grep -rq "logGap\|kb_gaps\|insertGap\|recordGap" . --include="*.ts" --include="*.js" 2>/dev/null; then
  echo "Gap logging found in source files"
  GAP_LOGGING_FOUND=true
fi

echo ""
echo "================================================"

if [ "$GAP_LOGGING_FOUND" = true ]; then
  echo "PASS: Gap logging implemented"
  exit 0
else
  echo "FAIL: No gap logging found"
  echo ""
  echo "Fix: Add gap logging to KB queries:"
  echo "  async function queryKB(query: string) {"
  echo "    const result = await kb.search(query);"
  echo "    if (!result || result.length === 0) {"
  echo "      await logGap(query);"
  echo "    }"
  echo "    return result;"
  echo "  }"
  exit 1
fi
