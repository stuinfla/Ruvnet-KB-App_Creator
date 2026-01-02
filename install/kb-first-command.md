Updated: 2026-01-01 23:55:00 EST | Version 4.2.0
Created: 2026-01-01 23:55:00 EST

# /kb-first

Build or transform applications using KB-First architecture.

## Usage

```
/kb-first              # Start interactive KB-First builder
/kb-first init         # Initialize KB-First in current project
/kb-first score        # Score existing KB and app compliance
/kb-first plan         # Generate transformation plan
/kb-first transform    # Execute KB-First transformation
/kb-first verify       # Run all Phase 8 verification checks
/kb-first hooks        # Configure Claude Code hooks
```

## Arguments

| Argument | Description |
|----------|-------------|
| (none) | Start interactive builder, detect greenfield/brownfield |
| `init` | Initialize KB-First structure in current project |
| `score` | Score existing KB quality and app compliance |
| `plan` | Generate transformation plan without executing |
| `transform` | Execute full KB-First transformation |
| `verify` | Run all 8 verification scripts |
| `hooks` | Install and configure RuVector hooks |

## Examples

### Build a New Application
```
/kb-first

# Then provide your intentions:
> I want to build a retirement planning advisor that helps users optimize
> their Social Security claiming strategy and tax-efficient withdrawals.
```

### Transform Existing Application
```
/kb-first score
# Shows: KB Quality: 45/100, App Compliance: 30/100

/kb-first plan
# Shows: 15 files need modification, 8 new files needed

/kb-first transform
# Executes the 10-phase build process
```

### Quick Verification
```
/kb-first verify
# Runs: 8.1-8.8 verification scripts
# Returns: PASS/FAIL for each check
```

---

## What This Command Does

1. **Detects** application type (greenfield vs brownfield)
2. **Scores** existing KB and app compliance (brownfield only)
3. **Confirms** transformation scope with user
4. **Identifies** which intelligence pattern fits
5. **Executes** the 10-phase build process with HARD quality gates
6. **Enforces** KB-First rules throughout development
7. **Verifies** all 8 verification sub-phases pass
8. **Reports** delta (before/after scores)

---

## Skill Reference

This command invokes the KB-First Application Builder skill.
Full documentation: `~/.claude/skills/kb-first.md`
