## Task 2: Document context.md handoff and planning-subagent experiment rules

Step 1 is now correct about reconciling the two `context.md` locations, but Step 2's verification command will not reliably prove that reconciliation happened.

Current Step 2 check:

```bash
grep -q "v1 scout rollout.*draft handoff lives at the plan root\|subagents/draft.*reserved for future" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md
```

Problem: `grep` matches one line at a time. Your intended clarification is written as a sentence under `## Artifact Layout`, while `## V1 project-scoped scout rollout` is a separate heading on a different line. The `v1 scout rollout.*draft handoff lives at the plan root` branch will therefore not match the document as written.

Replace that part of the command with direct checks for the actual sentence you told the implementer to add. For example, update Step 2 to use:

```bash
bash -lc 'grep -q "## V1 project-scoped scout rollout" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q "external `pi-subagents` extension" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q ".megapowers/plans/<issue-slug>/context.md" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q "plan-scout -> planner" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q "coverage-reviewer" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q "implementation delegation" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q "Less context overload" .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q "For the v1 scout rollout, the draft handoff lives at the plan root as `.megapowers/plans/<issue-slug>/context.md`." .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md \
  && grep -q "The `subagents/draft/` layout below is reserved for future expanded chains." .megapowers/docs/095-subagent-assisted-plan-review-decomposition.md'
```

That matches the actual doc text line-by-line and proves the contradiction is resolved.

Do not change Tasks 1 or 3; they pass review.