# Plan Review: Directory Restructure (#070)

Scope reviewed: **Plan** section only (Tasks 1–7) against Spec AC1–AC13.

## Per-Task Assessment

### Task 1: Move state/ files and update all imports — ✅ PASS
No gaps vs AC1/AC11–AC13.

Actionable nits:
- **Sweep scope:** in Step 5, prefer recursive sweeps so you don’t miss a non-root importer:
  - `rg 'from "\./state-machine\.js"' extensions/megapowers` (not `extensions/megapowers/*.ts`)
  - same for `state-io`, `store`, `derived`.

---

### Task 2: Move policy/ files and update all imports — ✅ PASS
Good dependency on Task 1, and the internal-relative import rewrites are correctly called out.

Actionable nits:
- **Make Step 4 fully deterministic:** replace “check for direct imports” with explicit sweeps (you already do this in other tasks):
  - `rg 'megapowers/(write-policy|gates|phase-advance)\.js' tests/ --no-heading`

---

### Task 3: Move tools/ files and update all imports — ✅ PASS
Clear mapping to AC2 and consistent with the earlier state/policy moves.

Actionable nits:
- Step 4 sweep is good; consider also adding a **source sweep** that’s recursive:
  - `rg 'from "\./(tool-signal|tool-artifact|tool-overrides|tools)\.js"' extensions/megapowers`

---

### Task 4: Move subagent/ files and update all imports — ✅ PASS
Covers AC4/AC5/AC6 and includes a “nothing left behind” check.

Actionable nits:
- In Step 5, the `rg` check for lingering source imports currently targets only `extensions/megapowers/*.ts`. Use recursive so you also catch any imports that might end up inside newly created files later:
  - `rg 'from "\./subagent-' extensions/megapowers`

---

### Task 5: Extract commands.ts from index.ts — ✅ PASS
Meets AC7 and (together with Tasks 6–7) supports AC10.

Strengths:
- The **shared RuntimeDeps + ensureDeps** pattern is explicit and should preserve the current “single store/jj/ui instance” behavior.
- Keeping `getArgumentCompletions` inline is safe (in current code they don’t capture `store/jj/ui`).

Actionable nits:
- When extracting handlers, add a one-liner rule to avoid accidental behavior edits:
  - “Do not change any conditional/notification/message strings; only replace free variables and remove now-redundant lazy-init guards.”

---

### Task 6: Extract hooks.ts from index.ts — ✅ PASS
Meets AC8.

Strengths:
- Using `Deps` from `commands.ts` and calling `ensureDeps(runtimeDeps, pi, ctx.cwd)` in the wrappers is consistent with Task 5.

Actionable nits:
- In Task 6 Step 1, double-check the `@mariozechner/pi-ai` imports: you listed both `AssistantMessage` and `TextContent` from that package; in current `index.ts`, `AssistantMessage` is imported from `@mariozechner/pi-ai` and `AgentMessage` from `@mariozechner/pi-agent-core`—match those exactly to avoid TS churn.

---

### Task 7: Extract setupSatellite and registerTools, slim index.ts — ✅ PASS (with one clarification)
Meets AC9/AC10 as written.

Clarification requested (spec alignment):
- The Spec’s **Out of Scope** mentions “Extracting subagent spawn glue from `index.ts`”, but AC10 requires `index.ts` ≤150 lines and the plan accomplishes that by moving tool registrations (including subagent orchestration) to `register-tools.ts`.

Actionable fix:
- Add a short note in Task 7 that this is a **verbatim relocation** to satisfy AC10 (no redesign), and therefore still qualifies as “pure refactor / no behavior change.”

Actionable nits:
- In `registerTools()`, prefer the pattern:
  - `const deps = ensureDeps(runtimeDeps, pi, ctx.cwd);` at the top of each tool `execute()` and then use `deps.store/deps.jj/deps.ui` to avoid repeated `ensureDeps(...)` calls and reduce copy/paste mistakes.

---

## Coverage
All acceptance criteria AC1–AC13 are covered by at least one task, and the coverage matrix is consistent with the task list.

## Ordering & Dependencies
No cycles; dependencies look correct:
- Moves are staged so relative imports are updated at the right times.
- Extraction tasks depend on all move tasks, which prevents churn while file paths are still shifting.

## TDD Completeness (per rubric)
All tasks are explicitly marked **[no-test]** and the work is a pure refactor. The plan consistently includes verification via `bun test`, so TDD 5-step RED/GREEN is **not applicable** here.

## No-Test Validity
✅ Valid for all tasks:
- Pure file moves/extractions.
- Verification step present (`bun test`) after each task.

## Self-Containment
Mostly self-contained.

Suggested tightening:
- Use recursive `rg` sweeps (`extensions/megapowers` vs `extensions/megapowers/*.ts`) to avoid missing non-root importers as directories are introduced.

## Verdict
**pass**

If you want, I can also provide a checklist-style “implementation order quick script” (commands only) derived from Tasks 1–7, but it’s not required for approval.
