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

<p align="center">
  <img src="assets/intelligence-stack.svg" alt="The Intelligence Stack" width="800">
</p>

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

<p align="center">
  <img src="assets/build-process.svg" alt="The 8-Phase Build Process" width="800">
</p>

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

*Examples: Retirement planning, medical treatment, portfolio construction*

<p align="center">
  <img src="assets/decision-web-gnn.svg" alt="GNN Decision Web Pattern" width="800">
</p>

### Pattern 2: Combinatorial Routing (Attention-First)
**Use when:** Queries need to go to different expert domains

*Examples: Travel optimizer, customer support, resource allocation*

<p align="center">
  <img src="assets/combinatorial-routing.svg" alt="MoE Expert Routing Pattern" width="800">
</p>

### Pattern 3: Scenario Learning (SONA-First)
**Use when:** "What worked for people like me?" is the core value

*Examples: Business simulator, strategy advisor, personalized coaching*

<p align="center">
  <img src="assets/scenario-learning-sona.svg" alt="SONA Pattern Recall" width="800">
</p>

### Pattern 4: Continuous Optimization (Attention + SONA Loop)
**Use when:** You need ongoing monitoring and adaptation

*Examples: SEO optimizer, trading system, adaptive marketing*

<p align="center">
  <img src="assets/continuous-optimization.svg" alt="Continuous Optimization Loop" width="800">
</p>

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
