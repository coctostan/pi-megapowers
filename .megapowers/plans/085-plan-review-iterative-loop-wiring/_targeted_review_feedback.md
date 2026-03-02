# Targeted review feedback — `_review_input.md`

File reviewed: `.megapowers/plans/085-plan-review-iterative-loop-wiring/_review_input.md`

## High-impact consistency fixes

1. **Top-level workflow line still includes the `review` phase** (but this spec removes it).
   - Ref: `32:9c|> **Workflow:** brainstorm → spec → **plan** → review → implement → verify → code-review → done`
   - Change: update this line to match the new workflow (`... → plan → implement ...`) or otherwise clearly mark it as “legacy/old workflow” if it’s intentionally describing the current state.

2. **Tool list conflicts with the spec’s deprecation and omits new plan-loop actions/tools.**
   - Ref: `10:0d|- { action: "review_approve" } — ...` vs deprecation section `79:0f|**review_approve deprecation**` / `81:9b|22. Calling ... review_approve returns a deprecation ...`
   - Ref: `73:c5|**plan_draft_done signal**` (but it’s not listed in the tool’s action list near the top)
   - Change: in the initial “megapowers tools” section, remove/mark `review_approve` as deprecated and add the new `plan_draft_done` action. Also consider listing the two new tools (`megapowers_plan_task`, `megapowers_plan_review`) alongside `megapowers_signal` since they’re central to this spec.

3. **End-of-file “Saving” instructions look out of date for the new loop.**
   - Ref: `517:3b|## Saving` through `524:49|Then advance with megapowers_signal({ action: "phase_next" }).`
   - Why: this spec says approval via `megapowers_plan_review` advances to implement (AC 15), and draft completion uses `plan_draft_done`.
   - Change: revise this section so it doesn’t instruct a manual `phase_next` from plan, and instead describes the draft→review signal and review verdict flow.

## Spec logic / internal contradictions

4. **`planIteration` bump semantics are inconsistent across sections.**
   - Ref (comment says bump on revise→review): `173:15|planIteration: number // starts at 1, bumps on each revise→review`
   - Ref (review tool says bump on review→revise): `69:96|... verdict: "revise" ... bumps planIteration.` and `254:01|Transition: set planMode: "revise", bump planIteration`
   - Change: pick one and make all mentions match (AC, comments, tool logic, and data-flow summary).

5. **Iteration cap wording doesn’t match the stated check.**
   - Ref (check is `>= MAX_PLAN_ITERATIONS`): `70:16|17. ... when planIteration >= MAX_PLAN_ITERATIONS (4) returns an error ...`
   - Ref (summary says `> 4`): `363:33|CAP HIT (iteration > 4):`
   - Change: align the summary wording with the actual cap condition.

6. **State-machine “leave plan phase via transition()” vs tool “advancePhase()” needs one clarifying sentence.**
   - Ref: `52:68|5. When leaving the plan phase via transition(), state sets planMode: null.` and tool behavior: `250:35|... advance to implement phase via advancePhase().`
   - Change: clarify whether `advancePhase()` internally uses `transition()` (so AC5 is satisfied automatically), or if tool handlers must explicitly null out `planMode` when advancing.

## Structure / formatting issues (easy wins)

7. **Nested/duplicate headings (“## Spec” immediately followed by “# Spec: ...”; same for Brainstorm).**
   - Ref: `37:af|## Spec` + `38:ef|# Spec: Plan-Review...`
   - Ref: `135:81|## Brainstorm Notes` + `136:4d|# Brainstorm: Plan-Review...`
   - Change: collapse each pair to a single heading level to reduce noise.

8. **Duplicated “Out of Scope” section(s) — likely consolidate or rename one.**
   - Ref: `120:47|## Out of Scope`
   - Ref: `426:fb|## Out of Scope (follow-up issue)`
   - Change: either merge into one section or make the distinction explicit (e.g., “Out of scope (this issue)” vs “Follow-ups”).

## Typos / small wording fixes

9. Typo: “Approive”.
   - Ref: `10:0d|- { action: "review_approve" } — Approive ...`
   - Change: “Approve”.

10. Double word: “a a”.
   - Ref: `157:52|... passed as a a JSON string field ...`
   - Change: “passed as a JSON string field”.

11. Minor: “passed as a a JSON string field” sentence is fine, but if this is a user-facing prompt template, consider adding one concrete note about escaping newlines/quotes in JSON strings (optional).
   - Ref: `157:52|... JSON string field ...`

## One confusing sentence

12. “Allow write to other `.megapowers/` paths (brainstorm, spec, etc. are read-only but shouldn’t error).” reads contradictory.
   - Ref: `307:f0|- ... Allow write to other .megapowers/ paths (brainstorm, spec, etc. are read-only but shouldn't error).`
   - Change: rewrite to clearly separate (a) what’s blocked in this mode and (b) what remains allowed.
