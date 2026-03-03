## Verification Report Summary

**Overall Verdict: PASS** — All 8 acceptance criteria met, 759/759 tests pass.

### #081 — Close-issue not executed in headless done phase

| Criterion | Evidence | Verdict |
|---|---|---|
| AC1: Headless `showDoneChecklist` writes defaults | `ui.ts:81–88` replaces old `return` with auto-populate; `ui.test.ts:354–395` and `reproduce-084-batch.test.ts:86–97` | ✅ PASS |
| AC2: `onAgentEnd` executes `close-issue` → `updateIssueStatus` + state reset | `hooks.ts:113–127`; end-to-end regression test `hooks.test.ts:521–555` | ✅ PASS |
| AC3: `buildInjectedPrompt` injects `done.md` when `doneActions` non-empty | `prompt-inject.ts:165`; `prompt-inject.test.ts:178–213` | ✅ PASS |
| AC4: Test — `hasUI=false` → `updateIssueStatus` called + `activeIssue` null | `hooks.test.ts:521–555` — 6-step end-to-end headless pipeline | ✅ PASS |

### #083 — Checklist fires synchronously mid-stream

| Criterion | Evidence | Verdict |
|---|---|---|
| AC1: `showDoneChecklist` NOT in `register-tools.ts execute()` | `grep` returns zero matches; `reproduce-084-batch.test.ts:298–306` asserts absence | ✅ PASS |
| AC2: Checklist fires in `onAgentEnd` after turn completes | `hooks.ts:102–107`; `hooks.test.ts:431–463` (`hasUI=true` invocation confirmed) | ✅ PASS |
| AC3: `doneChecklistShown=true` after first show, prevents re-show | `hooks.ts:105`; `state-machine.ts:151` (reset on transition); `hooks.test.ts:465–493` | ✅ PASS |
| AC4: Two-call test — first fires, second does not | `hooks.test.ts:431–463` + `465–493` | ✅ PASS |