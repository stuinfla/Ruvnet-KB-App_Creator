Updated: 2026-01-01 23:55:00 EST | Version 4.2.0
Created: 2026-01-01 23:55:00 EST

# KB-First Application Builder

Build applications where curated expert knowledge drives intelligent decision-making through GNN reasoning, attention routing, and SONA learning.

---

## Triggers

Use this skill when:
- "Build [description] with KB-First" (greenfield)
- "Apply KB-First to my existing app" (brownfield)
- "Score my existing KB"
- "What's my app compliance score?"
- "/kb-first" (invoke skill directly)

---

## The 10-Phase Build Process

| Phase | Name | Sub-Phases | Gate Type |
|-------|------|------------|-----------|
| 0 | Assessment | 6 | User Confirmation |
| 1 | Storage | 6 | Script Check |
| 1.5 | Hooks Setup | 4 | Hook Verify |
| 2 | KB Creation | 8 | Score ≥98 |
| 3 | Persistence | - | SQL Check |
| 4 | Visualization | - | Manual/Playwright |
| 5 | Integration | - | Compile Check |
| 6 | Scaffold | - | File Check |
| 7 | Build | 7 | Script Check |
| 8 | Verification | 8 | All Must Pass |

---

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

---

## Quick Start

### Greenfield (New Project)

```bash
# 1. Clone the KB-First builder
git clone https://github.com/ruvnet/kb-first-builder.git my-app
cd my-app

# 2. Create your intentions
cat > PROJECT_INTENTIONS.md << 'EOF'
# Project Intentions

## What I Want to Build
[Describe your application]

## Users
[Who will use this]

## Core Features
- Feature 1
- Feature 2

## Domain
[The knowledge domain]
EOF

# 3. Run the builder
/kb-first
```

### Brownfield (Existing Project)

```bash
# 1. Initialize KB-First in your project
npx kb-first-builder init

# 2. Score your current state
/kb-first score

# 3. See the transformation plan
/kb-first plan

# 4. Execute
/kb-first transform
```

---

## Phase 0: Assessment

For brownfield applications, Claude MUST score before any changes:

### KB Quality Score (0-100)
```
Expert Coverage (0-40):
  - 100+ experts cited = 40 points
  - 50-99 experts = 30 points
  - 20-49 experts = 20 points
  - <20 experts = 10 points

Depth Score (0-30):
  - Recursive depth ≥5 = 30 points
  - Depth 3-4 = 20 points
  - Depth 1-2 = 10 points

Completeness (0-30):
  - All nodes have content = 30 points
  - >90% = 20 points
  - <90% = 10 points
```

### App Compliance Score (0-100)
```
KB Imports (0-25):
  - All domain files import kb = 25 points

Source Returns (0-25):
  - All responses include kbSources = 25 points

No Hardcode (0-20):
  - No hardcoded values in domain = 20 points

Startup Verify (0-15):
  - Entry point verifies KB = 15 points

No Fallbacks (0-15):
  - No || DEFAULT patterns = 15 points
```

---

## Phase 1.5: Hooks Setup

**Without hooks, KB-First is an honor system.**

```bash
# Install and configure hooks
npx @ruvector/cli hooks init
npx @ruvector/cli hooks install

# Pre-train ReasoningBank
npx @ruvector/cli reasoningbank seed --kb-first

# Verify
./scripts/1.5-hooks-verify.sh
```

Hooks enforce:
- PreToolUse: Check KB before any Write/Edit
- PostToolUse: Record outcomes, trigger SONA learning
- SessionEnd: Persist patterns

---

## Scoring Formula

### KB Quality Score

| Component | Points | Criteria |
|-----------|--------|----------|
| Expert Coverage | 0-40 | Number of cited experts |
| Depth | 0-30 | Recursive depth of KB tree |
| Completeness | 0-30 | Nodes with actual content |
| Attribution | +5 | All nodes have source_expert |
| Confidence | +5 | All nodes have confidence score |

**Target: ≥98/100**

### App Compliance Score

| Component | Points | Criteria |
|-----------|--------|----------|
| KB Imports | 0-25 | All domain files import kb |
| Source Returns | 0-25 | All responses have kbSources |
| No Hardcode | 0-20 | No magic numbers in domain |
| Startup Verify | 0-15 | KB check in entry point |
| No Fallbacks | 0-15 | No `|| DEFAULT` patterns |

**Target: 100/100**

---

## Intelligence Patterns

### Pattern Selection

```
Q1: Does changing one variable affect many others?
    YES → Decision Web (GNN-first)

Q2: Do you need to route queries to different expert domains?
    YES → Combinatorial Routing (Attention-first)

Q3: Is "what worked for similar cases" the core value?
    YES → Scenario Learning (SONA-first)

Q4: Is this a continuous monitoring/optimization loop?
    YES → Continuous Optimization (Attention + SONA)

Otherwise → Standard KB-First (Vector Search primary)
```

### Technology Matrix

| Pattern | GNN | Attention | SONA | Vector |
|---------|-----|-----------|------|--------|
| Decision Web | PRIMARY | Compare | Learn | Foundation |
| Combinatorial Routing | Networks | PRIMARY | Patterns | Foundation |
| Scenario Learning | Dynamics | Parameters | PRIMARY | Foundation |
| Continuous Optimization | Structure | PRIMARY | PRIMARY | Foundation |

---

## Verification Checks (Phase 8)

| Check | Script | Purpose |
|-------|--------|---------|
| 8.1 | code-scan.sh | No hardcoded values |
| 8.2 | import-check.sh | KB imports required |
| 8.3 | source-returns.sh | kbSources in returns |
| 8.4 | startup-verify.sh | KB connection at startup |
| 8.5 | fallback-check.sh | No fallback patterns |
| 8.6 | attribution.sh | Expert attribution |
| 8.7 | confidence.sh | Confidence scores |
| 8.8 | gap-logging.sh | Gap detection |

All 8 checks must PASS for completion.

---

## Full Documentation

For complete documentation, see the KB-First Builder repository:
- Phases: `./phases/`
- Scripts: `./scripts/`
- Templates: `./templates/`
- References: `./references/`

---

*KB-First v4.2.0 — Intelligence-First Architecture*
