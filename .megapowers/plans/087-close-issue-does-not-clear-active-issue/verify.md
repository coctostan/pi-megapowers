## Test Suite Results

### Step 1: Full test suite (fresh run)
**RUN:** `bun test --dots; echo "__EXIT:$?"`

**Output:**
```text
bun test v1.3.9 (cf6cdbbb)
.......................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................

679 pass
0 fail
1415 expect() calls
Ran 679 tests across 59 files. [591.00ms]
__EXIT:0
```

**Result:** Full suite passed with exit code 0.

### Step 1b: Bug reproduction (from diagnosis) — confirm symptom is gone

#### Reproduction A: `close-issue` should clear active issue + phase + doneActions
**RUN:** (one-shot script invoking `onAgentEnd` with `doneActions: ["close-issue"]` and then reading state)

**Output:**
```json
{
  "before": {
    "activeIssue": "087-close-issue-does-not-clear-active-issue",
    "workflow": "bugfix",
    "phase": "done",
    "doneActions": ["close-issue"]
  },
  "updates": [
    {
      "slug": "087-close-issue-does-not-clear-active-issue",
      "status": "done"
    }
  ],
  "after": {
    "activeIssue": null,
    "workflow": null,
    "phase": null,
    "doneActions": []
  }
}
__EXIT:0
```

**VERIFY:** The original symptom (issue remains active in done phase after close) does not reproduce.

#### Reproduction B: short assistant text should not block non-content done actions
**RUN:** (one-shot script invoking `onAgentEnd` first with `doneActions: ["capture-learnings", "close-issue"]` and assistant text `"short"`, then invoking `onAgentEnd` again)

**Output:**
```json
{
  "afterShort": {
    "activeIssue": "087-close-issue-does-not-clear-active-issue",
    "phase": "done",
    "doneActions": ["close-issue"]
  },
  "afterSecond": {
    "activeIssue": null,
    "workflow": null,
    "phase": null,
    "doneActions": []
  },
  "updates": [
    {
      "slug": "087-close-issue-does-not-clear-active-issue",
      "status": "done"
    }
  ]
}
__EXIT:0
```

**VERIFY:** `capture-learnings` is consumed despite short text, so `close-issue` is not blocked.

---

## Per-Criterion Verification

### Criterion 1: After `close-issue` fires in `onAgentEnd`, `state.activeIssue` is `null` in `state.json`
**IDENTIFY:** Run reproduction A and inspect resulting state.

**Evidence:** Reproduction A output shows:
```json
"after": { "activeIssue": null }
```
Also regression test run:
```text
(pass) ... clears activeIssue to null after close-issue fires
```
(from `bun test tests/hooks-close-issue.test.ts; echo "__EXIT:$?"`)

**Verdict:** pass

### Criterion 2: After `close-issue` fires, `state.phase` is `null` in `state.json`
**IDENTIFY:** Run reproduction A and inspect resulting state.

**Evidence:** Reproduction A output shows:
```json
"after": { "phase": null }
```
Also regression test run:
```text
(pass) ... clears phase to null after close-issue fires
```

**Verdict:** pass

### Criterion 3: After `close-issue` fires, `state.doneActions` is `[]` in `state.json`
**IDENTIFY:** Run reproduction A and inspect resulting state.

**Evidence:** Reproduction A output shows:
```json
"after": { "doneActions": [] }
```
Also regression test run:
```text
(pass) ... removes close-issue from doneActions after it fires
```

**Verdict:** pass

### Criterion 4: `store.updateIssueStatus(activeIssue, "done")` is called when `close-issue` fires
**IDENTIFY:** Inspect close-issue handler and run reproduction A with captured store calls.

**Evidence:**
- Code inspection (`extensions/megapowers/hooks.ts`):
  - `131`: `store.updateIssueStatus(state.activeIssue!, "done");`
  - `132`: `writeState(ctx.cwd, { ...createInitialState(), megaEnabled: state.megaEnabled });`
- Reproduction A output shows captured call:
```json
"updates": [{ "slug": "087-close-issue-does-not-clear-active-issue", "status": "done" }]
```
- Regression test run:
```text
(pass) ... calls updateIssueStatus to mark issue done
```

**Verdict:** pass

### Criterion 5: A new session after issue completion shows no active issue (idle state / issue picker)
**IDENTIFY:** Verify post-close state read on next session and run dedicated regression test.

**Evidence:**
- Reproduction A/B outputs show post-close persisted state with:
```json
"activeIssue": null,
"phase": null
```
- Regression test run:
```text
(pass) ... new session after close-issue shows no active issue
```

**Verdict:** pass

### Criterion 6: Unrecognized done actions are always consumed regardless of LLM text length and do not block `close-issue`
**IDENTIFY:** Run reproduction B (short text) and inspect queue progression; inspect handler branch for non-content actions.

**Evidence:**
- Reproduction B output after short text:
```json
"afterShort": { "doneActions": ["close-issue"] }
```
(`capture-learnings` removed despite short text)
- Then second invocation clears issue:
```json
"afterSecond": { "activeIssue": null, "phase": null, "doneActions": [] }
```
- Code inspection (`extensions/megapowers/hooks.ts` lines 158-161): non-content actions are consumed unconditionally.
- Regression test run:
```text
(pass) ... secondary bug: unrecognized done actions (e.g. capture-learnings) are consumed even with short LLM text
```

**Verdict:** pass

### Criterion 7: All 6 tests in `tests/hooks-close-issue.test.ts` pass
**IDENTIFY:** Run the file directly.

**RUN:** `bun test tests/hooks-close-issue.test.ts; echo "__EXIT:$?"`

**Evidence:**
```text
6 pass
0 fail
Ran 6 tests across 1 file.
__EXIT:0
```

**Verdict:** pass

---

## Overall Verdict
pass

All seven acceptance criteria are satisfied with direct runtime evidence (fresh test runs + reproduction scripts) and code inspection. The original symptom (issue remains active after `close-issue`) no longer reproduces, and the secondary queue-blocking behavior is also resolved.
