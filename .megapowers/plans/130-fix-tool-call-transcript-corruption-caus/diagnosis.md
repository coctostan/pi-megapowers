# Diagnosis

## Root Cause

**Megapowers confuses resetting session storage with replacing a running Pi session, and performs that storage reset during tool execution.**

The root-cause sites are the `megapowers_signal` and `megapowers_plan_review` execute callbacks inside `registerTools` (`extensions/megapowers/register-tools.ts:43–45` and `:96–98`):

```ts
if (result.triggerNewSession) {
  (ctx.sessionManager as any)?.newSession?.();
}
```

A successful domain operation has already persisted the workflow state and returned `triggerNewSession: true`. The wrapper then clears the current session's canonical entries while the assistant call is already persisted but the tool result is not yet persisted. Pi subsequently appends the result to the reset manager, and its next request projects that incomplete transcript. The provider correctly rejects an output whose originating call is absent.

The violated assumption is that `sessionManager.newSession()` is a complete, safe agent/session transition that can be performed from a model tool. It is not: it is a low-level storage mutation, exposed here only by bypassing the `ReadonlySessionManager` type with `as any`. The installed runtime happens to expose the mutable object behind that read-only interface. Optional chaining does not make calling an existing mutating method safe, and a cast has no runtime protective effect.

The supported command-context `ctx.newSession()` is a different operation: the installed `AgentSessionRuntime.newSession()` checks cancellation, creates a new manager, tears down the old runtime, builds a replacement runtime, emits session start, and provides a fresh context to `withSession`. It is command-only; substituting it directly inside tool execution or lifecycle handlers is not a valid fix.

### Confirming experiment: one variable, real installed manager

An isolated `bun -e` experiment invoked the unchanged registered `megapowers_signal(phase_next)` twice with identical temporary feature/brainstorm fixtures and Pi 0.99.2 `SessionManager.inMemory()`. The only variable was whether an instrumented wrapper around the manager's `newSession()` delegated to the real reset. No production code was changed; no model request was issued.

Exact output:

```json
{"allowReset":true,"events":[{"boundary":"newSession entry","roles":["user","assistant"]},{"boundary":"newSession exit","roles":[]},{"boundary":"execute returned","roles":[]}],"phase":"spec","sessionIdChanged":true,"providerRoles":["toolResult"],"orphanedResults":["call_differential"]}
{"allowReset":false,"events":[{"boundary":"newSession entry","roles":["user","assistant"]},{"boundary":"newSession exit","roles":["user","assistant"]},{"boundary":"execute returned","roles":["user","assistant"]}],"phase":"spec","sessionIdChanged":false,"providerRoles":["user","assistant","toolResult"],"orphanedResults":[]}
```

Both domain transitions succeeded and advanced to `spec`. Only the raw storage reset destroyed the call/result pairing. This isolates the corruption from workflow validation, result formatting, provider/model selection, UI behavior, prompt injection, and other installed extensions.

The recorded live session confirms that this malformed pairing reaches Codex: the originating task_done call is in the old session, and its result is the new session's first message. The exact rejection is:

```text
Codex error: No tool call found for function call output with call_id call_gcDDXJG3AU55XvSlR4Gh2x9P.
```

### Pi update relationship

Pi 0.87.0's changelog explicitly made SessionManager canonical for provider context. Installed Pi 0.99.2 request preparation reconstructs context from that manager before requests, rather than relying on any still-existing in-memory agent messages. Therefore clearing storage now directly removes the originating call from provider input.

This is an extension contract violation exposed by newer runtime behavior, not evidence that provider tool-calling protocols or Pi's normal persistence are broken. We have not bisected older Pi releases to establish the first version with a live failure. Anthropic failures are user-reported, not separately exercised here; the corrupt internal transcript occurs before provider-specific serialization and explains a cross-provider symptom without requiring an Anthropic-specific defect.

## Trace

### Symptom traced backward

1. **Provider rejects function output.** Its call ID has no preceding assistant call in the provider-visible context.
2. **Pi prepared that context from canonical session storage.** Installed `dist/core/agent-session.js:415–440`, `_installAgentRequestProjection()`, calls `buildSessionProjection()` and uses `projection.messages`.
3. **The result is persisted after execution.** Installed `dist/core/agent-session.js:732–745`, `_handleAgentEvent`, appends finalized assistant and tool-result messages with `sessionManager.appendMessage()`.
4. **Between assistant-call persistence and result persistence, the extension resets storage.** `register-tools.ts:44` / `:97` call the raw manager's `newSession()` before returning the result.
5. **The reset is the first correct-to-incorrect boundary.** Installed `dist/core/session-manager.js:691–715`, `newSession(options)`, generates a new ID, replaces entries with only a new header, clears indexes, and resets the leaf. The differential instrumentation shows roles changing from `[user, assistant]` to `[]` exactly here.
6. **The request to reset comes from valid workflow transitions.** `handleTaskDone`, `handlePhaseNext`, `handlePhaseBack`, `handlePlanDraftDone`, and both review verdict paths return the reset flag after their domain work. Their state mutations are not the transcript-corruption source.

### Observed forward execution order

```text
Persist assistant(tool call X)
  → registered execute(X)
    → domain handler validates and persists next workflow state
    → returns successful result with triggerNewSession
    → wrapper calls raw sessionManager.newSession()
      → canonical transcript cleared
    → execute returns successful tool content
  → Pi persists toolResult(X) into reset manager
  → Pi projects manager entries for next provider request
  → request contains toolResult(X), no assistant call X
  → provider rejects request
```

The state transition is already committed when the provider error occurs; restarting does not roll it back. Repeating a task completion blindly risks operating on the next task, so this is not a retryable workflow-validation error.

`trace(handleSignal)` and `trace(registerTools)` returned static heuristic paths, not runtime coverage of external Pi callback dispatch. They identify the domain-handler chain; real ordering is established by the instrumented actual callback invocation, installed host source, and timestamped session logs in `reproduce.md`. `symbol_graph(registerTools, include: ["contract"])` identifies `megapowers` as the entry-point caller and the result-error guards; it does not model the external runtime's persistence lifecycle.

## Affected Code

### Extension root-cause sites

- `extensions/megapowers/register-tools.ts:13`: `registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void`.
- `:32–51`: signal execute callback, including raw reset at `:44`.
- `:91–100`: plan-review execute callback, including raw reset at `:97`.

### Successful paths requesting the reset

- `extensions/megapowers/tools/tool-signal.ts:63–174`, `handleTaskDone`: next incomplete task (`:172`) and final task → verify (`:149`).
- `:229–252`, `handlePlanDraftDone`: draft/revise → review (`:250`).
- `:261–274`, `handlePhaseNext`: all valid forward/explicit-target transitions (`:272`).
- `:280–328`, `handlePhaseBack`: permitted backward transitions (`:326`).
- `extensions/megapowers/tools/tool-plan-review.ts:24–86`, `handlePlanReview`: revise verdict (`:78`).
- `:89–123`, `handleApproveVerdict`: approve → implement (`:121`).

Repository search finds only these two raw-reset consumers. Successful `tests_failed`, `tests_passed`, and `close_issue` return no reset flag; existing validation errors return before the raw reset.

### Supporting code / contracts

- `extensions/megapowers/index.ts:15–42`: entry point registers tools and hooks.
- `extensions/megapowers/commands.ts:157–185`, `handlePhaseCommand`: working gated transition without a transcript reset.
- `extensions/megapowers/hooks.ts:14–18`, `onContext`: no-op, not a transcript-replacement source.
- `hooks.ts:65–83`, `onBeforeAgentStart`: builds phase context at agent start; does not implement runtime replacement on a raw storage reset.
- `tests/new-session-wiring.test.ts:14–25`: fake manager only clears `_messages`; no persisted assistant/result boundary.
- `:187–193`: explicitly asserts the unsafe cast/call text exists.
- `tests/tool-session-transcript.test.ts`: new two-case regression covers actual registered callback and post-execute persistence; both currently fail.

Installed Pi references are relative to `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/`:

- `dist/core/extensions/types.d.ts:222–223`: tool/event session manager is read-only.
- `:269–280`: tool context supports nested execution, not session replacement.
- `:282–298`: session controls are only safe in user-initiated commands.
- `dist/core/agent-session-runtime.js:147–172`: full runtime/session replacement lifecycle.
- `dist/core/session-manager.js:691–715`: low-level reset.
- `dist/core/agent-session.js:415–440` and `:732–745`: canonical request projection and persistence.
- `docs/extensions.md:123–124`: sibling tools may run in parallel.
- `docs/extensions.md:210–213`: command-only session controls and replacement-context lifetime.

## Pattern Analysis

### Working local comparison: `/phase next`

`handlePhaseCommand` calls the same `handleSignal(cwd, "phase_next", target)` domain handler, thus retaining normal gates and state mutations. It displays the result and updates the dashboard but does not consume the `triggerNewSession` flag by mutating session storage. The command therefore has no model-issued tool call/result to split and does not erase canonical request history.

Differences from the broken wrapper:

1. User command handler rather than model-tool execution.
2. Same transition validation/state handler, but no raw session mutation afterward.
3. UI notification rather than a model tool result appended after execution.
4. Transcript remains intact; no pretense that a storage reset starts a new agent run.

This confirms domain state transitions and session resets are separable responsibilities.

### Supported host comparison: `examples/extensions/handoff.ts`

The installed example registers `/handoff` as a command (`:80–83`) and uses:

```ts
const newSessionResult = await ctx.newSession({
  parentSession: currentSessionFile,
  withSession: async (replacementCtx) => {
    replacementCtx.ui.setEditorText(editedPrompt);
    replacementCtx.ui.notify("Handoff ready. Submit when ready.", "info");
  },
});
```

Unlike Megapowers, it uses the command-context operation, awaits runtime replacement, honors cancellation, and performs post-replacement work through the fresh supplied context. The runtime creates/rebinds a complete session rather than resetting the manager beneath an active tool. Megapowers cannot copy this call into a tool: tools do not have the same command context or lifecycle guarantees.

### Mistaken design assumptions and test protection

`.megapowers/docs/080-clean-context-windows.md` calls the raw-reset pattern "correct", claims casts can fail at runtime, and conflates full prompt generation on agent start with a newly started session after a storage reset. Those claims are contradicted by the installed contracts and instrumented behavior. That document is historical intent, not a runtime contract.

The old wiring tests protect the implementation detail rather than the required transcript invariant. They prove only that a stub method was called, not that a fresh agent runtime exists or that the next provider request is valid. The new persistence-boundary tests expose the missing guarantee while preserving the repo's pure-test convention.

## Risk Assessment

`impact(registerTools, behavior_change, maxDepth: 3)` identifies the `megapowers` entry point in `index.ts` as the direct dependent. The static graph does not capture model-dispatched callback consumers, so the affected surface additionally includes both registered tools and every successful flagged path listed above. `registerTools` also registers plan-task/issue/batch tools; changes to this shared registration function must leave those tools intact.

Risks the plan must address:

- **Partial repair:** fixing the signal callback alone leaves plan-review approve/revise broken.
- **Workflow regressions:** task ordering, final-task → verify, backward artifact versioning, plan iteration/status updates, gates, and strict TDD sequencing must remain unchanged.
- **Batch corruption:** resetting storage in one tool loses the assistant message containing sibling calls and may leave siblings' results orphaned too. Waiting for a single tool result is not equivalent to waiting for the entire batch.
- **Nested/codemode calls:** nested calls are recorded under the outer tool result rather than as separate transcript pairs. A nested Megapowers reset can erase the outer assistant call; preserving only the nested ID is insufficient. The outer pair must survive.
- **Session lifecycle:** moving the same reset to another hook still bypasses runtime replacement. Command-only APIs cannot simply be invoked from tool/lifecycle contexts. Returning `terminate: true` alone neither restores the missing call nor protects mixed batches; Pi only ends automatic follow-up when the whole batch agrees to terminate.
- **Context intent:** removing the reset stops automatic clean-session behavior promised by #080. The plan must explicitly document any change of policy and remove inaccurate claims. `onBeforeAgentStart` injects context at agent start, not on every follow-up provider request inside the same run; preserving history must not be falsely presented as triggering a fresh phase prompt/runtime.
- **Existing tests:** six old wiring tests currently pass while requiring unsafe behavior. Replace their unsafe expectations rather than retaining contradictory tests or weakening pairing assertions.
- **Historical sessions:** preventing new corruption does not automatically repair already orphaned transcripts. Previously broken sessions may still need a one-time user-driven new session; historical repair is outside this fix unless explicitly planned.
- **Scope control:** legacy package namespaces, schema compatibility, `isError` conventions, and the separate unconfirmed session interruption are not established causes of this error and should not become unrelated migration work here.

## Fixed When

1. Neither transition-tool execute callback mutates the raw/read-only session manager to start/reset a session. No equivalent unsafe reset is merely relocated into a tool hook or lifecycle callback, and command-only session replacement is not invoked from tool execution.
2. Successful `phase_next`, `phase_back`, `task_done` (next task and final task → verify), `plan_draft_done`, and plan-review `approve`/`revise` all preserve valid provider-visible call/result pairing after normal result persistence. Cover every affected success path, including failure-free continuation.
3. Workflow state, phase gates, task/TDD sequencing, backward artifact handling, and plan-review artifacts/statuses/iteration behavior remain correct. The fix must not achieve pairing by refusing successful transitions or skipping validation.
4. Mixed multi-tool batches retain the containing assistant call message and all corresponding results regardless of sibling result order; a nested/codemode transition preserves the outer call/result pair as well.
5. Validation-error paths and non-reset signals (`tests_failed`, `tests_passed`, `close_issue`) keep their existing workflow behavior and do not reset session storage. Plan-task and issue/batch tool registration remains intact.
6. The existing reproduction regressions pass, and tests asserting the unsafe cast/reset are replaced with behavioral guarantees. Repository tests remain pure; an isolated real-installed-manager smoke check additionally confirms valid projected context, without modifying the active session.
7. The plan explicitly decides and documents the clean-context policy: preserve the current session for these transitions unless a supported, independently validated replacement/handoff mechanism is implemented. Tool descriptions, user-facing next steps, and active documentation must not claim automatic fresh sessions when none occur. Subsequent agent-start context must reflect the updated workflow state.
8. With the extension fix loaded, fresh supported sessions continue after successful transitions without the orphaned-call provider error or needing a restart. Validate with OpenAI and Anthropic when available; report provider smoke-test limitations rather than treating offline pairing checks as live provider tests.

## Phase continuation

Diagnosis is complete; production code remains unchanged. The defective model tool's live `phase_next` call would execute the confirmed reset again. Advance using the user-initiated `/phase next` command, which keeps normal gates without that reset, then author the implementation plan. No direct state.json edit is required.
