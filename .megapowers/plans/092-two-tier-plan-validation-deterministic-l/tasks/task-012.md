---
id: 12
title: Update review-plan.md to remove mechanical checks covered by T0 and T1
status: approved
depends_on: []
no_test: true
files_to_modify:
  - prompts/review-plan.md
files_to_create: []
---

**Covers:** AC19

**Justification:** Prompt file change — no observable code behavior. The prompt content is editorial, directing the deep reviewer to focus on architecture/approach/correctness instead of mechanical checks.

**Files:**
- Modify: `prompts/review-plan.md`

**Step 1 — Make the change**

Update `prompts/review-plan.md`. The key change is in the "Evaluate against these criteria" section, specifically the intro paragraph and the criteria descriptions.

Replace the paragraph at line 19 (beginning "The drafter has a pre-submit checklist..."):
```markdown
The plan has already passed deterministic structural lint (T0) and a fast-model coherence check (T1). Mechanical issues — empty descriptions, missing file targets, placeholder text, spec coverage gaps, dependency ordering — have been caught and fixed. **Focus your review entirely on higher-order concerns:** code correctness, architectural soundness, and implementation feasibility.
```

Update section "3. TDD Completeness" to focus on code quality rather than structural presence:
```markdown
### 3. TDD Completeness
Each task must have all 5 steps with **correct, working code**:
- **Step 1** — Test code tests the right behavior (not just structural presence)
- **Step 2** — Expected failure message is accurate for the actual error that will occur
- **Step 3** — Implementation uses correct APIs from the actual codebase
- **Step 4** — Same run command, expected PASS
- **Step 5** — Full test suite command, expected all passing

Flag any task where the code won't actually work — wrong function signatures, incorrect import paths, missing error handling.
```

Update section "4. Granularity" — keep as-is (this is a judgment call, not mechanical).

Remove or simplify section "6. Self-Containment" since T0 catches the most obvious issues:
```markdown
### 6. Self-Containment
Can a developer execute each task from the plan alone? Focus on: Are the APIs and function signatures correct? Do the imports exist? Is the error handling complete? (Structural completeness — file paths, non-empty descriptions — is already verified by T0 lint.)
```

**Step 2 — Verify**
Run: `cat prompts/review-plan.md` to verify the changes look correct.
Run: `bun test` to verify no tests depend on exact prompt content.
Expected: All tests still pass — prompt content is not tested directly.
