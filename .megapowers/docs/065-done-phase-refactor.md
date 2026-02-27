## Code Review: `065-done-phase-refactor` — **ready** ✅

### Files Reviewed
16 files across implementation and tests, plus `prompts/done.md`.

---

### Strengths

- **Disk-first architecture preserved** — `handleCloseConfirmation`, `handleDoneTaskDone` both read fresh state from disk, no module-level leaks
- **`parseBulletItems` is clean** — double-filter handles empty items, leading whitespace, both `-` and `*` markers correctly
- **Complete dead code removal** — `onAgentEnd` scraping deleted with its helper functions and unused imports; nothing left behind
- **VCS permission timing is correct** — `vcs-wrap-up` stays in `doneActions` until completed, so `jj` access is available during earlier actions too
- **Tests are meaningful** — `ui-checklist.test.ts` simulates real keypresses through the widget, `tool-signal.test.ts` verifies actual disk state transitions

---

### Findings

**Critical:** None  
**Important:** None

**Minor:**

1. **`tool-signal.ts:83` — Misleading error message** when `!state.activeIssue`. Returns `"task_done can only be called during the implement or done phase."` but the issue is no active session. Should be `"No active issue. Use /issue to select or create one first."` (created when the original combined condition was split)

2. **`register-tools.ts:53` — `closeStore = createStore(ctx.cwd)` duplicates the cached `store`** from `ensureDeps`. Both are disk-backed so functionally identical, but `commands.ts` documents `ensureDeps` as the "ONLY place allowed to create store/jj/ui." Should use `store` directly.

3. **`done.md` (generate-docs) — Removed VCS inspection guidance without a fallback.** Old text explicitly said "Use spec, plan, verify artifacts and inspect via `jj diff` or `git diff`." New text says "Inspect actual changed files" with no mechanism. When `vcs-wrap-up` is absent, VCS access is not granted and the instruction is impossible to follow literally.

These are all non-blocking; the implementation is correct, tests are comprehensive, architecture is clean. The three items can be addressed in a follow-up.