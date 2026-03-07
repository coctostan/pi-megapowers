## Task 4: Add focused review fan-out gating and plan builder

### 1) Add explicit AC coverage mapping
This task currently has no `**Covers:** ...` line, which makes AC traceability incomplete in review mode.

Add this line right below the task justification/Files section:

```md
**Covers:** AC16, AC17, AC19, AC20, AC21, AC22
```

(AC18 is enforced at invocation time in Task 6; keep threshold behavior tests here.)

### 2) Keep the pure helper as the single threshold source
You already defined `shouldRunFocusedReviewFanout(taskCount)`. Keep all threshold checks in the codebase delegated to this helper (Task 6 currently hardcodes `< 5`; fix there).

---

## Task 5: Run focused reviewers in parallel with soft-fail artifact collection

### 1) Add explicit AC coverage mapping
This task currently has no `**Covers:** ...` line.

Add:

```md
**Covers:** AC24, AC25, AC26, AC27
```

This reflects the soft-fail / partial-fail / full-fail behavior implemented by `runFocusedReviewFanout`.

---

## Task 6: Invoke focused review fan-out before building the review prompt

### 1) Add explicit AC coverage mapping
This task currently has no `**Covers:** ...` line.

Add:

```md
**Covers:** AC18, AC19
```

### 2) Use the shared gating helper instead of hardcoded threshold logic
Step 3 currently uses:

```ts
const taskCount = deriveTasks(cwd, state.activeIssue).length;
if (taskCount < 5) return;
```

Replace this with helper-based gating so AC16/AC17 remain the single source of truth for threshold semantics:

```ts
import { shouldRunFocusedReviewFanout } from "./plan-review/focused-review.js";

const taskCount = deriveTasks(cwd, state.activeIssue).length;
if (!shouldRunFocusedReviewFanout(taskCount)) return;
```

Also include the helper import in the Task 6 import block replacement.

---

## Task 7: Inject focused review artifacts and authority notes into the review prompt

### 1) Add explicit AC coverage mapping
This task currently has no `**Covers:** ...` line.

Add:

```md
**Covers:** AC23, AC24, AC25, AC26, AC27, AC28, AC29, AC30
```

This task is where advisory artifacts and authority-boundary text are surfaced in the main review prompt.