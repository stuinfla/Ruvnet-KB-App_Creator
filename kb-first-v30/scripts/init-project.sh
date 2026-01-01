#!/bin/bash
# KB-First Project Initialization Script
# Creates a new KB-First application scaffold

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     KB-First v3.0 Project Init        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# Get project name
if [ -z "$1" ]; then
  read -p "Project name: " PROJECT_NAME
else
  PROJECT_NAME=$1
fi

# Validate project name
if [[ ! "$PROJECT_NAME" =~ ^[a-z0-9-]+$ ]]; then
  echo -e "${RED}Error: Project name must be lowercase alphanumeric with hyphens${NC}"
  exit 1
fi

# Get domain topic
if [ -z "$2" ]; then
  read -p "Domain topic (e.g., 'retirement planning'): " DOMAIN_TOPIC
else
  DOMAIN_TOPIC=$2
fi

# Select pattern
echo ""
echo "Select intelligence pattern:"
echo "  1) Decision Web (GNN) - When decisions cascade"
echo "  2) Combinatorial Routing (Attention) - When routing to experts"
echo "  3) Scenario Learning (SONA) - When learning from outcomes"
echo "  4) Continuous Optimization (Attention+SONA) - For ongoing monitoring"
echo ""
read -p "Pattern [1-4]: " PATTERN_CHOICE

case $PATTERN_CHOICE in
  1) PATTERN="decision-web" ;;
  2) PATTERN="combinatorial-routing" ;;
  3) PATTERN="scenario-learning" ;;
  4) PATTERN="continuous-optimization" ;;
  *) echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
esac

echo ""
echo -e "${GREEN}Creating project: $PROJECT_NAME${NC}"
echo -e "Domain: $DOMAIN_TOPIC"
echo -e "Pattern: $PATTERN"
echo ""

# Create directory structure
mkdir -p "$PROJECT_NAME"/{src/{kb,domain,api/routes,components,pages,intelligence},visualization,scripts}

# Create KB_ENFORCEMENT.md
cat > "$PROJECT_NAME/KB_ENFORCEMENT.md" << 'EOF'
# KB ENFORCEMENT RULES

This document defines the rules for KB-First development.
ALL code must comply with these rules.

## Rule 1: No Hardcoded Domain Logic
Every domain value comes from the KB.

❌ WRONG:
```typescript
const withdrawalRate = 0.04;
```

✅ CORRECT:
```typescript
const rateResult = await kb.search("withdrawal rate");
```

## Rule 2: Every Domain Function Queries KB
Every file in src/domain/ MUST import from ../kb

## Rule 3: All Responses Include kbSources
Traceability is mandatory.

```typescript
return {
  data: result,
  kbSources: sources
};
```

## Rule 4: Startup Verification Required
App exits if KB unavailable.

## Rule 5: No Fallback Logic
KB is the source of truth.

❌ WRONG:
```typescript
const rules = kb.get() || DEFAULT_RULES;
```

✅ CORRECT:
```typescript
const rules = kb.get();
if (!rules) throw new Error("KB unavailable");
```
EOF

# Create package.json
cat > "$PROJECT_NAME/package.json" << EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "description": "KB-First application for $DOMAIN_TOPIC",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "verify": "./scripts/verify-enforcement.sh",
    "test": "jest"
  },
  "keywords": ["kb-first", "$PATTERN"],
  "dependencies": {
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/pg": "^8.10.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
EOF

# Create tsconfig.json
cat > "$PROJECT_NAME/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create entry point
cat > "$PROJECT_NAME/src/index.ts" << 'EOF'
import { kb } from './kb';

async function main() {
  console.log('Starting KB-First application...');
  
  // RULE 4: Verify KB first
  console.log('Verifying knowledge base connection...');
  const health = await kb.verifyConnection();
  
  if (!health.healthy) {
    console.error('KB unavailable:', health.error);
    console.error('Cannot start application without knowledge base.');
    process.exit(1);
  }
  
  console.log(`KB ready: ${health.nodeCount} nodes`);
  
  // Initialize application
  // TODO: Add your application initialization here
  
  console.log('Application started successfully');
}

main().catch((error) => {
  console.error('Startup failed:', error);
  process.exit(1);
});
EOF

# Create KB types
cat > "$PROJECT_NAME/src/kb/types.ts" << 'EOF'
export interface KBNode {
  id: string;
  namespace: string;
  path: string;
  title: string;
  content: string | null;
  sourceExpert: string;
  sourceUrl: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface KBSource {
  nodeId: string;
  expert: string;
  url: string;
  confidence: number;
}

export interface KBResponse<T> {
  data: T;
  kbSources: KBSource[];
  confidence: number;
  gap: boolean;
  gapReason?: string;
}

export interface KBHealth {
  healthy: boolean;
  nodeCount: number;
  gapCount: number;
  error?: string;
}
EOF

# Create KB index
cat > "$PROJECT_NAME/src/kb/index.ts" << 'EOF'
import { Pool } from 'pg';
import { KBNode, KBResponse, KBSource, KBHealth } from './types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function verifyConnection(): Promise<KBHealth> {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM kb_nodes) as node_count,
        (SELECT COUNT(*) FROM kb_gaps) as gap_count
    `);
    
    return {
      healthy: true,
      nodeCount: parseInt(result.rows[0].node_count),
      gapCount: parseInt(result.rows[0].gap_count)
    };
  } catch (error) {
    return {
      healthy: false,
      nodeCount: 0,
      gapCount: 0,
      error: error.message
    };
  }
}

export async function search(
  query: string,
  namespace: string
): Promise<KBResponse<KBNode[]>> {
  // TODO: Implement with your embedding solution
  throw new Error('Implement search with your embedding provider');
}

export async function logGap(query: string, namespace: string): Promise<void> {
  await pool.query(`
    INSERT INTO kb_gaps (namespace, query, created_at)
    VALUES ($1, $2, NOW())
  `, [namespace, query]);
}

export const kb = {
  verifyConnection,
  search,
  logGap
};

export * from './types';
EOF

# Create verification script
cat > "$PROJECT_NAME/scripts/verify-enforcement.sh" << 'SCRIPT'
#!/bin/bash
# KB-First Enforcement Verification

echo "=== KB-First Verification ==="

errors=0

# Rule 1: No hardcoded values
echo "Checking for hardcoded values..."
if grep -rqE "= 0\.[0-9]+" src/domain/ 2>/dev/null; then
  echo "  ❌ Found hardcoded decimals in domain/"
  errors=$((errors + 1))
else
  echo "  ✅ No hardcoded decimals"
fi

# Rule 2: All domain files import kb
echo "Checking KB imports..."
for file in src/domain/*.ts; do
  if [ -f "$file" ] && ! grep -q "from.*kb" "$file"; then
    echo "  ❌ $file does not import from kb/"
    errors=$((errors + 1))
  fi
done

# Rule 4: Entry point verification
echo "Checking entry point..."
if grep -q "verifyConnection" src/index.ts; then
  echo "  ✅ Entry point verifies KB"
else
  echo "  ❌ Entry point missing KB verification"
  errors=$((errors + 1))
fi

echo ""
if [ $errors -eq 0 ]; then
  echo "✅ All checks passed!"
else
  echo "❌ $errors error(s) found"
  exit 1
fi
SCRIPT

chmod +x "$PROJECT_NAME/scripts/verify-enforcement.sh"

# Create checkpoint file
cat > "$PROJECT_NAME/kb-checkpoint.json" << EOF
{
  "project": "$PROJECT_NAME",
  "domain": "$DOMAIN_TOPIC",
  "pattern": "$PATTERN",
  "currentPhase": 1,
  "completedPhases": [],
  "startedAt": "$(date -Iseconds)",
  "kbStats": {
    "experts": 0,
    "nodes": 0,
    "qualityScore": 0
  }
}
EOF

# Create README
cat > "$PROJECT_NAME/README.md" << EOF
# $PROJECT_NAME

A KB-First application for **$DOMAIN_TOPIC**.

## Pattern: $PATTERN

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Set database URL
export DATABASE_URL="postgresql://..."

# Run verification
npm run verify

# Start development
npm run dev
\`\`\`

## KB Enforcement

This project follows KB-First rules. See \`KB_ENFORCEMENT.md\`.

## Phase Progress

Check \`kb-checkpoint.json\` for current build progress.
EOF

echo ""
echo -e "${GREEN}✅ Project created successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. cd $PROJECT_NAME"
echo "  2. npm install"
echo "  3. Set DATABASE_URL environment variable"
echo "  4. Follow the 8-phase build process in SKILL.md"
echo ""
echo -e "${BLUE}Current phase: 1 (Storage Setup)${NC}"
