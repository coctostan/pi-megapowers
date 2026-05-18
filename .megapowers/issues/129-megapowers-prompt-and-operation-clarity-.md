---
id: 129
type: feature
status: in-progress
created: 2026-05-18T17:02:32.556Z
sources: [121, 128]
---
# Megapowers prompt and operation clarity consolidation
Consolidate the remaining M1 Megapowers UX clarity work from #121 and #128 into one implementation track.

## Goal
Make Megapowers interactions clearer and less noisy in actual use by combining compact phase-aware prompt injection with consistent operation feedback.

## Source issues
- #121 Megapowers operation feedback — progress, result summaries, and next-step clarity
- #128 Compact Megapowers prompt injection with phase-aware protocol header

## Scope
- Replace repeated full-protocol prompt injection with a compact, phase-aware header.
- Keep detailed phase templates intact.
- Keep full protocol available through explicit/debug/help/context paths.
- Ensure active prompts show only phase-relevant actions and critical rules.
- Make major Megapowers actions report what changed and what to do next.
- Standardize success/error/result wording for `megapowers_signal`, `megapowers_plan_task`, `megapowers_plan_review`, and relevant slash commands.
- Preserve workflow gates, TDD enforcement, plan review semantics, VCS policy, and state architecture.

## Acceptance criteria
- Default live Megapowers prompt no longer repeats the full `## Megapowers Protocol` block every turn.
- Active issue turns include a compact phase-aware header with current issue/phase, allowed actions, and critical rules.
- Open issues and available commands are shown only when issue selection/status/help/triage needs them.
- Full protocol remains available through an explicit/internal full rendering path and debug/context inspection where appropriate.
- Existing detailed phase templates still render as before.
- `megapowers_signal`, `megapowers_plan_task`, and `megapowers_plan_review` success/error messages consistently state what changed and the next step.
- Artifact-writing actions include the relevant artifact path in results.
- Existing workflow gates, state transitions, TDD behavior, plan review behavior, and focused-review anti-recursion behavior remain unchanged.
- Tests cover compact-vs-full prompt behavior, phase-specific compact guidance, and representative operation feedback messages.
- `bun test` passes.
