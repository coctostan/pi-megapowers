# Bug Report: `megapowers_save_artifact` — silent overwrite + no UI feedback

## Issue #039: Silent Overwrite (Data Loss)

### Steps to Reproduce

1. Start a megapowers session with an active issue in any phase that requires a spec/plan artifact.
2. Call `megapowers_save_artifact` with `{ phase: "spec", content: "# Original spec\n..." }` — succeeds.
3. Call `megapowers_save_artifact` again with `{ phase: "spec", content: "# Replacement (erroneous)" }` — no error returned; file is silently clobbered.

**Minimal programmatic reproduction (no overwrite param exists):**
```ts
writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
handleSaveArtifact(tmp, "spec", "# Original content");
const second = handleSaveArtifact(tmp, "spec", "# Replacement content");
// second.error === undefined  ← BUG: should be defined
// readFileSync(path) === "# Replacement content"  ← BUG: should be "# Original content"
```

### Expected Behavior

When the target artifact file already exists, `handleSaveArtifact` should return:
```ts
{ error: "File already exists: .megapowers/plans/001-test/spec.md. Pass overwrite: true to replace it." }
```
The existing file must remain untouched. An optional `overwrite: true` parameter on the tool schema should allow an intentional replacement.

### Actual Behavior

`writeFileSync` is called unconditionally in `tool-artifact.ts` line 31 — no existence check:
```ts
writeFileSync(join(dir, `${phase}.md`), content);
return { message: `Artifact saved: .megapowers/plans/${state.activeIssue}/${phase}.md` };
```
Any pre-existing content is silently destroyed. The LLM gets a success message.

---

## Issue #038: No UI Feedback After Save

### Steps to Reproduce

1. LLM calls `megapowers_save_artifact` with a valid spec.
2. File is written to disk. `handleSaveArtifact` returns `{ message: "Artifact saved: ..." }`.
3. The `execute` handler in `index.ts` returns this message as the LLM tool result — and does nothing else.
4. The user sees whatever prose the LLM decides to generate; no TUI notification appears; the dashboard is not refreshed.

### Expected Behavior

After a successful save, the `execute` handler in `index.ts` should:
1. Call `ctx.ui.notify(result.message, "info")` — shows a TUI notification to the user.
2. Call `ui.renderDashboard(ctx, readState(ctx.cwd), store)` — refreshes the dashboard so any newly-unlocked phase transitions (e.g. spec.md now exists → plan phase becomes available) are reflected immediately.

### Actual Behavior

The `megapowers_save_artifact` execute handler in `index.ts` (lines ~297–310) is:
```ts
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const result = handleSaveArtifact(ctx.cwd, params.phase, params.content);
  if (result.error) {
    return { content: [{ type: "text", text: `Error: ${result.error}` }], details: undefined };
  }
  return { content: [{ type: "text", text: result.message ?? "Artifact saved." }], details: undefined };
},
```
No `ctx.ui.notify()`. No `ui.renderDashboard()`. The tool is a silent black box to the user.

---

## Environment

- Runtime: Bun 1.3.9
- OS: macOS (darwin)
- Files: `extensions/megapowers/tool-artifact.ts`, `extensions/megapowers/index.ts`

## Failing Tests

### `tests/tool-artifact.test.ts` — 3 new failing tests under `AC39 — overwrite protection`:

```
(fail) returns an error when the artifact file already exists (no overwrite flag)
(fail) does not overwrite file content when error is returned
(fail) error message references the existing file path and hints at overwrite param
```

```ts
// tests/tool-artifact.test.ts (added)
describe("AC39 — overwrite protection", () => {
  it("returns an error when the artifact file already exists (no overwrite flag)", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
    const first = handleSaveArtifact(tmp, "spec", "# Original content");
    expect(first.error).toBeUndefined();

    const second = handleSaveArtifact(tmp, "spec", "# Replacement content");
    expect(second.error).toBeDefined();  // FAILS: currently returns success and clobbers the file
  });

  it("does not overwrite file content when error is returned", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
    handleSaveArtifact(tmp, "spec", "# Original content");
    handleSaveArtifact(tmp, "spec", "# Replacement content");
    const onDisk = readFileSync(path, "utf-8");
    expect(onDisk).toBe("# Original content");  // FAILS: currently "# Replacement content"
  });

  it("error message references the existing file path and hints at overwrite param", () => {
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
    handleSaveArtifact(tmp, "spec", "# Original");
    const result = handleSaveArtifact(tmp, "spec", "# New");
    expect(result.error).toContain("spec.md");   // FAILS: result.error is undefined
    expect(result.error).toContain("overwrite");  // FAILS: result.error is undefined
  });

  it("succeeds on second save when overwrite: true is passed", () => {
    // Tests the future positive case — currently passes for the wrong reason
    // (function ignores 4th arg and overwrites anyway)
  });

  it("does not block first write when file does not yet exist", () => {
    // Guard only triggers on overwrite — passes now, must keep passing after fix
    writeState(tmp, { ...createInitialState(), activeIssue: "001-test", megaEnabled: true });
    const result = handleSaveArtifact(tmp, "spec", "# Fresh content");
    expect(result.error).toBeUndefined();
  });
});
```

### `tests/index-integration.test.ts` — 2 new failing tests under `AC38 — megapowers_save_artifact tool handler provides UI feedback`:

```
(fail) calls ctx.ui.notify after a successful artifact save
(fail) calls ui.renderDashboard after a successful artifact save
```

```ts
// tests/index-integration.test.ts (added)
describe("AC38 — megapowers_save_artifact tool handler provides UI feedback", () => {
  it("calls ctx.ui.notify after a successful artifact save", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    const start = source.indexOf('name: "megapowers_save_artifact"');
    const end = source.indexOf("pi.registerTool", start + 1);
    const handlerBlock = end > start ? source.slice(start, end) : source.slice(start, start + 600);
    expect(handlerBlock).toContain("ctx.ui.notify");  // FAILS: no notify call exists
  });

  it("calls ui.renderDashboard after a successful artifact save", () => {
    const source = readFileSync(join(__dirname, "../extensions/megapowers/index.ts"), "utf-8");
    const start = source.indexOf('name: "megapowers_save_artifact"');
    const end = source.indexOf("pi.registerTool", start + 1);
    const handlerBlock = end > start ? source.slice(start, end) : source.slice(start, start + 600);
    expect(handlerBlock).toContain("renderDashboard");  // FAILS: no renderDashboard call exists
  });
});
```

**Full suite result: 408 pass, 5 fail (all new). Zero regressions.**

## Root Cause Summary

| Issue | File | Line | Root Cause |
|---|---|---|---|
| #039 overwrite | `tool-artifact.ts` | 31 | `writeFileSync` called without `existsSync` guard; no `overwrite` param |
| #038 no notify | `index.ts` | ~305 | `execute` returns immediately after `handleSaveArtifact` — no `ctx.ui.notify`, no `ui.renderDashboard` |
