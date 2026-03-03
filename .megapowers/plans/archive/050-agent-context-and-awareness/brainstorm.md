# Brainstorm: Agent Context & Awareness (#050)

## Scope Reduction

Original #050 batched four source issues: #048, #040, #047, #044. During brainstorm we determined:
- **#044** (write policy flexibility) — Already solved by allowlist + config-driven blocking. Dropped.
- **#047** (TDD guard blocks type-only tasks) — Already solved: `[no-test]` annotation parsed from plan, TDD guard respects it, prompts explain it thoroughly. Marked done.
- **#048** (no context without active issue) — Still broken. `buildInjectedPrompt()` returns null.
- **#040** (prompt audit) — Still needed but less severe than expected.

**Final scope: two items.**

## Approach

**Item 1: Idle-mode context.** When no issue is active but mega is enabled, `buildInjectedPrompt()` currently returns null — the agent has zero awareness of megapowers. We'll add an idle-mode path that injects: the base protocol (tool names, available signals), a list of open issues with milestone/priority, available slash commands, and a reference to ROADMAP.md and .megapowers/milestones.md. The dashboard widget (`renderDashboardLines`) will also be enhanced to show command hints beyond just `/issue new` and `/issue list` — adding `/triage`, `/mega on|off`, and the roadmap/milestones reference.

**Item 2: Prompt audit (level B).** All 15 prompt templates audited for correctness and quality. Grouped by workflow phase for consistency. Specific findings documented below — the implementer applies these fixes, not a vague "audit and fix" directive.

## Key Decisions

- **Idle prompt = B (moderate)** — protocol + open issues + commands + roadmap reference. Not A (too minimal) or C (context bloat with full roadmap content).
- **Dashboard hints as text, not interactive** — simple hint lines, no new UI components.
- **Prompt audit level B** — correctness + quality tightening, not full overhaul (C). Saves full overhaul for #062.
- **Audit done in brainstorm** — specific findings documented here so implementer gets exact marching orders, not vague "review and fix."
- **Prompt tasks grouped by workflow phase** — ~5 groups for consistency within stages.
- **#044 dropped, #047 marked done** — both already solved in codebase.

## Components

### 1. `prompt-inject.ts` — Idle mode path
New branch in `buildInjectedPrompt()` when `state.megaEnabled && !state.activeIssue`:
- Load base protocol (`megapowers-protocol.md`)
- List open issues from store (id, title, milestone, priority)
- List available slash commands with descriptions
- Reference to ROADMAP.md and .megapowers/milestones.md

### 2. `ui.ts` → `renderDashboardLines` — Enhanced idle dashboard
When no active issue, show:
```
No active issue.
/issue new   — create an issue
/issue list  — pick an issue to work on
/triage      — batch and prioritize issues
/mega on|off — enable/disable workflow enforcement
See ROADMAP.md and .megapowers/milestones.md for what's next.
```

### 3. Prompt template fixes (15 files, 5 groups)

#### Group A: Protocol
**`megapowers-protocol.md`**
- Add `{ action: "phase_back" }` to signal list with description: "Go back to previous phase (verify→implement, code-review→implement, review→plan)"
- Add `learnings` to valid artifact phases list

#### Group B: Early phases (brainstorm, write-spec, write-plan, review-plan)
**`review-plan.md`**
- Fix duplicate section numbering: second "### 5." (Self-Containment) should be "### 6."
- "After Review" section: add mention of `megapowers_signal({ action: "phase_back" })` for going back to plan

**`brainstorm.md`**, **`write-spec.md`**, **`write-plan.md`** — No changes needed. Clean.

#### Group C: Implement phase
**`implement-task.md`**
- Tighten "Execution Mode" section — reduce verbosity while keeping all info
- No stale references found

#### Group D: Late phases (verify, code-review)
**`verify.md`**
- Replace "use `/phase implement` or `/phase plan` to transition back" with reference to `megapowers_signal({ action: "phase_back" })`

**`code-review.md`**
- Same fix: replace `/phase implement` or `/phase plan` references with `phase_back` signal
- Update "needs-fixes" and "needs-rework" sections to reference `phase_back`

#### Group E: Done/utility + standalone
**`capture-learnings.md`**, **`write-changelog.md`**, **`generate-docs.md`**, **`generate-bugfix-summary.md`**, **`triage.md`**, **`reproduce-bug.md`**, **`diagnose-bug.md`** — No changes needed. All clean.

## Testing Strategy

- **`buildInjectedPrompt` idle mode** — unit tests:
  - Returns content when mega enabled + no active issue
  - Returns null when mega disabled (regardless of active issue)
  - Idle content includes protocol section
  - Idle content includes open issues list
  - Idle content includes slash command hints
  - Idle content includes roadmap/milestones reference
- **`renderDashboardLines` idle mode** — unit tests:
  - Idle mode lines include all command hints (`/issue`, `/triage`, `/mega`)
  - Idle mode lines include roadmap reference
  - Active-issue mode unchanged (no regression)
- **Prompt templates** — no automated tests (markdown files). Correctness verified by human review during code-review phase. Specific fixes are mechanical (find/replace stale references).
