# Implementation Plan

## Summary

Two tasks covering the two independent bugs. Task 1 adds overwrite protection to `handleSaveArtifact`. Task 2 adds UI feedback to the `megapowers_save_artifact` tool handler in `index.ts`. Task 2 depends on Task 1 because the tool schema change (adding `overwrite` param) is part of the `index.ts` modifications in Task 2.

---

### Task 1: Add overwrite protection to `handleSaveArtifact`

**Files:**
- Modify: `extensions/megapowers/tool-artifact.ts`
- Test: `tests/tool-artifact.test.ts` (already has failing tests from reproduce phase)

**Test:** Already written in `tests/tool-artifact.test.ts` under `AC39 — overwrite protection`. The 3 failing tests + 1 overwrite-true test cover this task:

```ts
// These tests already exist in tests/tool-artifact.test.ts — no new tests needed
it("returns an error when the artifact file already exists (no overwrite flag)")
it("does not overwrite file content when error is returned")
it("error message references the existing file path and hints at overwrite param")
it("succeeds on second save when overwrite: true is passed")
it("does not block first write when file does not yet exist")
```

**Implementation:** In `extensions/megapowers/tool-artifact.ts`:

1. Add `existsSync` to the import from `node:fs`:
```ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
```

2. Change function signature to accept optional `overwrite` parameter:
```ts
export function handleSaveArtifact(cwd: string, phase: string, content: string, overwrite?: boolean): ArtifactResult {
```

3. After `mkdirSync` and before `writeFileSync`, add the existence guard:
```ts
  const filePath = join(dir, `${phase}.md`);

  if (existsSync(filePath) && !overwrite) {
    return { error: `File already exists: .megapowers/plans/${state.activeIssue}/${phase}.md. Pass overwrite: true to replace it.` };
  }

  writeFileSync(filePath, content);
```

4. Also update the `overwrite: true` test in `tests/tool-artifact.test.ts` to call `handleSaveArtifact` directly (remove the `as any` cast) since the param now exists:
```ts
it("succeeds on second save when overwrite: true is passed", () => {
  writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
  handleSaveArtifact(tmp, "spec", "# Original");

  const result = handleSaveArtifact(tmp, "spec", "# Replaced", true);
  expect(result.error).toBeUndefined();

  const path = join(tmp, ".megapowers", "plans", "001-test", "spec.md");
  expect(readFileSync(path, "utf-8")).toBe("# Replaced");
});
```

**Verify:** `bun test tests/tool-artifact.test.ts` — all 13 tests pass (8 existing + 5 AC39).

---

### Task 2: Add UI feedback and overwrite param to tool handler [depends: 1]

**Files:**
- Modify: `extensions/megapowers/index.ts`
- Test: `tests/index-integration.test.ts` (already has failing tests from reproduce phase)

**Test:** Already written in `tests/index-integration.test.ts` under `AC38 — megapowers_save_artifact tool handler provides UI feedback`. The 2 failing tests cover this task:

```ts
// These tests already exist in tests/index-integration.test.ts — no new tests needed
it("calls ctx.ui.notify after a successful artifact save")
it("calls ui.renderDashboard after a successful artifact save")
```

**Implementation:** In `extensions/megapowers/index.ts`, replace the `megapowers_save_artifact` tool registration block (lines ~296–314):

From:
```ts
  pi.registerTool({
    name: "megapowers_save_artifact",
    label: "Save Artifact",
    description: "Save a phase artifact to disk. Use phase names: spec, plan, brainstorm, reproduce, diagnosis, verify, code-review.",
    parameters: Type.Object({
      phase: Type.String(),
      content: Type.String(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSaveArtifact(ctx.cwd, params.phase, params.content);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      return { content: [{ type: "text", text: result.message ?? "Artifact saved." }], details: undefined };
    },
  });
```

To:
```ts
  pi.registerTool({
    name: "megapowers_save_artifact",
    label: "Save Artifact",
    description: "Save a phase artifact to disk. Use phase names: spec, plan, brainstorm, reproduce, diagnosis, verify, code-review. Pass overwrite: true to replace an existing artifact.",
    parameters: Type.Object({
      phase: Type.String(),
      content: Type.String(),
      overwrite: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = handleSaveArtifact(ctx.cwd, params.phase, params.content, params.overwrite);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
      }
      if (ctx.hasUI) {
        ctx.ui.notify(result.message!, "info");
        if (store && ui) {
          ui.renderDashboard(ctx, readState(ctx.cwd), store);
        }
      }
      return { content: [{ type: "text", text: result.message ?? "Artifact saved." }], details: undefined };
    },
  });
```

**Verify:** `bun test tests/index-integration.test.ts` — all tests pass (including the 2 AC38 tests). Then `bun test` — full suite passes with 0 failures.
