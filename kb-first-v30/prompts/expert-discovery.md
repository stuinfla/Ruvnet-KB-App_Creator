# Expert Discovery Prompt

Use this prompt to identify the top 100 world experts for a domain.

---

## The Prompt

```
You are building a world-class knowledge base on: [TOPIC]

Your task is to identify the TOP 100 WORLD EXPERTS who have contributed the most valuable knowledge to this field.

## Categories (ensure coverage across all):

### Academic Researchers (30+)
- University professors
- Research institute leaders
- Published researchers
- PhD-level experts

### Practitioners/Professionals (30+)
- Industry professionals with decades of experience
- Consultants who advise top clients
- Professionals with notable track records
- Those who "do the work" at the highest level

### Authors & Educators (20+)
- Book authors (bestselling and academic)
- Course creators
- Popular educators
- Podcast hosts/creators in this space

### Industry Leaders (10+)
- CEOs/founders of relevant companies
- Trade association leaders
- Conference keynote speakers
- Policy influencers

### Emerging Voices (10+)
- Rising researchers
- Innovative practitioners
- New thought leaders
- Those challenging conventional wisdom

## For EACH Expert, Provide:

1. **Full Name** with credentials (PhD, CFA, CFP, etc.)
2. **Primary Affiliation** (university, company, organization)
3. **Key Contributions** (3-5 bullet points of what they're known for)
4. **Most Cited/Notable Work** (specific book, paper, framework)
5. **Content Sources** (where to find their work):
   - Books
   - Academic papers
   - Website/blog
   - Podcast appearances
   - YouTube/videos
   - Social media

## Quality Criteria:

- Each expert must be REAL and VERIFIABLE
- Focus on those with ORIGINAL contributions (not just popularizers)
- Include DIVERSE perspectives (don't just list one school of thought)
- Balance FOUNDATIONAL experts with CURRENT thought leaders
- Include CONTRARIAN voices who challenge mainstream views

## Output Format:

### Category: [Category Name]

**1. [Expert Name], [Credentials]**
- Affiliation: [Organization]
- Known for: [3-5 key contributions]
- Notable work: [Specific title]
- Sources: [Where to find their content]

[Continue for all experts]

## Summary Statistics:
- Total experts: 100
- By category: [breakdown]
- By decade active: [breakdown]
- Geographic diversity: [breakdown]
```

---

## Follow-Up: Content Extraction

After identifying experts, use this prompt for each:

```
For expert: [EXPERT NAME]

Extract their key knowledge contributions:

1. **Core Concepts** they've introduced or refined
   - [Concept]: [Brief explanation]
   - Source: [Where they wrote/spoke about this]

2. **Frameworks/Models** they've created
   - [Framework name]: [What it does]
   - Source: [Citation]

3. **Key Findings/Insights**
   - [Finding]: [Implication]
   - Source: [Citation]

4. **Practical Recommendations**
   - [Recommendation]: [When to apply]
   - Source: [Citation]

5. **Contrarian/Nuanced Views**
   - [View]: [How it differs from mainstream]
   - Source: [Citation]

6. **Evolution of Thinking**
   - Early position: [What they used to say]
   - Current position: [What they say now]
   - What changed: [Why they evolved]

For each item, include:
- Confidence level (high/medium/low based on source quality)
- Date (when this was published/stated)
- Cross-references (other experts who agree/disagree)
```

---

## Quality Checks

After running expert discovery:

### Verification Questions

1. **Can each expert be verified?**
   - Google search returns relevant results
   - LinkedIn/academic profile exists
   - Published work is findable

2. **Is there diversity of perspective?**
   - Different schools of thought represented
   - Contrarian views included
   - Various backgrounds (academic, practitioner, etc.)

3. **Are foundational and current experts both included?**
   - Historical figures who established the field
   - Current researchers advancing it
   - Emerging voices challenging assumptions

4. **Is geographic diversity present?**
   - Not all from one country/region
   - International perspectives included

### Red Flags

- ❌ Expert doesn't appear in Google search
- ❌ No verifiable publications
- ❌ All experts from same institution
- ❌ All experts share same viewpoint
- ❌ No experts from last 5 years
- ❌ No foundational/historical experts
