# Targeted Review Notes (hashline-referenced)

Scope: the pasted "write plan" prompt content is primarily composed of:
- `prompts/megapowers-protocol.md`
- `prompts/write-plan.md`

Below are *targeted* edits to align the prompt with the #085 spec (plan-mode loop, new tools, no standalone `review` phase).

## Must-fix inconsistencies

1. **Protocol still presents `review_approve` as a normal signal action (but spec deprecates it).**
   - `prompts/megapowers-protocol.md` `10:68` — lists `review_approve` as a normal action ("Approve the plan during review phase").
   - Fix: remove this from the “available actions” list *or* mark it explicitly deprecated and point to `megapowers_plan_review`.

2. **Protocol describes `phase_back` including `review→plan`, but the spec removes the `review` phase from workflows.**
   - `prompts/megapowers-protocol.md` `8:b1` — `phase_back` description still includes `review→plan` in the backward-transition list.
   - Fix: update the parenthetical to only include the currently-supported backward transitions.

3. **`write-plan.md` workflow line still includes a `review` phase.**
   - `prompts/write-plan.md` `3:9c` — workflow diagram includes the `review` phase.
   - Fix: update the diagram to match the new workflow order (no `review`).

4. **`write-plan.md` “Saving” section instructs direct `plan.md` authoring + `phase_next`, which conflicts with the new plan-mode loop.**
   - `prompts/write-plan.md` `97:da` — instructs saving a completed plan by writing `.megapowers/plans/{{issue_slug}}/plan.md` directly.
   - `prompts/write-plan.md` `99:eb` — provides a direct `write({ path: ".megapowers/plans/{{issue_slug}}/plan.md", ... })` example.
   - `prompts/write-plan.md` `102:49` — instructs advancing via `megapowers_signal({ action: "phase_next" })`.
   - Fix: revise this section to (a) instruct using `megapowers_plan_task` for task creation, and (b) end draft/revise with the new `plan_draft_done` signal instead of `phase_next`.

## Related prompt-template follow-ups (same issue pattern)

5. **`review-plan.md` still references the removed `review` phase + the deprecated `review_approve` flow.**
   - `prompts/review-plan.md` `3:98` — workflow diagram still includes `review`.
   - `prompts/review-plan.md` `83:00` — instructs calling `megapowers_signal({ action: "review_approve" })`.
   - `prompts/review-plan.md` `85:95` — instructs using `phase_back` to return to plan for rework.
   - Fix: update to the plan-mode review flow (`megapowers_plan_review` + planMode transitions), and remove references to a standalone `review` phase.

6. **Workflow diagrams with `→ review →` are duplicated across multiple prompts; update for consistency once the workflow changes.**
   - `prompts/brainstorm.md` `3:69` — workflow diagram includes `review`.
   - `prompts/write-spec.md` `3:73` — workflow diagram includes `review`.
   - `prompts/code-review.md` `3:7c` — workflow diagram includes `review`.
   - `prompts/verify.md` `3:20` — workflow diagram includes `review`.
   - `prompts/implement-task.md` `3:04` — workflow diagram includes `review`.
   - `prompts/diagnose-bug.md` `3:b2` — workflow diagram includes `review`.
   - `prompts/reproduce-bug.md` `3:0f` — workflow diagram includes `review`.
