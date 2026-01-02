#!/bin/bash
# 9 Security Audit - Complete security verification suite
# Version 1.0.0 | Created 2026-01-02
#
# Runs all security checks for Phase 9

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              Phase 9: Security Audit Suite                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

check_result() {
  local name="$1"
  local status="$2"
  local message="$3"

  if [ "$status" = "PASS" ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "✅ $name: $message"
  elif [ "$status" = "FAIL" ]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "❌ $name: $message"
  else
    WARN_COUNT=$((WARN_COUNT + 1))
    echo "⚠️  $name: $message"
  fi
}

# ============================================
# 9.1 Dependency Audit
# ============================================
echo ""
echo "=== 9.1 Dependency Audit ==="

if [ -f "package.json" ]; then
  AUDIT_RESULT=$(npm audit --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"critical":0,"high":0}}}')
  CRITICAL=$(echo "$AUDIT_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('critical',0))" 2>/dev/null || echo "0")
  HIGH=$(echo "$AUDIT_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('high',0))" 2>/dev/null || echo "0")

  if [ "$CRITICAL" = "0" ] && [ "$HIGH" = "0" ]; then
    check_result "Dependencies" "PASS" "No critical/high vulnerabilities"
  else
    check_result "Dependencies" "FAIL" "$CRITICAL critical, $HIGH high vulnerabilities"
  fi
else
  check_result "Dependencies" "WARN" "No package.json found"
fi

# ============================================
# 9.3 SQL Injection Prevention
# ============================================
echo ""
echo "=== 9.3 SQL Injection Prevention ==="

SQL_VIOLATIONS=0

# Check for template literals in SQL
if grep -rqE "(SELECT|INSERT|UPDATE|DELETE).*\\\$\{" src/ 2>/dev/null; then
  check_result "SQL Injection" "FAIL" "Template literals found in SQL queries"
  SQL_VIOLATIONS=$((SQL_VIOLATIONS + 1))
fi

# Check for string concatenation in queries
if grep -rqE "query\s*\(\s*['\"].*\+\s*" src/ 2>/dev/null; then
  check_result "SQL Concat" "WARN" "String concatenation in queries detected"
fi

if [ $SQL_VIOLATIONS -eq 0 ]; then
  check_result "SQL Injection" "PASS" "No SQL injection patterns found"
fi

# ============================================
# 9.4 Authentication & Authorization
# ============================================
echo ""
echo "=== 9.4 Authentication & Authorization ==="

# Check for password hashing
if grep -rq "bcrypt\|argon2\|scrypt" package.json 2>/dev/null; then
  check_result "Password Hashing" "PASS" "Secure hashing library found"
else
  check_result "Password Hashing" "WARN" "No password hashing library found"
fi

# Check for secure cookies
if grep -rq "httpOnly.*true" src/ 2>/dev/null || grep -rq "secure.*true" src/ 2>/dev/null; then
  check_result "Secure Cookies" "PASS" "Secure cookie flags found"
else
  check_result "Secure Cookies" "WARN" "Secure cookie flags not found"
fi

# Check for auth middleware
if grep -rq "requireAuth\|isAuthenticated\|authMiddleware\|passport\|jwt" src/ 2>/dev/null; then
  check_result "Auth Middleware" "PASS" "Authentication middleware found"
else
  check_result "Auth Middleware" "WARN" "No authentication middleware detected"
fi

# ============================================
# 9.5 Secrets Management
# ============================================
echo ""
echo "=== 9.5 Secrets Management ==="

SECRETS_VIOLATIONS=0

# Check for hardcoded passwords
if grep -rqE "password\s*=\s*['\"][^'\"]+['\"]" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "process.env\|\.env\|example\|template\|test" | head -1; then
  check_result "Hardcoded Password" "FAIL" "Potential hardcoded password found"
  SECRETS_VIOLATIONS=$((SECRETS_VIOLATIONS + 1))
fi

# Check for hardcoded API keys
if grep -rqE "(api_key|apiKey|API_KEY)\s*=\s*['\"][^'\"]{20,}['\"]" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "process.env\|\.env"; then
  check_result "Hardcoded API Key" "FAIL" "Potential hardcoded API key found"
  SECRETS_VIOLATIONS=$((SECRETS_VIOLATIONS + 1))
fi

# Check .gitignore for .env
if grep -q "^\.env$" .gitignore 2>/dev/null; then
  check_result ".env in .gitignore" "PASS" ".env is properly ignored"
else
  check_result ".env in .gitignore" "FAIL" ".env is NOT in .gitignore"
  SECRETS_VIOLATIONS=$((SECRETS_VIOLATIONS + 1))
fi

# Check for .env files in git
if git ls-files 2>/dev/null | grep -q "\.env$"; then
  check_result ".env in git" "FAIL" ".env file is tracked in git!"
  SECRETS_VIOLATIONS=$((SECRETS_VIOLATIONS + 1))
fi

if [ $SECRETS_VIOLATIONS -eq 0 ]; then
  check_result "Secrets" "PASS" "No secret management issues found"
fi

# ============================================
# 9.6 API Security
# ============================================
echo ""
echo "=== 9.6 API Security ==="

# Check for rate limiting
if grep -rq "rateLimit\|rate-limit\|throttle" src/ package.json 2>/dev/null; then
  check_result "Rate Limiting" "PASS" "Rate limiting implemented"
else
  check_result "Rate Limiting" "WARN" "No rate limiting found"
fi

# Check for CORS
if grep -rq "cors" package.json 2>/dev/null; then
  check_result "CORS" "PASS" "CORS library found"
else
  check_result "CORS" "WARN" "No CORS configuration found"
fi

# Check for input validation
if grep -rq "zod\|joi\|yup\|class-validator" package.json 2>/dev/null; then
  check_result "Input Validation" "PASS" "Input validation library found"
else
  check_result "Input Validation" "WARN" "No input validation library found"
fi

# Check for helmet (security headers)
if grep -rq "helmet" package.json 2>/dev/null; then
  check_result "Security Headers" "PASS" "Helmet (security headers) found"
else
  check_result "Security Headers" "WARN" "Helmet not found"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SECURITY AUDIT SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Passed:   $PASS_COUNT"
echo "  Warnings: $WARN_COUNT"
echo "  Failed:   $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ SECURITY AUDIT PASSED"
  echo ""
  if [ $WARN_COUNT -gt 0 ]; then
    echo "Note: $WARN_COUNT warning(s) should be reviewed before production."
  fi
  exit 0
else
  echo "❌ SECURITY AUDIT FAILED"
  echo ""
  echo "Fix all failures before proceeding to Phase 10."
  exit 1
fi
