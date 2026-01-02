#!/bin/bash
# KB-First Auto-Detection Hook
#
# This hook runs on session start to detect if the current project
# should be using KB-First methodology.
#
# Install to: ~/.claude/hooks/kb-first-autodetect.sh
# Add to settings.json:
#   "hooks": {
#     "SessionStart": ["~/.claude/hooks/kb-first-autodetect.sh"]
#   }
#
# Version: 5.0.0
# Created: 2026-01-02

set -e

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

PROJECT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
KB_FIRST_CONFIG="$PROJECT_DIR/.ruvector/config.json"

# ============================================
# Check 1: Already a KB-First Project
# ============================================
if [ -f "$KB_FIRST_CONFIG" ]; then
  # Project is already KB-First enabled
  echo "📚 KB-First project detected"

  # Read current phase
  CURRENT_PHASE=$(cat "$KB_FIRST_CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('phases',{}).get('current',0))" 2>/dev/null || echo "0")

  echo "   Phase: $CURRENT_PHASE"
  echo "   Run: kb-first status"
  exit 0
fi

# ============================================
# Check 2: Detect KB-First Indicators
# ============================================
KB_SCORE=0
KB_INDICATORS=""

# Check for knowledge-intensive directories
if [ -d "$PROJECT_DIR/docs" ] && [ "$(find "$PROJECT_DIR/docs" -name "*.md" 2>/dev/null | wc -l)" -gt 5 ]; then
  KB_SCORE=$((KB_SCORE + 20))
  KB_INDICATORS="$KB_INDICATORS\n  • Extensive documentation"
fi

# Check for domain-specific content
if grep -rq "knowledge\|domain\|expertise\|specification" "$PROJECT_DIR/README.md" 2>/dev/null; then
  KB_SCORE=$((KB_SCORE + 15))
  KB_INDICATORS="$KB_INDICATORS\n  • Domain-specific content in README"
fi

# Check for existing schema/database references
if find "$PROJECT_DIR" -name "*.sql" -o -name "*schema*" -o -name "*migration*" 2>/dev/null | head -1 | grep -q .; then
  KB_SCORE=$((KB_SCORE + 15))
  KB_INDICATORS="$KB_INDICATORS\n  • Database/schema files present"
fi

# Check for API/specification files
if find "$PROJECT_DIR" -name "openapi*" -o -name "swagger*" -o -name "*.graphql" 2>/dev/null | head -1 | grep -q .; then
  KB_SCORE=$((KB_SCORE + 15))
  KB_INDICATORS="$KB_INDICATORS\n  • API specification files"
fi

# Check for vector/embedding references
if grep -rq "vector\|embedding\|similarity\|semantic" "$PROJECT_DIR" --include="*.json" --include="*.yaml" --include="*.yml" 2>/dev/null; then
  KB_SCORE=$((KB_SCORE + 20))
  KB_INDICATORS="$KB_INDICATORS\n  • Vector/embedding references"
fi

# Check for ruvector dependency
if grep -q "ruvector\|pgvector\|qdrant\|pinecone" "$PROJECT_DIR/package.json" 2>/dev/null; then
  KB_SCORE=$((KB_SCORE + 20))
  KB_INDICATORS="$KB_INDICATORS\n  • Vector database dependency"
fi

# Check for existing KB-related files
if find "$PROJECT_DIR" -name "*knowledge*" -o -name "*kb*" 2>/dev/null | head -1 | grep -q .; then
  KB_SCORE=$((KB_SCORE + 15))
  KB_INDICATORS="$KB_INDICATORS\n  • KB-related file names"
fi

# ============================================
# Output Recommendation
# ============================================
if [ $KB_SCORE -ge 50 ]; then
  echo "🔍 KB-First Recommended (Score: $KB_SCORE/100)"
  echo ""
  echo "This project shows indicators of knowledge-intensive work:"
  echo -e "$KB_INDICATORS"
  echo ""
  echo "Initialize KB-First with:"
  echo "  npx ruvnet-kb-first init"
  echo ""
  echo "Or skip this check:"
  echo "  touch $PROJECT_DIR/.ruvector/.skip-detection"
elif [ $KB_SCORE -ge 25 ]; then
  echo "💡 KB-First might be beneficial (Score: $KB_SCORE/100)"
  echo "   Run: npx ruvnet-kb-first init --help"
fi

exit 0
