---
type: plan-review
iteration: 3
verdict: revise
reviewed_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
approved_tasks:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
needs_revision_tasks:
  - 7
  - 8
  - 9
---

## Plan Review Summary — Issue 117

**Overall**: Architecturally sound with complete coverage. **Critical issue**: dependency chain for Tasks 6-9 must be flattened.

---

### Per-Task Assessment

**✅ Tasks 1-6 PASS**
- Task 1: Row-building implementation with milestone headers and active markers — correct, pure test thorough
- Task 2: Cursor navigation with non-focusable row skipping — correct, proper test coverage  
- Task 3: Action menu building with active/non-active distinction — correct logic
- Task 4: Detail view state and rendering — correct implementation
- Task 5: Widget driver using `ctx.ui.custom()` — correct, all imports verified (Key, matchesKey exist in @mariozechner/pi-tui), test covers all scenarios
- Task 6: Create row routing to `handleIssueCommand(ctx, state, store, "new")` — correct delegation

**❌ Tasks 7-9 NEED REVISION (implementation code correct, dependencies wrong)**
- Task 7: Implementation is correct, but **depends_on: [6]** should be **[5]**
- Task 8: Implementation is correct, but **depends_on: [7]** should be **[5]**
- Task 9: Implementation is correct, but **depends_on: [8]** should be **[5]**

---

### Critical Issue: Unnecessary Task Dependencies

**Current problem**: Tasks 6→7→8→9 are serially chained, creating:
1. **Blocking**: Later tasks can't start until earlier ones complete
2. **Merge conflicts**: All modify the same code region in ui.ts
3. **No logical dependency**: Each adds independent if/else branches to result handler

**Why tasks are independent**: Each adds separate conditional branch:
- Task 6: `if (result.type === "create")`
- Task 7: `if (result.type === "issue-action" && action === "open")`  
- Task 8: `if (result.type === "issue-action" && action === "archive")`
- Task 9: `if (result.type === "issue-action" && action === "close/close-now/go-to-done")`

Task 7's code does NOT depend on Task 6's. Task 8's code does NOT depend on Task 7's. Etc.

**Required fix**: Change frontmatter in three files:
- task-007.md: `depends_on: [5]` (was [6])
- task-008.md: `depends_on: [5]` (was [7])
- task-009.md: `depends_on: [5]` (was [8])

**No implementation code changes needed** — all three implementations are correct.

---

### Verified Correctness ✅

**All APIs verified in codebase**:
- `getFirstPhase(workflow)` returns Phase — exists in state-machine.ts
- `writeState(cwd, state)` and `readState(cwd)` — exist in state-io.ts  
- `handleSignal(cwd, "phase_next", target)` — exists in tool-signal.ts with correct signature
- `@mariozechner/pi-tui` exports `Key`, `matchesKey` — verified in ui-checklist.ts
- `store.archiveIssue(slug)` returns `{ ok: true; archivedIssue } | { ok: false; error }` — correct
- `store.createIssue(title, type, description, sources?, milestone?, priority?)` — correct signature

**All other review criteria**:
- ✅ **Coverage**: All 27 ACs addressed completely
- ✅ **TDD**: All 5 steps correct with realistic mocks
- ✅ **Imports**: No circular dependencies, all imports correct
- ✅ **Granularity**: One test, one implementation per task
- ✅ **Self-containment**: Code is standalone and executable

---

### Recommended Next Steps

After fixing the three `depends_on` values, the plan will be implementation-ready. The revise-instructions-3.md file contains specific guidance for this fix.
