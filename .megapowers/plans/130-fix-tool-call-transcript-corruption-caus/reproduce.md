# Reproduction: Megapowers transition leaves an orphaned tool result

## Steps to Reproduce

### Minimal offline regression (no provider or live-session transition)

1. From the repository root run:
   ```sh
   bun test tests/tool-session-transcript.test.ts
   ```
2. The test creates an isolated temporary workflow fixture, registers the actual extension tools, and persists a user message and assistant `megapowers_signal` call into a transcript session-manager harness.
3. It invokes the registered tool's `execute()` with either:
   - `phase_next`: feature workflow at `brainstorm`, advancing to `spec`; or
   - `task_done`: feature workflow at `implement` with two plan tasks and an impl-allowed TDD state, completing task 1 and advancing to task 2.
4. After `execute()` returns, it appends the corresponding tool result, matching Pi's normal message-persistence order.
5. It projects the next request's transcript from the session manager and checks that every tool result has a matching assistant tool call.

Repeat with:

```sh
bun test --rerun-each 3 tests/tool-session-transcript.test.ts
```

All fixture writes are outside the repository in temporary directories and are removed in `finally`. No live Megapowers state is edited.

### Observed live reproduction

In pi-hashline-readmap, completing task 1 with `megapowers_signal({ action: "task_done" })` produced the success output below and then the provider error. Session-log evidence records the originating call and its result in different files.

## Expected Behavior

A successful workflow operation advances the phase/task and permits the next provider request. The provider-visible transcript must contain valid tool-call/result pairing: a result for call ID X must have its matching assistant call X. A session/context transition must not leave a standalone result behind.

## Actual Behavior

The workflow operation succeeds, but the projected request transcript contains a tool result without its originating call.

Exact user-reported success output and subsequent provider error:

```text
megapowers_signal action="task_done"
✅ Task 1 (Record the Gemini schema audit) marked complete
  • 18 tasks remaining
  Next: Task 2: Migrate read.bundle to StringEnum

Error: Codex error: No tool call found for function call output with call_id call_gcDDXJG3AU55XvSlR4Gh2x9P.
```

The errorMessage persisted in the assistant entry is exactly:

```text
Codex error: No tool call found for function call output with call_id call_gcDDXJG3AU55XvSlR4Gh2x9P.
```

This specific provider error has no JavaScript stack trace attached to the observed assistant entry.

## Evidence

### Recorded live component boundaries

Session directory:

`~/.pi/agent/sessions/--Users-maxwellnewman-pi-workspace-pi-hashline-readmap--/`

| Time (UTC) | Boundary / observation |
| --- | --- |
| 2026-10-01T16:24:32.082Z | Old session records assistant `megapowers_signal` call with arguments `{ "action": "task_done" }`. |
| 2026-10-01T16:24:32.089Z | A new session header is created. |
| 2026-10-01T16:24:32.117Z | New session's first message is the successful `megapowers_signal` tool result. |
| 2026-10-01T16:24:32.120Z | New session receives system entries, but no matching assistant call. |
| 2026-10-01T16:24:33.004Z | Assistant entry records the exact Codex error above. |

Old session:

`2026-10-01T16-21-39-421Z_01a0f845-7fdc-7409-b959-30cbd1c39e08.jsonl`

New session:

`2026-10-01T16-24-32-089Z_01a0f848-2258-7409-b959-30cc61d4ac6a.jsonl`

Both call and result have the identical full internal ID:

```text
call_gcDDXJG3AU55XvSlR4Gh2x9P|fc_06e8f46cb477e2dc016abe893fb4f887d28ac58f88de4bf5b0
```

### Offline check with installed Pi's real session manager

During the initial investigation, an isolated `bun -e` reproduction imported the actual registered extension tool and Pi 0.99.2's `SessionManager` from:

`/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js`

It used `SessionManager.inMemory(cwd)`, a temporary brainstorm workflow, and appended the tool result after registered `execute()` returned. No model request was made. Exact output:

```json
{
  "before": [
    "user",
    "assistant"
  ],
  "after": [
    "toolResult"
  ],
  "sessionIdChanged": true,
  "orphanedToolResults": [
    {
      "tool": "megapowers_signal",
      "id": "call_offline_repro"
    }
  ],
  "toolResult": [
    {
      "type": "text",
      "text": "📋 Phase advanced to spec\n  Next: Proceed with spec phase work."
    }
  ]
}
```

### Runtime ordering inspected

- `registerTools` registers the real execute callbacks. Exact source signature:
  ```ts
  export function registerTools(pi: ExtensionAPI, runtimeDeps: RuntimeDeps): void
  ```
- Callback signature in `extensions/megapowers/register-tools.ts:32`:
  ```ts
  async execute(_toolCallId, params, _signal, _onUpdate, ctx)
  ```
- The registered signal and plan-review callbacks invoke `sessionManager.newSession()` before returning their result (current lines 44 and 97).
- Installed Pi's `SessionManager.newSession(options)` resets file entries, indexes, and leaf ID (`dist/core/session-manager.js:691–715`).
- Installed Pi persists finalized tool-result messages with `sessionManager.appendMessage(event.message)` (`dist/core/agent-session.js:732–745`).
- Its request preparation projects provider history through `sessionManager.buildSessionProjection()` (`dist/core/agent-session.js:415–426`).

`symbol_graph(registerTools, include: ["source"])` confirmed the registration signature. `trace(registerTools)` returned a **static heuristic trace**, including `handleSignal` and its phase/task handlers; it is not runtime coverage of Pi's external callback dispatch. The offline invocation and recorded session messages provide the actual boundary evidence.

### VCS / environment changes checked

Ran:

```sh
git log --oneline -20 -- extensions/megapowers/register-tools.ts tests/new-session-wiring.test.ts
git show cd413f1 -- extensions/megapowers/register-tools.ts
```

Commit `cd413f1` (2026-03-04, fresh sessions on phase/task transitions) changed both existing raw `newSession({ parentSession: ... })` calls to `newSession()` and expanded transition coverage. The raw calls existed before this commit; this history check does not establish the original introduction date or which first Pi version began rejecting live requests.

Installed Pi's changelog under **0.87.0 (2026-09-21)** records the breaking change that made SessionManager canonical for provider context. This is recorded environmental evidence; causal diagnosis belongs to the next phase.

## Environment

- OS / architecture: `Darwin 25.6.0 arm64`.
- Pi CLI / @earendil-works/pi-coding-agent: `0.99.2`.
- Bun: `1.3.14` (`0d9b296a`).
- Repository HEAD at reproduction: `f40f61c`.
- Extension: local pi-megapowers source, package version `0.1.0`.
- Test runner: Bun (`bun test`), per `AGENTS.md`.
- Live example provider: `openai-codex`.
- Anthropic failures are user-reported; no matching Anthropic request was issued in this reproduction. Transcript-pairing failures are established independently of provider access.
- Existing unrelated working-tree changes were left untouched. No production extension code was changed.

## Failing Test

File: `tests/tool-session-transcript.test.ts`.

Two parameterized cases invoke the actual registered `megapowers_signal` execute callback. The test's small persistence harness models assistant-before-execute, result-after-execute, and session-manager-based request projection without importing Pi, keeping the repo's pure-test convention. Its transcript-clearing behavior is corroborated by the real installed-manager check above.

Core assertion (see the test file for complete fixture and harness code):

```ts
const result = await tools.megapowers_signal.execute(
  toolCallId, { action }, undefined, undefined,
  { cwd, hasUI: false, sessionManager },
);
sessionManager.appendMessage({
  role: "toolResult", toolCallId, toolName: "megapowers_signal",
  content: result.content, isError: false,
});
const messages = sessionManager.buildSessionProjection().messages;
const calls = new Set(messages.flatMap((message) =>
  message.role === "assistant" ? message.content.map((call) => call.id) : [],
));
const orphanedResults = messages.flatMap((message) =>
  message.role === "toolResult" && !calls.has(message.toolCallId) ? [message.toolCallId] : [],
);
expect(orphanedResults).toEqual([]);
```

Exact failure excerpts:

```text
error: expect(received).toEqual(expected)

- []
+ [
+   "call_repro_phase_next",
+ ]

      at <anonymous> (/Users/maxwellnewman/pi/workspace/pi-megapowers/tests/tool-session-transcript.test.ts:92:33)
```

```text
error: expect(received).toEqual(expected)

- []
+ [
+   "call_repro_task_done",
+ ]

      at <anonymous> (/Users/maxwellnewman/pi/workspace/pi-megapowers/tests/tool-session-transcript.test.ts:92:33)
```

The workflow-success assertions pass before these failures: phase becomes `spec`, or completedTasks becomes `[1]` and currentTaskIndex becomes `1`. These are not gate-validation failures.

Combined regression and existing-test run:

```text
bun test tests/tool-session-transcript.test.ts tests/new-session-wiring.test.ts

 6 pass
 2 fail
 16 expect() calls
Ran 8 tests across 2 files.
Command exited with code 1
```

Repeat run:

```text
bun test --rerun-each 3 tests/tool-session-transcript.test.ts

 0 pass
 6 fail
 21 expect() calls
Ran 6 tests across 1 file.
Command exited with code 1
```

## Reproducibility

**Always in the tested conditions:** both successful phase_next and task_done cases fail in all three repeat runs, plus the initial combined run. A real installed-manager offline check independently produced one orphaned result, and the user's exact live call is corroborated by logs.

Plan-review verdicts and other transition paths are not yet covered by this new reproduction test. No new live provider request was used to deliberately trigger this failure.

The initial investigation's broad log scan timed out. A separate reported session interruption has not been attributed to this bug and is not treated as equivalent evidence.

## Safe continuation

Reproduction is complete; production code remains unchanged. Do not deliberately invoke the defective live `megapowers_signal(phase_next)` solely to advance this investigation: it performs the same observed in-tool session reset. The user can run `/phase next` while idle; the inspected `handlePhaseCommand` calls the normal `handleSignal` transition/gates without performing that session-manager reset. This preserves the workflow's gated advance without editing state.json directly. Then continue with diagnosis.
