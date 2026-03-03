## Test Suite Results
```
333 pass
0 fail
596 expect() calls
Ran 333 tests across 15 files. [98.00ms]
```

## Per-Criterion Verification

### Criterion 1: `renderStatusText()` shows doneMode
**Evidence:** Line 48 of `ui.ts`:
```typescript
const modeLabel = state.doneMode ? ` → ${DONE_MODE_LABELS[state.doneMode] ?? state.doneMode}` : "";
return `📋 #${idNum} ${state.phase ?? "?"}${taskInfo}${modeLabel}`;
```
Test `"renderStatusText — done phase with doneMode > includes doneMode in status text"` passes — asserts output contains "changelog" when doneMode is "write-changelog".
**Verdict:** ✅ pass

### Criterion 2: `renderDashboardLines()` shows doneMode and instruction
**Evidence:** Lines 116-120 of `ui.ts`:
```typescript
if (state.phase === "done" && state.doneMode) {
    const label = DONE_MODE_LABELS[state.doneMode] ?? state.doneMode;
    lines.push(`${theme.fg("accent", "Action:")} ${label}`);
    lines.push(theme.fg("dim", "Send any message to generate."));
}
```
Test `"shows active doneMode in dashboard when set"` passes — asserts "changelog" appears.
Test `"shows instruction to send a message when doneMode is active"` passes — asserts "send" appears.
**Verdict:** ✅ pass

### Criterion 3: No regressions
**Evidence:** 333 pass, 0 fail. All existing tests untouched and green.
**Verdict:** ✅ pass

## Overall Verdict
**✅ pass** — Both `renderStatusText` and `renderDashboardLines` now display the active doneMode. The user will see "Action: Write changelog" and "Send any message to generate." in the dashboard, plus `📋 #014 done → Write changelog` in the status bar. 333 tests pass with zero regressions.