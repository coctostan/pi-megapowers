## Test Suite Results

```
bun test — 650 pass, 0 fail across 34 files [382ms]
```

All tests pass on a fresh run.

---

## Per-Criterion Verification

### Criterion 1: When megapowers is enabled and no active issue, `buildInjectedPrompt()` returns non-null injected text including the Megapowers protocol/tooling orientation (from `prompts/base.md`)

**Evidence:**
- `extensions/megapowers/prompt-inject.ts` lines 71–74:
  ```ts
  if (!state.activeIssue || !state.phase) {
      const base = loadPromptFile("base.md");
      return base || null;
  }
  ```
  When `megaEnabled=true` and no active issue, the function loads and returns `base.md` content (non-null when file exists).
- `prompts/base.md` exists (confirmed by `ls prompts/`) and contains the full Megapowers protocol tooling orientation including `megapowers_signal`, `megapowers_save_artifact`, and Getting Started guidance.
- Test: `(pass) buildInjectedPrompt > returns base.md content when megaEnabled but no active issue`

**Verdict:** ✅ pass

---

### Criterion 2: When megapowers is disabled, `buildInjectedPrompt()` returns `null` regardless of whether an active issue exists

**Evidence:**
- `prompt-inject.ts` line 67: `if (!state.megaEnabled) return null;` — this fires before any issue/phase check.
- Tests:
  - `(pass) buildInjectedPrompt > returns null when megaEnabled is false`
  - `(pass) buildInjectedPrompt > returns null when megaEnabled is false even with active issue`

**Verdict:** ✅ pass

---

### Criterion 3: When megapowers is enabled and an active issue is set, `buildInjectedPrompt()` injects the phase-specific prompt template (not `prompts/base.md`)

**Evidence:**
- When `activeIssue` is set, execution falls through the no-issue early return and builds `parts[]` from `megapowers-protocol.md` + phase-specific `getPhasePromptTemplate(state.phase)`. `base.md` is never referenced in this path — `grep -n "base.md" extensions/megapowers/prompt-inject.ts` returns only line 73 (inside the no-issue branch).
- Test: `(pass) buildInjectedPrompt > returns phase prompt (not base.md) when issue is active`

**Verdict:** ✅ pass

---

### Criterion 4: `prompts/base.md` exists as a standalone template file and is the only template used by the "enabled but no active issue" injection path

**Evidence:**
- `ls prompts/` confirms `base.md` exists.
- `prompt-inject.ts` no-issue path (lines 71–74) calls only `loadPromptFile("base.md")` — no other files loaded in that branch.
- `prompts/base.md` content: Megapowers protocol, tool descriptions, Getting Started section with `/issue` command and workflow start guidance.
- Tests in `tests/base-prompt.test.ts`:
  - `(pass) prompts/base.md (AC4) > exists as a standalone template file`
  - `(pass) prompts/base.md (AC4) > contains Getting Started section`
  - `(pass) prompts/base.md (AC4) > contains /issue command reference`
  - `(pass) prompts/base.md (AC4) > contains megapowers_signal tool reference`
  - `(pass) prompts/base.md (AC4) > contains megapowers_save_artifact tool reference`

**Verdict:** ✅ pass

---

### Criterion 5: `canWrite()` allows writes/edits to allowlisted safe files in every workflow phase, including early phases and done

**Evidence:**
- `write-policy.ts` `isAllowlisted()` matches `.json`, `.yaml`, `.toml`, `.env`, `.d.ts`, `.md`, `.config.*` — executed before phase-blocking logic.
- `canWrite()`: after `.megapowers/` check, `if (isAllowlisted(filePath)) return { allowed: true };` — unconditional pass-through in all phases.
- `tests/write-policy.test.ts` covers 66 allowlist-in-all-phases cases:
  - All pass: `README.md`, `CHANGELOG.md`, `docs/foo.md`, `tsconfig.json`, `.env`, `types.d.ts` allowed in every phase including brainstorm, spec, plan, review, verify, done, reproduce, diagnose, implement, code-review.

**Verdict:** ✅ pass

---

### Criterion 6: `canWrite()` continues to block writes/edits to non-allowlisted source code files in phases where source changes are not permitted

**Evidence:**
- `BLOCKING_PHASES` in `write-policy.ts`: `{"brainstorm", "spec", "plan", "review", "verify", "done", "reproduce", "diagnose"}`.
- Non-allowlisted, non-test files in these phases return `{ allowed: false, reason: "Source code writes are blocked during the ${phase} phase..." }`.
- Tests confirm blocking in every non-implement phase:
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in brainstorm phase`
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in spec phase`
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in plan phase`
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in review phase`
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in verify phase`
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in done phase`
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in reproduce phase`
  - `(pass) canWrite — allowlisted files in all phases > blocks src/app.ts in diagnose phase`
  - (same pattern for `lib/index.js`)

**Verdict:** ✅ pass

---

### Criterion 7: During implement phase, `canWrite()` continues to enforce the TDD guard for non-allowlisted source files (allowlist relaxation does not bypass TDD for production/source files)

**Evidence:**
- `write-policy.ts` TDD-gated phases logic (after allowlist check): non-test, non-`[no-test]`, non-skipped files return `{ allowed: false }` until `tddState.state === "impl-allowed"`.
- The allowlist check runs first — allowlisted files pass through — but non-allowlisted `.ts`/`.js` production files are not allowlisted, so they reach TDD gating.
- Tests in `write-policy.test.ts`:
  - `(pass) canWrite — allowlisted files in all phases > blocks source files in implement when TDD not satisfied`
  - `(pass) canWrite — allowlisted files in all phases > allows source files in implement when TDD impl-allowed`
  - `(pass) canWrite — allowlisted files in all phases > allows test files in implement without TDD`
- Also in `tool-overrides.test.ts`:
  - `(pass) evaluateWriteOverride > blocks production files when TDD not met in implement`
  - `(pass) evaluateWriteOverride > allows allowlisted files (config, json, md) without TDD in implement`

**Verdict:** ✅ pass

---

### Criterion 8: `prompts/write-plan.md` contains explicit guidance that purely type-only or otherwise non-testable tasks must be marked with a `[no-test]` annotation

**Evidence:**
- `grep -n "no-test" prompts/write-plan.md` returns line 45:
  > `**Type-only tasks** (interface changes, type aliases, `.d.ts` edits) that cannot produce a failing runtime test must be annotated with `[no-test]` in the task title (e.g., `### Task 3: Add phase field to State interface [no-test]`). This bypasses TDD enforcement for that task.`
- Test: `(pass) write-plan.md (AC8) > contains [no-test] annotation guidance for type-only tasks`

**Verdict:** ✅ pass

---

### Criterion 9: `prompts/implement-task.md` contains explicit guidance that `/tdd skip` may be used as an escape hatch when a task cannot reasonably produce a failing runtime test

**Evidence:**
- `grep -n "tdd skip" prompts/implement-task.md` returns line 65:
  > `- Otherwise, use the \`/tdd skip\` command to bypass the TDD guard for this task, then proceed with the implementation.`
- `implement-task.md` lines 61–65 contain a dedicated `## Type-Only Tasks` section explaining both the `[no-test]` path and the `/tdd skip` escape hatch.
- Tests:
  - `(pass) implement-task.md (AC9) > contains /tdd skip guidance`
  - `(pass) implement-task.md (AC9) > contains Type-Only Tasks section`

**Verdict:** ✅ pass

---

### Criterion 10: Automated tests fail if any `{{variable}}` placeholder in any prompt template under `prompts/` is not populated by the prompt injection logic

**Evidence:**
- `tests/prompt-templates.test.ts` runs `buildInjectedPrompt()` with a full mock state for each template and asserts `expect(output).not.toMatch(/\{\{[a-zA-Z_]+\}\}/)`.
- All 13 templates tested, all pass:
  ```
  (pass) reproduce-bug.md has no uninterpolated {{var}} placeholders in output
  (pass) diagnose-bug.md has no uninterpolated {{var}} placeholders in output
  (pass) implement-task.md has no uninterpolated {{var}} placeholders in output
  (pass) review-plan.md has no uninterpolated {{var}} placeholders in output
  (pass) verify.md has no uninterpolated {{var}} placeholders in output
  (pass) generate-bugfix-summary.md has no uninterpolated {{var}} placeholders in output
  (pass) write-plan.md has no uninterpolated {{var}} placeholders in output
  (pass) code-review.md has no uninterpolated {{var}} placeholders in output
  (pass) generate-docs.md has no uninterpolated {{var}} placeholders in output
  (pass) write-changelog.md has no uninterpolated {{var}} placeholders in output
  (pass) write-spec.md has no uninterpolated {{var}} placeholders in output
  (pass) capture-learnings.md has no uninterpolated {{var}} placeholders in output
  (pass) brainstorm.md has no uninterpolated {{var}} placeholders in output
  ```
- Note: `base.md` has no `{{var}}` placeholders (it's a static template), so it is not in the coverage test — correctly excluded. The test covers all phase-specific templates.

**Verdict:** ✅ pass

---

## Overall Verdict

**pass**

All 10 acceptance criteria are met. The implementation:
1. Injects `prompts/base.md` when mega is enabled but no issue is active (AC1, AC4).
2. Returns `null` when mega is disabled, regardless of issue state (AC2).
3. Injects phase-specific templates (not base.md) when an issue is active (AC3).
4. `canWrite()` allowlist relaxation correctly permits docs/config/typings in all phases (AC5) while blocking non-allowlisted source files in non-implement phases (AC6) and maintaining TDD guard for non-allowlisted source in implement (AC7).
5. `write-plan.md` contains `[no-test]` annotation guidance (AC8).
6. `implement-task.md` contains `## Type-Only Tasks` section with `/tdd skip` escape hatch (AC9).
7. All 13 prompt templates are covered by automated `{{var}}` placeholder detection tests (AC10).

Full test suite: **650 pass, 0 fail**.
