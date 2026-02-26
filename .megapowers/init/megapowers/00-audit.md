# Phase 0: Audit — Megapowers

> **Date:** 2026-02-25
> **Type:** Brownfield
> **Auditor:** Claude + Max (collaborative)

---

## 1. Codebase Health

### Size & Structure
- **30 source modules** in `extensions/megapowers/` — 4,107 LOC
- **30 test files** in `tests/` — 6,674 LOC (1.6x test-to-source ratio)
- **15 prompt templates** in `prompts/`
- **3 agent definitions** in `agents/` (worker, reviewer, scout)
- **1 prompt template** in `.pi/prompts/` (mp.md — the `/mp` command dispatcher)
- **9 mp-handler files** in `.megapowers/mp-handlers/` (council, new, quick, audit, health, back, ship, retro, export)
- **Single entry point:** `index.ts` at 870 LOC — the largest file by far, handles session lifecycle, all tool registrations, subagent spawning, and command registration

### Tests
- **574 passing, 3 failing** across 577 tests, 1,027 expect() calls
- **Failing tests** — all 3 are template expectation mismatches, not logic bugs:
  - `generate-docs.md` template expects `{{files_changed}}` placeholder — template was rewritten to tell LLM to use VCS instead
  - `generate-bugfix-summary.md` expects `{{files_changed}}` — same cause
  - bugfix integration test expects 6 interpolated variables but template only has 5
- **Root cause:** Templates were intentionally changed (LLM inspects VCS for files changed instead of injecting a list), but tests weren't updated to match. **Tests are wrong, not code.**
- **No TODOs, FIXMEs, or HACKs** in any source file — codebase is clean of debt markers
- **No test coverage tooling** configured

### Dead Code (confirmed)
- `appendLearnings(issueSlug, entries[])` in store.ts — defined, tested, **zero callers** outside store.ts and its test
- `buildWorkspaceSquashArgs()` in subagent-workspace.ts — exported, tested, **zero callers** outside its test. Subagent work captured as diff but never squashed back.

---

## 2. Architecture

### Module Map (by responsibility)

**Core State Machine:**
- `state-machine.ts` (157 LOC) — Types, transition tables, transition function. Two workflows: feature (8 phases), bugfix (7 phases). Backward transitions defined in tables but no tool/command triggers them.
- `state-io.ts` (41 LOC) — Atomic read/write of `state.json`
- `store.ts` (290 LOC) — Issue CRUD, artifact read/write, learnings, changelog. Filesystem-backed.

**Derived Data:**
- `derived.ts` (35 LOC) — `deriveTasks()` from plan.md, `deriveAcceptanceCriteria()` from spec.md/diagnosis.md
- `plan-parser.ts` (93 LOC) — Parses numbered task lists with `[no-test]`, `[depends: N]` annotations
- `spec-parser.ts` (83 LOC) — Extracts acceptance criteria and open questions

**Enforcement:**
- `gates.ts` (108 LOC) — Phase gate checks (artifact exists, no open questions, tasks complete)
- `write-policy.ts` (110 LOC) — Pure `canWrite()` — phase/TDD write matrix
- `tool-overrides.ts` (81 LOC) — Write/edit interception, test file tracking

**Tools (LLM-facing):**
- `tool-signal.ts` (251 LOC) — `handleSignal()` for task_done, review_approve, phase_next, tests_failed, tests_passed
- `tool-artifact.ts` (34 LOC) — `handleSaveArtifact()`
- `tools.ts` (26 LOC) — `createBatchHandler()`

**Phase Management:**
- `phase-advance.ts` (81 LOC) — Shared `advancePhase()` with gate checking
- `prompt-inject.ts` (175 LOC) — Builds context injected into every LLM prompt (phase, task, TDD state, protocol)
- `prompts.ts` (156 LOC) — Template loading and variable interpolation

**Subagent System:**
- `subagent-tools.ts` (149 LOC) — Dispatch and status handlers
- `subagent-runner.ts` (147 LOC) — Spawn args, env, JSONL parsing, runner state
- `subagent-workspace.ts` (29 LOC) — jj workspace management
- `subagent-status.ts` (58 LOC) — Status file read/write
- `subagent-context.ts` (63 LOC) — Task section extraction, prompt building
- `subagent-agents.ts` (113 LOC) — Agent discovery from markdown frontmatter
- `subagent-validate.ts` (35 LOC) — Dispatch validation
- `subagent-errors.ts` (25 LOC) — Repeated error detection
- `subagent-async.ts` (39 LOC) — Async utilities

**UI & Integration:**
- `ui.ts` (573 LOC) — Dashboard rendering, phase transition UI, done menu, issue commands. Second largest file.
- `satellite.ts` (35 LOC) — Subagent detection via PI_SUBAGENT env var
- `jj.ts` (151 LOC) — jj VCS operations
- `jj-messages.ts` (19 LOC) — Install/init notification strings
- `task-coordinator.ts` (80 LOC) — Diff file parsing for task changes

### Dependency Shape
- `index.ts` imports from 22 of the 29 other modules — it's the hub
- Modules are otherwise well-decomposed with minimal cross-dependencies
- State flows: disk → `readState()` → pure functions → `writeState()` → disk
- No module-level mutable state (by design, per AGENTS.md)

### Key Architectural Decisions
1. **Disk-first, tool-first** — No in-memory state. Every handler reads from disk.
2. **Derived data** — Tasks and acceptance criteria parsed from artifacts on demand, never cached in state.json
3. **Satellite mode** — Subagents get TDD enforcement via in-memory state + limited tool surface
4. **Prompt injection** — LLM context built fresh each turn from current state + artifacts

---

## 3. Documentation State

| Document | Location | Status |
|----------|----------|--------|
| AGENTS.md | root | Current — architecture reference, not user-facing |
| ROADMAP.md | root | **Stale** — "Current" section lists #041, #050, #051, #061 but doesn't reflect audit findings or council review |
| CHANGELOG.md | root | Current — 3 release sections, well-structured |
| UPSTREAM.md | extensions/megapowers/ | Current — pinned dependency audit |
| learnings.md | learnings/ | 3 entries, current |
| docs/plans/ | docs/plans/ | 12 historical design/impl docs from Feb 18-22. **Archive** — reflect original build, not current state |
| .megapowers/docs/ | .megapowers/docs/ | 7 feature docs from completed issues |
| .megapowers/project-audit-2026-02-24.md | .megapowers/ | Council-informed audit. Thorough on issues, light on architecture |
| mp-handlers/ | .megapowers/ | 9 handler files for `/mp` subcommands — **designed but not programmatically wired** (prompt-template based) |

**Missing:**
- No README (user-facing introduction)
- No Getting Started guide
- No architecture diagram
- No API reference for tools/commands

---

## 4. Feature Completeness

### What Works (fully functional)
- ✅ Feature workflow: brainstorm → spec → plan → review → implement → verify → code-review → done
- ✅ Bugfix workflow: reproduce → diagnose → plan → review → implement → verify → done
- ✅ TDD enforcement: blocks production writes until test written + `tests_failed` signal
- ✅ Phase gates: artifact existence, open question checks, task completion checks
- ✅ Write policy: phase-appropriate file access control
- ✅ Prompt injection: phase-specific context + protocol injected every turn
- ✅ Issue management: create, list, switch, batch, triage
- ✅ Subagent delegation: dispatch, status tracking, workspace isolation, timeout, error detection
- ✅ Satellite mode: TDD enforcement for subagent sessions
- ✅ Dashboard: TUI rendering of current state
- ✅ `/mega on|off`: toggle enforcement
- ✅ `/learn`: capture learnings
- ✅ `/tdd skip|status`: TDD guard controls
- ✅ `/mp` command: prompt-template dispatcher for 12 subcommands

### What's Half-Built
- ⚠️ **Done phase** — menu renders but: `appendLearnings()` dead code, no ship report, no artifact archival, capture-learnings has no save flow
- ⚠️ **Backward transitions** — defined in state machine tables (review→plan, verify→implement, code-review→implement) but no tool action or command triggers them. `/mp back` handler exists as prompt template but isn't wired programmatically.
- ⚠️ **Subagent squash** — `buildWorkspaceSquashArgs()` exists and is tested but never called. Subagent work captured as diff but not merged.
- ⚠️ **jj integration** — change IDs tracked, workspace create/forget works, but no bookmark creation, no squash-to-bookmark, no git push

### What's Broken
- ❌ 3 failing tests (template expectation mismatches — tests are stale, not code)
- ❌ jj mismatch dialog (#061) — select widget doesn't accept input during session_start, auto-patched to just update silently

### What Doesn't Exist Yet (from council/audit)
- No telemetry or metrics
- No transition/audit log
- No CI validation mode
- No git push workflow
- No lightweight/quick-fix workflow
- No onboarding flow
- No user documentation

---

## 5. User Experience (what's it like today)

### First-Time User Path
1. Install the pi package → no guidance
2. Must manually create `.megapowers/issues/XXX.md` with correct frontmatter format → no documentation on format
3. `/issue list` to see issues, `/issue <slug>` to activate → discoverable if you guess
4. Workflow starts at brainstorm/reproduce → prompt injection tells LLM what to do → this part works well
5. Phase transitions via LLM tool calls or `/phase next` → works but no way to go back
6. Done phase → menu renders but wrap-up actions are incomplete

### Power User Experience
- `/mega off` to escape when enforcement is frustrating → no audit trail
- `/mp council` for persona-based reviews → works via prompt template
- `/tdd skip` for edge cases → works
- `/learn` for capturing insights → works

### Pain Points
- No way to go backward when something is wrong
- Done phase is a dead end — can't properly close out work
- No quick path for small changes — same 8-phase ceremony for everything
- No onboarding — must already understand the system to use it
- `/mp` subcommands exist as prompt templates, not programmatic tools — they work but consume tokens and can't be batched

---

## 6. Prior Art & Existing Feedback

### Issue Backlog
- **52 archived** (completed) issues
- **17 open** issues (3 bugfix, 14 feature)
- **2 in-progress** (#050 agent context, #051 UX feedback)

### Council Review (2026-02-24)
18-persona review produced the restructured audit (`.megapowers/project-audit-2026-02-24.md`) organized into 6 categories with 22 findings. Key strategic insights:
- Decision provenance as the core value proposition
- Contrarian market position (structure over autonomy)
- Ship report as viral growth mechanic
- TDD enforcement as the crown jewel feature

### Handoff Document (2026-02-25)
Synthesized council review + audit + `/mp` command design. Identified transition log as the keystone dependency for 4+ features.

### 15 Unfiled Items
The restructured audit identified 15 items from the council review that aren't yet filed as issues (telemetry, audit log, `/mega off` trail, CI validation, quick-fix workflow, etc.)

---

## 7. Summary: What Do We Have?

**A well-architected, well-tested workflow enforcement engine with strong foundations but incomplete edges.**

### Strengths
- Clean architecture: disk-first, pure functions, derived data, no mutable module state
- Strong test culture: 1.6x test-to-source ratio, 574 passing tests, zero TODO/FIXME markers
- Core workflows work end-to-end for the happy path
- TDD enforcement is real and battle-tested
- Subagent system is sophisticated (workspace isolation, timeout, error detection)
- Prompt system is well-designed (phase-specific injection, template interpolation)

### Weaknesses
- **No way out when things go wrong** — backward transitions, re-diagnosis, iterative review all missing
- **Done phase is hollow** — the capstone of every workflow is incomplete
- **Work is stranded** — no git push, no subagent squash, no export
- **No onboarding** — zero path from "installed" to "productive"
- **No measurement** — can't prove value, can't identify bottlenecks
- **index.ts is a god file** — 870 LOC doing session lifecycle, tool registration, subagent spawning, command registration

### The One-Sentence Assessment
Megapowers proves the concept works — structured AI development with TDD enforcement produces better code — but it can't yet prove it to anyone who isn't already using it.
