# Quality Critique Prompt

Use this prompt in Phase 2.8 to score your knowledge base and identify improvements needed to reach ≥98/100.

---

## The Prompt

```
You are a demanding quality reviewer evaluating a knowledge base on: [TOPIC]

Score this KB on a scale of 0-100 using these weighted criteria. Be harsh but fair.

---

## SCORING CRITERIA

### 1. COMPLETENESS (25 points)

Does the KB cover the full domain?

| Score | Description |
|-------|-------------|
| 25 | Every major topic covered with multiple perspectives |
| 20 | All major topics covered, minor gaps |
| 15 | Most topics covered, some notable gaps |
| 10 | Many significant gaps |
| 5 | Major portions of domain missing |
| 0 | Fundamentally incomplete |

**Your score:** ___/25
**Specific weaknesses:**
**Improvements needed:**

---

### 2. ACCURACY (25 points)

Is the information correct and reliable?

| Score | Description |
|-------|-------------|
| 25 | All information verified, sources authoritative |
| 20 | Highly accurate, rare minor errors |
| 15 | Generally accurate, some questionable claims |
| 10 | Accuracy issues affecting usability |
| 5 | Significant errors present |
| 0 | Unreliable |

**Your score:** ___/25
**Specific weaknesses:**
**Improvements needed:**

---

### 3. ATTRIBUTION (15 points)

Are sources properly cited and verifiable?

| Score | Description |
|-------|-------------|
| 15 | Every claim attributed to named expert with verifiable source |
| 12 | Most claims attributed, sources generally verifiable |
| 9 | Attribution present but inconsistent |
| 6 | Many claims without sources |
| 3 | Minimal attribution |
| 0 | No attribution |

**Your score:** ___/15
**Specific weaknesses:**
**Improvements needed:**

---

### 4. STRUCTURE (15 points)

Is the KB well-organized and navigable?

| Score | Description |
|-------|-------------|
| 15 | Perfect MECE structure, intuitive navigation, ≤9 primary nodes |
| 12 | Well-organized, minor structural issues |
| 9 | Organized but some navigation challenges |
| 6 | Structure makes finding information difficult |
| 3 | Poorly organized |
| 0 | No coherent structure |

**Your score:** ___/15
**Specific weaknesses:**
**Improvements needed:**

---

### 5. DEPTH (10 points)

Is there sufficient detail for practical use?

| Score | Description |
|-------|-------------|
| 10 | Deep expertise at every leaf node, actionable detail |
| 8 | Good depth, occasional surface-level nodes |
| 6 | Adequate depth for basic use |
| 4 | Too shallow for expert use |
| 2 | Surface-level only |
| 0 | No meaningful depth |

**Your score:** ___/10
**Specific weaknesses:**
**Improvements needed:**

---

### 6. CURRENCY (10 points)

Is the information up to date?

| Score | Description |
|-------|-------------|
| 10 | Includes latest developments, recent sources |
| 8 | Current for established topics, recent updates present |
| 6 | Generally current, some dated content |
| 4 | Noticeably dated in key areas |
| 2 | Significantly outdated |
| 0 | Obsolete |

**Your score:** ___/10
**Specific weaknesses:**
**Improvements needed:**

---

## CALCULATION

| Criterion | Weight | Your Score | Weighted |
|-----------|--------|------------|----------|
| Completeness | 25 | | |
| Accuracy | 25 | | |
| Attribution | 15 | | |
| Structure | 15 | | |
| Depth | 10 | | |
| Currency | 10 | | |
| **TOTAL** | **100** | | **___/100** |

---

## IF SCORE < 98

List the TOP 10 IMPROVEMENTS that would most increase the score:

1. [Improvement] - Expected impact: +__ points
2. [Improvement] - Expected impact: +__ points
3. ...

Prioritize by:
- Impact (how many points gained)
- Effort (how much work required)
- Dependency (what must come first)

---

## QUALITY LOOP

After implementing improvements:
1. Re-run this critique
2. If score still < 98, repeat
3. Continue until score ≥ 98

Maximum iterations: 4
If unable to reach 98 in 4 iterations, document remaining blockers.
```

---

## Interpreting Scores

| Score | Interpretation |
|-------|----------------|
| 98-100 | Production ready |
| 90-97 | Good, needs polish |
| 80-89 | Usable, notable gaps |
| 70-79 | Significant work needed |
| <70 | Major rework required |

---

## Common Score Killers

These issues frequently prevent reaching 98:

1. **Attribution gaps** — Claims without expert sources
2. **Depth inconsistency** — Some nodes deep, others shallow
3. **Recent developments missing** — No content from last 2 years
4. **Edge cases ignored** — Only covers typical scenarios
5. **Single perspective** — One school of thought dominates
