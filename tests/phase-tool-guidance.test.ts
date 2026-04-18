import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", name), "utf-8");
}

function expectAll(content: string, snippets: string[]) {
  for (const snippet of snippets) {
    expect(content).toContain(snippet);
  }
}

describe("phase-specific tool guidance — brainstorm/write-spec", () => {
  it("brainstorm.md inlines the required Read first tool hints", () => {
    const content = readPrompt("brainstorm.md");
    expectAll(content, [
      "Use `read` with `map: true` on unfamiliar files to get a structural map instead of dumping full contents.",
      "Use `symbol_graph` when the request mentions a concrete function, class, or module, to confirm it exists and see what calls it.",
      "Use `symbol_graph` with `include: [\"contract\"]` on any existing symbol the request proposes to change, so the brainstorm preserves its current behavioral guarantees instead of silently dropping them.",
      "Use `grep` for text mentions; use `ast_search` for structural patterns (e.g. every call site of a specific API shape).",
      "When the request touches an area that might have prior attempts or recent churn, run `git log --oneline -20 -- <path>` via `bash` to skim recent history.",
    ]);
  });

  it("write-spec.md adds symbol grounding in Purpose and Legacy handling", () => {
    const content = readPrompt("write-spec.md");
    expectAll(content, [
      "When an acceptance criterion references an existing function, class, or module, use `symbol_graph` to confirm the symbol exists and the signature/naming in the AC matches reality.",
      "If the AC depends on current behavioral guarantees (error cases, guards, throws), use `symbol_graph` with `include: [\"contract\"]` to cite real behavior, not assumed behavior.",
      "When the prior artifact is prose-heavy and references code, use `symbol_graph` to verify every named symbol exists before extracting it as an implied requirement.",
    ]);
  });
});

describe("phase-specific tool guidance — write-plan/review-plan", () => {
  it("write-plan.md adds batching, symbol, trace, impact, and signature-lifting hints", () => {
    const content = readPrompt("write-plan.md");
    expectAll(content, [
      "When grounding spans many lookups (multiple `symbol_graph` calls, greps, and reads across ≥5 files), prefer batching them through `code_execution` in a single script rather than issuing many sequential tool calls.",
      "Use `symbol_graph` to list the functions/classes/types each task will touch and confirm their real names, signatures, and call sites. Don't invent symbols.",
      "Use `symbol_graph` with `include: [\"contract\"]` on any symbol whose behavior you're changing, so the plan accounts for existing throws, guards, and invariants.",
      "Use `ast_search` when multiple tasks will modify the same structural pattern (e.g. every usage of a framework API) — get the full list of sites once, distribute them across tasks.",
      "Use `impact` with `changeType: \"signature_change\"` on any symbol whose public signature will change. The returned blast radius names dependent tests the plan must update.",
      "Use `trace` from a known entry point when ordering tasks on a real execution path — the trace order is a good first pass at task order.",
      "Use `read` with `symbol: \"<name>\"` to pull the exact current signature into Step 1 / Step 3 of each task (prevents fabricated-signature bugs).",
      "When the test imports or mocks an existing symbol, use `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` to lift the exact current signature into the test.",
      "Before committing the expected-error text to the plan, use `bash` to run a minimal probe — e.g. a one-line call to the target symbol — and paste the real error text the runner emits.",
      "If Step 3 changes a symbol's public signature, run `impact` with `changeType: \"signature_change\"` on that symbol first and list the dependent callers/tests in the task's **Files** section.",
      "*How to verify:* use `grep` to scan `spec.md` for acceptance-criterion numbering, then cross-check against the task list — every AC must be referenced by at least one task.",
    ]);
  });

  it("review-plan.md adds criterion-anchored grep, symbol_graph, read, and ast_search hints", () => {
    const content = readPrompt("review-plan.md");
    expectAll(content, [
      "Use `grep` across `spec.md` and the task files in `.megapowers/plans/<issue-slug>/tasks/` to confirm every acceptance-criterion identifier is referenced by at least one task.",
      "For each task that imports a symbol or type from a prior task, use `symbol_graph` or `grep` against the relevant task files to confirm the symbol is actually defined in a task with a lower index.",
      "For Step 3's implementation code, use `symbol_graph` on every symbol the task claims it imports or calls — if the symbol doesn't resolve, Step 3 is referencing fiction. Use `read` with `symbol: \"<name>\"` to compare the task's quoted signature against the real one.",
      "Use `symbol_graph` and `ast_search` to verify every API, signature, and import referenced in a task exists as written. Fabricated APIs are the highest-impact defect this criterion catches.",
    ]);
  });
});

describe("phase-specific tool guidance — revise-plan/implement-task", () => {
  it("revise-plan.md adds symbol, read, ast_search, grep, and impact revision hints", () => {
    const content = readPrompt("revise-plan.md");
    expectAll(content, [
      "Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim.",
      "Use `read` with `symbol: \"<name>\"` to pull the exact current signature into the task's test/implementation text.",
      "Use `ast_search` to confirm structural patterns used in Step 3 actually exist in the codebase.",
      "When the reviewer said 'missing coverage for AC N', use `grep` for the AC identifier across `spec.md` and the task files to confirm which task you added now covers it — don't just append a task and assume.",
      "When a revision changes a function signature in Step 3, run `impact` with `changeType: \"signature_change\"` on that symbol and update the task's **Files** list to include every dependent the impact call surfaces.",
      "**Coverage re-check:** if the revision addressed a missing-AC complaint, use `grep` across spec and task files to confirm the AC is now referenced.",
    ]);
  });

  it("implement-task.md adds signature, anchor, impact, and drift-recovery hints", () => {
    const content = readPrompt("implement-task.md");
    expectAll(content, [
      "When the plan's test references an existing symbol, use `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` to confirm its real signature before pasting the test.",
      "Before editing, use `read` with `symbol: \"<name>\"` (or `symbol_graph` with `include: [\"source\"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`.",
      "Before patching, run `impact` on the changed symbol to see the full dependent set, so you fix all downstream tests in one pass rather than cascading.",
      "| Implementation doesn't match what the file looks like now | Run `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` — the plan was based on an earlier snapshot; start from reality. |",
    ]);
  });
});

describe("phase-specific tool guidance — verify/code-review", () => {
  it("verify.md adds impact, symbol_graph, ast_search, and trace evidence hints", () => {
    const content = readPrompt("verify.md");
    expectAll(content, [
      "Before concluding the suite covers the change, use `impact` on the primary symbol you changed to list downstream dependents. Confirm every surfaced dependent's test ran.",
      "Use `symbol_graph` on the symbol the criterion describes to confirm it exists with the expected shape; paste the card output (or anchored source from `include: [\"source\"]`) into the evidence block.",
      "Use `ast_search` when the criterion is about a structural pattern across multiple sites.",
      "Use `trace` from the feature's real entry point to confirm the new code is on the executed path. Paste the trace output into the evidence block.",
      "| New behavior is actually reached | `trace` from the feature's entry point shows the new code on the path | Test that constructs the call directly, bypassing the real entry |",
    ]);
  });

  it("code-review.md adds codex-review, contract, impact, and anchored-fix hints", () => {
    const content = readPrompt("code-review.md");
    expectAll(content, [
      "Run `/codex-review --base <ref>` early (against `main` or the feature's base branch) and treat the findings as input.",
      "For high-stakes changes (security-sensitive code, data-loss risk, public API surface, or architecture-level changes), also run `/codex-adversarial-review --base <ref>` with focus text describing the risk area.",
      "Use `symbol_graph` with `include: [\"contract\"]` on the changed symbol to see its current guards, throws, and invariants. Flag any behavior in the contract that isn't covered by a test.",
      "Run `impact` with `changeType: \"signature_change\"` on every public symbol modified in the diff. The returned dependents are the 'breaking change' surface — the review must either confirm they're updated or call out the break explicitly.",
      "Prefer `symbol_graph` and `read` with `symbol: \"<name>\"` over paraphrasing.",
      "When applying fixes inline, re-read the changed symbols with `read` using hashline anchors and edit through those anchors. For any signature change you make during fixes, re-run `impact` and update dependent files in the same session.",
    ]);
  });
});

describe("phase-specific tool guidance — reproduce-bug/diagnose-bug", () => {
  it("reproduce-bug.md adds symbol, read, git, trace, and signature hints", () => {
    const content = readPrompt("reproduce-bug.md");
    expectAll(content, [
      "When the error mentions a specific symbol or file, use `symbol_graph` with `include: [\"source\"]` on the symbol in the stack trace, and `read` with hashline anchors for nearby context. Copy real signatures into the reproduction report.",
      "Use `bash` to run `git log --oneline -20 -- <path>` on the files from the stack trace, and `git diff <suspect-commit>` if one looks likely.",
      "Use `trace` from the entry point to confirm which boundaries the real execution path actually crosses (don't assume from architecture diagrams). Instrument those specific boundaries.",
      "Before writing the failing test, use `read` with `symbol: \"<name>\"` to pull the exact signature of the function you're calling into the test.",
    ]);
  });

  it("diagnose-bug.md adds trace, symbol_graph, contract, and impact hints", () => {
    const content = readPrompt("diagnose-bug.md");
    expectAll(content, [
      "Use `trace` from a known entry point to see the real call order the runtime follows, not the static call graph.",
      "Use `symbol_graph` (default compact card) on the function where the bad value first appears, to list its callers — those are your next candidates to inspect.",
      "Use `symbol_graph` with `include: [\"contract\"]` on the broken function to see its documented/tested guarantees and `impact` to see its dependents.",
      "Use `impact` on the function containing the root cause. The returned dependents are the risk surface the 'Fixed When' acceptance criteria must cover.",
    ]);
  });
});

describe("phase-specific tool guidance — done", () => {
  it("done.md adds signature and symbol-name grounding to docs/summary actions", () => {
    const content = readPrompt("done.md");
    expectAll(content, [
      "When the document describes a new or modified API surface, use `symbol_graph` (or `read` with `symbol: \"<name>\"`) to pull the real signature into the doc. Do not paraphrase signatures from memory.",
      "When describing the fix's root cause or affected code, use `symbol_graph` to confirm the symbol names and locations before including them in the summary.",
    ]);
  });
});

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
