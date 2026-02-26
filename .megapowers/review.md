# Review: Directory Restructure Plan (#070)

## Per-Task Assessment

### Task 1: Move state/ files and update all imports — ✅ PASS
No functional concerns. Steps are concrete and include `bun test`.

Notes to tighten:
- Plan header says “574 existing tests”; repo context indicates **546**. Keep the number consistent (or just say “all tests pass”).

---

### Task 2: Move policy/ files and update all imports — ✅ PASS
Ordering/deps are fine (depends on Task 1 via import rewrites; you also annotated `[depends: 1]`).

Minor improvement:
- In Step 4, replace “(if it imports… check and update)” with an explicit sweep step (e.g., `rg 'write-policy\\.js' tests`) and update any hits.

---

### Task 3: Move tools/ files and update all imports — ✅ PASS
Concrete moves + clear import rewrites + test verification.

Minor improvement:
- Add a “find all remaining old imports” sweep (e.g., `rg '(tool-signal|tool-artifact|tool-overrides|tools)\\.js'`) to avoid missing a non-obvious importer.

---

### Task 4: Move subagent/ files and update all imports — ✅ PASS
Good dependency annotation and you included a root “nothing left behind” check.

Minor improvement:
- Add a ripgrep sweep to ensure no lingering `./subagent-*.js` imports remain anywhere (source + tests).

---

### Task 5: Extract commands.ts from index.ts — ❌ REVISE
Two issues that could cause behavior drift/confusion during implementation:

1) **Shared deps wiring is underspecified / potentially inconsistent**
- Today `index.ts` uses module-level `store/jj/ui` set in `session_start` and lazily created elsewhere.
- The plan introduces `ensureDeps()` in `commands.ts` plus a `deps` object in `index.ts`, but it doesn’t explicitly guarantee **hooks and commands share the same single source of truth** for `store/jj/ui`.

Actionable fix:
- Explicitly define one shared deps shape (e.g. `RuntimeDeps { store?: Store; jj?: JJ; ui?: MegapowersUI }`) and a single `ensureDeps()` that both hooks and commands use, **or** explicitly state:
  - `onSessionStart` assigns `deps.store/jj/ui = …`
  - every command wrapper calls `ensureDeps(deps, pi, ctx.cwd)` using that same shared `deps` object.

2) **Self-containment is borderline**
- “Extract verbatim from index.ts” is workable, but per the rubric it’s not fully executable from the plan alone.

Actionable fix:
- Add explicit extraction instructions:
  - “For each `pi.registerCommand('<name>', { handler: async (...) => { … } })`, move the handler body into `handle<Name>Command`.”
  - List any captured variables that must be replaced (`store → deps.store`, etc.) and confirm whether any helper functions used by handlers stay in `index.ts` or move too.

---

### Task 6: Extract hooks.ts from index.ts — ❌ REVISE
Similar issues to Task 5:

1) **Deps initialization must match current behavior**
- Current `before_agent_start` does `if (!store) store = createStore(ctx.cwd)` etc.
- The plan says “deps provides `{ pi, store, jj, ui }`”, but the wrapper passes raw `deps` without showing how `hooks.ts` will lazily initialize/mutate it.

Actionable fix:
- Explicitly state that each exported hook performs the same lazy-init (mutating the shared deps object), **or** wrappers pass `ensureDeps(deps, pi, ctx.cwd)`.

2) **Clarify the satellite exception**
- Satellite mode currently registers its own handlers and returns early.

Actionable fix:
- Note explicitly that hooks extraction applies to the **non-satellite** path, and satellite-specific handlers move to `satellite.ts` in Task 7.

---

### Task 7: Extract setupSatellite into satellite.ts and slim index.ts — ❌ REVISE
Main risk: **AC10 (index.ts ≤150 lines) may not be guaranteed** given “keep subagent spawn glue in index.ts”.

Actionable fix:
- Add a hard checkpoint and contingency:
  - After Tasks 5+6, run `wc -l extensions/megapowers/index.ts`.
  - If still >150 after Task 7, explicitly allow extracting some remaining pi-dependent registration glue into a new file (e.g. `register-tools.ts` or `subagent/registration.ts`) while keeping behavior identical. Otherwise AC10 can fail with no escape hatch.

Also:
- Replace “lines ~48-130” with a structural instruction: “move everything inside `if (satellite) { ... return; }` into `setupSatellite()`” to avoid line-number drift.

---

## Missing Coverage
None. All AC1–AC13 are mapped to tasks.

## Verdict
**revise**

Recommended revisions (minimal, high value):
1) Make the **shared deps strategy** explicit and consistent across Tasks 5 and 6.
2) Add a **guarantee/contingency** for AC10 (≤150 lines).
3) Replace “if exists / check and update” language with explicit `rg` sweeps.
4) Fix the **test count inconsistency** (546 vs 574) or avoid quoting a number.
