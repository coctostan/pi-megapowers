## 2026-02-23

### Fixed
- Prevented silent artifact overwrites in `megapowers_save_artifact` by adding existence checks and explicit overwrite gating.
- Added optional `overwrite` parameter to save-artifact tool schema and threaded it to the artifact writer.
- Added user-facing save confirmation (`ctx.ui.notify`) and dashboard refresh after successful artifact saves.

### Tests
- Added/updated tests for overwrite protection in `tests/tool-artifact.test.ts`.
- Added/updated integration checks for UI notification and dashboard refresh in `tests/index-integration.test.ts`.
- Full suite passing: `414 pass, 0 fail`.
