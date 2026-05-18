## [Unreleased]
### Added
- Compact, phase-aware `## Megapowers` prompt header replacing the every-turn full-protocol injection in `buildInjectedPrompt` (#129, #128).
- Shared status vocabulary and `composeMessage` helper in `extensions/megapowers/feedback.ts` adopted by `handleSignal`, `handlePlanTask`, `handlePlanReview`, `handlePlanDraftDone`, and `handleCloseIssue` (#129, #121).
- Single allowed-action mapping in `extensions/megapowers/workflows/allowed-actions.ts` driving both the compact header and `deriveToolInstructions`, with parity tests (#129).
- `renderFullProtocolPrompt()` export reachable from tests and `/mega context debug` for explicit full-protocol rendering (#129).
- `docs/operation-feedback.md` documenting status vocabulary, result-message shape, and adoption guidance for new megapowers tools (#129).

### Changed
- Standardized success/error messages for all megapowers signals and plan tools to include an icon, what changed, artifact path when applicable, and explicit next step (#129, #121).
- `handlePlanTask` update path now reports only fields whose values actually changed (#129).
- `handlePlanReview` no longer writes the review artifact or mutates task statuses when a revise verdict is rejected at the iteration cap (#129).
