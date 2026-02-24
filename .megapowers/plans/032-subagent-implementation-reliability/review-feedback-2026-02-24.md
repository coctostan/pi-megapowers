# Plan Review (Round 2): 032-subagent-implementation-reliability

Verdict: **revise**

This revision is much closer. Most previous gaps (JSONL runner, jj workspace path, timeout/cleanup race, user agent lookup, UPSTREAM pin) are addressed. The remaining issues are mostly “last-mile” spec alignment and a couple of test/implementation completeness holes.

---

## 1) Coverage (ACs)

### ✅ Covered
- **AC1–AC4**: tool registration + async-first dispatch + jj workspace add + PI_SUBAGENT env.
- **AC6–AC11**: status schema + status tool + timeout/cleanup strategy + failure propagation.
- **AC12–AC14**: agent file parsing + discovery priority + builtin agents + schema support.
- **AC15/AC16**: available in all phases; satellite mode triggered via `PI_SUBAGENT=1`.
- **AC18/AC19**: depends-on validation + plan section context + learnings.
- **AC20**: repeated error detector is present and integrated into terminal status writes.
- **AC21**: UPSTREAM.md pinned commit included.

### ⚠️ Remaining gaps / mismatches

1) **AC5: status.json includes “current phase” while running**
   - Spec explicitly calls out: “turns used, current phase, completion state”.
   - Current `SubagentStatus` type (Task 4) has no `phase`/`currentPhase` field, and the running updates only write `{state, turnsUsed, startedAt}`.
   - **Fix:** add an optional field (e.g. `phase?: string`) to `SubagentStatus` and write it at least once (initial status). If you interpret this as the *parent* workflow phase at dispatch time, store `state.phase` from `readState(cwd)`.

2) **Agent markdown body (“system prompt”) is parsed but never applied**
   - Task 1 extracts `systemPrompt` from the markdown body.
   - Task 8 supports `--append-system-prompt <path>`.
   - But Task 11/12 never actually *writes* the body to a file and never passes `systemPromptPath` into `buildSpawnArgs()`.
   - This makes builtin `worker/scout/reviewer.md` bodies effectively unused.
   - **Fix:** in the dispatch path, if `agent?.systemPrompt` is present, write it to something like:
     - `.megapowers/subagents/<id>/agent-prompt.md`
     and set `config.systemPromptPath` so Task 12 passes it to `buildSpawnArgs()`.

3) **Agent `thinking` is parsed but not forwarded to `pi`**
   - Pi CLI supports `--thinking <level>`.
   - You already parse `thinking` into `AgentDef` and include it in `SpawnOptions`, but `buildSpawnArgs()` ignores it.
   - **Fix:** add `--thinking <level>` when `options.thinking` is set, and pass `agent?.thinking` through in Task 11 → Task 12.

If you address (1) + (2) + (3), AC5 and the “agent definition compatibility” story become fully credible.

---

## 2) Ordering

No blocking ordering problems detected.

- Task 2 precedes Task 3 (good) so builtin fallback tests can pass.
- Task 12 depends on the right prerequisites (workspace helpers + runner + handlers).

---

## 3) Completeness (tasks executable as written)

### A) One test snippet still uses `require()`
- In Task 12’s appended tests (“satellite TDD enforcement”), the snippet uses CommonJS `require()`.
- Elsewhere the plan claims “no require() calls” and the repo tests are consistently ESM.
- **Fix:** switch that snippet to ESM imports, e.g.
  ```ts
  import { buildSpawnEnv } from "../extensions/megapowers/subagent-runner.js";
  import { isSatelliteMode } from "../extensions/megapowers/satellite.js";
  ```

### B) Summary says “19 tasks” but the plan defines 14
- Not a functional blocker, but it makes reviews/coordination harder.
- **Fix:** update the summary count.

### C) Minor robustness: `resolveAgent()` should continue search if parsing fails
- Current code returns `parseAgentFrontmatter(content)` immediately.
- If a file exists but has invalid frontmatter (parse returns `null`), you’ll stop searching even if later directories have a valid agent.
- **Fix:** if `parsed` is null, `continue`.

---

## Requested changes (minimal patch list)

- **Task 4:** add `phase?: string` (or `currentPhase?: string`) to `SubagentStatus`.
- **Task 11 + Task 12:**
  - persist `agent.systemPrompt` to `.megapowers/subagents/<id>/agent-prompt.md`
  - pass it to `buildSpawnArgs()` via `systemPromptPath`
  - pass agent `thinking` through and implement `--thinking` in `buildSpawnArgs()`
  - write `phase` into status.json on dispatch
- **Task 12 tests:** replace `require()` with ESM imports.
- **Plan header:** fix the task count (14 vs 19).

---

## Final verdict

**revise** — one more small revision is needed to fully meet AC5 and to ensure agent definitions (body + thinking) aren’t “dead features”. Once those are reflected in the tasks/snippets, the plan looks ready to approve and proceed to implementation.
