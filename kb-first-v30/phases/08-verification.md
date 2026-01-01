# Phase 8: Final Verification

## Purpose

Comprehensive check that all KB-First rules are followed. This is the final gate before the application is considered complete.

---

## Verification Checklist

### A. KB Enforcement Rules

#### Rule 1: No Hardcoded Domain Logic

```bash
# Check for suspicious patterns in domain files
grep -rn "= [0-9]\+\.[0-9]\+" src/domain/     # Decimal numbers
grep -rn "= [0-9]\+" src/domain/              # Integer constants
grep -rn "const.*Rate" src/domain/            # Rate constants
grep -rn "const.*Age" src/domain/             # Age constants
grep -rn "const.*Limit" src/domain/           # Limit constants
grep -rn "DEFAULT_" src/domain/               # Default values
```

**Expected:** No matches, or all matches are justified (e.g., array indices)

#### Rule 2: Every Domain Function Queries KB

```bash
# Check all domain files import from kb
for file in src/domain/*.ts; do
  if ! grep -q "from.*kb" "$file"; then
    echo "FAIL: $file does not import from kb/"
  fi
done
```

**Expected:** All files import from kb/

#### Rule 3: All Responses Include kbSources

```bash
# Check return types include kbSources
grep -rn "return {" src/domain/ | while read line; do
  file=$(echo $line | cut -d: -f1)
  if ! grep -A5 "return {" "$file" | grep -q "kbSources"; then
    echo "CHECK: $file may not return kbSources"
  fi
done
```

**Expected:** All return statements include kbSources

#### Rule 4: Startup Verification

```bash
# Check entry point
head -30 src/index.ts | grep -q "verifyConnection"
echo "Verify connection check: $?"

grep -q "process.exit(1)" src/index.ts
echo "Exit on failure check: $?"
```

**Expected:** Both checks pass (return 0)

#### Rule 5: No Fallback Logic

```bash
# Check for fallback patterns
grep -rn "|| DEFAULT" src/
grep -rn "|| \[" src/         # Empty array fallback
grep -rn "|| {}" src/         # Empty object fallback
grep -rn "??" src/domain/     # Nullish coalescing (needs review)
```

**Expected:** No matches in domain files

---

### B. Intelligence Layer (if applicable)

#### Decision Web (GNN)

```bash
# Check GNN is initialized
grep -rn "GNNEngine" src/
grep -rn "gnn.simulate" src/domain/
```

#### Combinatorial Routing (Attention)

```bash
# Check attention routing is used
grep -rn "AttentionRouter" src/
grep -rn "routeToExpert\|moeRoute" src/domain/
```

#### Scenario Learning (SONA)

```bash
# Check SONA is configured
grep -rn "SonaEngine" src/
grep -rn "sona.recallPatterns\|sona.storePattern" src/domain/
```

---

### C. Expert Attribution

```sql
-- Check all KB nodes have expert attribution
SELECT COUNT(*) as missing_attribution
FROM kb_nodes
WHERE source_expert IS NULL OR source_expert = '';

-- Should return 0
```

---

### D. Confidence Scores

```sql
-- Check all KB nodes have confidence
SELECT COUNT(*) as missing_confidence
FROM kb_nodes  
WHERE confidence IS NULL;

-- Should return 0

-- Check confidence distribution
SELECT 
  CASE 
    WHEN confidence >= 0.8 THEN 'high'
    WHEN confidence >= 0.5 THEN 'medium'
    ELSE 'low'
  END as level,
  COUNT(*) as count
FROM kb_nodes
GROUP BY level;
```

---

### E. Gap Detection

```sql
-- Check gap logging is active
SELECT COUNT(*) as gaps_logged
FROM kb_gaps
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Should show recent gaps if testing included unanswerable queries
```

---

### F. API Source Transparency

```bash
# Test API endpoints return sources
curl -s localhost:3000/api/[endpoint] | jq '.sources'

# Should return non-empty array
```

---

### G. UI Source Display

Manual verification:
- [ ] Results show expert attribution
- [ ] Confidence levels are displayed
- [ ] Sources are clickable/verifiable

---

## Automated Verification Script

```bash
#!/bin/bash
# scripts/verify-all.sh

echo "=== KB-First Final Verification ==="
echo ""

errors=0

# Rule 1: No hardcoded values
echo "Checking Rule 1: No hardcoded domain logic..."
if grep -rqE "= [0-9]+\.[0-9]+" src/domain/ 2>/dev/null; then
  echo "  ❌ Found potential hardcoded decimals"
  errors=$((errors + 1))
else
  echo "  ✅ No hardcoded decimals found"
fi

# Rule 2: All domain files import kb
echo "Checking Rule 2: All domain files import kb..."
for file in src/domain/*.ts; do
  if [ -f "$file" ] && ! grep -q "from.*kb" "$file"; then
    echo "  ❌ $file does not import from kb/"
    errors=$((errors + 1))
  fi
done
[ $errors -eq 0 ] && echo "  ✅ All domain files import kb"

# Rule 3: Returns include kbSources
echo "Checking Rule 3: Returns include kbSources..."
missing=$(grep -rL "kbSources" src/domain/*.ts 2>/dev/null | wc -l)
if [ "$missing" -gt 0 ]; then
  echo "  ⚠️  $missing files may not return kbSources"
else
  echo "  ✅ kbSources present in domain files"
fi

# Rule 4: Startup verification
echo "Checking Rule 4: Startup verification..."
if grep -q "verifyConnection" src/index.ts && grep -q "process.exit" src/index.ts; then
  echo "  ✅ Entry point verifies KB"
else
  echo "  ❌ Entry point missing KB verification"
  errors=$((errors + 1))
fi

# Rule 5: No fallbacks
echo "Checking Rule 5: No fallback logic..."
if grep -rqE "\|\| DEFAULT|\|\| \[|\|\| \{\}" src/domain/ 2>/dev/null; then
  echo "  ❌ Found fallback patterns"
  errors=$((errors + 1))
else
  echo "  ✅ No fallback patterns found"
fi

echo ""
echo "=== Results ==="
if [ $errors -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
else
  echo "❌ $errors error(s) found"
  exit 1
fi
```

---

## Quality Gate

All items must pass:

- [ ] No hardcoded domain values
- [ ] All domain files import from kb/
- [ ] All responses include kbSources
- [ ] Entry point verifies KB first
- [ ] Entry point exits if KB unavailable
- [ ] No fallback patterns
- [ ] All KB nodes have expert attribution
- [ ] All KB nodes have confidence scores
- [ ] Gap logging is active
- [ ] Intelligence layer properly integrated (if applicable)
- [ ] API endpoints return sources
- [ ] UI displays sources and confidence

---

## Completion

When all checks pass:

**🎉 The KB-First application is complete!**

The application:
- Grounds all responses in expert knowledge
- Provides full traceability for every answer
- Detects and logs knowledge gaps
- Cannot function without its knowledge base
- Uses the appropriate intelligence layer for its pattern

---

## Post-Completion

### Maintenance Tasks

1. **Monitor gaps** — Review kb_gaps table regularly
2. **Update KB** — Add content to fill gaps
3. **Track confidence** — Monitor average confidence over time
4. **Review sources** — Ensure expert sources remain valid

### Enhancement Opportunities

1. **Add SONA learning** — If not already present
2. **Improve routing** — Add MoE if queries vary widely
3. **Model relationships** — Add GNN if decisions interconnect
4. **Expand KB** — More experts, more depth
