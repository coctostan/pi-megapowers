---
id: 130
type: bugfix
status: in-progress
created: 2026-10-01T16:36:43.159Z
priority: 1
---
# Fix tool-call transcript corruption caused by in-tool session resets
## Symptom
Successful Megapowers transition tools cause the next provider request to fail, requiring a new session. Reported with both OpenAI and Anthropic. Exact OpenAI example after megapowers_signal({ action: "task_done" }):

`Codex error: No tool call found for function call output with call_id call_gcDDXJG3AU55XvSlR4Gh2x9P.`

## Confirmed cause
`extensions/megapowers/register-tools.ts:44` and `:97` call `(ctx.sessionManager as any)?.newSession?.()` inside tool execute(), before Pi persists the tool result. The reset clears the originating assistant/tool-call entry; the result is then appended to a new session without a matching call. This bypasses the documented read-only sessionManager interface and does not perform a supported runtime/session replacement.

Installed Pi is @earendil-works/pi-coding-agent 0.99.2. Pi 0.87.0 made SessionManager canonical for provider context, exposing this unsafe behavior in subsequent requests. See installed CHANGELOG.md's 0.87.0 breaking changes and dist/core/agent-session.js's _installAgentRequestProjection().

## Direct evidence
Under `~/.pi/agent/sessions/--Users-maxwellnewman-pi-workspace-pi-hashline-readmap--/`:
- `2026-10-01T16-21-39-421Z_01a0f845-7fdc-7409-b959-30cbd1c39e08.jsonl`: at 16:24:32.082, assistant issues the task_done call above.
- `2026-10-01T16-24-32-089Z_01a0f848-2258-7409-b959-30cc61d4ac6a.jsonl`: new session created at 16:24:32.089; its first message is the matching tool result at 16:24:32.117; provider rejects it at 16:24:33.004.

An offline reproduction invoking the actual registered megapowers_signal(phase_next) with the installed real SessionManager.inMemory() and temporary brainstorm state confirmed: before execution, projected roles are [user, assistant]; after execution and normal result persistence, roles are [toolResult], session ID changed, and the tool result is orphaned. No live session transition or network request is needed to reproduce the corruption.

## Affected paths
Successful megapowers_signal phase_next, phase_back, task_done, and plan_draft_done; megapowers_plan_review approve and revise. Audit all triggerNewSession consumers. tests_failed/tests_passed and close_issue currently do not request a reset.

## Test gap
`bun test tests/new-session-wiring.test.ts` passes all six tests. The fake manager only clears its own _messages, and the tests explicitly require the unsafe cast/call. They do not model normal result persistence or validate provider-context call/result pairing.

## Fix requirements
- Remove raw sessionManager.newSession() calls from tool execution; preserve workflow state transitions and valid transcript pairing.
- Decide how to preserve fresh-context intent safely: supported lifecycle/context APIs after the complete tool batch, or explicit user-driven session replacement. Do not substitute command-only ctx.newSession() inside tools or lifecycle handlers.
- Replace tests that assert the unsafe implementation with behavioral regressions using the real installed/compatible session manager or a faithful persistence/runtime harness.
- Cover signal transitions and both plan-review verdicts, direct and nested/codemode calls where applicable, and multi-tool batches so sibling calls/results are not lost.
- Confirm subsequent provider context has no orphaned tool results and successful transitions do not require restarting the session.

## Scope note
The earlier investigation's broad log scan timed out. A separate reported session interruption has not been attributed to this bug; do not conflate it with the confirmed provider tool-pairing failure.
