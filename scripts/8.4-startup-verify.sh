#!/bin/bash
# 8.4 Startup Verify - Entry point verifies KB connection
# Version 1.0.0 | Created 2026-01-01
#
# The application entry point must verify KB connection before starting.

set -e

echo "=== 8.4 Startup Verify: KB Connection Check ==="
echo ""

# Find entry point
ENTRY_POINT=""
for file in "src/index.ts" "src/index.js" "src/main.ts" "src/app.ts" "index.ts" "index.js"; do
  if [ -f "$file" ]; then
    ENTRY_POINT="$file"
    break
  fi
done

if [ -z "$ENTRY_POINT" ]; then
  echo "No entry point found"
  echo "SKIPPED - Create src/index.ts or similar"
  exit 0
fi

echo "Checking entry point: $ENTRY_POINT"
echo ""

# Check for verifyConnection call
if grep -q "verifyConnection\|verifyKb\|checkKb\|kb\.verify\|kb\.connect" "$ENTRY_POINT"; then
  echo "Found KB verification call"

  # Check for proper error handling
  if grep -q "process.exit(1)\|throw\|reject" "$ENTRY_POINT"; then
    echo "Found error handling"
    echo ""
    echo "================================================"
    echo "PASS: Entry point verifies KB and handles errors"
    exit 0
  else
    echo ""
    echo "================================================"
    echo "FAIL: KB verification exists but no error handling"
    echo ""
    echo "Fix: Add process.exit(1) on KB failure:"
    echo "  if (!kbOk) {"
    echo "    console.error('KB unavailable');"
    echo "    process.exit(1);"
    echo "  }"
    exit 1
  fi
else
  echo ""
  echo "================================================"
  echo "FAIL: No KB verification at startup"
  echo ""
  echo "Fix: Add to entry point:"
  echo "  const kbOk = await kb.verifyConnection();"
  echo "  if (!kbOk) {"
  echo "    console.error('KB unavailable');"
  echo "    process.exit(1);"
  echo "  }"
  exit 1
fi
