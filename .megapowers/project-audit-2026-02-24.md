# Megapowers Project Audit — 2026-02-24

Comprehensive audit informed by full council review (18 personas). Organized by user impact, not system component.

**Council feedback archive:** `.megapowers/council-feedback/2026-02-24-full-project-audit/`

---

## 1. Workflow Completeness — "Can users actually finish work?"

These determine whether someone who starts a megapowers workflow can complete it without hitting `/mega off`.

### 1.1 Backward transitions unreachable (#069)
**Severity: Critical — #1 usability blocker**

State machine defines backward transitions (review→plan, verify→implement, code-review→implement) but no tool or command triggers them. `phase_next` only goes forward. `/phase` doesn't accept a target. When verify fails and the fix needs a design change, users are stuck.

**Council consensus:** Every user-facing persona hit this. PM calls it "existential for retention." AI Orchestrator has no tool to call. Big Head `/mega off`'d because of it.

**Proposed:** Add `phase_goto` action to `megapowers_signal`. Gate it with reason requirement. Log the backward transition for audit trail.

### 1.2 Done phase broken (#065)
**Severity: Critical — happy path incomplete**

- `appendLearnings()` is dead code — never called
- Capture-learnings has no approval/save flow
- Artifact capture via message scraping is fragile
- Menu is one-action-then-exit
- No tracking of completed wrap-up actions

**Council insight (Peter Gregory):** The done phase isn't just wrap-up — it's where the decision provenance chain gets sealed. Every artifact + transition in the workflow constitutes an auditable decision record. Discarding it at completion destroys the most valuable output.

**Council insight (Russ Hanneman):** Done phase should generate a "ship report" — exportable summary of the full workflow (time, phases, tests, artifacts). This is the viral mechanic. Shareable proof of quality.

**Proposed:** Full done phase rewrite. Learnings capture, changelog generation, ship report, artifact archival.

### 1.3 Plan/review is one-shot (#066)
**Severity: High — waste and friction**

Reviewer rejects → full rewrite instead of targeted feedback. No structured feedback passing from reviewer to planner. AI burns tokens rewriting plans from scratch when 80% was fine.

**Proposed:** Iterative loop within plan/review. Reviewer provides specific feedback. Planner revises targeted sections. Converge, don't restart.

### 1.4 No diagnosis review step (bugfix workflow)
**Severity: High — wrong root cause produces wrong fix**

Feature workflow has spec → plan → **review**. Bugfix has diagnose → plan → review but review only checks plan structure, not diagnosis accuracy. A wrong root cause produces a perfectly structured plan that fixes the wrong thing.

**Proposed:** Add diagnosis validation step — reviewer checks evidence→root cause chain, considers alternatives, flags gaps.

### 1.5 Multi-cause bugs have no re-diagnosis path
**Severity: Medium — depends on #069**

Workflow assumes single root cause. Verify failure from partial fix has no path back to diagnose. Even with #069, going back means re-doing full investigation instead of building on existing diagnosis.

**Proposed:** After #069, support incremental diagnosis — append to existing rather than overwrite. Verify failure evidence becomes input to next diagnosis round.

---

## 2. Integration — "Does work have any effect outside the tool?"

These determine whether megapowers-produced work connects to the real world.

### 2.1 No git push workflow (#064)
**Severity: Critical — work is stranded**

- No bookmark created on issue start
- No root change tracked for full-tree squash
- No git push — work never reaches GitHub
- No session resume from pushed branches

**Council notes (DevOps):** CI environments have git, not jj. Need git adapter or jj-optional mode. (Monica): If work can't be pushed, this is a productivity island.

**Proposed:** Bookmark creation on issue start, squash-to-bookmark on done, git push, session resume.

### 2.2 Subagent workspace squash missing (#067)
**Severity: High — delegation model is broken**

`buildWorkspaceSquashArgs()` exists but has zero callers. Subagent changes captured as diff but never merged into main working copy. Subagent delegation is effectively throwaway.

**Proposed:** Wire squash into `handleTaskDone` or subagent completion flow.

### 2.3 No CI validation mode
**Severity: Medium — blocks pipeline integration**
**Source: DevOps Engineer council feedback**

No headless/batch mode for CI. Can't validate that a PR was built through the workflow. Can't use megapowers as a PR gate.

**Proposed:** `megapowers validate` CLI command — checks artifact presence, workflow completion, transition log integrity. Usable as PR check.

### 2.4 No external tool integration
**Severity: Low (for now) — limits enterprise adoption**
**Source: CTO, Gavin council feedback**

No Jira/Linear sync. No GitHub Issues bridge. No Slack notifications. No CI/CD hooks beyond what #064 would provide.

**Proposed:** Defer until core workflow is solid. Design plugin API for future integrations.

---

## 3. Quality of Guidance — "Does the AI actually do good work?"

These determine whether the structured workflow produces better output than unstructured work.

### 3.1 No prompt testing (#068)
**Severity: High — prompts ARE the product**

16 prompt templates with no test framework. Changing `write-plan.md` could break brainstorm flow. No regression detection. Currently falls under `[no-test]` with no enforcement.

**Council note (Dinesh):** "The prompts ARE the product. They're what makes the AI actually do useful work. Test them first."

**Proposed:** `[prompt-test]` task type. Subagent-based verification cycle: baseline → change → verify → regression.

### 3.2 TDD enforcement is heuristic, not contractual
**Severity: Medium — known limitation**
**Source: AI Orchestrator, QA Lead council feedback**

- Test runner detection uses string matching on bash output ("fail", "FAIL", "✗")
- Different test runner formatting could misfire
- Linter output containing "failures" could trigger false positives
- Empty/trivial tests satisfy the syntactic check
- Dual path: auto-detect via `processBashResult()` AND manual `tests_failed`/`tests_passed` signals can conflict

**Proposed:** 
- Unify TDD signal path (auto-detect with manual override, not parallel paths)
- Document known bypass scenarios honestly
- Consider structured test runner output parsing (JSON reporters)

### 3.3 Artifact overwrite protection (#041)
**Severity: Medium — loses decision history**

`writeFileSync` is unconditional — no versioning. When a spec is revised, the original is lost. Peter Gregory's "decision provenance" requires full revision history.

**Proposed:** Rename existing to `phase.v1.md` before overwrite. Maintain version index.

### 3.4 No `megapowers_query` tool for AI self-awareness
**Severity: Medium — agent wastes context**
**Source: AI Orchestrator council feedback**

Agent can't query its own state ("what phase am I in?", "which tasks are complete?"). Relies on prompt injection which may be far back in context window. A query tool would reduce context waste and prevent stale-state errors.

**Proposed:** Add `megapowers_query` action: returns current phase, task list, completion status, TDD state.

---

## 4. Measurement & Trust — "Can we prove this works?"

These determine whether megapowers can make quantifiable claims about its value.

### 4.1 No telemetry or metrics
**Severity: High — flying blind**
**Source: Laurie Bream, CTO council feedback**

No measurement of: cycle time per phase, phase abandonment rate, first-pass verify rate, token cost per workflow, artifact quality correlation. Without data, can't prove value, can't identify bottlenecks, can't prioritize improvements.

**Proposed:** Lightweight telemetry foundation — log phase transitions, abandon events (`/mega off`), cycle times. Local-only initially. Aggregatable later.

### 4.2 No tamper-evident audit log
**Severity: Medium — claims without receipts**
**Source: Security Engineer council feedback**

State transitions are mutable. `/mega off` has no log. State.json can be manually edited. If the tool makes compliance claims ("this feature was TDD'd and reviewed"), there's no proof.

**Proposed:** Append-only transition log. Every state change, every override, every gate passage timestamped. Harder to silently modify than state.json.

### 4.3 Prompt injection can bypass gates
**Severity: Medium — theoretical but real**
**Source: Security Engineer council feedback**

Gates check artifact existence, not quality. Rapid `phase_next` calls with empty artifacts could skip through all phases. Malicious prompt injection could exploit this.

**Proposed:** Add minimum artifact quality checks (non-empty, minimum length, required sections). Rate-limit phase transitions. Log rapid transitions as anomalies.

### 4.4 No `/mega off` audit trail
**Severity: Medium — governance gap**
**Source: CTO, Security Engineer council feedback**

Any developer can disable all enforcement with no record. In team settings, this undermines the governance value proposition.

**Proposed:** Log `/mega off` events with timestamp and (if available) reason. Make visible in ship report. Enterprise mode could require approval.

---

## 5. Onboarding & Adoption — "Can new users get started?"

These determine whether the tool grows beyond power users.

### 5.1 No onboarding flow
**Severity: High — activation energy too high**
**Source: Big Head, PM, Erlich, OSS Maintainer council feedback**

Current path: install extension → create issue in markdown with frontmatter → pick workflow → navigate phases via undocumented slash commands. Four adoption barriers before reaching value.

**Proposed:** `/mega new` command — conversational issue creation. "What do you want to build?" → auto-generates issue → starts workflow. Zero-to-working in 30 seconds.

### 5.2 No lightweight workflow for small changes
**Severity: High — tool doesn't match small tasks**
**Source: PM, Jian-Yang council feedback**

Same 8-phase workflow for a typo fix and a 500-line feature. Small changes need a `quick-fix` workflow: reproduce → implement → verify → done (4 phases). Or even: implement → verify → done (3 phases) for trivial changes.

**Proposed:** Add `quick-fix` workflow type. Auto-suggest based on issue description length/complexity.

### 5.3 No "fast track" for experienced developers
**Severity: Medium — alienates senior devs**
**Source: PM council feedback**

Senior dev with a clear spec in their head doesn't want to brainstorm. Should be able to start at any phase with pre-populated artifacts.

**Proposed:** Allow phase skip with artifact pre-population. `/mega start --phase plan --spec <file>`.

### 5.4 No user-facing documentation
**Severity: High — can't recommend to others**
**Source: OSS Maintainer, Erlich council feedback**

AGENTS.md is architecture reference, not user docs. No Getting Started, no How It Works, no FAQ, no screenshots. README doesn't sell the benefit.

**Proposed:** 
- User-facing README rewrite (Erlich's pitch: "Megapowers makes AI agents build software the way senior engineers do")
- Getting Started guide
- How It Works with screenshots/GIFs
- FAQ

### 5.5 jj dependency as adoption barrier
**Severity: Medium — requires VCS migration**
**Source: Big Head, DevOps council feedback**

Users must have jj installed. Most developers use git. Requiring a VCS migration to try a workflow tool is high friction.

**Proposed:** Git adapter. jj as optional upgrade for advanced features (per-task changes, workspace isolation).

---

## 6. Product Vision — "What could this become?"

New strategic insights from council review.

### 6.1 Decision provenance chain (Peter Gregory)
The atomic unit of value isn't the code — it's the decision record. Every phase transition = a decision. Every artifact = accumulated reasoning. Every gate = a quality threshold. The workflow produces an auditable provenance chain for AI-assisted development. This is what enterprises will pay for. This is what makes AI development insurable and trustworthy.

**Implication:** Every feature should be evaluated against "does this strengthen the decision chain?"

### 6.2 Contrarian market position (Monica Hall)
Every AI coding tool races toward more autonomy. Megapowers adds more structure. The "no guardrails" approach is failing at scale — companies finding autonomous agents produce demo code, not production code. Megapowers is early to the correction swing.

**Implication:** Don't chase autonomy. Double down on structured, auditable, high-quality AI development. That's the moat.

### 6.3 Ship report as viral mechanic (Russ Hanneman)
A "ship report" at done phase — "This feature was brainstormed, specified, planned, reviewed, test-driven, and verified in 47 minutes with 23 tests" — is a shareable proof of quality. Developers post these. It's the growth engine.

**Implication:** The done phase isn't just wrap-up. It's the marketing moment. Make it beautiful.

### 6.4 Artifacts as deliverables, not gates (Erlich Bachman)
Prevention is invisible. Creation is visible. Each phase artifact should feel like a deliverable worth sharing, not a form to fill out. Beautiful specs, clean plans, sharp reviews.

**Implication:** Invest in artifact template quality. Make each phase output something the developer is proud of, not something they had to produce.

---

## Filed Issues Summary

| # | Title | Type | Status | Audit Section |
|---|-------|------|--------|---------------|
| 041 | Artifact overwrite protection | bugfix | open | 3.3 |
| 063 | Done phase artifacts write to wrong files | bugfix | open (superseded by #065) | 1.2 |
| 064 | jj bookmark + git push workflow | feature | open | 2.1 |
| 065 | Done phase refactor | feature | open | 1.2 |
| 066 | Plan/review iterative loop | feature | open | 1.3 |
| 067 | Subagent workspace squash missing | bugfix | open | 2.2 |
| 068 | Prompt-test task type | feature | open | 3.1 |
| 069 | Backward phase transitions | feature | open | 1.1 |

## Not Yet Filed (New from Council Review)

| Item | Audit Section | Source Persona |
|------|---------------|----------------|
| CI validation mode (`megapowers validate`) | 2.3 | DevOps Engineer |
| Telemetry foundation | 4.1 | Laurie Bream, CTO |
| Tamper-evident audit log | 4.2 | Security Engineer |
| `/mega off` audit trail | 4.4 | CTO, Security Engineer |
| `/mega new` conversational issue creation | 5.1 | Big Head, PM |
| Lightweight `quick-fix` workflow | 5.2 | PM, Jian-Yang |
| Fast-track phase skip | 5.3 | PM |
| User-facing documentation | 5.4 | OSS Maintainer, Erlich |
| `megapowers_query` tool | 3.4 | AI Orchestrator |
| Unify TDD signal path | 3.2 | AI Orchestrator |
| Ship report generation | 6.3 | Russ Hanneman |
| Git adapter (jj optional) | 5.5 | Big Head, DevOps |
| Prompt injection / gate quality checks | 4.3 | Security Engineer |
| Diagnosis review step (bugfix) | 1.4 | Original audit |
| Incremental re-diagnosis | 1.5 | Original audit |
