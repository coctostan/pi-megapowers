# Feature: Remove `megapowers_save_artifact` Tool

## Summary

Removed the `megapowers_save_artifact` custom tool and replaced all artifact persistence with direct `write`/`edit` operations to `.megapowers/plans/<issue-slug>/<phase>.md`. The old tool forced a full-file overwrite on every save, made incremental edits during revision cycles impossible, and had a phase-confusion bug where the wrong artifact file could be overwritten. Artifact versioning is now handled automatically on backward phase transitions via a new `versionArtifact()` utility.

## Design Decisions

**Direct `write`/`edit` instead of a dedicated tool** — eliminating the tool layer entirely removes a class of bugs (phase confusion, forced rewrites) without adding complexity. The LLM already knows how to write files; the tool was redundant.

**Auto-versioning on `phase_back` only** — versioning is triggered at the moment of backward transition (review→plan, verify→implement, code-review→implement), not on every save. This is the only moment when overwriting an existing artifact would lose information. Forward transitions don't need versioning.

**`versionArtifact()` as a pure utility** — takes `planDir` and `filename`, scans for existing `.v{N}.md` files using a regex (with proper `escapeRegExp`), picks `max + 1`, and copies. Returns `null` (no-op) when the source file doesn't exist.

**`deriveToolInstructions(phase, issueSlug)` for per-session instructions** — generates the "how to save your artifact" instruction block with the concrete file path interpolated. Replaces the generic tool description with specific, actionable guidance per phase.

**Backwards compatibility** — the gate evaluator (`requireArtifact`) and write policy (`.megapowers/` paths always allowed) were not changed.

## API / Interface

### Removed
- `megapowers_save_artifact` tool — no longer registered; calling it returns an unknown tool error.

### Added

**`versionArtifact(planDir: string, filename: string): string | null`**
- Location: `extensions/megapowers/artifacts/version-artifact.ts`
- Copies `<filename>` to `<basename>.v{N}.md` where N = max(existing) + 1
- Returns versioned filename (e.g. `plan.v2.md`) or `null` if source doesn't exist

**`deriveToolInstructions(phase: PhaseConfig, issueSlug: string, options?: DeriveOptions): string`**
- Location: `extensions/megapowers/workflows/tool-instructions.ts`
- Returns phase-specific instructions with concrete artifact path
- Handles: terminal/done, review approval, TDD-only (implement), artifact phases, default

### Auto-versioning on `phase_back`
- `review → plan`: versions `review.md` and `plan.md`
- `verify → implement`: versions `verify.md`
- `code-review → implement`: versions `code-review.md`

## Testing

**New test files:**
- `tests/version-artifact.test.ts` — 4 tests: no-op when missing, v1 creation, v1→v2 sequential, max-finding (v3 when v2 exists)
- `tests/register-tools.test.ts` — asserts `megapowers_save_artifact` is not registered
- `tests/mega-command-tools.test.ts` — asserts `commands.ts` contains no `megapowers_save_artifact` references
- `tests/prompts-no-save-artifact.test.ts` — scans all `prompts/*.md`; regression canary

**Updated test files:**
- `tests/tool-signal.test.ts` — 3 new `phase_back` tests asserting versioned files are created with correct content
- `tests/workflow-configs.test.ts` — `deriveToolInstructions` tests updated to require concrete paths
- `tests/prompt-inject.test.ts` — concrete path assertions added

Full suite: **693 pass / 0 fail** across 38 files.

## Files Changed

| File | Change |
|------|--------|
| `extensions/megapowers/artifacts/version-artifact.ts` | **Added** — `versionArtifact()` utility |
| `extensions/megapowers/workflows/tool-instructions.ts` | **Modified** — `deriveToolInstructions()` requires `issueSlug`, emits `write`/`edit` instructions |
| `extensions/megapowers/tools/tool-artifact.ts` | **Deleted** — `megapowers_save_artifact` implementation removed |
| `extensions/megapowers/tools/tool-signal.ts` | **Modified** — `handlePhaseBack` calls `versionArtifact` before each backward transition |
| `extensions/megapowers/register-tools.ts` | **Modified** — removed `megapowers_save_artifact` registration |
| `extensions/megapowers/commands.ts` | **Modified** — removed `megapowers_save_artifact` from on/off lists |
| `extensions/megapowers/prompt-inject.ts` | **Modified** — passes `state.activeIssue` as `issueSlug` to `deriveToolInstructions` |
| `prompts/megapowers-protocol.md` + 9 phase templates | **Modified** — `save_artifact` → `write`/`edit` with concrete paths |
| `AGENTS.md` | **Modified** — removed `megapowers_save_artifact` from custom tools list |
| `ROADMAP.md` | **Modified** — #041 marked superseded by #086 |
| `tests/version-artifact.test.ts` | **Added** — 4 tests for `versionArtifact` |
| `tests/register-tools.test.ts`, `mega-command-tools.test.ts`, `prompts-no-save-artifact.test.ts` | **Added** — regression canaries |
| `tests/tool-signal.test.ts`, `workflow-configs.test.ts`, `prompt-inject.test.ts` | **Modified** — updated assertions |
| `tests/tool-artifact.test.ts` | **Deleted** |
