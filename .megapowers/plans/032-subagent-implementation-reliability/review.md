# Review: Plan — Subagent Implementation Reliability (Issue 032)

## Scope
Quick sanity check of the plan vs spec/ACs (not a deep audit).

---

## 1) Coverage (AC gaps / mismatches)

**Overall:** AC1–AC21 are addressed by at least one task.

**Potential mismatch to resolve:**
- **AC5 wording vs plan architecture (BLOCKING, needs explicit agreement):** AC5 says *“spawned pi subprocess writes a status.json file”*. The plan intentionally implements **supervisor/parent-written** `status.json` based on the child’s JSONL stream.
  - If you consider AC5 satisfied by “the subagent system produces status.json”, then OK.
  - If AC5 is interpreted literally, the plan **does not meet AC5** as written.
  - Action: confirm acceptance of the supervisor-written status file approach, or adjust the spec/AC5 text (or adjust implementation to have the child write status).

Minor interpretation notes (non-blocking):
- **AC2/AC6 state string:** plan uses `"timed-out"` (hyphen). AC text says “timed out” (space). Likely fine, but pick one canonical string and document it.

---

## 2) Ordering (dependency sanity)

No major ordering problems.

Small nit:
- **Task 13** uses `detectRepeatedErrors()` (Task 5) but doesn’t list it in its `[depends:]`. It *is* earlier in the task list, so execution ordering is fine; dependency annotation is just slightly incomplete.

---

## 3) Completeness (are tasks executable as written?)

Mostly self-contained, with a few items that will otherwise create implementation churn:

### A) Task 11: unknown agent behavior
- `handleSubagentDispatch()` calls `resolveAgent(input.agent, cwd)`.
- If the user passes an unknown agent name, `resolveAgent()` returns `null`, and the dispatch proceeds with **no model/tools/thinking overrides** (whatever pi defaults are).

Action:
- Decide behavior and encode it:
  - **Option 1 (recommended):** if `input.agent` is provided and not found → return a clear error.
  - **Option 2:** fall back to default `worker` even when an explicit but unknown agent name is provided.

### B) Task 13: RunnerState `timedOut` field is used but not defined
- The plan notes this, but make it explicit in Task 8 implementation (RunnerState interface + initialization) so Task 13 compiles cleanly.

### C) Task 13: timeout kill semantics for detached processes
- With `detached: true`, killing the child PID may not terminate any spawned grandchildren. If the goal is reliable cleanup on timeout, consider signaling the **process group** (platform caveats):
  - On POSIX: `process.kill(-child.pid, "SIGTERM")` then `SIGKILL`.

Action:
- Either: (a) implement process-group kill; or (b) explicitly document that only the `pi` process is killed and that child-of-child processes are out of scope.

### D) Builtin agents location / packaging clarity (Task 2/3)
- Plan places builtin agent markdown in **repo root** `agents/` and computes `BUILTIN_AGENTS_DIR` by walking up from `extensions/megapowers/`.

Action:
- Confirm that this repo root path is part of the shipped extension artifact.
- If you want to avoid ambiguity, consider placing builtin agents under `extensions/megapowers/agents/` and updating `BUILTIN_AGENTS_DIR` + tests accordingly.

### E) jj workspace add: ensure target path existence (edge-case)
- `jj workspace add --name <name> <path>` may or may not create the directory depending on jj behavior/version.

Action:
- Either ensure `mkdirSync(config.workspacePath, { recursive: true })` before workspace add, or add a test/guard for jj versions that require it.

---

## Verdict: revise

The overall approach and task breakdown look solid and close to ready, but I’d like the following clarified/adjusted before approving:

1. **(Blocking) AC5 interpretation agreement:** confirm that supervisor-written `status.json` satisfies AC5, or update AC5 / implementation accordingly.
2. **(Blocking) Unknown agent behavior (Task 11):** error vs fallback; encode and test.
3. **(Blocking) RunnerState `timedOut` completeness:** ensure Task 8 defines it since Task 13 uses it.

Recommended (non-blocking but improves reliability):
- Process-group termination on timeout.
- Confirm builtin agent file placement for packaging.
- Ensure workspace directory creation semantics.

If you agree with these changes, revise the plan accordingly and re-submit; I’ll re-check and then approve + advance to implement.
