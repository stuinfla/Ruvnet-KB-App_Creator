#!/bin/bash
# 1.5 Hooks Verify - Complete hook verification suite
# Version 1.0.0 | Created 2026-01-01
#
# Runs all hook verification checks for Phase 1.5

set -e

echo "=== Phase 1.5: RuVector Hooks Verification ==="
echo ""

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Track results
declare -a RESULTS

check_result() {
  local name="$1"
  local status="$2"
  local message="$3"

  if [ "$status" = "PASS" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    RESULTS+=("✅ $name: $message")
  elif [ "$status" = "FAIL" ]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS+=("❌ $name: $message")
  else
    SKIP_COUNT=$((SKIP_COUNT + 1))
    RESULTS+=("⏭️ $name: $message")
  fi
}

# ============================================
# Check 1: Hooks directory exists
# ============================================
echo "1. Checking hooks directory..."

if [ -d "$HOME/.claude/hooks" ]; then
  check_result "Hooks Directory" "PASS" "~/.claude/hooks exists"
else
  check_result "Hooks Directory" "FAIL" "~/.claude/hooks not found"
fi

# ============================================
# Check 2: Hook scripts exist
# ============================================
echo "2. Checking hook scripts..."

HOOKS_FOUND=0
for hook in pre_tool_use post_tool_use session_end; do
  if [ -f "$HOME/.claude/hooks/${hook}.py" ]; then
    HOOKS_FOUND=$((HOOKS_FOUND + 1))
  fi
done

if [ $HOOKS_FOUND -eq 3 ]; then
  check_result "Hook Scripts" "PASS" "All 3 hook scripts found"
elif [ $HOOKS_FOUND -gt 0 ]; then
  check_result "Hook Scripts" "FAIL" "Only $HOOKS_FOUND/3 hook scripts found"
else
  check_result "Hook Scripts" "FAIL" "No hook scripts found"
fi

# ============================================
# Check 3: Hook scripts are executable
# ============================================
echo "3. Checking hook permissions..."

EXEC_COUNT=0
for hook in pre_tool_use post_tool_use session_end; do
  if [ -x "$HOME/.claude/hooks/${hook}.py" ]; then
    EXEC_COUNT=$((EXEC_COUNT + 1))
  fi
done

if [ $EXEC_COUNT -eq 3 ]; then
  check_result "Hook Permissions" "PASS" "All hooks are executable"
elif [ $EXEC_COUNT -gt 0 ]; then
  check_result "Hook Permissions" "FAIL" "$EXEC_COUNT/3 hooks executable"
else
  check_result "Hook Permissions" "FAIL" "No hooks are executable"
fi

# ============================================
# Check 4: Hook scripts have valid Python syntax
# ============================================
echo "4. Checking hook syntax..."

SYNTAX_OK=0
for hook in pre_tool_use post_tool_use session_end; do
  if [ -f "$HOME/.claude/hooks/${hook}.py" ]; then
    if python3 -m py_compile "$HOME/.claude/hooks/${hook}.py" 2>/dev/null; then
      SYNTAX_OK=$((SYNTAX_OK + 1))
    fi
  fi
done

if [ $SYNTAX_OK -eq 3 ]; then
  check_result "Hook Syntax" "PASS" "All hooks pass syntax check"
elif [ $SYNTAX_OK -gt 0 ]; then
  check_result "Hook Syntax" "FAIL" "$SYNTAX_OK/3 hooks have valid syntax"
else
  check_result "Hook Syntax" "SKIP" "No hooks to check"
fi

# ============================================
# Check 5: Settings.json has hooks configured
# ============================================
echo "5. Checking settings.json..."

SETTINGS_FILE="$HOME/.claude/settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  if grep -q '"hooks"' "$SETTINGS_FILE" 2>/dev/null; then
    # Check for specific hook types
    HOOK_TYPES=$(python3 -c "
import json
try:
    with open('$SETTINGS_FILE') as f:
        s = json.load(f)
    hooks = s.get('hooks', {})
    print(len(hooks.keys()))
except:
    print(0)
" 2>/dev/null || echo "0")

    if [ "$HOOK_TYPES" -ge 3 ]; then
      check_result "Settings Hooks" "PASS" "All 3 hook types configured"
    elif [ "$HOOK_TYPES" -gt 0 ]; then
      check_result "Settings Hooks" "FAIL" "Only $HOOK_TYPES hook types configured"
    else
      check_result "Settings Hooks" "FAIL" "Hooks key exists but empty"
    fi
  else
    check_result "Settings Hooks" "FAIL" "No hooks key in settings.json"
  fi
else
  check_result "Settings Hooks" "FAIL" "~/.claude/settings.json not found"
fi

# ============================================
# Check 6: PreToolUse hook returns valid JSON
# ============================================
echo "6. Testing PreToolUse hook..."

if [ -f "$HOME/.claude/hooks/pre_tool_use.py" ]; then
  OUTPUT=$(echo '{"tool_name": "Write", "tool_input": {"file_path": "test.ts"}}' | \
    python3 "$HOME/.claude/hooks/pre_tool_use.py" 2>/dev/null || echo "ERROR")

  if echo "$OUTPUT" | python3 -c "import json, sys; json.load(sys.stdin)" 2>/dev/null; then
    DECISION=$(echo "$OUTPUT" | python3 -c "import json, sys; print(json.load(sys.stdin).get('decision', ''))" 2>/dev/null)
    if [ "$DECISION" = "continue" ] || [ "$DECISION" = "block" ]; then
      check_result "PreToolUse Test" "PASS" "Returns valid JSON with decision"
    else
      check_result "PreToolUse Test" "FAIL" "Missing or invalid decision field"
    fi
  else
    check_result "PreToolUse Test" "FAIL" "Does not return valid JSON"
  fi
else
  check_result "PreToolUse Test" "SKIP" "Hook script not found"
fi

# ============================================
# Check 7: ReasoningBank exists and has patterns
# ============================================
echo "7. Checking ReasoningBank..."

REASONING_DB=".swarm/memory.db"

if [ -f "$REASONING_DB" ]; then
  PATTERN_COUNT=$(sqlite3 "$REASONING_DB" "SELECT COUNT(*) FROM reasoning_memory WHERE namespace = 'kb_first_patterns';" 2>/dev/null || echo "0")

  if [ "$PATTERN_COUNT" -ge 5 ]; then
    check_result "ReasoningBank" "PASS" "$PATTERN_COUNT KB-First patterns found"
  elif [ "$PATTERN_COUNT" -gt 0 ]; then
    check_result "ReasoningBank" "FAIL" "Only $PATTERN_COUNT patterns (need ≥5)"
  else
    check_result "ReasoningBank" "FAIL" "No KB-First patterns seeded"
  fi
else
  # Check alternative location
  GLOBAL_DB="$HOME/.claude-flow/memory.db"
  if [ -f "$GLOBAL_DB" ]; then
    PATTERN_COUNT=$(sqlite3 "$GLOBAL_DB" "SELECT COUNT(*) FROM reasoning_memory WHERE namespace = 'kb_first_patterns';" 2>/dev/null || echo "0")

    if [ "$PATTERN_COUNT" -ge 5 ]; then
      check_result "ReasoningBank" "PASS" "$PATTERN_COUNT patterns in global DB"
    else
      check_result "ReasoningBank" "FAIL" "Global DB has $PATTERN_COUNT patterns"
    fi
  else
    check_result "ReasoningBank" "SKIP" "ReasoningBank not initialized"
  fi
fi

# ============================================
# Check 8: RuVector CLI available
# ============================================
echo "8. Checking RuVector CLI..."

if command -v npx >/dev/null 2>&1; then
  if npx @ruvector/cli --version >/dev/null 2>&1; then
    VERSION=$(npx @ruvector/cli --version 2>/dev/null || echo "unknown")
    check_result "RuVector CLI" "PASS" "Version $VERSION"
  else
    check_result "RuVector CLI" "SKIP" "Not installed (optional)"
  fi
else
  check_result "RuVector CLI" "SKIP" "npx not available"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "================================================"
echo "RESULTS SUMMARY"
echo "================================================"
echo ""

for result in "${RESULTS[@]}"; do
  echo "$result"
done

echo ""
echo "================================================"

TOTAL=$((PASS_COUNT + FAIL_COUNT))

if [ $FAIL_COUNT -eq 0 ] && [ $PASS_COUNT -ge 5 ]; then
  echo "PASS: All critical checks passed ($PASS_COUNT passed, $SKIP_COUNT skipped)"
  exit 0
elif [ $FAIL_COUNT -eq 0 ]; then
  echo "PARTIAL: Some checks passed ($PASS_COUNT passed, $SKIP_COUNT skipped)"
  echo ""
  echo "Run the following to complete setup:"
  echo "  npx @ruvector/cli hooks init"
  echo "  npx @ruvector/cli hooks install"
  exit 0
else
  echo "FAIL: $FAIL_COUNT check(s) failed"
  echo ""
  echo "To fix, run:"
  echo "  npx @ruvector/cli hooks init"
  echo "  npx @ruvector/cli hooks install"
  echo "  npx @ruvector/cli reasoningbank seed --kb-first"
  exit 1
fi
