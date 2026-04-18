---
id: 7
title: Document tool mapping plus injected-prompt coverage
status: approved
depends_on:
  - 6
no_test: false
files_to_modify:
  - tests/phase-tool-guidance.test.ts
  - tests/prompt-inject.test.ts
files_to_create:
  - docs/phase-tools.md
---

**Covers:** AC 13, AC 15.

**Files:**
- Create: `docs/phase-tools.md`
- Modify: `tests/phase-tool-guidance.test.ts`
- Modify: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**
First, extend `tests/phase-tool-guidance.test.ts` with a doc reader, a full expected prompt/step/rationale map, a renderer, and an exact doc-sync test:

```ts
function readPhaseToolsDoc(): string {
  return readFileSync(join(process.cwd(), "docs", "phase-tools.md"), "utf-8");
}

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
  {
    prompt: "write-spec.md",
    rows: [
      { tool: "symbol_graph", step: "## Purpose", rationale: "Confirm named existing symbols and signatures in ACs." },
      { tool: "symbol_graph", step: "## Purpose", rationale: "Ground ACs in current guards, throws, and invariants." },
      { tool: "symbol_graph", step: "## Legacy handling", rationale: "Verify prose-named symbols exist before extracting implied requirements." },
    ],
  },
  {
    prompt: "write-plan.md",
    rows: [
      { tool: "code_execution", step: "## Read the Codebase First", rationale: "Batch many grounding lookups through a single script." },
      { tool: "symbol_graph", step: "## Read the Codebase First", rationale: "Confirm real symbol names, signatures, and call sites." },
      { tool: "symbol_graph", step: "## Read the Codebase First", rationale: "Preserve contracts for behavior-changing work." },
      { tool: "ast_search", step: "## Read the Codebase First", rationale: "Enumerate repeated structural edit sites once." },
      { tool: "impact", step: "## Read the Codebase First", rationale: "Surface dependents for public signature changes." },
      { tool: "trace", step: "## Read the Codebase First", rationale: "Order tasks along a real execution path." },
      { tool: "read", step: "## Read the Codebase First", rationale: "Lift exact current signatures into task steps." },
      { tool: "read", step: "Task template / Step 1", rationale: "Lift exact imported or mocked signatures into tests." },
      { tool: "symbol_graph", step: "Task template / Step 1", rationale: "Lift source-backed signatures into tests." },
      { tool: "bash", step: "Task template / Step 2", rationale: "Probe for real failure text instead of guessing." },
      { tool: "impact", step: "Task template / Step 3", rationale: "List dependent callers/tests for signature changes." },
      { tool: "grep", step: "Pre-Submit Checklist / Coverage", rationale: "Mechanically confirm every AC is referenced by at least one task." },
    ],
  },
  {
    prompt: "review-plan.md",
    rows: [
      { tool: "grep", step: "Criterion 1 / Coverage", rationale: "Mechanically confirm AC coverage." },
      { tool: "symbol_graph", step: "Criterion 2 / Ordering & Dependencies", rationale: "Verify imported symbols come from lower-index tasks." },
      { tool: "grep", step: "Criterion 2 / Ordering & Dependencies", rationale: "Cross-check task-file symbol definitions by index." },
      { tool: "symbol_graph", step: "Criterion 3 / TDD Completeness", rationale: "Reject fictional Step 3 APIs and imports." },
      { tool: "read", step: "Criterion 3 / TDD Completeness", rationale: "Compare quoted signatures against real signatures." },
      { tool: "symbol_graph", step: "Criterion 6 / Self-Containment", rationale: "Verify referenced APIs/imports exist as written." },
      { tool: "ast_search", step: "Criterion 6 / Self-Containment", rationale: "Verify repeated structural references exist." },
    ],
  },
  {
    prompt: "revise-plan.md",
    rows: [
      { tool: "symbol_graph", step: "## Instructions", rationale: "Confirm revised Step 3 imports/calls match reality." },
      { tool: "read", step: "## Instructions", rationale: "Lift exact current signatures into revised task text." },
      { tool: "ast_search", step: "## Instructions", rationale: "Confirm Step 3 structural patterns exist." },
      { tool: "grep", step: "Most Common Revision Failures / missing coverage", rationale: "Verify which task now covers the missing AC." },
      { tool: "impact", step: "Most Common Revision Failures / signature change", rationale: "Update dependent files after signature changes." },
      { tool: "grep", step: "Pre-Submit Checklist / Coverage re-check", rationale: "Confirm missing-AC complaints were actually fixed." },
    ],
  },
  {
    prompt: "implement-task.md",
    rows: [
      { tool: "read", step: "RED / step 1", rationale: "Confirm real signatures before pasting tests." },
      { tool: "symbol_graph", step: "RED / step 1", rationale: "Pull source-backed signature details into tests." },
      { tool: "read", step: "GREEN / step 1", rationale: "Re-read the exact current file state before editing." },
      { tool: "symbol_graph", step: "GREEN / step 1", rationale: "Pull source-backed current state before editing." },
      { tool: "edit", step: "GREEN / step 1", rationale: "Edit through hashline anchors from the read." },
      { tool: "impact", step: "GREEN / step 5", rationale: "Find all downstream regressions in one pass." },
      { tool: "read", step: "When Stuck", rationale: "Recover from plan/file drift by starting from reality." },
      { tool: "symbol_graph", step: "When Stuck", rationale: "Recover source-backed reality when the file drifted." },
    ],
  },
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
  {
    prompt: "code-review.md",
    rows: [
      { tool: "/codex-review", step: "## Instructions", rationale: "Use codex review findings as cited input." },
      { tool: "/codex-adversarial-review", step: "## Instructions", rationale: "Add adversarial review for high-stakes changes." },
      { tool: "symbol_graph", step: "Code Quality / Correctness", rationale: "Inspect current contracts, guards, and throws." },
      { tool: "impact", step: "Architecture / Breaking changes", rationale: "Define the dependent breaking-change surface." },
      { tool: "symbol_graph", step: "## Rules", rationale: "Verify findings against real symbol names and signatures." },
      { tool: "read", step: "## Rules", rationale: "Prefer exact symbol reads over paraphrase." },
      { tool: "read", step: "If needs-fixes", rationale: "Re-read anchored source before inline fixes." },
      { tool: "impact", step: "If needs-fixes", rationale: "Update dependent files when fixes change signatures." },
    ],
  },
  {
    prompt: "reproduce-bug.md",
    rows: [
      { tool: "symbol_graph", step: "Step 1", rationale: "Resolve symbols mentioned in the stack trace." },
      { tool: "read", step: "Step 1", rationale: "Pull nearby anchored context and real signatures." },
      { tool: "bash", step: "Step 2", rationale: "Inspect recent commits and suspect diffs." },
      { tool: "trace", step: "Step 4", rationale: "Confirm which boundaries the real path crosses." },
      { tool: "read", step: "Step 5", rationale: "Pull the exact function signature into the failing test." },
    ],
  },
  {
    prompt: "diagnose-bug.md",
    rows: [
      { tool: "trace", step: "Phase 1", rationale: "Follow the real runtime call order backward from the symptom." },
      { tool: "symbol_graph", step: "Phase 1", rationale: "Enumerate callers of the first bad-value function." },
      { tool: "symbol_graph", step: "Phase 2 / Understand dependencies", rationale: "Inspect the broken function's current contract." },
      { tool: "impact", step: "Phase 2 / Understand dependencies", rationale: "Enumerate dependents of the broken function." },
      { tool: "impact", step: "After diagnosis — assess risk", rationale: "Define the risk surface the Fixed When criteria must cover." },
    ],
  },
  {
    prompt: "done.md",
    rows: [
      { tool: "symbol_graph", step: "generate-docs", rationale: "Pull real API names/signatures into generated docs." },
      { tool: "read", step: "generate-docs", rationale: "Pull exact current signatures into generated docs." },
      { tool: "symbol_graph", step: "generate-bugfix-summary", rationale: "Confirm real symbol names and locations in the summary." },
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
describe("phase-specific tool guidance — mapping doc", () => {
  it("docs/phase-tools.md stays exactly in sync with the expected prompt/tool map", () => {
    expect(readPhaseToolsDoc().trim()).toBe(renderPhaseToolsDoc(phaseToolDoc));
  });
});
```

Do **not** touch `tests/prompt-inject.test.ts` yet; let the missing-doc failure happen first.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/phase-tool-guidance.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open '.../docs/phase-tools.md'`


**Step 3 — Write minimal implementation**
Create `docs/phase-tools.md` with one section per touched prompt file and a three-column table (`Tool / command`, `Section / step`, `Rationale`). Use this exact content:

```md
# Phase Tool Guidance Map

Prompt markdown in `prompts/*.md` is the source of truth. This file is a review index for issue #127 and the drift-check target for the tests in `tests/phase-tool-guidance.test.ts`.

## prompts/brainstorm.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `read` | `## Read first` | Prefer structural-map reads on unfamiliar files. |
| `symbol_graph` | `## Read first` | Confirm named symbols exist and inspect callers. |
| `symbol_graph` | `## Read first` | Preserve current contracts when brainstorming changes to existing symbols. |
| `grep` | `## Read first` | Handle text mentions. |
| `ast_search` | `## Read first` | Handle structural patterns. |
| `bash` | `## Read first` | Skim recent history with `git log --oneline -20 -- <path>`. |

## prompts/write-spec.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `## Purpose` | Confirm named existing symbols and signatures in ACs. |
| `symbol_graph` | `## Purpose` | Ground ACs in current guards, throws, and invariants. |
| `symbol_graph` | `## Legacy handling` | Verify prose-named symbols exist before extracting implied requirements. |

## prompts/write-plan.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `code_execution` | `## Read the Codebase First` | Batch many grounding lookups through a single script. |
| `symbol_graph` | `## Read the Codebase First` | Confirm real symbol names, signatures, and call sites. |
| `symbol_graph` | `## Read the Codebase First` | Preserve contracts for behavior-changing work. |
| `ast_search` | `## Read the Codebase First` | Enumerate repeated structural edit sites once. |
| `impact` | `## Read the Codebase First` | Surface dependents for public signature changes. |
| `trace` | `## Read the Codebase First` | Order tasks along a real execution path. |
| `read` | `## Read the Codebase First` | Lift exact current signatures into task steps. |
| `read` | `Task template / Step 1` | Lift exact imported or mocked signatures into tests. |
| `symbol_graph` | `Task template / Step 1` | Lift source-backed signatures into tests. |
| `bash` | `Task template / Step 2` | Probe for real failure text instead of guessing. |
| `impact` | `Task template / Step 3` | List dependent callers/tests for signature changes. |
| `grep` | `Pre-Submit Checklist / Coverage` | Mechanically confirm every AC is referenced by at least one task. |

## prompts/review-plan.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `grep` | `Criterion 1 / Coverage` | Mechanically confirm AC coverage. |
| `symbol_graph` | `Criterion 2 / Ordering & Dependencies` | Verify imported symbols come from lower-index tasks. |
| `grep` | `Criterion 2 / Ordering & Dependencies` | Cross-check task-file symbol definitions by index. |
| `symbol_graph` | `Criterion 3 / TDD Completeness` | Reject fictional Step 3 APIs and imports. |
| `read` | `Criterion 3 / TDD Completeness` | Compare quoted signatures against real signatures. |
| `symbol_graph` | `Criterion 6 / Self-Containment` | Verify referenced APIs/imports exist as written. |
| `ast_search` | `Criterion 6 / Self-Containment` | Verify repeated structural references exist. |

## prompts/revise-plan.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `## Instructions` | Confirm revised Step 3 imports/calls match reality. |
| `read` | `## Instructions` | Lift exact current signatures into revised task text. |
| `ast_search` | `## Instructions` | Confirm Step 3 structural patterns exist. |
| `grep` | `Most Common Revision Failures / missing coverage` | Verify which task now covers the missing AC. |
| `impact` | `Most Common Revision Failures / signature change` | Update dependent files after signature changes. |
| `grep` | `Pre-Submit Checklist / Coverage re-check` | Confirm missing-AC complaints were actually fixed. |

## prompts/implement-task.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `read` | `RED / step 1` | Confirm real signatures before pasting tests. |
| `symbol_graph` | `RED / step 1` | Pull source-backed signature details into tests. |
| `read` | `GREEN / step 1` | Re-read the exact current file state before editing. |
| `symbol_graph` | `GREEN / step 1` | Pull source-backed current state before editing. |
| `edit` | `GREEN / step 1` | Edit through hashline anchors from the read. |
| `impact` | `GREEN / step 5` | Find all downstream regressions in one pass. |
| `read` | `When Stuck` | Recover from plan/file drift by starting from reality. |
| `symbol_graph` | `When Stuck` | Recover source-backed reality when the file drifted. |

## prompts/verify.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `impact` | `Step 1` | Verify the regression sweep covers downstream dependents. |
| `symbol_graph` | `Step 2 / code inspection` | Prove a symbol exists with the expected shape. |
| `ast_search` | `Step 2 / code inspection` | Prove multi-site structural patterns. |
| `trace` | `Step 2 / user-observable behavior` | Prove the new code is on the real executed path. |
| `trace` | `What Actually Proves a Claim` | Define valid evidence that new behavior is reached. |

## prompts/code-review.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `/codex-review` | `## Instructions` | Use codex review findings as cited input. |
| `/codex-adversarial-review` | `## Instructions` | Add adversarial review for high-stakes changes. |
| `symbol_graph` | `Code Quality / Correctness` | Inspect current contracts, guards, and throws. |
| `impact` | `Architecture / Breaking changes` | Define the dependent breaking-change surface. |
| `symbol_graph` | `## Rules` | Verify findings against real symbol names and signatures. |
| `read` | `## Rules` | Prefer exact symbol reads over paraphrase. |
| `read` | `If needs-fixes` | Re-read anchored source before inline fixes. |
| `impact` | `If needs-fixes` | Update dependent files when fixes change signatures. |

## prompts/reproduce-bug.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `Step 1` | Resolve symbols mentioned in the stack trace. |
| `read` | `Step 1` | Pull nearby anchored context and real signatures. |
| `bash` | `Step 2` | Inspect recent commits and suspect diffs. |
| `trace` | `Step 4` | Confirm which boundaries the real path crosses. |
| `read` | `Step 5` | Pull the exact function signature into the failing test. |

## prompts/diagnose-bug.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `trace` | `Phase 1` | Follow the real runtime call order backward from the symptom. |
| `symbol_graph` | `Phase 1` | Enumerate callers of the first bad-value function. |
| `symbol_graph` | `Phase 2 / Understand dependencies` | Inspect the broken function's current contract. |
| `impact` | `Phase 2 / Understand dependencies` | Enumerate dependents of the broken function. |
| `impact` | `After diagnosis — assess risk` | Define the risk surface the Fixed When criteria must cover. |

## prompts/done.md
| Tool / command | Section / step | Rationale |
| --- | --- | --- |
| `symbol_graph` | `generate-docs` | Pull real API names/signatures into generated docs. |
| `read` | `generate-docs` | Pull exact current signatures into generated docs. |
| `symbol_graph` | `generate-bugfix-summary` | Confirm real symbol names and locations in the summary. |
```

Then append this exact describe block to `tests/prompt-inject.test.ts`:

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

This keeps the test copy-pasteable, covers feature + bugfix + done injection, and makes the doc drift check fail in both directions.


**Step 4 — Run test, verify it passes**
Run: `bun test tests/phase-tool-guidance.test.ts tests/prompt-inject.test.ts`
Expected: PASS


**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
