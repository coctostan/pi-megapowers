# Brainstorm: Subagent Pipeline (#084)

## Approach

Build a two-layer subagent system on top of [pi-subagents](https://github.com/nicobailon/pi-subagents) (npm dependency). pi-subagents provides the execution layer — chain/parallel dispatch, agent definitions, progress tracking, artifacts, error detection, recursion guards. Megapowers builds an orchestration layer on top that adds jj workspace isolation, pipeline control flow with retry budgets and pause/escalate, state machine integration, structured result parsing, and TDD compliance auditing.

The system supports two modes. **Implementation pipeline**: for each plan task during the implement phase, the system-orchestrated pipeline runs implement → verify → review in a single jj workspace, with automatic retry on failure and escalation to the parent LLM when the retry budget is exhausted. **General-purpose subagent**: ad-hoc one-shot delegation for tasks like codebase discovery, wrapping pi-subagents' single execution.

TDD enforcement shifts from the current buggy in-memory satellite guard to a two-part approach: prompt-based TDD instructions in the implementer agent + deterministic after-the-fact TDD compliance auditing. The auditor scans the subagent's tool call history to verify test-first ordering and feeds the compliance report into the reviewer's context as a soft gate — the reviewer decides if non-compliance matters for that specific task.

## Key Decisions

- **Adopt pi-subagents as npm dependency** — not a fork. We use ~38% of it (execution engine, agent discovery, types). The TUI/management layer (~32%) is unused baggage but doesn't affect us. Upgrades via `npm update`.
- **System-orchestrated pipeline with escape hatches (Option C)** — happy path runs autonomously (no parent tokens wasted), but pauses and escalates on: retry budget exhaustion (3 failed verify/review cycles), or per-step timeout exceeded.
- **Clean slate replacement** — existing `extensions/megapowers/subagent/` and `tests/subagent-*.test.ts` (~10 files) are gutted and replaced, not incrementally adapted.
- **File-based visibility** — each pipeline writes structured log entries to `.megapowers/subagents/{id}/log.jsonl`. Consistent with disk-first architecture. Parent LLM reads log at decision points. Naturally extends to parallel (each agent writes own log).
- **Pause + escalate model** — when pipeline pauses, parent gets read-only access to log + diff + error summary, and can resume with amended instructions (option 1+3). Parent does NOT edit files in the subagent workspace directly.
- **Prompt-based TDD + soft-gate audit** — no `tool_call` hook blocking writes. Deterministic auditor analyzes tool call ordering after implement step. TDD compliance report fed to reviewer as context; reviewer decides if it matters.
- **Dispatcher interface for testability** — pipeline runner depends on `Dispatcher` interface, not pi-subagents directly. Mock dispatcher in tests, pi-subagents wrapper in production.

## Components

1. **Pipeline runner** (`pipeline-runner.ts`) — takes task + agent configs, composes steps (implement → verify → review), manages retry budget, pauses on failure, returns structured result. Core orchestration logic.
2. **jj workspace manager** (`pipeline-workspace.ts`) — creates jj workspace before pipeline, squashes changes back on success, cleans up on failure/abort. Fixes #067.
3. **TDD auditor** (`tdd-auditor.ts`) — pure function: takes ordered list of tool calls, returns TDD compliance report (test-first ordering, test runs before/after production writes).
4. **Result parser** (`pipeline-results.ts`) — extracts structured data from subagent output: files changed, test pass/fail, review verdict, findings.
5. **Step context builder** (`pipeline-context.ts`) — builds accumulating context object passed between steps: task description, files changed, test output, review findings, TDD report.
6. **Pipeline tool** (`register-tools.ts` changes) — LLM-facing `pipeline({ taskIndex })` tool with `resume` + `guidance` params for escalation recovery.
7. **One-shot subagent tool** — wraps pi-subagents' single execution for ad-hoc tasks (codebase discovery, research).
8. **Log writer** (`pipeline-log.ts`) — structured JSONL logging per pipeline step (status, summary, artifacts).
9. **Agent definitions** — updated `agents/` markdown files for worker, reviewer roles with TDD prompt instructions.

## Testing Strategy

- **Dispatcher interface** enables pure unit tests — mock dispatcher returns canned `StepResult` objects, no subprocesses, no timeouts
- **Pipeline runner tests**: happy path (3-step success → squash), retry loop (verify fail → re-implement → pass), budget exhaustion (3 failures → pause result), review rejection (reject → re-implement with findings), resume with guidance
- **TDD auditor tests**: pure function, mock tool call histories → assert compliance reports. Test-first ordering, production-before-test detection, config-only changes (no tests needed), missing test runs
- **jj workspace manager tests**: mock jj commands → assert correct create/squash/cleanup sequences
- **Result parser tests**: mock subagent text output → assert structured extraction
- **Step context builder tests**: assert context accumulates correctly across steps
- **Integration tests deferred** to post-v1 — actual pi-subagents execution in sandbox environment
