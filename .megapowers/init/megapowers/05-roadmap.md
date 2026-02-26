# Phase 5: Roadmap — Megapowers V1

> **Date:** 2026-02-25

---

## Dependency Map

Before sequencing milestones, here are the hard dependencies:

```
Restructure (dirs + extract index.ts + generalize state machine)
    │
    ├──▶ UX Overhaul (needs extracted hooks, /mp command hub)
    │
    ├──▶ Subagent Pipeline (needs extracted subagent modules)
    │       │
    │       └──▶ Plan/Review Loop (reviewer is a subagent call)
    │
    ├──▶ Done Phase (needs generalized state machine for VCS flow)
    │
    ├──▶ Backward Transitions (needs generalized state machine for cascade)
    │
    └──▶ Init System (needs generalized state machine for init configs)

TDD Flexibility ── no hard dependency, can slot in anywhere
Issue Management ── no hard dependency, can slot in anywhere
Clean Context Windows ── needs /mp command registered (UX milestone)
```

## Milestones

### M0: Restructure
**Theme:** Make the codebase workable. No user-visible changes.

| Step | What | Risk |
|------|------|------|
| Create directory structure | Move 30 flat files into core/, workflows/, subagent/, ui/, hooks/, prompts/, parsers/, jj/, init/ | Low — file moves + import updates |
| Extract index.ts | Pull hook handlers, tool handlers, command handlers into their subdirectories. index.ts becomes ~150 lines of wiring. | Medium — index.ts is 870 lines of intertwined logic |
| Generalize state machine | `WorkflowConfig` type. Feature, bugfix, init-green, init-brown as configs. Transition tables become config-driven. | Medium — touches state machine + gates + phase-advance |

**Gate:** All 546 existing tests pass. No behavior change.

---

### M1: UX Foundation
**Theme:** Fix the worst pain. PRD priority #1.

| Step | What | Risk |
|------|------|------|
| Kill the phase transition popup | Replace `agent_end → select widget` with notification + contextual info | Low — removing code is easier than adding |
| `/mp` command hub | Single entry point. Shows contextual commands for current state. All existing commands become `/mp` subcommands | Medium — command routing |
| Phase transition notifications | "✅ Brainstorm complete. Artifact saved. Next: Spec. Type /mp next or start typing." | Low |
| LLM-driven issue creation | Template-based issue creation via conversation, not UI form | Low |
| Prompt/skill overhaul | Prompts match current architecture, guide correct behavior per phase | Medium — needs tuning |

**Gate:** A person who didn't build megapowers can start an issue and get through brainstorm → spec without getting stuck or confused.

---

### M2: Subagent Pipeline
**Theme:** Make delegation work. PRD priority #2.

| Step | What | Risk |
|------|------|------|
| Fix jj workspace squash (#067) | Subagent commits squash back to main workspace cleanly | High — jj workspace mechanics |
| Extract subagent spawn from index.ts | Already done in M0 restructure, but wire up the clean pipeline: dispatcher → workspace → runner → status | Low |
| Structured result handoff | Subagent returns: files changed, tests run, verdict, issues encountered | Medium |
| Rich subagent UI | Agent name, model, task, status, tool calls, duration, cost, tokens. Collapsed with expand. | Medium — pi UI integration |
| Per-task chain | implement → verify → code-review subagents per task. Different prompts per role. Reject → escalate to main agent | High — orchestration complexity |

**Gate:** A 3-task plan can be implemented via sequential subagent delegation with all tasks completing successfully, results squashed back, and the main agent understanding what happened.

---

### M3: Plan/Review Loop
**Theme:** Plans that actually work. PRD priority #4. Depends on M2 (reviewer = subagent).

| Step | What | Risk |
|------|------|------|
| Merge plan + review into one phase | Single "plan-review" phase in workflow config. Remove separate review phase. | Medium — state machine + gates change |
| Interview step | Planner asks clarifying questions before drafting. Draws from foundation docs + issue + codebase | Low — prompt engineering |
| Reviewer subagent | Spawn subagent with reviewer model (GPT-5.2) + reviewer prompt (checklist-based). Returns OKAY/REJECT with details | Medium — subagent with specific model selection |
| Iteration loop | On REJECT: planner sees verdict, fixes plan, re-submits. Loop until OKAY or user intervenes | Medium — loop control within a phase |
| Autonomy checkpoints | Prompt user at N iterations or >90% score. User can intervene anytime | Low |

**Gate:** A plan goes through at least one REJECT → fix → re-review cycle and produces a measurably better plan than single-shot generation.

---

### M4: Done Phase
**Theme:** Clean close. PRD priority #3.

| Step | What | Risk |
|------|------|------|
| Automated artifact review | Single LLM turn: review artifacts, update foundation docs (proposed), generate changelog | Low — prompt engineering |
| Confirmation widget | "Ready for final processes? [docs, changelog, VCS] — Proceed / Discuss" | Low |
| VCS automation — local merge | jj squash + describe + merge to target. Or git commit + merge | High — jj/git mechanics, error handling |
| VCS automation — push/PR | jj git push or git push + PR creation | High — remote interaction, auth |
| Issue archival | Move to archive directory, mark complete | Low |

**Gate:** An issue goes from code-review → done → merged/pushed with one confirmation click and no manual VCS commands.

---

### M5: Backward Transitions + TDD Flexibility + Issue Management
**Theme:** Polish the dev workflow. PRD priorities #5, #6, #7.

| Step | What | Risk |
|------|------|------|
| Cascade invalidation | Going back marks downstream artifacts stale, resets downstream state | Medium |
| Backward warning | "Going back to X will invalidate Y, Z. Proceed?" | Low |
| TDD per-task override | Plan marks tasks `[no-test]`. User can `/mp tdd skip`. Logged in artifact | Low — write-policy already supports this partially |
| Issue priority sorting | Priority field + triage process (`/mp triage`) | Low |
| Issue archiving process | `/mp archive` or automatic on done | Low |
| Issue list UI | Show priority, status, workflow type in list | Low |

**Gate:** User can go backward from verify to spec, see correct cascade warnings, re-do plan/review, and re-implement without stale state.

---

### M6: Init System + Clean Context Windows
**Theme:** The second product. PRD scope: init workflows + foundation doc lifecycle.

| Step | What | Risk |
|------|------|------|
| Init workflow configs | Brownfield + greenfield WorkflowConfigs. Phase tracking, artifact storage | Low — state machine already generalized in M0 |
| Init phase templates | Brownfield templates from this project. Greenfield derived variants | Low — we already have the brownfield templates |
| Foundation doc read during brainstorm | Prompt injection loads vision, PRD, architecture for brainstorm/plan phases | Low — extending existing prompt-inject |
| Foundation doc update during done | Done sequence proposes foundation doc updates, user approves | Medium |
| `/mp audit` + `/mp revisit` | On-demand foundation doc review | Low |
| Clean context windows | Programmatic `newSession()` via `sendUserMessage` → command → `ctx.newSession()` with artifact injection | Medium — pi API integration |

**Gate:** A user can run `/mp init` on a brownfield project, walk through all phases, produce foundation docs, then start a dev workflow that references those docs during brainstorm.

---

## Milestone Sequence

```
M0 ──▶ M1 ──▶ M2 ──▶ M3 ──▶ M4 ──▶ M5 ──▶ M6
 │      │      │      │      │      │      │
 │      │      │      │      │      │      └─ Init system works, clean context windows
 │      │      │      │      │      └─ Backward transitions, TDD flex, issue mgmt
 │      │      │      │      └─ Done phase automated
 │      │      │      └─ Plans iterate until good
 │      │      └─ Subagents complete tasks
 │      └─ UX is usable
 └─ Codebase is workable
```

**After M4:** The full dev workflow works end-to-end (brainstorm → spec → plan/review → implement via subagents → verify → code-review → automated done). This is the "machine works" checkpoint.

**After M6:** V1.0 complete. Both init and dev systems functional.

---

## V1.1 Milestones (Post-V1.0)

| Milestone | Theme |
|-----------|-------|
| M7: Wisdom Accumulation | Task N+1 receives learnings from 1..N |
| M8: Parallel Subagents | Multiple tasks dispatched simultaneously |
| M9: Ship Reports | Summary artifact at done |
| M10: Greenfield Templates | Live greenfield project produces real templates |

---

## Risk Summary

| Risk | Milestone | Severity | Mitigation |
|------|-----------|----------|------------|
| JJ workspace squash doesn't work reliably | M2 | High | Focus on squash first. If jj is too fragile, fall back to git stash/branch approach |
| Index.ts extraction breaks things | M0 | Medium | Incremental extraction with test runs after each module move |
| Plan/review loop produces worse plans than single-shot | M3 | Medium | Start strict reviewer, loosen based on results. Measure before/after |
| VCS automation fails on edge cases (conflicts, auth) | M4 | High | Handle errors gracefully. Fall back to "here's what to run manually" on failure |
| Clean context windows feel jarring | M6 | Low | User already wants this. Test with real workflows |
