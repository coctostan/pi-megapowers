# Diagnosis

## Root Cause

Two independent, non-interacting bugs in the `megapowers_save_artifact` pipeline.

### Bug #039 — Silent overwrite (`tool-artifact.ts`)

`handleSaveArtifact` writes unconditionally:

```ts
writeFileSync(join(dir, `${phase}.md`), content);
```

There is no `existsSync` guard before this call. The function accepts three parameters (`cwd`, `phase`, `content`) and has no `overwrite` escape hatch. Consequence: any call with an already-existing artifact path is a destructive, silent overwrite with no error surfaced to the LLM or user.

### Bug #038 — No UI feedback (`index.ts`)

The `megapowers_save_artifact` `execute` handler does nothing with the success path except return the message as a tool result to the LLM:

```ts
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const result = handleSaveArtifact(ctx.cwd, params.phase, params.content);
  if (result.error) {
    return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
  }
  return { content: [{ type: "text", text: result.message ?? "Artifact saved." }], details: undefined };
},
```

Missing:
- `if (ctx.hasUI) ctx.ui.notify(result.message!, "info")` — user never sees a TUI confirmation
- `if (ctx.hasUI && store && ui) ui.renderDashboard(ctx, readState(ctx.cwd), store)` — dashboard not refreshed, so phase-gate indicators stay stale even after the artifact that unlocks the next phase was just written

The pattern for how this should look already exists immediately above, in the `megapowers_signal` handler:
```ts
if (result.error) { ... }
if (ctx.hasUI && store && ui) {
  ui.renderDashboard(ctx, readState(ctx.cwd), store);
}
return { ... };
```

## Affected Code

| File | Symbol | Change needed |
|---|---|---|
| `extensions/megapowers/tool-artifact.ts` | `handleSaveArtifact()` | Add `overwrite?: boolean` param; add `existsSync` guard before `writeFileSync`; update return error message |
| `extensions/megapowers/index.ts` | `megapowers_save_artifact` `execute` handler | Pass `params.overwrite` through to `handleSaveArtifact`; add `ctx.ui.notify` + `ui.renderDashboard` on success |
| `extensions/megapowers/index.ts` | `megapowers_save_artifact` tool schema | Add `overwrite: Type.Optional(Type.Boolean())` to `Type.Object({...})` |

## Risk Assessment

**`tool-artifact.ts` changes:**
- Adding `overwrite?: boolean` is a purely additive signature change — all existing callers pass 3 args and get the default `false` behaviour, which is strictly safer than before. No regression risk.
- The `existsSync` guard only fires when the file already exists. First-write paths (the common case) are unaffected.
- One edge case: if the LLM legitimately wants to regenerate an artifact (e.g. the user asked it to rewrite the spec), it must now explicitly pass `overwrite: true`. This is intentional friction — the issue spec calls it "Option A (recommended)". The LLM will see the error message and can retry.

**`index.ts` changes:**
- `ctx.ui.notify` is guarded by `ctx.hasUI` (same pattern as every other notify in the file) — headless/satellite sessions are unaffected.
- `ui.renderDashboard` is guarded by `ctx.hasUI && store && ui` — same guard as in `megapowers_signal`. No risk of null-reference in headless mode.
- Adding `params.overwrite` threading: TypeBox optional booleans default to `undefined` when omitted by the LLM, which is falsy — consistent with `overwrite?: boolean` defaulting to `false` in the function.

**Tests:**
- The 3 `AC39` failing tests in `tool-artifact.test.ts` and the 2 `AC38` failing tests in `index-integration.test.ts` all become green with the fix.
- The `overwrite: true` test case (currently passing for the wrong reason — the 4th arg is silently ignored) will continue to pass for the right reason after the fix.
- No existing tests touch the overwrite or UI-feedback paths, so zero risk of breaking the 408 currently passing tests.

## Fixed When

1. `handleSaveArtifact(cwd, phase, content)` — when `existsSync(targetPath)` is true and `overwrite` is falsy, returns `{ error: "File already exists: .megapowers/plans/<slug>/<phase>.md. Pass overwrite: true to replace it." }` without writing.
2. `handleSaveArtifact(cwd, phase, content, true)` — when `overwrite` is true and file exists, writes successfully (same as current behaviour, now intentional).
3. `megapowers_save_artifact` tool schema includes `overwrite: Type.Optional(Type.Boolean())`.
4. `execute` handler passes `params.overwrite` to `handleSaveArtifact`.
5. On success, `execute` calls `if (ctx.hasUI) ctx.ui.notify(result.message!, "info")`.
6. On success, `execute` calls `if (ctx.hasUI && store && ui) ui.renderDashboard(ctx, readState(ctx.cwd), store)`.
7. All 5 reproduction-phase failing tests pass; no previously-passing tests regress.
