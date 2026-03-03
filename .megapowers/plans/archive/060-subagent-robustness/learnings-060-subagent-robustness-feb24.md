## 2026-02-24 — subagent-robustness

- When `state.phase` is typed `Phase | null` but a downstream function expects `string | undefined`, use `?? undefined` to convert — TypeScript treats `null` and `undefined` as distinct, and this mismatch silently passes at runtime but fails `tsc --noEmit`.
- Centralize user-facing error/guidance messages in a dedicated constants module (e.g. `jj-messages.ts`) rather than inlining strings at each call site — this prevents drift between session-start warnings and dispatch-time errors that describe the same prerequisite.
- When adding an async check to `session_start` that shouldn't block initialization, avoid early returns in the handler — place the check inline and let execution fall through to the next block (dashboard rendering, etc.).
- For `index.ts` integration tests where you can't easily construct the full pi context, source-level invariant tests (read the file as a string and assert on import names, function calls, and control flow ordering) are a pragmatic substitute that catches wiring regressions without mocking the entire extension harness.
- The TDD guard state machine (`test-written` → `impl-allowed` → etc.) requires tests to actually fail before production code writes are permitted — TypeScript-only type errors don't trigger the guard's `test-failed` transition since `bun test` still passes at runtime.
