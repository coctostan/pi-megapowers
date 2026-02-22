# Plan: Bugfix Mode (Component 03)

## Overview

8 tasks implementing the bugfix workflow end-to-end. Tasks are ordered by dependency: prompt templates first (no deps), then gates, artifact routing, prompt mapping, AC extraction, UI done-phase, index.ts integration, and finally state type update.

---

### Task 1: Create reproduce-bug.md prompt template

**Covers AC:** 1, 16
**Depends on:** nothing

**Files:**
- Create: `prompts/reproduce-bug.md`
- Modify: `extensions/megapowers/prompts.ts`
- Test: `tests/prompts.test.ts` (append)

### Task 2: Update diagnose-bug.md with optional Fixed When section

**Covers AC:** 5
**Depends on:** nothing

### Task 3: Create generate-bugfix-summary.md prompt template

**Covers AC:** 14
**Depends on:** nothing

### Task 4: Add bugfix gates (reproduce→diagnose, diagnose→plan)

**Covers AC:** 3, 4, 7, 8
**Depends on:** nothing

### Task 5: Add reproduce artifact routing and Fixed When AC extraction

**Covers AC:** 2, 6, 9, 10
**Depends on:** nothing

### Task 6: Add bugfix prompt variable mapping

**Covers AC:** 11
**Depends on:** Task 1

### Task 7: Add bugfix done-phase menu to UI

**Covers AC:** 12, 13, 17
**Depends on:** nothing

### Task 8: Update MegapowersState doneMode type

**Covers AC:** 15
**Depends on:** Task 7
