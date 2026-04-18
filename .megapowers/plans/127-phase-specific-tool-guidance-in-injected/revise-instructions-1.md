## Task 7: Document tool mapping plus injected-prompt coverage

### 1) Fix the `verify.md` tool-map mismatch
Your current Task 7 matrix/doc content lists `read` for `prompts/verify.md`, but Task 4 never adds a `read` hint to `prompts/verify.md`. If implemented as written, `docs/phase-tools.md` will document a tool the prompt does not actually reference.

Use this exact verify entry instead:

```ts
{ prompt: "verify.md", tools: ["impact", "symbol_graph", "ast_search", "trace"] },
```

And use these exact `docs/phase-tools.md` rows for `prompts/verify.md`:

```md
## prompts/verify.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `impact` | `Step 1` | Verify the regression sweep covers downstream dependents. |
| `symbol_graph` | `Step 2 / code inspection` | Prove a symbol exists with the expected shape. |
| `ast_search` | `Step 2 / code inspection` | Prove multi-site structural patterns. |
| `trace` | `Step 2 / user-observable behavior` | Prove the new code is on the real executed path. |
| `trace` | `What Actually Proves a Claim` | Define valid evidence that new behavior is reached. |
```

Do **not** add a `read` row unless you also revise approved Task 4 and its prompt tests, which this review is not requesting.

### 2) Strengthen the doc-sync test so drift fails in both directions
The current Step 1 test only checks that `docs/phase-tools.md` contains each prompt name and each tool token somewhere. That will still pass if:
- a row moves to the wrong prompt section,
- the section/step or rationale drifts,
- a stale extra row remains in the doc,
- the doc lists a tool that the prompt no longer references.

Replace the loose `promptToolMatrix`/`toContain` loop with a structured expected doc renderer and an exact equality assertion. Use concrete section/step/rationale rows, not just tool names.

Use this shape:

```ts
type DocRow = { tool: string; step: string; rationale: string };

const phaseToolDoc = [
  {
    prompt: "brainstorm.md",
    rows: [
      { tool: "read", step: "## Read first", rationale: "Prefer structural-map reads on unfamiliar files." },
      { tool: "symbol_graph", step: "## Read first", rationale: "Confirm named symbols exist and inspect callers." },
      { tool: "symbol_graph", step: "## Read first", rationale: "Preserve current contracts when brainstorming changes to existing symbols." },
      { tool: "grep", step: "## Read first", rationale: "Handle text mentions." },
      { tool: "ast_search", step: "## Read first", rationale: "Handle structural patterns." },
      { tool: "bash", step: "## Read first", rationale: "Skim recent history with `git log --oneline -20 -- <path>`." },
    ],
  },
  // ...all remaining prompt sections...
  {
    prompt: "verify.md",
    rows: [
      { tool: "impact", step: "Step 1", rationale: "Verify the regression sweep covers downstream dependents." },
      { tool: "symbol_graph", step: "Step 2 / code inspection", rationale: "Prove a symbol exists with the expected shape." },
      { tool: "ast_search", step: "Step 2 / code inspection", rationale: "Prove multi-site structural patterns." },
      { tool: "trace", step: "Step 2 / user-observable behavior", rationale: "Prove the new code is on the real executed path." },
      { tool: "trace", step: "What Actually Proves a Claim", rationale: "Define valid evidence that new behavior is reached." },
    ],
  },
] as const;

function renderPhaseToolsDoc(entries: typeof phaseToolDoc): string {
  return [
    "# Phase Tool Guidance Map",
    "",
    "Prompt markdown in `prompts/*.md` is the source of truth. This file is a review index for issue #127 and the drift-check target for the tests in `tests/phase-tool-guidance.test.ts`.",
    "",
    ...entries.flatMap(({ prompt, rows }) => [
      `## prompts/${prompt}`,
      "| Tool / command | Section / step | Rationale |",
      "| --- | --- | --- |",
      ...rows.map(({ tool, step, rationale }) => `| \`${tool}\` | \`${step}\` | ${rationale} |`),
      "",
    ]),
  ].join("\n").trim();
}

it("docs/phase-tools.md stays exactly in sync with the expected prompt/tool map", () => {
  expect(readPhaseToolsDoc().trim()).toBe(renderPhaseToolsDoc(phaseToolDoc));
});
```

That exact-match check is what turns doc drift into a deterministic failure.

### 3) Replace the prose-only `tests/prompt-inject.test.ts` instruction with real test code
The current Step 3 says only “extend `tests/prompt-inject.test.ts` with a new describe block...”. That is not copy-pasteable code, and it does not specify the actual state setup needed for bugfix phases or done mode.

Add an explicit describe block like this:

```ts
describe("buildInjectedPrompt — inline phase tool guidance", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "prompt-inject-phase-tools-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("injects representative inline hints for feature phases", () => {
    setState(tmp, { phase: "brainstorm", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `read` with `map: true` on unfamiliar files to get a structural map instead of dumping full contents.");

    setState(tmp, { phase: "spec", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When an acceptance criterion references an existing function, class, or module, use `symbol_graph` to confirm the symbol exists and the signature/naming in the AC matches reality.");

    setState(tmp, { phase: "plan", planMode: "draft", planIteration: 1, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When grounding spans many lookups (multiple `symbol_graph` calls, greps, and reads across ≥5 files), prefer batching them through `code_execution` in a single script rather than issuing many sequential tool calls.");

    setState(tmp, { phase: "plan", planMode: "review", planIteration: 1, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `grep` across `spec.md` and the task files in `.megapowers/plans/<issue-slug>/tasks/` to confirm every acceptance-criterion identifier is referenced by at least one task.");

    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.");

    setState(tmp, { phase: "implement", megaEnabled: true, currentTaskIndex: 0 });
    expect(buildInjectedPrompt(tmp)).toContain("Before editing, use `read` with `symbol: \"<name>\"` (or `symbol_graph` with `include: [\"source\"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.");

    setState(tmp, { phase: "verify", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Before concluding the suite covers the change, use `impact` on the primary symbol you changed to list downstream dependents. Confirm every surfaced dependent's test ran.");

    setState(tmp, { phase: "code-review", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Run `/codex-review --base <ref>` early (against `main` or the feature's base branch) and treat the findings as input.");
  });

  it("injects representative inline hints for bugfix and done prompts", () => {
    setState(tmp, { workflow: "bugfix", phase: "reproduce", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("When the error mentions a specific symbol or file, use `symbol_graph` with `include: [\"source\"]` on the symbol in the stack trace, and `read` with hashline anchors for nearby context. Copy real signatures into the reproduction report.");

    setState(tmp, { workflow: "bugfix", phase: "diagnose", megaEnabled: true });
    expect(buildInjectedPrompt(tmp)).toContain("Use `trace` from a known entry point to see the real call order the runtime follows, not the static call graph.");

    setState(tmp, { phase: "done", megaEnabled: true, doneActions: ["generate-docs"] });
    expect(buildInjectedPrompt(tmp)).toContain("When the document describes a new or modified API surface, use `symbol_graph` (or `read` with `symbol: \"<name>\"`) to pull the real signature into the doc. Do not paraphrase signatures from memory.");
  });
});
```

The important part is that Step 3 must contain real test code, with the correct `setState(...)` calls for draft/review/revise, bugfix phases, and done mode.
