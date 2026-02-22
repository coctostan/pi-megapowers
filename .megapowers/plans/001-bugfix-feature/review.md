Good, both files restored. Now the actual review:

---

## Review Findings

### 1. Coverage ✅
All 17 acceptance criteria are covered. The AC coverage matrix checks out — every criterion maps to at least one task.

### 2. Ordering ⚠️ One issue

**Task 8 should come before Task 7, not after.** Task 7's implementation uses `doneMode: "generate-bugfix-summary" as any` — that `as any` cast is needed because the type doesn't include the new value yet. If Task 8 (type update) runs first, Task 7 doesn't need the unsafe cast. 

However, this is minor — the `as any` cast works and Task 8 cleans it up. No blocking issue.

### 3. Completeness ⚠️ Two items

**Task 6's test doesn't actually test the implementation.** The test just checks that `write-plan.md` contains `{{spec_content}}` and `{{brainstorm_content}}` placeholders — but those already exist and pass today. The real implementation is the aliasing code in `index.ts`, which is untestable at the unit level (it's in the event handler wiring). This test verifies a precondition, not the feature itself. That's acceptable since the actual aliasing is integration-level, but it should be noted.

**Task 4: `diagnose→plan` gate might conflict with the existing `spec→plan` switch case.** When a bugfix issue is in `diagnose` phase and transitions to `plan`, the switch key is `"diagnose→plan"`. When a feature issue is in `spec` phase transitioning to `plan`, it's `"spec→plan"`. These are separate cases — no conflict. Confirmed fine.

---

**Verdict: pass**

The plan is solid. The ordering nit (Task 8 before 7) and the weak test in Task 6 are real but not blocking. Both are easy to handle during implementation. Ready to proceed.