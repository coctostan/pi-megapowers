---
type: plan-review
iteration: 2
verdict: revise
reviewed_tasks:
  - 14
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
  - 10
  - 11
  - 12
  - 13
approved_tasks:
  - 14
needs_revision_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
  - 10
  - 11
  - 12
  - 13
---

### Per-Task Assessment

### Task 1: Remove task-level jj change helpers and task_done jj integration — ❌ REVISE
- **Coverage tag mismatch / incomplete:** claims **AC20** but doesn’t call out which tests it updates to cover the jj-removal invariants beyond 2 files; ok, but be explicit.
- **Step 1 not self-contained:** the added `task_done` test snippet uses `tmp`, `writeArtifact`, `setState`, `handleSignal`, `readState` with **no imports** or fixture setup shown. Plan must include full test code (imports + tmp dir creation).
- **Step 2 missing exact expected failure output:** “FAIL because …” is not an “expected failure message”. Make it deterministic (e.g. assertion message for `createTaskChange` still defined).
- **Step 3 not “full implementation code”:** it’s a checklist (“remove JJ imports… remove async block…”). Include the exact resulting exported surface / function bodies (at least the edited functions).
- **Granularity:** combines removing exports **and** changing task_done logic **and** deleting a describe block in another test; consider splitting if it becomes hard to keep one red→green loop.

### Task 2: Remove jj automation from phase-advance — ❌ REVISE
- **Step 1 test snippet missing imports** (`readFileSync`, `join`, etc.) and doesn’t show the rest of the file edits it requires (“delete entire suite”).
- **Step 2 missing exact failure message.**
- **Step 3 not full code:** “delete async jj block below writeState” is ambiguous without quoting the block or providing the final function body.
- **Granularity:** modifies both `phase-advance.ts` and `tool-signal.ts` + tests; if possible, keep phase-advance changes isolated and leave tool-signal plumbing for Task 6.

### Task 3: Remove unused jj parameter from prompt injection path — ❌ REVISE
- **Step 1 not self-contained:** missing imports and assumes test harness context.
- **Step 2 missing exact expected failure message.**
- **Step 3 partial:** provides signature + hooks snippet, but not the complete edited `prompt-inject.ts` export signature context.

### Task 4: Remove jj from UI issue/triage flows and command deps — ❌ REVISE
- **Coverage label incorrect:** says **AC 4, AC 6**, but this task is actually **AC5 (commands.ts)** + **AC6 (ui.ts)**. AC4 belongs to hooks (Task 5).
- **Step 1 not complete test code:** instructions like “Remove createMockJJ() usage from all calls” aren’t a full patch. Provide the exact updated call sites (or a full file replacement).
- **Step 2 missing exact failure message.**
- **Step 3 not full code:** large list of removals (params, checklist items, state writes) without final function signatures.
- **Granularity:** UI + commands + multiple behaviors (“dashboard line”, “done checklist”, “deps shape”) in one task. This is likely **multiple tests / multiple behaviors**; split into (a) commands deps cleanup, (b) UI rendering cleanup.

### Task 5: Remove session-start jj checks and notifications — ❌ REVISE
- **Coverage label incorrect:** says **AC1, AC5**, but this is **AC4** (hooks no longer checks jj availability / mismatch). AC1 is file deletion (Task 12); AC5 is commands deps (Task 4).
- **Step 1 includes one source-scan test**, but the plan also says “replace describe block” and “remove jj:null from makeDeps helper” without showing exact code.
- **Step 2 missing exact failure message.**
- **Step 3 not full code:** “delete both blocks” needs exact final code to avoid accidental behavior changes.

### Task 6: Drop jj parameter threading from signal handling and tool wiring — ❌ REVISE
- **Step 1 is instructions only** (no full test code).
- **Step 2 missing exact failure message.**
- **Step 3 incomplete / ambiguity:** signature change is shown, but it doesn’t show the updated helper signatures/return types and all updated call sites in-file.

### Task 7: Switch register-tools subagent/pipeline executors from jj to git — ❌ REVISE
- **Step 2 missing exact failure message.**
- **Step 3 mismatch with AC13/AC11:** the new `execGit` returns `{ code, stdout, stderr }`, but **AC13 states ExecGit must keep the `(args) => Promise<{ stdout, stderr }>` shape**. Either:
  - revise the plan to conform to AC13 exactly, **or**
  - call out that AC13 is inconsistent with current `ExecJJ` (which currently includes `code` and `opts.cwd`) and propose an explicit spec adjustment.

### Task 8: Rewrite pipeline-workspace.ts to git worktree with patch-file squash — ❌ REVISE
- **Major spec mismatch (AC21):** Acceptance requires workspace path `.megapowers/workspaces/<pipelineId>`, but current code uses `.megapowers/subagents/<pipelineId>/workspace`. Task 8 does not explicitly state updating `pipelineWorkspacePath()` to the required location, nor tests asserting it.
- **Step 1 test is partial** (“including: …”) and doesn’t cover key ACs:
  - AC14 (`git worktree add --detach …`) should be asserted via mock calls.
  - AC16 (“preserves worktree for inspection on squash failure”) needs an explicit test that `git worktree remove` is **not** called on apply failure.
  - AC17 cleanup `--force` should be asserted.
  - AC18 getWorkspaceDiff staged diff command sequence should be asserted here or in a dedicated task.
- **Step 2 missing exact failure message.**
- **Step 3 not full implementation code:** this is a substantial rewrite; plan should include the full new module (or at minimum full bodies for `createPipelineWorkspace`, `squashPipelineWorkspace`, `cleanupPipelineWorkspace`, `getWorkspaceDiff`, and path helpers).

### Task 9: Migrate pipeline runner/tool/oneshot to ExecGit — ❌ REVISE
- **Step 1 not full test code:** “Update these test files…” is not self-contained.
- **Step 2 missing exact failure message.**
- **Step 3 partial:** shows one snippet but not the full call chain changes (all updated imports and options types).

### Task 10: Update remaining workspace-related tests and comments for git worktrees — ❌ REVISE
- **Step 1 is a list**, not full test code.
- **Step 2 missing exact failure message.**
- **Granularity:** mixes (a) test behavior changes, (b) comment wording updates, (c) reproducer test changes. Consider splitting comments-only into a `[no-test]` doc/refactor task.

### Task 11: Remove jj fields from state-machine and state-io — ❌ REVISE
- **Step 2 missing exact failure message.**
- **Step 3 mostly ok**, but ensure the plan explicitly states the read-side behavior for legacy keys (silently ignore) and write-side behavior (drop) as required by **AC3**.

### Task 12: Delete jj modules and jj-specific tests — ❌ REVISE
- **Step 2 missing exact failure message.**
- **Step 3 deletion mechanics:** specify exactly how files are removed in this repo’s workflow (e.g. delete files from tree; tests should pass). Also confirm any re-exports/index files don’t still reference the deleted modules.

### Task 13: Final code/test sweep for residual jj symbols — ❌ REVISE
- **Not TDD-shaped:** Step 1 is a shell `grep`, not “full test code”. Either:
  - mark this task **`[no-test]`** with a justification (“verification-only sweep”), and keep explicit verification commands, **or**
  - replace it with a deterministic unit test that scans a **bounded** set of files and asserts absence of strings (if you really want this as a test).
- **Step ordering not red→green:** it’s effectively a cleanup checklist, not one test + one implementation.

### Task 14: Update AGENTS.md and prompt files to remove jj references — ✅ PASS
No issues. `[no-test]` is justified (docs/prompts only) and it includes a concrete grep verification step.

---

### Missing Coverage (Acceptance Criteria)
No acceptance criteria are completely unaddressed, but there are **two critical plan/spec alignment gaps** that must be fixed explicitly in tasks/tests:
1. **AC13 ExecGit shape:** tasks currently keep `{ code, stdout, stderr }` and `{ cwd }` opts (matching current `ExecJJ`), but AC13 as written says the shape is only `{ stdout, stderr }` and only `args: string[]`. Plan must resolve this mismatch.
2. **AC21 workspace path:** tasks must explicitly change and test the workspace path to `.megapowers/workspaces/<pipelineId>`.

---

### Verdict
**revise** — Most tasks need tightening to meet the plan-quality bar (self-contained Step 1 code, deterministic Step 2 failure messages, and “full code” Step 3). Also fix the AC mapping mistakes (Tasks 4/5) and the AC13/AC21 spec alignment issues (Tasks 7/8).
