# Completeness Audit Prompt

Use this prompt after expert discovery to identify gaps in your knowledge base.

---

## The Prompt

```
You are auditing the knowledge base for: [TOPIC]

Your task is to find EVERY gap, weakness, and missing element. Be ruthlessly critical.

## 1. COVERAGE GAPS

For each major sub-topic in the domain:
- How many expert sources cover it? (Flag if <3)
- What depth of coverage exists? (surface/moderate/deep)
- What user questions about this topic cannot be answered?

List every sub-topic with insufficient coverage.

## 2. DEPTH GAPS

Examine each covered topic:
- Is it explained at multiple expertise levels? (beginner → expert)
- Are there practical examples?
- Is there quantitative data where appropriate?
- Are edge cases addressed?
- Are common misconceptions corrected?

List every topic lacking sufficient depth.

## 3. PERSPECTIVE GAPS

Consider all potential users:
- Which user types are underserved?
- Which expertise levels lack appropriate content?
- Which use cases aren't supported?
- Which viewpoints or schools of thought are missing?

List every underserved perspective.

## 4. TEMPORAL GAPS

Consider the time dimension:
- Is historical context present where needed?
- Are foundational/classic works represented?
- Are recent developments (last 2 years) covered?
- Are emerging trends mentioned?

List every temporal gap.

## 5. STRUCTURAL GAPS

Consider how knowledge connects:
- What relationships between concepts are unclear?
- What prerequisites aren't explained?
- What comparisons would be valuable but are missing?
- What decision frameworks would help but don't exist?

List every structural gap.

## 6. PRACTICAL GAPS

Consider real-world application:
- What "how do I actually do this?" questions can't be answered?
- What tools/resources should be mentioned but aren't?
- What warnings/cautions should exist but don't?
- What success criteria should be defined but aren't?

List every practical gap.

---

## OUTPUT FORMAT

For EACH gap identified:

### Gap #[N]: [Short Title]

**Category:** Coverage / Depth / Perspective / Temporal / Structural / Practical

**Description:** What exactly is missing?

**Importance:** Critical / High / Medium / Low

**Impact:** What can't users do because of this gap?

**Suggested Sources:** Where might we find content to fill this?

**Effort to Fill:** Small (1-2 nodes) / Medium (3-5 nodes) / Large (6+ nodes)

---

## MINIMUM REQUIREMENTS

You must identify AT LEAST:
- 10 coverage gaps
- 5 depth gaps
- 5 perspective gaps
- 3 temporal gaps
- 4 structural gaps
- 3 practical gaps

Total: **30+ gaps minimum**

If you cannot find 30 gaps, you are not looking hard enough. Every knowledge base has gaps.

---

## CRITICAL GAPS

After listing all gaps, identify the TOP 5 CRITICAL GAPS that most severely limit the KB's usefulness. These should be prioritized for immediate filling.
```

---

## After the Audit

Use the gap list to guide Phase 2.5 (Gap Filling). Address gaps in this order:
1. Critical gaps first
2. Then High importance
3. Then Medium
4. Low importance gaps can wait

Re-run the audit after filling to verify gaps are closed.
