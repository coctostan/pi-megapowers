Every option has a handler: "Generate bugfix summary", "Write changelog entry", "Capture learnings", "Close issue", "Squash...", and "Done" all have explicit branches. ✓

---

## Verification Report

## Test Suite Results
```
315 pass
0 fail
554 expect() calls
Ran 315 tests across 15 files. [69.00ms]
```

## Per-Criterion Verification

### Criterion 1: reproduce phase gets reproduce-bug.md with {{issue_slug}}
**Evidence:** `PHASE_PROMPT_MAP["reproduce"] === "reproduce-bug.md"` (prompts.ts:17). Template contains `{{issue_slug}}` (reproduce-bug.md line 3). Test: `"reproduce-bug template exists and contains {{issue_slug}}"` passes.
**Verdict:** pass

### Criterion 2: reproduce output > 100 chars saved as reproduce.md
**Evidence:** `artifact-router.ts` line: `if (phase === "reproduce" && text.length > 100)` → pushes `{ filename: "reproduce.md" }`. Test: `"saves reproduce.md when text is long enough"` and `"ignores short reproduce text"` both pass.
**Verdict:** pass

### Criterion 3: Gate reproduce→diagnose fails without reproduce.md
**Evidence:** Test `"fails when reproduce.md does not exist"` passes, checks `result.pass === false` and `result.reason` contains "reproduce.md".
**Verdict:** pass

### Criterion 4: Gate reproduce→diagnose passes with reproduce.md
**Evidence:** Test `"passes when reproduce.md exists"` passes.
**Verdict:** pass

### Criterion 5: diagnose phase gets diagnose-bug.md with {{issue_slug}} and {{reproduce_content}}
**Evidence:** `diagnose-bug.md` contains `{{issue_slug}}` and `{{reproduce_content}}`. Integration test `"diagnose-bug.md interpolates reproduce_content and issue_slug"` passes.
**Verdict:** pass

### Criterion 6: diagnose output > 100 chars saved as diagnosis.md
**Evidence:** `artifact-router.ts`: `if (phase === "diagnose" && text.length > 100)` → `diagnosis.md`. Test `"saves diagnosis artifact"` passes.
**Verdict:** pass

### Criterion 7: Gate diagnose→plan fails without diagnosis.md
**Evidence:** Test `"fails when diagnosis.md does not exist"` passes with `result.reason` containing "diagnosis.md".
**Verdict:** pass

### Criterion 8: Gate diagnose→plan passes with diagnosis.md
**Evidence:** Test `"passes when diagnosis.md exists"` passes.
**Verdict:** pass

### Criterion 9: Fixed When criteria extracted into acceptanceCriteria
**Evidence:** Test `"extracts acceptance criteria from ## Fixed When section"` passes — verifies 2 criteria extracted with correct text.
**Verdict:** pass

### Criterion 10: No Fixed When → acceptanceCriteria remains empty
**Evidence:** Test `"clears acceptanceCriteria when no Fixed When section"` passes — `result.stateUpdate.acceptanceCriteria` equals `[]`.
**Verdict:** pass

### Criterion 11: bugfix plan phase gets {{reproduce_content}} and {{diagnosis_content}}
**Evidence:** Integration test `"write-plan.md interpolates correctly when bugfix aliases reproduce→brainstorm_content and diagnosis→spec_content"` passes. Variables include both `reproduce_content`/`brainstorm_content` and `diagnosis_content`/`spec_content`.
**Verdict:** pass

### Criterion 12: bugfix done menu shows correct items
**Evidence:** Test `"shows bugfix menu items when workflow is bugfix"` passes — checks `menuItems` contains "Generate bugfix summary", "Write changelog entry", "Capture learnings", "Close issue" and does NOT contain "Generate feature doc".
**Verdict:** pass

### Criterion 13: Selecting "Generate bugfix summary" sets doneMode
**Evidence:** Tests `"sets doneMode to 'generate-bugfix-summary' when selected"` and `"notifies user when bugfix summary mode is active"` both pass.
**Verdict:** pass

### Criterion 14: generate-bugfix-summary.md has all required variables
**Evidence:** Test `"bugfix summary template contains expected placeholders"` passes — checks `{{reproduce_content}}`, `{{diagnosis_content}}`, `{{plan_content}}`, `{{files_changed}}`, `{{learnings}}`. Also `{{issue_slug}}` present in template.
**Verdict:** pass

### Criterion 15: doneMode type includes "generate-bugfix-summary"
**Evidence:** `state-machine.ts` type: `doneMode: "generate-docs" | "capture-learnings" | "write-changelog" | "generate-bugfix-summary" | null`. Test `"accepts generate-bugfix-summary as a valid doneMode"` passes.
**Verdict:** pass

### Criterion 16: PHASE_PROMPT_MAP maps reproduce to reproduce-bug.md
**Evidence:** `prompts.ts:17`: `reproduce: "reproduce-bug.md"`. Test `"maps reproduce to reproduce-bug.md"` passes.
**Verdict:** pass

### Criterion 17: Every bugfix done menu option handled or hits catch-all
**Evidence:** Code inspection of `ui.ts handleDonePhase`: "Generate bugfix summary" → sets doneMode + break, "Write changelog entry" → sets doneMode + break, "Capture learnings" → sets doneMode + break, "Close issue" → updates issue status + break, "Squash..." → squashes + break, "Done..." → break. All paths exit the loop.
**Verdict:** pass

## Overall Verdict
**pass** — All 17 acceptance criteria verified with evidence from test output, code inspection, and template content. 315 tests pass with 0 failures.