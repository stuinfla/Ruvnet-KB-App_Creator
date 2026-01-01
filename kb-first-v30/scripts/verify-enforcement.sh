#!/bin/bash
# KB-First Final Verification Script
# Run this to verify all KB enforcement rules are followed

set -e

echo "=== KB-First v3.0 Verification ==="
echo ""

errors=0
warnings=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
  echo -e "  ${GREEN}✅${NC} $1"
}

fail() {
  echo -e "  ${RED}❌${NC} $1"
  errors=$((errors + 1))
}

warn() {
  echo -e "  ${YELLOW}⚠️${NC} $1"
  warnings=$((warnings + 1))
}

# ============================================
# Rule 1: No Hardcoded Domain Logic
# ============================================
echo "Rule 1: No hardcoded domain logic..."

if [ -d "src/domain" ]; then
  # Check for hardcoded decimals (likely rates/percentages)
  hardcoded=$(grep -rnE "= 0\.[0-9]+" src/domain/ 2>/dev/null | grep -v "confidence" | grep -v "test" || true)
  if [ -n "$hardcoded" ]; then
    fail "Found potential hardcoded decimals:"
    echo "$hardcoded" | head -5
  else
    pass "No hardcoded decimals found"
  fi
  
  # Check for DEFAULT_ constants
  defaults=$(grep -rn "DEFAULT_" src/domain/ 2>/dev/null || true)
  if [ -n "$defaults" ]; then
    fail "Found DEFAULT_ constants:"
    echo "$defaults" | head -5
  else
    pass "No DEFAULT_ constants found"
  fi
else
  warn "src/domain/ directory not found"
fi

# ============================================
# Rule 2: All Domain Files Import KB
# ============================================
echo ""
echo "Rule 2: All domain files import from kb/..."

if [ -d "src/domain" ]; then
  for file in src/domain/*.ts; do
    if [ -f "$file" ]; then
      if ! grep -q "from.*kb" "$file"; then
        fail "$file does not import from kb/"
      fi
    fi
  done
  
  if [ $errors -eq 0 ]; then
    pass "All domain files import from kb/"
  fi
else
  warn "src/domain/ directory not found"
fi

# ============================================
# Rule 3: Responses Include kbSources
# ============================================
echo ""
echo "Rule 3: Responses include kbSources..."

if [ -d "src/domain" ]; then
  missing_sources=$(grep -rL "kbSources" src/domain/*.ts 2>/dev/null || true)
  if [ -n "$missing_sources" ]; then
    warn "Files may not return kbSources:"
    echo "$missing_sources"
  else
    pass "kbSources found in domain files"
  fi
else
  warn "src/domain/ directory not found"
fi

# ============================================
# Rule 4: Startup Verification
# ============================================
echo ""
echo "Rule 4: Startup verification..."

if [ -f "src/index.ts" ]; then
  if grep -q "verifyConnection" src/index.ts; then
    pass "Entry point calls verifyConnection"
  else
    fail "Entry point does not verify KB connection"
  fi
  
  if grep -q "process.exit" src/index.ts; then
    pass "Entry point exits on failure"
  else
    fail "Entry point does not exit on KB failure"
  fi
else
  warn "src/index.ts not found"
fi

# ============================================
# Rule 5: No Fallback Logic
# ============================================
echo ""
echo "Rule 5: No fallback logic..."

if [ -d "src/domain" ]; then
  fallbacks=$(grep -rnE "\|\| DEFAULT|\|\| \[|\|\| \{\}" src/domain/ 2>/dev/null || true)
  if [ -n "$fallbacks" ]; then
    fail "Found fallback patterns:"
    echo "$fallbacks" | head -5
  else
    pass "No fallback patterns found"
  fi
else
  warn "src/domain/ directory not found"
fi

# ============================================
# KB_ENFORCEMENT.md Check
# ============================================
echo ""
echo "KB Enforcement document..."

if [ -f "KB_ENFORCEMENT.md" ]; then
  pass "KB_ENFORCEMENT.md present"
else
  warn "KB_ENFORCEMENT.md not found in project root"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "=== Summary ==="

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC}"
  exit 0
elif [ $errors -eq 0 ]; then
  echo -e "${YELLOW}$warnings warning(s), no errors${NC}"
  exit 0
else
  echo -e "${RED}$errors error(s), $warnings warning(s)${NC}"
  exit 1
fi
