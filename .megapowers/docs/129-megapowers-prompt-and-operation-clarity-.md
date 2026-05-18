# Megapowers prompt and operation clarity (#129)

Batch issue covering #128 (compact Megapowers prompt injection) and #121 (operation feedback clarity).

## What changed

### Compact, phase-aware prompt injection (#128)

`extensions/megapowers/prompt-inject.ts` no longer prepends the full `prompts/megapowers-protocol.md` block on every turn.

- **Active issues** now render a compact `## Megapowers` header containing:
  - active phase (with plan-mode label, e.g. `plan (draft)`)
  - current issue slug, and current task (`Task <index>: <description>`) in `implement`
  - phase-appropriate allowed actions for `megapowers_signal`, `megapowers_plan_task`, and `megapowers_plan_review`
  - phase notes (e.g. push/PR allowed in `done`) and phase warnings (e.g. no `phase_next` from plan)
  - universal rules: `Do not edit .megapowers/state.json.` and tool-error retry guidance
- **No-active-issue** prompt renders a compact `## Megapowers` block with `/issue list`, `/issue new`, `/triage` and the same rules. Open-issues list still renders here.
- **Phase template assembly is preserved**: per-phase prompt templates, workflow artifact variables, acceptance-criteria derivation, current-task vars, plan revise instructions, focused-review artifacts, advisory subagent section, derived tool instructions, and source-issue context all still render after the compact header.
- **Full protocol path retained**: new export `renderFullProtocolPrompt()` returns the canonical `## Megapowers Protocol` block from `prompts/megapowers-protocol.md`, reachable by tests and debug rendering (`/mega context debug`) without going through `buildInjectedPrompt`.

The allowed actions used by the compact header come from a single mapping module:

```ts
// extensions/megapowers/workflows/allowed-actions.ts
export function getAllowedActions(phase: Phase, planMode: PlanMode): AllowedActions
```

`deriveToolInstructions` (`extensions/megapowers/workflows/tool-instructions.ts`) now asserts at composition time that any `megapowers_signal` action it mentions is present in this mapping, preventing drift between the compact header and the appended phase guidance. Plan-mode guidance (`draft`/`revise`/`review`) is also routed through this module.

### Standardized operation feedback (#121)

A new module `extensions/megapowers/feedback.ts` exports a shared status vocabulary and a `composeMessage` helper:

```ts
export const ICONS = { success: "✅", info: "📋", warn: "⚠️", error: "❌", note: "📝" } as const;
export function composeMessage(args: ComposeArgs): string;
```

Every megapowers tool now uses it:

- `handleSignal` (`task_done`, `phase_next`, `phase_back`, `tests_failed`, `tests_passed`, `close_issue`)
- `handlePlanDraftDone` / `transitionDraftToReview`
- `handlePlanReview` (approve, revise, error paths)
- `handlePlanTask` (create and update; preserved error format with action-named errors)

Each success message now starts with an icon from the shared vocabulary, names what changed, includes the relative artifact path when a file under `.megapowers/plans/<slug>/` was written, and states an explicit next step.

Error messages now name the tool action (`plan_task`, `plan_review`) and a corrective action (e.g. `provide title`, `fix lint errors`, `delete and recreate corrupt task`, `submit during plan review`, `write revise-instructions file before revise verdict`).

Result fields (`message`, `error`, `triggerNewSession`) keep their existing names and semantics — only the contents of the strings changed.

### Hardening fixes added during code review

- `handlePlanTask` update path now reports only fields whose values actually changed, including the "no changes when only the description was rewritten unchanged" case.
- `handlePlanReview` no longer writes the review artifact or mutates task statuses when the revise verdict is rejected at the iteration cap.
- Removed an extraneous `Commands:` line from the no-active-issue prompt so its contents match AC29 exactly.

## Documentation

- New: `docs/operation-feedback.md` — status vocabulary, result-message shape, per-tool conventions, error rules, and adoption checklist for new megapowers tools.

## Key APIs

```ts
// extensions/megapowers/prompt-inject.ts
export function renderFullProtocolPrompt(): string;
export function buildInjectedPrompt(cwd: string, store?: Store): string | null;

// extensions/megapowers/workflows/allowed-actions.ts
export interface AllowedActions {
  signalActions: string[];
  planTask: boolean;
  planReview: boolean;
  notes: string[];
  warnings: string[];
}
export function getAllowedActions(phase: Phase, planMode: PlanMode): AllowedActions;

// extensions/megapowers/feedback.ts
export const ICONS: { success: "✅"; info: "📋"; warn: "⚠️"; error: "❌"; note: "📝" };
export function composeMessage(args: ComposeArgs): string;
```

## Tests

New test files:

- `tests/allowed-actions.test.ts` — phase/plan-mode coverage of the mapping.
- `tests/allowed-actions-parity.test.ts` — asserts the mapping and `deriveToolInstructions` cannot drift for `implement`, `verify`, `code-review`, `done`, and each plan mode.
- `tests/feedback.test.ts` — vocabulary + `composeMessage` shape.

Extended:

- `tests/prompt-inject.test.ts` — compact active/idle prompt, per-phase allowed actions, `review_approve` absence, `renderFullProtocolPrompt`, preservation of phase template content.
- `tests/context-summary.test.ts` — `/mega context debug` rendered-prompt contains the compact header.
- `tests/tool-signal.test.ts`, `tests/tool-plan-task.test.ts`, `tests/tool-plan-review.test.ts` — icon, summary, changes, artifact path, next-step, and error-wording shape per AC36–AC49.

Verification: `bun test` — 868 pass, 0 fail.
