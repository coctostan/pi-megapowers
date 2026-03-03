# Bugfix Summary: megapowers_save_artifact reliability and overwrite safety

## Issues addressed
- #038 `megapowers_save_artifact` had no direct user feedback
- #039 `megapowers_save_artifact` silently overwrote existing artifacts

## What changed

### 1) Overwrite protection in artifact writes
**File:** `extensions/megapowers/tool-artifact.ts`

- Extended `handleSaveArtifact` signature to accept `overwrite?: boolean`
- Added file existence guard using `existsSync`
- When target file exists and `overwrite` is not true, return:
  - `File already exists: .megapowers/plans/<slug>/<phase>.md. Pass overwrite: true to replace it.`
- Preserved successful writes for:
  - first-time save
  - explicit overwrite (`overwrite: true`)

### 2) UI feedback + dashboard refresh in tool handler
**File:** `extensions/megapowers/index.ts`

- Updated `megapowers_save_artifact` tool schema to include:
  - `overwrite: Type.Optional(Type.Boolean())`
- Passed `params.overwrite` through to `handleSaveArtifact`
- On successful save, tool handler now:
  - calls `ctx.ui.notify(result.message!, "info")`
  - calls `ui.renderDashboard(ctx, readState(ctx.cwd), store)` (when UI/store available)

## Tests

### Added/updated coverage
- `tests/tool-artifact.test.ts`
  - verifies overwrite is blocked by default
  - verifies existing file is not clobbered on blocked overwrite
  - verifies error message contains path + overwrite guidance
  - verifies explicit `overwrite: true` succeeds
- `tests/index-integration.test.ts`
  - verifies save-artifact handler includes `ctx.ui.notify`
  - verifies save-artifact handler includes dashboard refresh

### Verification results
- Targeted suites: pass
- Full test suite: **414 pass, 0 fail**

## User-visible impact
- Users now get an explicit in-UI confirmation when artifacts are saved.
- Existing artifacts are protected from accidental data loss unless overwrite is explicitly requested.
