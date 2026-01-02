#!/bin/bash
# KB-First Project Initializer
# Version 4.2.0 | Created 2026-01-01
#
# Initialize KB-First in a new or existing project

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           KB-First Project Initialization v4.2.0             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in a git repo
if [ ! -d ".git" ]; then
  echo "⚠️  Warning: Not in a git repository"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Determine project type
echo "Detecting project type..."
if [ -f "package.json" ]; then
  PROJECT_TYPE="node"
  echo "  Detected: Node.js project"
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
  PROJECT_TYPE="python"
  echo "  Detected: Python project"
elif [ -f "Cargo.toml" ]; then
  PROJECT_TYPE="rust"
  echo "  Detected: Rust project"
elif [ -f "go.mod" ]; then
  PROJECT_TYPE="go"
  echo "  Detected: Go project"
else
  PROJECT_TYPE="generic"
  echo "  Detected: Generic project"
fi

# Create CLAUDE.md with KB-First rules
echo ""
echo "Creating CLAUDE.md with KB-First rules..."

cat > CLAUDE.md << 'EOF'
# KB-First Project Configuration

This project uses the KB-First architecture. All development must follow these rules.

## Critical Rules (NEVER VIOLATE)

```
RULE 1: No hardcoded domain logic
        ❌ const rate = 0.04;
        ✅ const rate = await kb.search("withdrawal rate");

RULE 2: Every domain function queries KB
        Every file in src/domain/ imports from ../kb

RULE 3: All responses include kbSources
        Traceability is mandatory

RULE 4: Startup verification required
        App exits if KB unavailable

RULE 5: No fallback logic
        ❌ rules = kb.get() || DEFAULT_RULES
        ✅ rules = kb.get(); if (!rules) throw Error("KB missing");
```

## KB Quality Score Target: ≥98/100

| Component | Points | Criteria |
|-----------|--------|----------|
| Expert Coverage | 0-40 | Number of cited experts |
| Depth | 0-30 | Recursive depth of KB tree |
| Completeness | 0-30 | Nodes with actual content |
| Attribution | +5 | All nodes have source_expert |
| Confidence | +5 | All nodes have confidence score |

## App Compliance Score Target: 100/100

| Component | Points | Criteria |
|-----------|--------|----------|
| KB Imports | 0-25 | All domain files import kb |
| Source Returns | 0-25 | All responses have kbSources |
| No Hardcode | 0-20 | No magic numbers in domain |
| Startup Verify | 0-15 | KB check in entry point |
| No Fallbacks | 0-15 | No `|| DEFAULT` patterns |

## Commands

```
/kb-first              # Run KB-First builder
/kb-first score        # Score current state
/kb-first verify       # Run verification checks
```

## Phase Documentation

See: https://github.com/ruvnet/kb-first-builder

---

*KB-First v4.2.0*
EOF

echo "  ✅ Created CLAUDE.md"

# Create project structure
echo ""
echo "Creating project structure..."

# Create directories
mkdir -p src/kb
mkdir -p src/domain
mkdir -p src/api
mkdir -p visualization

# Create KB enforcement document
cat > KB_ENFORCEMENT.md << 'EOF'
# KB Enforcement Rules

## BEFORE Writing Any Domain Logic

1. Query KB for relevant data
2. Never hardcode numeric values
3. Never use fallback defaults
4. Always return kbSources

## Domain File Template

```typescript
import { kb } from '../kb';

export async function calculate(input: Input): Promise<Result> {
  // Query KB for domain rules
  const rules = await kb.search('calculation rules', { namespace: 'domain' });

  if (!rules || rules.length === 0) {
    throw new Error('KB missing required rules');
  }

  // Use KB values
  const rate = rules.find(r => r.key === 'rate')?.value;

  // Perform calculation
  const result = performCalculation(input, rate);

  // Return with sources
  return {
    ...result,
    kbSources: rules.map(r => ({
      title: r.title,
      expert: r.source_expert,
      confidence: r.confidence
    }))
  };
}
```

## Verification Before Commit

Run: `/kb-first verify`

All 8 checks must PASS:
- 8.1: No hardcoded values
- 8.2: KB imports in all domain files
- 8.3: kbSources in all returns
- 8.4: Startup verification
- 8.5: No fallback patterns
- 8.6: Expert attribution
- 8.7: Confidence scores
- 8.8: Gap logging
EOF

echo "  ✅ Created KB_ENFORCEMENT.md"

# Create minimal KB client stub
cat > src/kb/index.ts << 'EOF'
/**
 * KB Client - Knowledge Base Interface
 *
 * This is a stub. Replace with your actual KB implementation.
 * See: https://github.com/ruvnet/kb-first-builder
 */

export interface KBNode {
  id: string;
  title: string;
  content: string;
  source_expert: string;
  confidence: number;
  namespace: string;
}

export interface KBSearchOptions {
  namespace?: string;
  limit?: number;
  minConfidence?: number;
}

export interface KBSource {
  title: string;
  expert: string;
  confidence: number;
}

class KBClient {
  private connected = false;

  async verifyConnection(): Promise<boolean> {
    // TODO: Implement actual connection check
    // Should return false if KB is unavailable
    console.log('[KB] Verifying connection...');
    this.connected = true;
    return this.connected;
  }

  async search(query: string, options?: KBSearchOptions): Promise<KBNode[]> {
    if (!this.connected) {
      throw new Error('KB not connected. Call verifyConnection() first.');
    }

    // TODO: Implement actual KB search
    // This should query your PostgreSQL database
    console.log(`[KB] Searching: "${query}"`);

    return [];
  }

  async logGap(query: string): Promise<void> {
    // TODO: Log unanswered queries for KB improvement
    console.log(`[KB] Gap logged: "${query}"`);
  }
}

export const kb = new KBClient();
export default kb;
EOF

echo "  ✅ Created src/kb/index.ts (stub)"

# Create entry point stub
cat > src/index.ts << 'EOF'
/**
 * Application Entry Point
 *
 * KB-First: Verify KB connection before anything else
 */

import { kb } from './kb';

async function main() {
  // KB-First: Verify connection FIRST
  console.log('Verifying KB connection...');
  const kbOk = await kb.verifyConnection();

  if (!kbOk) {
    console.error('ERROR: KB unavailable. Cannot start application.');
    process.exit(1);
  }

  console.log('KB connected successfully.');

  // TODO: Initialize your application
  console.log('Application starting...');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
EOF

echo "  ✅ Created src/index.ts with KB verification"

# Create scripts directory and copy verification scripts
echo ""
echo "Setting up verification scripts..."

mkdir -p scripts

# Create a simplified verification script
cat > scripts/verify-all.sh << 'EOF'
#!/bin/bash
# KB-First Verification Suite
# Run all Phase 8 verification checks

set -e

echo "=== KB-First Verification Suite ==="
echo ""

PASS=0
FAIL=0

# Check 1: No hardcoded values in domain
echo "8.1 Checking for hardcoded values..."
if grep -rE "= [0-9]+\.[0-9]+" src/domain 2>/dev/null | grep -v "node_modules"; then
  echo "  ❌ FAIL: Hardcoded values found"
  FAIL=$((FAIL + 1))
else
  echo "  ✅ PASS: No hardcoded values"
  PASS=$((PASS + 1))
fi

# Check 2: KB imports
echo "8.2 Checking KB imports..."
if [ -d "src/domain" ]; then
  MISSING=$(find src/domain -name "*.ts" -o -name "*.js" 2>/dev/null | while read f; do
    if ! grep -q "from.*kb" "$f" 2>/dev/null; then
      echo "$f"
    fi
  done)
  if [ -n "$MISSING" ]; then
    echo "  ❌ FAIL: Files missing KB import"
    FAIL=$((FAIL + 1))
  else
    echo "  ✅ PASS: All domain files import KB"
    PASS=$((PASS + 1))
  fi
else
  echo "  ⏭️ SKIP: No src/domain directory"
fi

# Check 3: Startup verification
echo "8.4 Checking startup verification..."
if grep -q "verifyConnection" src/index.ts 2>/dev/null; then
  echo "  ✅ PASS: Startup verification found"
  PASS=$((PASS + 1))
else
  echo "  ❌ FAIL: No startup verification"
  FAIL=$((FAIL + 1))
fi

# Check 4: No fallback patterns
echo "8.5 Checking for fallback patterns..."
if grep -rE "\|\| \[\]|\|\| \{\}|\|\| null|\|\| 0|\?\? \[\]|\?\? \{\}" src/domain 2>/dev/null | grep -v "node_modules"; then
  echo "  ❌ FAIL: Fallback patterns found"
  FAIL=$((FAIL + 1))
else
  echo "  ✅ PASS: No fallback patterns"
  PASS=$((PASS + 1))
fi

echo ""
echo "================================================"
echo "Results: $PASS passed, $FAIL failed"

if [ $FAIL -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
else
  echo "❌ Some checks failed. Review and fix before proceeding."
  exit 1
fi
EOF

chmod +x scripts/verify-all.sh
echo "  ✅ Created scripts/verify-all.sh"

# Create PROJECT_INTENTIONS.md template
echo ""
echo "Creating PROJECT_INTENTIONS.md template..."

cat > PROJECT_INTENTIONS.md << 'EOF'
# Project Intentions

## What I Want to Build

[Describe your application in 2-3 sentences]

## Who Will Use This

[Describe your target users]

## Core Features

1. [Feature 1]
2. [Feature 2]
3. [Feature 3]

## Knowledge Domain

[What domain knowledge does this application need?]

## Example Queries

What questions should the KB be able to answer?

1. [Example question 1]
2. [Example question 2]
3. [Example question 3]

## Success Criteria

How will you know when the application is complete?

1. [Criterion 1]
2. [Criterion 2]
3. [Criterion 3]

---

*Fill out this file, then run `/kb-first` to start building.*
EOF

echo "  ✅ Created PROJECT_INTENTIONS.md"

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ KB-First project initialized!"
echo ""
echo "Project structure:"
echo "  ├── CLAUDE.md           # KB-First rules for Claude"
echo "  ├── KB_ENFORCEMENT.md   # Enforcement documentation"
echo "  ├── PROJECT_INTENTIONS.md # Fill this out first!"
echo "  ├── src/"
echo "  │   ├── kb/             # KB client"
echo "  │   ├── domain/         # Domain logic (uses KB)"
echo "  │   ├── api/            # API routes"
echo "  │   └── index.ts        # Entry point (verifies KB)"
echo "  ├── scripts/"
echo "  │   └── verify-all.sh   # Verification suite"
echo "  └── visualization/      # KB visualization"
echo ""
echo "Next steps:"
echo "  1. Fill out PROJECT_INTENTIONS.md"
echo "  2. Run: /kb-first"
echo ""
echo "═══════════════════════════════════════════════════════════════"
