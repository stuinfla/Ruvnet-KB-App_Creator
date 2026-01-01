# KB-First Application Builder v3.0

## Intelligence-First Architecture for Knowledge Applications

**Version:** 3.0.0  
**Purpose:** Build applications where curated expert knowledge drives intelligent decision-making through GNN reasoning, attention routing, and SONA learning.

---

## How to Use This Skill

When you invoke this skill, Claude will:

1. **Analyze** what you're building (or reviewing your existing code)
2. **Identify** which intelligence pattern fits (Decision Web, Combinatorial Routing, Scenario Learning, or Continuous Optimization)
3. **Execute** the 8-phase build process with quality gates
4. **Enforce** KB-First rules throughout development
5. **Verify** no shortcuts were taken

**Trigger phrases:**
- "Apply KB-First 3.0 to build [description]"
- "Review my application with KB-First 3.0"
- "What intelligence pattern do I need for [description]?"

---

## Part 1: Intelligence Architecture

### The Four Technologies

Every KB-First application uses some combination of these:

#### 1. GNN — Graph Neural Networks (`@ruvector/gnn`)

**What it does:** Sees relationships between decisions and predicts cascading effects.

**When it's PRIMARY:**
- Decisions affect other decisions
- Need to answer "what happens if I do X?"
- Many interdependent variables

**Example domains:** Retirement planning, medical diagnosis, investment portfolios

```typescript
// GNN simulates decision cascades
const impact = await gnn.simulate(graph, {
  node: 'ss_claiming_age',
  newValue: 70
});
// Returns: effects on tax bracket, Roth space, Medicare premiums, etc.
```

#### 2. Attention Mechanisms (`@ruvector/attention`)

**What it does:** Routes queries to the right expert, compares options, focuses processing.

**When it's PRIMARY:**
- Multiple expert domains (travel: awards vs cash vs positioning)
- Need to compare many options efficiently
- Processing large amounts of content

**Key mechanisms:**
| Mechanism | Purpose |
|-----------|---------|
| MoE (Mixture of Experts) | Route query to right specialist |
| Cross-Attention | Compare two or more options |
| Flash Attention | Fast processing of large content |
| Graph Attention | Navigate relationship networks |
| Hyperbolic | Navigate hierarchies |

```typescript
// MoE routes to the right expert
const expert = await attention.routeToExpert(query, experts);
// Returns: best expert(s) for this query
```

#### 3. SONA — Self-Optimizing Neural Architecture (`@ruvector/sona`)

**What it does:** Learns from outcomes and remembers what worked.

**When it's PRIMARY:**
- "What worked for people like me?" is the core value
- You have feedback to learn from
- Building institutional knowledge over time

**Three learning loops:**
| Loop | Timing | Function |
|------|--------|----------|
| Instant (MicroLoRA) | Per-request | Fine-tune based on immediate feedback |
| Background (BaseLoRA) | Hourly | Extract patterns from successful interactions |
| Deep (EWC++) | Weekly | Consolidate without forgetting |

```typescript
// SONA recalls similar successful patterns
const patterns = await sona.recallPatterns(userProfile);
// Returns: what worked for similar users/situations
```

#### 4. Vector Search (Foundation)

**What it does:** Semantic retrieval from the knowledge base.

**Always required.** The foundation for all KB-First applications.

```sql
SELECT title, content, source_expert, confidence,
       embedding <=> $query_embedding AS distance
FROM kb_nodes
WHERE namespace = $namespace
ORDER BY distance
LIMIT 10;
```

---

### Intelligence Pattern Selection

Answer these questions to identify your pattern:

```
Q1: Does changing one variable affect many others?
    YES → Decision Web (GNN-first)
    NO  → Continue to Q2

Q2: Do you need to route queries to different expert domains?
    YES → Combinatorial Routing (Attention-first)
    NO  → Continue to Q3

Q3: Is "what worked for similar cases" the core value?
    YES → Scenario Learning (SONA-first)
    NO  → Continue to Q4

Q4: Is this a continuous monitoring/optimization loop?
    YES → Continuous Optimization (Attention + SONA)
    NO  → Standard KB-First (Vector Search primary)
```

### Technology Matrix by Pattern

| Pattern | GNN | Attention | SONA | Vector |
|---------|-----|-----------|------|--------|
| Decision Web | 🔴 PRIMARY | 🟡 Compare | 🟠 Learn patterns | ✅ Foundation |
| Combinatorial Routing | 🟠 Networks | 🔴 PRIMARY | 🟡 Success patterns | ✅ Foundation |
| Scenario Learning | 🟠 Dynamics | 🟡 Parameters | 🔴 PRIMARY | ✅ Foundation |
| Continuous Optimization | 🟡 Structure | 🔴 PRIMARY | 🔴 PRIMARY | ✅ Foundation |

---

## Part 2: The 8-Phase Build Process

Every KB-First application is built through these phases with quality gates.

### Phase 1: Storage Setup

**Purpose:** Ensure persistent storage is available.

**Steps:**
```bash
# Check for running storage
docker ps | grep ruvector-db

# If not running, start it
docker run -d --name ruvector-db \
  --restart unless-stopped \
  -e POSTGRES_PASSWORD=${RUVECTOR_PASSWORD:-secret} \
  -p 5432:5432 \
  -v ~/ruvector-data:/var/lib/postgresql/data \
  ruvnet/ruvector-postgres:latest

# Verify connection
export DATABASE_URL="postgresql://postgres:${RUVECTOR_PASSWORD:-secret}@localhost:5432/postgres"
psql "$DATABASE_URL" -c "SELECT 1"

# Initialize schema
psql "$DATABASE_URL" -f templates/schema.sql
```

**Quality Gate:** ✅ Connection verified, schema created.

**Detailed instructions:** `./phases/01-storage.md`

---

### Phase 2: World-Class Knowledge Base Creation

**Purpose:** Build a KB representing the collective expertise of top 100 world experts.

This phase has 8 sub-phases:

| Sub-Phase | Purpose | Output |
|-----------|---------|--------|
| 2.1 | Domain Scoping | Formal definition, boundaries |
| 2.2 | Perspective Expansion | User types, questions, edge cases |
| 2.3 | Expert Discovery | 100 experts, 500+ content items, 1000+ insights |
| 2.4 | Completeness Audit | 30+ identified gaps |
| 2.5 | Gap Filling | All gaps addressed with sources |
| 2.6 | Structure Organization | ≤9 primary nodes, unlimited depth |
| 2.7 | Recursive Depth | Actual data at all leaf nodes |
| 2.8 | Quality Loop | Iterate until score ≥98/100 |

**Key prompts:**
- Expert discovery: `./prompts/expert-discovery.md`
- Completeness audit: `./prompts/completeness-audit.md`
- Quality critique: `./prompts/quality-critique.md`

**Quality Gate:** ✅ KB score ≥98/100, all sub-phases complete.

**Detailed instructions:** `./phases/02-kb-creation.md`

---

### Phase 3: Persistence & Verification

**Purpose:** Store KB to PostgreSQL with embeddings and verify retrieval.

**Steps:**
1. Generate embeddings for all content
2. Insert nodes with expert attribution
3. Create HNSW index for fast search
4. Verify semantic search returns relevant results
5. Generate KB statistics report

```typescript
// Verify search quality
const results = await searchKB("withdrawal rate retirement", namespace);
assert(results.length > 0);
assert(results[0].sourceExpert); // Must have attribution
assert(results[0].confidence >= 0.5); // Must have confidence
```

**Quality Gate:** ✅ All nodes persisted, semantic search returns relevant results.

**Detailed instructions:** `./phases/03-persistence.md`

---

### Phase 4: Visualization

**Purpose:** Generate interactive visualization for human verification.

**Requirements:**
- Interactive tree (expandable/collapsible)
- Click node to see content + sources
- Search functionality
- Breadcrumb navigation
- Statistics display

**Quality Gate:** ✅ Full tree renders, navigation works, leaf content visible with sources.

**Detailed instructions:** `./phases/04-visualization.md`

---

### Phase 5: KB Integration Layer

**Purpose:** Generate TypeScript SDK for application to access KB.

**Output structure:**
```
src/kb/
├── client.ts      # Query functions
├── types.ts       # TypeScript interfaces
├── tree.ts        # Tree navigation
├── validator.ts   # Startup verification
└── index.ts       # Single export
```

**The SDK enforces:**
- All queries return sources
- Confidence scores on all results
- Gap logging for unanswered queries
- Connection verification on startup

**Quality Gate:** ✅ All files compile, exports work.

**Detailed instructions:** `./phases/05-integration.md`

---

### Phase 6: Application Scaffold

**Purpose:** Create project structure with KB enforcement built in.

**Output structure:**
```
[PROJECT]/
├── src/
│   ├── kb/           # FROM PHASE 5 (read-only)
│   ├── domain/       # Domain logic (MUST use kb/)
│   ├── api/          # Routes
│   ├── components/   # UI
│   ├── pages/        # Page compositions
│   └── index.ts      # Entry point (KB verification FIRST)
├── visualization/    # FROM PHASE 4
└── KB_ENFORCEMENT.md # Rules document
```

**Quality Gate:** ✅ Structure complete, entry point verifies KB first.

**Detailed instructions:** `./phases/06-scaffold.md`

---

### Phase 7: Application Build (KB Enforced)

**Purpose:** Build the application with strict KB enforcement.

**⚠️ THIS IS WHERE SHORTCUTS HAPPEN. MAXIMUM ENFORCEMENT.**

### KB Enforcement Rules

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

### Build Sequence

1. Generate `KB_ENFORCEMENT.md` (keep in context always)
2. Plan domain functions (list them all first)
3. Implement ONE function at a time
4. **VERIFY after EACH function:**
   - Does it import from kb/?
   - Does it return kbSources?
   - Any hardcoded values?
   - If FAIL → fix before continuing
5. Implement API layer
6. Implement UI
7. Implement pages
8. Integration testing

**Quality Gate:** ✅ All functions verified, no hardcoded values, all responses have kbSources.

**Detailed instructions:** `./phases/07-build.md`

---

### Phase 8: Final Verification

**Purpose:** Comprehensive check that all rules are followed.

**Verification checklist:**
```
[ ] No hardcoded domain values (grep for patterns)
[ ] All domain files import from kb/
[ ] All responses include kbSources array
[ ] Startup verifies KB connection before anything else
[ ] No fallback logic (no || DEFAULT patterns)
[ ] All experts have attribution
[ ] All nodes have confidence scores
[ ] Gap logging is active
[ ] Intelligence layer (GNN/Attention/SONA) properly integrated
```

**Quality Gate:** ✅ All checks pass.

**Detailed instructions:** `./phases/08-verification.md`

---

## Part 3: Pattern Implementation Guides

Detailed implementation guides for each pattern:

| Pattern | Guide |
|---------|-------|
| Decision Web | `./patterns/decision-web.md` |
| Combinatorial Routing | `./patterns/combinatorial-routing.md` |
| Scenario Learning | `./patterns/scenario-learning.md` |
| Continuous Optimization | `./patterns/continuous-optimization.md` |

---

## Part 4: Quick Reference

### SONA Configuration by Domain

| Domain Stability | ewc_lambda | base_lora_rank | pattern_threshold |
|------------------|------------|----------------|-------------------|
| Very stable (finance, law) | 0.6 | 16 | 0.8 |
| Moderate (business, travel) | 0.4 | 8-12 | 0.7 |
| Fast-changing (SEO, markets) | 0.2 | 4-8 | 0.6 |

### Attention Mechanism Selection

| Task | Mechanism |
|------|-----------|
| Route to expert | MoE |
| Compare 2 options | Cross-attention |
| Compare many options | Cross-attention + batching |
| Process long document | Flash attention |
| Process 8K+ tokens | Linear attention |
| Navigate hierarchy | Hyperbolic attention |
| Navigate graph | Graph attention |

### File References

| Reference | Path |
|-----------|------|
| PostgreSQL Functions | `./references/ruvector-functions.md` |
| Attention Mechanisms | `./references/attention-mechanisms.md` |
| SONA Configuration | `./references/sona-config.md` |
| Claude Code Hooks | `./references/hooks-integration.md` |

### Templates

| Template | Path |
|----------|------|
| Database Schema | `./templates/schema.sql` |
| KB Client | `./templates/kb-client.ts` |
| GNN Engine | `./templates/gnn-engine.ts` |
| Attention Router | `./templates/attention-router.ts` |
| SONA Config | `./templates/sona-config.ts` |

---

## Part 5: Diagnostic Mode

When reviewing an existing application, Claude checks:

### 1. Pattern Identification
- What intelligence pattern does this application need?
- Is it currently implemented correctly?

### 2. Missing Intelligence
- **Decision Web apps:** Is GNN implemented? Are relationships modeled?
- **Routing apps:** Is MoE routing to experts? Are experts defined?
- **Learning apps:** Is SONA configured? Is outcome tracking present?
- **Optimization apps:** Is the feedback loop closed?

### 3. KB Enforcement
- Are all domain values from KB?
- Do all responses have sources?
- Is startup verification in place?
- Is gap logging active?

### 4. Configuration Issues
- Is SONA ewc_lambda appropriate for domain stability?
- Are attention mechanisms matching cognitive tasks?
- Is graph structure complete (for GNN apps)?

### Diagnostic Checklist

```
INTELLIGENCE LAYER:
[ ] Primary technology identified and implemented
[ ] Secondary technology integrated
[ ] Tertiary technology available

KB ENFORCEMENT:
[ ] No hardcoded domain values
[ ] All responses have kbSources
[ ] Expert attribution on all nodes
[ ] Confidence scores present
[ ] Gap detection active
[ ] Startup verification present

CONFIGURATION:
[ ] SONA ewc_lambda matches domain stability
[ ] Attention mechanisms match tasks
[ ] Graph relationships complete (if GNN)
[ ] Expert domains defined (if MoE)
```

---

## The Core Principle

**Your knowledge base is not just storage. It's the foundation for a reasoning system.**

- **Vector search** finds relevant content
- **GNN** sees how things connect and cascade
- **Attention** routes to the right expertise and compares options
- **SONA** remembers what worked

The magic happens when these work together. A retirement advisor that just searches is a fancy FAQ. A retirement advisor with GNN modeling decision interdependencies, SONA learning from thousands of users, and cross-attention comparing scenarios — that's an intelligent system that gets smarter over time.

**Build intelligence, not just retrieval.**

---

*KB-First v3.0 — Intelligence-First Architecture*
