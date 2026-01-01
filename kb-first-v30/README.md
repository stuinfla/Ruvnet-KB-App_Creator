# KB-First Application Builder v3.0

## Build Intelligent Applications on Expert Knowledge

<p align="center">
  <img src="assets/kb-first-architecture.svg" alt="KB-First Architecture" width="800">
</p>

**KB-First** is a methodology and skill for building applications where **curated expert knowledge drives intelligent decision-making**. Every response is grounded in verified sources. Every decision can be traced. Every gap is detected and logged.

This is **not just RAG** (Retrieval-Augmented Generation). RAG retrieves context to supplement responses. KB-First applications treat the knowledge base as the **authoritative source** — if it's not in the KB, the system says so.

---

## 🎯 What This Solves

| Problem | KB-First Solution |
|---------|-------------------|
| AI hallucinations | Every response cites KB sources or acknowledges gaps |
| Untraceable advice | Every answer includes expert attribution |
| Generic responses | Domain-specific knowledge from top experts |
| Static systems | SONA learning improves with usage |
| Simple search | GNN models decision cascades, Attention routes to experts |

---

## 🧠 The Intelligence Stack

KB-First leverages the full **RuVector** stack for intelligent applications:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE INTELLIGENCE STACK                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │      GNN        │  │    ATTENTION    │  │      SONA       │             │
│  │   (Reasoning)   │  │   (Routing)     │  │   (Learning)    │             │
│  │                 │  │                 │  │                 │             │
│  │ Sees how things │  │ Knows which     │  │ Remembers what  │             │
│  │ connect and     │  │ expert/approach │  │ worked and      │             │
│  │ cascade         │  │ fits this query │  │ patterns that   │             │
│  │                 │  │                 │  │ succeed         │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │     VECTOR SEARCH     │                               │
│                    │     (Foundation)      │                               │
│                    │  Semantic retrieval   │                               │
│                    │  from knowledge base  │                               │
│                    └───────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use Each Technology

| Technology | Primary Use | Example Application |
|------------|-------------|---------------------|
| **GNN** | Decisions affect other decisions | Retirement planning, medical diagnosis |
| **Attention (MoE)** | Route queries to expert domains | Travel optimizer, customer support |
| **SONA** | Learn from outcomes | Business simulator, strategy advisor |
| **Vector Search** | Find relevant content | All applications (foundation) |

---

## 🏗️ The 8-Phase Build Process

KB-First applications are built through a rigorous 8-phase process:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE 8-PHASE BUILD PROCESS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1          Phase 2              Phase 3           Phase 4            │
│  ┌──────┐         ┌──────┐             ┌──────┐          ┌──────┐          │
│  │STORE │   ───►  │  KB  │    ───►     │SAVE &│   ───►   │ VIZ  │          │
│  │SETUP │         │BUILD │             │VERIFY│          │      │          │
│  └──────┘         └──────┘             └──────┘          └──────┘          │
│                      │                                                      │
│                      ├─ 2.1 Domain Scoping                                 │
│                      ├─ 2.2 Perspective Expansion                          │
│                      ├─ 2.3 Expert Discovery (100 experts)                 │
│                      ├─ 2.4 Completeness Audit                             │
│                      ├─ 2.5 Gap Filling                                    │
│                      ├─ 2.6 Structure (≤9 nodes)                           │
│                      ├─ 2.7 Recursive Depth                                │
│                      └─ 2.8 Quality Loop (≥98/100)                         │
│                                                                             │
│  Phase 5          Phase 6              Phase 7           Phase 8            │
│  ┌──────┐         ┌──────┐             ┌──────┐          ┌──────┐          │
│  │ SDK  │   ───►  │SCAF- │    ───►     │BUILD │   ───►   │VERIFY│          │
│  │LAYER │         │ FOLD │             │(ENF) │          │      │          │
│  └──────┘         └──────┘             └──────┘          └──────┘          │
│                                            │                                │
│                                            └─ NO SHORTCUTS                 │
│                                               NO HARDCODED VALUES          │
│                                               ALL SOURCES TRACED           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase Summary

| Phase | Name | Purpose | Quality Gate |
|-------|------|---------|--------------|
| 1 | Storage Setup | Start PostgreSQL + ruvector | Connection verified |
| 2 | KB Creation | Build world-class knowledge base | Score ≥98/100 |
| 3 | Persistence | Store with embeddings | Semantic search works |
| 4 | Visualization | Interactive 3D tree | Navigation works |
| 5 | Integration Layer | TypeScript SDK | All functions compile |
| 6 | Scaffold | Project structure | KB enforcement in place |
| 7 | Build | Implement with KB enforcement | No hardcoded values |
| 8 | Verification | Final check | All rules pass |

---

## 🎭 Four Intelligence Patterns

Every KB-First application fits one of four patterns. The pattern determines your primary technology:

### Pattern 1: Decision Web (GNN-First)
**Use when:** Changing one variable affects many others

```
Examples: Retirement planning, medical treatment, portfolio construction

User: "What if I take Social Security at 70?"
        │
        ▼
    ┌───────────────────────────────────────────────┐
    │              GNN DECISION GRAPH               │
    │                                               │
    │   SS Age ──affects──► Tax Bracket            │
    │     │                    │                    │
    │     │                    ▼                    │
    │     └──affects──► Roth Conversion Space      │
    │                          │                    │
    │                          ▼                    │
    │                   Medicare Premium           │
    └───────────────────────────────────────────────┘
        │
        ▼
    Response with: cascade effects, similar patterns, scenario comparison
```

### Pattern 2: Combinatorial Routing (Attention-First)
**Use when:** Queries need to go to different expert domains

```
Examples: Travel optimizer, customer support, resource allocation

User: "Find me cheap business class to Tokyo using points"
        │
        ▼
    ┌───────────────────────────────────────────────┐
    │              MoE EXPERT ROUTING               │
    │                                               │
    │   Query ──► Award Travel Expert (0.85)       │
    │         ──► Cash Fares Expert (0.45)         │
    │         ──► Positioning Expert (0.72)        │
    │                                               │
    │   Route to: Award + Positioning              │
    └───────────────────────────────────────────────┘
        │
        ▼
    Response with: multi-expert synthesis, optimal combinations
```

### Pattern 3: Scenario Learning (SONA-First)
**Use when:** "What worked for people like me?" is the core value

```
Examples: Business simulator, strategy advisor, personalized coaching

User: "What pricing strategy should I use for my SaaS?"
        │
        ▼
    ┌───────────────────────────────────────────────┐
    │              SONA PATTERN RECALL              │
    │                                               │
    │   Your Profile ──► Similar Businesses        │
    │                          │                    │
    │                          ▼                    │
    │   "Companies like yours that used freemium   │
    │    saw 23% better conversion..."             │
    └───────────────────────────────────────────────┘
        │
        ▼
    Response with: learned patterns, outcome data, confidence
```

### Pattern 4: Continuous Optimization (Attention + SONA Loop)
**Use when:** You need ongoing monitoring and adaptation

```
Examples: SEO optimizer, trading system, adaptive marketing

Weekly Cycle:
        │
        ▼
    ┌───────────────────────────────────────────────┐
    │           ATTENTION + SONA LOOP              │
    │                                               │
    │   Flash Attention ──► Scan content/competitors│
    │          │                                    │
    │          ▼                                    │
    │   Cross Attention ──► Identify gaps          │
    │          │                                    │
    │          ▼                                    │
    │   Deploy Changes ──► Track Results           │
    │          │                                    │
    │          ▼                                    │
    │   SONA Learning ──► Remember what worked     │
    │          │                                    │
    │          └──────────► (Loop)                 │
    └───────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Docker
- Node.js 18+
- Claude Code (optional, for skill usage)

### Installation

```bash
# Clone the repository
git clone https://github.com/stuinfla/Ruvnet-KB-App_Creator.git
cd Ruvnet-KB-App_Creator

# Start the database
docker run -d --name kb-postgres \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 \
  ruvnet/ruvector-postgres:latest

# Set environment
export DATABASE_URL="postgres://postgres:secret@localhost:5432/postgres"

# Initialize schema
psql $DATABASE_URL -f templates/schema.sql
```

### As a Claude Skill

Copy to your Claude skills directory:
```bash
cp -r . ~/.claude/skills/user/kb-first-v30
```

Then tell Claude:
```
"Apply KB-First 3.0 to build a retirement planning advisor"
```

---

## 📁 Repository Structure

```
kb-first-v30/
├── README.md                     # This file
├── SKILL.md                      # Main skill documentation
├── phases/                       # Phase-by-phase instructions
│   ├── 01-storage.md
│   ├── 02-kb-creation.md
│   ├── 03-persistence.md
│   ├── 04-visualization.md
│   ├── 05-integration.md
│   ├── 06-scaffold.md
│   ├── 07-build.md
│   └── 08-verification.md
├── patterns/                     # Intelligence pattern guides
│   ├── decision-web.md           # GNN-first pattern
│   ├── combinatorial-routing.md  # Attention-first pattern
│   ├── scenario-learning.md      # SONA-first pattern
│   └── continuous-optimization.md
├── templates/                    # Code templates
│   ├── schema.sql                # PostgreSQL schema
│   ├── kb-client.ts              # TypeScript KB client
│   ├── gnn-engine.ts             # GNN implementation
│   ├── attention-router.ts       # Attention routing
│   └── sona-config.ts            # SONA configuration
├── prompts/                      # AI prompts for KB creation
│   ├── expert-discovery.md
│   ├── completeness-audit.md
│   └── quality-critique.md
├── scripts/                      # Utility scripts
│   ├── init-db.sh
│   ├── verify-enforcement.sh
│   └── gap-report.sql
├── references/                   # Technical references
│   ├── ruvector-functions.md
│   ├── attention-mechanisms.md
│   ├── sona-config.md
│   └── hooks-integration.md
├── examples/                     # Working examples
│   ├── retirement-advisor/
│   ├── travel-optimizer/
│   ├── business-simulator/
│   └── seo-engine/
└── assets/                       # Images and diagrams
    └── kb-first-architecture.svg
```

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [SKILL.md](SKILL.md) | Complete skill documentation for Claude |
| [phases/](phases/) | Detailed phase-by-phase instructions |
| [patterns/](patterns/) | Intelligence pattern implementation guides |
| [references/](references/) | Technical API and function references |

---

## 🔧 The Five Enforcement Rules

Every KB-First application follows these rules:

### Rule 1: KB-First Mandate
> Every response must cite KB sources or explicitly acknowledge a gap.

### Rule 2: Confidence Scoring
> Every KB result includes a confidence score (0.0-1.0).

### Rule 3: Gap Detection
> Log every query that cannot be answered from the KB.

### Rule 4: Expert Attribution
> Every KB node must trace to a named expert source.

### Rule 5: No Shortcuts
> No hardcoded domain logic. No fallback values. KB is the source of truth.

---

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) first.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [RuVector](https://github.com/ruvnet/ruvector) - The intelligence stack
- [Anthropic](https://www.anthropic.com) - Claude AI

---

<p align="center">
  <strong>Build intelligence, not just retrieval.</strong>
</p>
