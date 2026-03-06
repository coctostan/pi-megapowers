---
id: 92
type: feature
status: done
created: 2026-03-06T02:53:37.907Z
priority: 1
---
# Two-tier plan validation — deterministic lint gate + focused deep review
## Problem

Plan writing/review/revise is the biggest bottleneck in the megapowers workflow. The current flow forces 3-4 session boundaries minimum, with the deep reviewer wasting time catching trivial issues (nonexistent file paths, placeholder text, missing TDD steps) instead of focusing on the hard structural questions (dependency correctness, spec coverage, test adequacy).

For large plans (15-30 tasks), this results in multiple expensive review/revise round trips where most revisions are for dumb mistakes that should have been caught earlier.

## Solution

Add a two-tier validation system:

### Tier 1: Lint gate (runs inside `plan_draft_done`)

**Deterministic checks** — zero LLM, runs in the tool handler:
- `files_to_modify` paths that don't exist on disk (`fs.existsSync`)
- `files_to_create` paths that already exist
- `depends_on` references to non-existent task IDs
- Dependency cycle detection (topological sort)
- Cross-task file conflicts (two tasks modify same file without declared dependency)
- Empty/missing required fields (description, title)

**Fast model pass** — strong model (Sonnet-class) with thinking OFF:
- Are TDD steps concrete and testable?
- Does the description contain placeholder text or "similar to Task N" references?
- Is the task self-contained or does it implicitly depend on unlisted prior work?
- Does the code reference APIs/functions that exist in the codebase?

If the lint gate finds issues, it returns them to the **current drafter session** (no session break). The drafter fixes inline and calls `plan_draft_done` again. This loop is fast because there's no cold start.

### Tier 2: Deep review (separate session, full reasoning)

Only runs after lint gate passes. The deep review prompt is tightened to focus exclusively on the hard questions:
- Dependency graph correctness — ordering, missing deps, unnecessary deps
- Spec/AC coverage completeness — does the task set satisfy all acceptance criteria?
- Test adequacy — will the planned tests actually catch regressions?
- Integration coherence — do the tasks compose into a working whole?
- Architectural concerns — is the approach sound?

The deep review session uses a strong model with thinking ON — this is where deep reasoning adds value.

### Full lifecycle

```
Draft session (strong model, thinking on):
  Write all tasks → plan_draft_done
  → [Deterministic lint — sync, in-handler]
  → [Fast model lint — strong model, thinking off, single API call]
  ↺ If issues: return to drafter, fix inline, resubmit
  → Lint passes → session break

Deep review session (strong model, thinking on):
  Focused on structural/semantic review only
  → approve or targeted revise → session break

Revise session (if needed):
  Fix specific issues → plan_draft_done
  → [Lint gate again]
  → session break

Deep review session 2:
  → approve (almost always, since issues were targeted)
```

### Configuration

The lint model should be configurable — users may want to specify which model/provider to use for the fast lint pass. Default: same model as drafter with thinking off. Could be a megapowers setting:

```json
{
  "planLintModel": "anthropic/claude-sonnet-4",
  "planLintThinking": "off"
}
```

### Implementation notes

- The fast model call uses the same `modelRegistry.find()` + `completeFn()` pattern that pi-lcm's `PiSummarizer` uses — proven approach for making targeted LLM calls from within an extension
- Deterministic checks run first (free, instant) — if they fail, the model call is skipped
- The fast model receives: spec content + all task files as markdown. Returns structured JSON with per-task issues.
- The lint gate is a quality improvement for the plan phase — it doesn't change the state machine or phase transitions
