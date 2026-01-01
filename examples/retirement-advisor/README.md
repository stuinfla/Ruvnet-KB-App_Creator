# Example: Retirement Advisor

A Decision Web (GNN-first) KB-First application for retirement planning.

## Why Decision Web?

Retirement planning has highly interdependent decisions:
- Changing Social Security claiming age affects tax bracket
- Tax bracket affects optimal Roth conversion amount
- Roth conversions affect Medicare premiums
- All affect portfolio longevity

**GNN models these cascading effects.**

## Knowledge Base Structure

```
retirement-planning/
├── social-security/
│   ├── claiming-strategies/
│   ├── spousal-benefits/
│   └── taxation/
├── withdrawal-strategies/
│   ├── systematic-withdrawal/
│   ├── bucket-strategy/
│   └── guardrails/
├── tax-optimization/
│   ├── roth-conversion/
│   ├── capital-gains-harvesting/
│   └── charitable-giving/
├── healthcare/
│   ├── medicare/
│   └── long-term-care/
├── estate-planning/
│   ├── beneficiary-designations/
│   └── inheritance-strategies/
└── risk-management/
    ├── sequence-of-returns/
    ├── inflation/
    └── longevity/
```

## Key Expert Sources

- William Bengen (4% Rule creator)
- Wade Pfau (Retirement Research)
- Michael Kitces (Tax Planning)
- Laurence Kotlikoff (Social Security)
- Ed Slott (IRAs and Tax)

## Decision Graph Nodes

```typescript
const decisionGraph = {
  nodes: [
    // Decisions
    { id: 'ss_claiming_age', type: 'decision', range: [62, 70] },
    { id: 'roth_conversion_amount', type: 'decision', range: [0, 200000] },
    { id: 'withdrawal_rate', type: 'decision', range: [0.03, 0.05] },
    { id: 'asset_allocation_stocks', type: 'decision', range: [0, 100] },
    
    // Outcomes
    { id: 'tax_bracket', type: 'outcome' },
    { id: 'medicare_premium', type: 'outcome' },
    { id: 'portfolio_longevity', type: 'outcome' },
    { id: 'legacy_amount', type: 'outcome' }
  ],
  edges: [
    // SS age affects many things
    { from: 'ss_claiming_age', to: 'tax_bracket', weight: 0.8 },
    { from: 'ss_claiming_age', to: 'portfolio_longevity', weight: 0.7 },
    
    // Tax bracket affects conversions
    { from: 'tax_bracket', to: 'roth_conversion_amount', weight: 0.9 },
    
    // Conversions affect Medicare
    { from: 'roth_conversion_amount', to: 'medicare_premium', weight: 0.85 },
    
    // Withdrawal rate affects longevity
    { from: 'withdrawal_rate', to: 'portfolio_longevity', weight: 0.95 }
  ]
};
```

## Sample Domain Function

```typescript
// src/domain/social-security.ts
import { kb } from '../kb';
import { gnn } from '../intelligence/gnn';
import { KBResponse } from '../kb/types';

interface SSAnalysis {
  optimalAge: number;
  monthlyBenefit: number;
  cascadeEffects: CascadeEffect[];
  comparisons: ScenarioComparison[];
}

export async function analyzeSSClaiming(
  profile: UserProfile
): Promise<KBResponse<SSAnalysis>> {
  // Get SS rules from KB (not hardcoded)
  const ssRulesResult = await kb.search('social security claiming rules', 'retirement');
  const benefitCalcResult = await kb.search('social security benefit calculation', 'retirement');
  
  // Get tax implications from KB
  const taxRulesResult = await kb.search('social security taxation thresholds', 'retirement');
  
  // Simulate different claiming ages using GNN
  const scenarios = await Promise.all(
    [62, 65, 67, 70].map(age => 
      gnn.simulate(decisionGraph, { node: 'ss_claiming_age', newValue: age })
    )
  );
  
  // Find optimal based on profile
  const optimal = selectOptimalScenario(scenarios, profile);
  
  return {
    data: {
      optimalAge: optimal.claimingAge,
      monthlyBenefit: optimal.benefit,
      cascadeEffects: optimal.cascades,
      comparisons: scenarios
    },
    kbSources: [
      ...ssRulesResult.kbSources,
      ...benefitCalcResult.kbSources,
      ...taxRulesResult.kbSources
    ],
    confidence: Math.min(
      ssRulesResult.confidence,
      benefitCalcResult.confidence,
      taxRulesResult.confidence
    ),
    gap: false
  };
}
```

## SONA Integration

Store successful planning patterns:

```typescript
// After a user completes their plan and reports satisfaction
await sona.storePattern({
  embedding: await embedProfile(userProfile),
  pattern: {
    profileType: 'married_high_income_early_retirement',
    decisions: {
      ss_claiming_age: 70,
      roth_conversions: 'aggressive',
      withdrawal_strategy: 'guardrails'
    },
    outcome: 'user_followed_plan_95%'
  },
  quality: 0.92
});
```

## Getting Started

```bash
# Initialize project
./scripts/init-project.sh retirement-advisor "retirement planning"
# Select option 1 (Decision Web)

cd retirement-advisor
npm install

# Set database
export DATABASE_URL="postgresql://..."

# Run the 8-phase process following SKILL.md
```
