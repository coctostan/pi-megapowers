## Files Reviewed

- `extensions/megapowers/ui.ts` — Added ROADMAP.md/milestones.md hint line to `renderDashboardLines` idle mode (AC8 fix)
- `tests/ui.test.ts` — Added AC8 regression test for ROADMAP/milestones reference
- `prompts/review-plan.md` — Fixed duplicate "### 5." → "### 6." (AC12) and added `megapowers_signal({ action: "phase_back" })` to After Review section (AC13)
- `prompts/code-review.md` — Replaced `/phase implement` or `/phase plan` with `megapowers_signal({ action: "phase_back" })` in needs-rework section (AC16)
- `extensions/megapowers/prompt-inject.ts` — Read-only; idle prompt already correct (AC1–AC6)

## Strengths

- **`buildIdlePrompt` (prompt-inject.ts):** Clean separation — protocol, open issues, slash commands, roadmap — all composited via `parts.push()`. Issue filtering (`status !== "done"`) correctly excludes closed issues. Format `- #NNN title (milestone: ..., priority: ...)` matches the spec exactly.
- **`renderDashboardLines` idle path (ui.ts:74–82):** Simple, linear push-then-return pattern. Early return prevents any bleed-through to the active-issue rendering path. New ROADMAP line uses `theme.fg("dim", ...)` matching the tone of the other dim elements.
- **Test coverage:** All 16 ACs now have corresponding tests passing (680 pass, 0 fail).
- **`megapowers-protocol.md`:** `phase_back` documented with all 3 backward transitions; `learnings` listed as valid artifact phase — both correct.

## Findings

### Critical
None.

### Important
None.

### Minor

- `ui.ts:80`: The ROADMAP hint string `"See ROADMAP.md and .megapowers/milestones.md for what's next."` is bare text inside `theme.fg("dim", ...)` — no accent styling for the file paths. This is consistent with the other dim-toned hint in the "No active issue." line, so stylistically coherent, though accenting the filenames would add visual scannability. Not a bug.

- `prompts/code-review.md:112`: The new text `"Use megapowers_signal({ action: \"phase_back\" }) to transition back to implement (or present the recommendation to the user first if a plan-level rethink is needed)"` is slightly wordy. A cleaner phrasing would be: `"Use megapowers_signal({ action: \"phase_back\" }) to return to implement, or present findings to the user if a plan-level rethink is needed."` Not functionally wrong.

## Verification Post-Fixes

Re-ran full test suite after all 4 fixes:
```
bun test: 680 pass, 0 fail, 1222 expect() calls across 34 files [387ms]
```

All 16 ACs verified passing. All 4 previously failing criteria now confirmed fixed:
- AC8: `grep -n "ROADMAP\|milestones" ui.ts` → line 80 present ✅
- AC12: `grep -n "### [0-9]\." review-plan.md` → sequential 1–6, no duplicate ✅
- AC13: `grep -A8 "After Review" review-plan.md` → `megapowers_signal({ action: "phase_back" })` present ✅
- AC16: `grep -n "phase_back" code-review.md` → line 112 updated, no `/phase` commands remain ✅

## Assessment

**ready**

All 16 acceptance criteria pass. The 4 fixes applied in this session are contained, targeted, and don't affect any other behavior. Test suite is green.
