# Code Review — Issue #115: Subagent Plan Revision Workflows

## Files Reviewed

| File | Description |
|------|-------------|
| `.pi/agents/revise-helper.md` | New project agent — targeted plan-revision advisor |
| `.pi/agents/draft-assist.chain.md` | New project chain — sequential plan-scout → planner draft-assist workflow |
| `.pi/agents/planner.md` | **Added during review** — advisory planning synthesizer (was missing; chain was broken without it) |
| `.megapowers/docs/115-review-fanout-pattern.md` | New docs — reusable review fan-out pattern description |

---

## Strengths

- **revise-helper.md** is well-structured and defensively scoped. The "Required input" section (lines 12–16) includes a sensible guard: "If the latest revise instructions are missing, stop and report…" — prevents the agent from hallucinating revisions when input is absent.
- **Authority boundaries** are consistently enforced across all three new agent prompts: explicit prohibition of `megapowers_plan_task`, `megapowers_plan_review`, `megapowers_signal`, and state file edits.
- **draft-assist.chain.md** uses the correct pi-subagents chain serialization format. `output:` / `reads:` / `model:` / `progress:` directives parse correctly per `chain-serializer.ts`.
- **115-review-fanout-pattern.md** is appropriately scoped documentation. The "Non-goals" section explicitly guards against scope creep (no new runtime orchestration, no parallel `.chain.md` support, no delegation of final review authority).
- Output format templates in `revise-helper.md` and `planner.md` use bounded, scannable sections rather than free-form prose, which is consistent with the existing reviewer agents.

---

## Findings

### Critical

**Missing `planner` agent — chain fails at runtime**  
**File:** `.pi/agents/draft-assist.chain.md` line 12 (`## planner`)  
**What's wrong:** `draft-assist.chain.md` defines a `## planner` step, which the pi-subagents chain runner resolves by looking up an agent with `name === "planner"` (`chain-execution.ts` line 162). No `.pi/agents/planner.md` existed before this review. On execution the runner would immediately return `{ isError: true, text: "Unknown agent: planner" }` and abort the chain.  
**Why it matters:** The feature's core deliverable — an executable sequential draft-assist chain — would be entirely non-functional. The verification step confirmed the chain *file* exists and has the right headings, but did not verify that the referenced agents exist.  
**Fix applied:** Created `.pi/agents/planner.md` — an advisory planning synthesizer that reads `context.md` (the scout handoff) and produces a structured advisory draft. It enforces the same authority-boundary conventions as all other project agents (no megapowers tool calls, advisory only).

---

### Important

None.

---

### Minor

**Stray closing fence at end of `revise-helper.md`**  
**File:** `.pi/agents/revise-helper.md` line 72 (original)  
**What's wrong:** After the output-format code block closes on line 64, the "## Output rules" section (lines 66–71) appeared outside any code fence in raw text, but a lone ` ``` ` on line 72 had no matching opening fence. In most markdown renderers this caused the "## Output rules" section to be rendered inside a code block, making it invisible as structured instructions.  
**Why it matters:** While the LLM reads agent files as text (so the instructions remain legible), downstream rendering in the pi TUI's agent detail view would display the output rules incorrectly. The rendering issue also misleadingly implies the rules are inert code rather than active directives.  
**Fix applied:** Removed the stray ` ``` ` on line 72.

---

## Recommendations

1. **Test chain agent resolution in verification.** The verify phase confirmed file presence and grep evidence, but did not invoke the chain or verify that referenced agent names resolve. Add a convention: for `.chain.md` files, check that every `## step-name` has a corresponding `.pi/agents/<step-name>.md` with a matching `name:` frontmatter field.

2. **Document the `{chain_dir}` vs project-path distinction.** The `plan-scout.md` agent writes to `.megapowers/plans/<issue-slug>/context.md`, but the chain's `output: context.md` writes to `{chain_dir}/context.md`. These are different paths. The `planner` step reads via `reads: context.md` from `{chain_dir}`, so the intermediate handoff works correctly within the chain. However, the project-path `context.md` written by the agent's own system prompt will also persist. This is not a bug but could confuse future maintainers — worth a brief comment in the chain file.

3. **Planner output artifact.** The `planner` step has no `output:` directive in the chain, which means its response text is captured but not automatically persisted to a named file in `{chain_dir}`. This is intentional for advisory-only flows (no artifact to carry forward), but if future users want the planner draft accessible after the chain completes, adding `output: planning-draft.md` would make that persistent without changing the advisory nature of the output.

---

## Assessment

**ready** (after fixes applied in this session)

Two issues found and fixed:
1. **Critical:** Missing `planner` agent created at `.pi/agents/planner.md` — chain is now executable.
2. **Minor:** Stray ``` removed from `revise-helper.md` line 72 — rendering corrected.

All 905 tests pass after fixes. No regressions. The three deliverables (revise-helper agent, draft-assist chain, review-fanout pattern doc) satisfy all 29 acceptance criteria. The advisory-only authority model is consistently enforced across all new files.
