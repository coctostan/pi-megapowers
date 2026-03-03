# Verification Report — Issue 090

## Test Suite Results

```
bun test v1.3.9 (cf6cdbbb)

 688 pass
 0 fail
 1439 expect() calls
Ran 688 tests across 60 files. [563.00ms]
```

Dedicated regression tests (`tests/reproduce-090.test.ts`):

```
bun test tests/reproduce-090.test.ts

 9 pass
 0 fail
 24 expect() calls
Ran 9 tests across 1 file. [69.00ms]
```

---

## Per-Criterion Verification

### Criterion 1: `phase_next` during plan phase with `planMode: "draft"` returns an error

**Command:** `bun test tests/reproduce-090.test.ts`

**Test:** "phase_next rejects plan→implement when planMode is 'draft' (no review happened)"
- Calls `advancePhase(tmp)` with `planMode: "draft"`, `plan.md` present
- Asserts `result.ok === false`
- **Result: PASS**

**Code evidence:** `extensions/megapowers/workflows/feature.ts` line 22 and `bugfix.ts` line 16:
```typescript
{ from: "plan", to: "implement", gates: [{ type: "requireArtifact", file: "plan.md" }, { type: "requirePlanApproved" }] }
```

`gate-evaluator.ts` `requirePlanApproved` case:
```typescript
case "requirePlanApproved": {
  if (state.planMode !== null) {
    return { pass: false, message: `Plan review not complete (planMode: ${state.planMode}). Call plan_draft_done to submit for review.` };
  }
  return { pass: true };
}
```

**Verdict: pass**

---

### Criterion 2: `phase_next` during plan phase with `planMode: "revise"` returns an error

**Command:** `bun test tests/reproduce-090.test.ts`

**Test:** "phase_next rejects plan→implement when planMode is 'revise' (after revise, before re-review)"
- Calls `advancePhase(tmp)` with `planMode: "revise"`, `plan.md` present
- Asserts `result.ok === false`
- **Result: PASS**

Same `requirePlanApproved` gate checks `state.planMode !== null` — catches both `"draft"` and `"revise"`.

**Verdict: pass**

---

### Criterion 3: `phase_next` during plan phase with `planMode: null` succeeds

**Command:** `bun test tests/reproduce-090.test.ts`

**Test:** "phase_next allows plan→implement when planMode is null (review completed)"
- Calls `advancePhase(tmp)` with `planMode: null`, `plan.md` present
- Asserts `result.ok === true` and `result.newPhase === "implement"`
- **Result: PASS**

**Verdict: pass**

---

### Criterion 4: `deriveTasks` returns tasks from task files when they exist

**Command:** `bun test tests/reproduce-090.test.ts`

**Test:** "deriveTasks reads task files when they exist (ignoring plan.md)"
- Creates 2 task files via `writePlanTask`, plus a plan.md saying "See task files."
- Calls `deriveTasks(tmp, slug)`
- Asserts `tasks.length === 2`, `tasks[0].index === 1`, `tasks[0].description === "Set up schema"`, `tasks[1].index === 2`, `tasks[1].description === "Build API"`
- **Result: PASS**

**Code evidence:** `extensions/megapowers/state/derived.ts` lines 14-20:
```typescript
const taskDocs = listPlanTasks(cwd, issueSlug);
if (taskDocs.length > 0) {
  return taskDocs.map((doc) => ({
    index: doc.data.id,
    description: doc.data.title,
    ...
  }));
}
```

**Verdict: pass**

---

### Criterion 5: `deriveTasks` falls back to `plan.md` parsing when no task files exist

**Command:** `bun test tests/reproduce-090.test.ts`

**Test:** "deriveTasks falls back to plan.md when no task files exist"
- Creates `plan.md` with `### Task 1: Do something\n### Task 2: Do another\n`, no task files
- Asserts `tasks.length === 2`, `tasks[0].index === 1`, `tasks[1].index === 2`
- **Result: PASS**

**Code evidence:** `derived.ts` lines 21-25: falls through to `plan.md` read when `taskDocs.length === 0`.

**Verdict: pass**

---

### Criterion 6: `extractPlanTasks` accepts `##` and `###` headers with `:`, `—`, or `-` separators

**Command:** `bun test tests/reproduce-090.test.ts`

**Tests:**
- "extractPlanTasks accepts ## headers (not just ###)" — `## Task 1: Set up schema` → 2 tasks. PASS
- "extractPlanTasks accepts em-dash separator (not just colon)" — `### Task 1 — Set up schema` → `description === "Set up schema"`. PASS
- "deriveTasks returns tasks when plan.md uses ## Task N — format" — full `## Task N — Description` format → 2 tasks. PASS

**Code evidence:** `plan-parser.ts` line 71:
```typescript
const pattern = /^#{2,3}\s+Task\s+(\d+)\s*[:—–-]\s*(.+)$/gm;
```
Matches `##` or `###`, followed by `:`, `—` (em-dash U+2014), `–` (en-dash U+2013), or `-`.

**Verdict: pass**

---

### Criterion 7: `revise-plan.md` prompt includes explicit instruction to call `plan_draft_done` after revisions

**Command:** `grep -n "plan_draft_done" prompts/revise-plan.md`

**Output:**
```
25:After all revisions are complete, call `megapowers_signal({ action: "plan_draft_done" })` to resubmit for review.
```

Full "When Done" section:
```
## When Done

After all revisions are complete, call `megapowers_signal({ action: "plan_draft_done" })` to resubmit for review.
Do not use direct phase-advance actions here — the plan must pass review before advancing to implement.
```

**Verdict: pass**

---

### Criterion 8: No plan-phase prompt template mentions `phase_next` as a valid action

**Command:** `grep -rn "phase_next" prompts/`

**Output:**
```
prompts/reproduce-bug.md:109:Then advance with `megapowers_signal({ action: "phase_next" })`.
prompts/diagnose-bug.md:109:Then advance with `megapowers_signal({ action: "phase_next" })`.
prompts/verify.md:89:Then advance with `megapowers_signal({ action: "phase_next" })`.
prompts/megapowers-protocol.md:7:- `{ action: "phase_next" }` — Advance to the next workflow phase
prompts/code-review.md:98:megapowers_signal({ action: "phase_next" })
prompts/write-spec.md:50:Then advance to the next phase with `megapowers_signal({ action: "phase_next" })`.
prompts/brainstorm.md:64:Then advance to the spec phase with `megapowers_signal({ action: "phase_next" })`.
```

`phase_next` does **not** appear in `write-plan.md`, `review-plan.md`, or `revise-plan.md` — the three plan-phase templates. It only appears in non-plan phases (brainstorm, spec, verify, code-review, reproduce, diagnose) where it is the correct action. `megapowers-protocol.md` is the protocol reference doc, not a phase-specific template.

**Verdict: pass**

---

### Criterion 9: Existing tests in `tests/reproduce-090.test.ts` assertions flip (currently assert buggy behavior)

**Command:** `bun test tests/reproduce-090.test.ts`

**Output:**
```
 9 pass
 0 fail
 24 expect() calls
Ran 9 tests across 1 file. [69.00ms]
```

All 9 tests pass. The spec says these tests "currently assert buggy behavior" — meaning before the fix they were written to document the bugs (expecting the wrong behavior). Post-fix, they now assert correct behavior and all pass. The full test suite (688 tests) also passes with 0 failures, confirming no regressions.

**Verdict: pass**

---

## Overall Verdict

**pass**

All 9 acceptance criteria are met:

1. ✅ `phase_next` with `planMode: "draft"` blocked by `requirePlanApproved` gate
2. ✅ `phase_next` with `planMode: "revise"` blocked by same gate
3. ✅ `phase_next` with `planMode: null` (after approval) succeeds
4. ✅ `deriveTasks` reads task files first via `listPlanTasks`
5. ✅ `deriveTasks` falls back to `plan.md` parsing when no task files exist
6. ✅ `extractPlanTasks` uses pattern `/^#{2,3}\s+Task\s+(\d+)\s*[:—–-]\s*(.+)$/gm` covering all required formats
7. ✅ `revise-plan.md` explicitly instructs `plan_draft_done` call after revisions
8. ✅ No plan-phase prompt template (`write-plan.md`, `review-plan.md`, `revise-plan.md`) mentions `phase_next`
9. ✅ All 9 regression tests in `reproduce-090.test.ts` pass; full suite: 688 pass, 0 fail
