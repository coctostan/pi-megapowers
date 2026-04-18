# Phase-Specific Tool Guidance In Injected Prompts

## Goal
Phase prompts inject generic workflow instructions but don't steer the agent toward the most appropriate tools for each specific step. The intended outcome is to embed concrete, step-bound tool hints directly in the phase prompt templates — naming specific tools (`symbol_graph`, `impact`, `trace`, `ast_search`, `code_execution`, `/codex-review`, structural-map `read`, etc.) at the exact step where they apply — using a consistent short imperative style, without bloating context or duplicating global tool descriptions.

## Mode
`Exploratory`

The issue named the tools and the ACs, but the shape of the solution (inline vs overlay, data vs prose, presence filter vs dependency assumption), the per-phase placements, and the wording were all open and got resolved through per-phase collaborative review.

## Language Style (binding on implementation)
All inline tool hints follow a consistent imperative micro-pattern. Approved forms, ordered by preference:

1. **"When <doing step>, use `tool` to <verb phrase>."**
2. **"Before <step>, run `tool` to <purpose>."**
3. **"Use `tool` for <specific sub-task>."**

Rules:
- One sentence, one tool family per hint (multi-bullet grouped hints allowed when each bullet stays single-tool).
- Tool names in backticks.
- No reiteration of parameter schemas (the tool registry covers that).
- Inline with the step, not collected into a separate block.
- Pi extension slash commands (e.g. `/codex-review`) may substitute for tool names where the surface is a command rather than a tool.
- Existing prompt text may be tightened or edited when doing so sharpens a tool hint (not a strict "add-only" rule).

## Must-Have Requirements

- **R1** — Tool hints are inlined into `prompts/*.md` templates at the step they apply to, not collected into a separate "preferred tools" block.
- **R2** — Hints follow the language style patterns defined above.
- **R3** — Hints name concrete tools/commands, never abstract capability tags.
- **R4** — Hints do not restate what the global Pi routing table and per-tool registry already cover.
- **R5** — The pi-maintained tools (`pi-hashline-readmap`, `pi-codegraph`, `pi-ptc-next`, `pi-codex-review`) are assumed present as a dependency; no presence-conditional logic in prompts.
- **R6** — A documented mapping exists at `docs/phase-tools.md` listing, per prompt file, which specific tools it references and with what rationale.
- **R7** — The change does not materially grow injected context size; hint additions should generally be offset by tightening existing prose.
- **R8** — The following **specific per-prompt placements** are implemented:

  ### `prompts/brainstorm.md` — inside the `## Read first` section
  - "Use `read` with `map: true` on unfamiliar files to get a structural map instead of dumping full contents."
  - "Use `symbol_graph` when the request mentions a concrete function, class, or module, to confirm it exists and see what calls it."
  - "Use `symbol_graph` with `include: [\"contract\"]` on any existing symbol the request proposes to change, so the brainstorm preserves its current behavioral guarantees instead of silently dropping them."
  - "Use `grep` for text mentions; use `ast_search` for structural patterns (e.g. every call site of a specific API shape)."
  - "When the request touches an area that might have prior attempts or recent churn, run `git log --oneline -20 -- <path>` via `bash` to skim recent history."

  ### `prompts/write-spec.md`
  - **Under `## Purpose`** (grounding):
    "When an acceptance criterion references an existing function, class, or module, use `symbol_graph` to confirm the symbol exists and the signature/naming in the AC matches reality. If the AC depends on current behavioral guarantees (error cases, guards, throws), use `symbol_graph` with `include: [\"contract\"]` to cite real behavior, not assumed behavior."
  - **Inside `## Legacy handling`** (additional bullet):
    "When the prior artifact is prose-heavy and references code, use `symbol_graph` to verify every named symbol exists before extracting it as an implied requirement."

  ### `prompts/write-plan.md`
  - **Top of `## Read the Codebase First` — `code_execution` batching lead-in:**
    "When grounding spans many lookups (multiple `symbol_graph` calls, greps, and reads across ≥5 files), prefer batching them through `code_execution` in a single Python script rather than issuing many sequential tool calls."
  - **Inside `## Read the Codebase First` — 6 bullets:**
    - "Use `symbol_graph` to list the functions/classes/types each task will touch and confirm their real names, signatures, and call sites. Don't invent symbols."
    - "Use `symbol_graph` with `include: [\"contract\"]` on any symbol whose behavior you're changing, so the plan accounts for existing throws, guards, and invariants."
    - "Use `ast_search` when multiple tasks will modify the same structural pattern (e.g. every usage of a framework API) — get the full list of sites once, distribute them across tasks."
    - "Use `impact` with `changeType: \"signature_change\"` on any symbol whose public signature will change. The returned blast radius names dependent tests the plan must update."
    - "Use `trace` from a known entry point when ordering tasks on a real execution path — the trace order is a good first pass at task order."
    - "Use `read` with `symbol: \"<name>\"` to pull the exact current signature into Step 1 / Step 3 of each task (prevents fabricated-signature bugs)."
  - **Task template Step 1:**
    "When the test imports or mocks an existing symbol, use `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` to lift the exact current signature into the test."
  - **Task template Step 2:**
    "Before committing the expected-error text to the plan, use `bash` to run a minimal probe — e.g. a one-line call to the target symbol — and paste the real error text the runner emits. Never guess the error phrasing; runners differ (Bun vs Jest vs Vitest print different messages for the same failure)."
  - **Task template Step 3:**
    "If Step 3 changes a symbol's public signature, run `impact` with `changeType: \"signature_change\"` on that symbol first and list the dependent callers/tests in the task's **Files** section."
  - **Pre-Submit Checklist — Coverage item sub-hint:**
    "*How to verify:* use `grep` to scan `spec.md` for acceptance-criterion numbering, then cross-check against the task list — every AC must be referenced by at least one task."

  ### `prompts/review-plan.md` — criterion-anchored hints
  - **Criterion 1 (Coverage):** "Use `grep` across `spec.md` and the task files in `.megapowers/plans/<issue-slug>/tasks/` to confirm every acceptance-criterion identifier is referenced by at least one task. Missing coverage is the most common approve-error; verify it mechanically."
  - **Criterion 2 (Ordering & Dependencies):** "For each task that imports a symbol or type from a prior task, use `symbol_graph` or `grep` against the relevant task files to confirm the symbol is actually defined in a task with a lower index."
  - **Criterion 3 (TDD Completeness):** "For Step 3's implementation code, use `symbol_graph` on every symbol the task claims it imports or calls — if the symbol doesn't resolve, Step 3 is referencing fiction. Use `read` with `symbol: \"<name>\"` to compare the task's quoted signature against the real one."
  - **Criterion 6 (Self-Containment / codebase realism):** "Use `symbol_graph` and `ast_search` to verify every API, signature, and import referenced in a task exists as written. Fabricated APIs are the highest-impact defect this criterion catches."

  ### `prompts/revise-plan.md`
  - **Between `## Instructions` items 3 and 4:**
    - "Use `symbol_graph` on every symbol the revised Step 3 will import or call, to confirm the signature matches the task's claim."
    - "Use `read` with `symbol: \"<name>\"` to pull the exact current signature into the task's test/implementation text."
    - "Use `ast_search` to confirm structural patterns used in Step 3 actually exist in the codebase."
  - **Inside `## Most Common Revision Failures` (new bullet aligned to Coverage row):**
    "When the reviewer said 'missing coverage for AC N', use `grep` for the AC identifier across `spec.md` and the task files to confirm which task you added now covers it — don't just append a task and assume."
  - **Inside `## Most Common Revision Failures` (new bullet near incomplete-Step-3 row):**
    "When a revision changes a function signature in Step 3, run `impact` with `changeType: \"signature_change\"` on that symbol and update the task's **Files** list to include every dependent the impact call surfaces."
  - **Pre-Submit Checklist (new item):**
    "**Coverage re-check:** if the revision addressed a missing-AC complaint, use `grep` across spec and task files to confirm the AC is now referenced."

  ### `prompts/implement-task.md`
  - **RED section, step 1:**
    "When the plan's test references an existing symbol, use `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` to confirm its real signature before pasting the test."
  - **GREEN section, step 1:**
    "Before editing, use `read` with `symbol: \"<name>\"` (or `symbol_graph` with `include: [\"source\"]`) to pull the exact current file state. Use the hashline anchors from that read directly with `edit`."
  - **GREEN section, step 5 (regressions):**
    "Before patching, run `impact` on the changed symbol to see the full dependent set, so you fix all downstream tests in one pass rather than cascading."
  - **`## When Stuck` table — new row:**
    | Implementation doesn't match what the file looks like now | Run `read` with `symbol: \"<name>\"` or `symbol_graph` with `include: [\"source\"]` — the plan was based on an earlier snapshot; start from reality. |

  ### `prompts/verify.md`
  - **Step 2 (Gate Function IDENTIFY, code-inspection case):**
    "Use `symbol_graph` on the symbol the criterion describes to confirm it exists with the expected shape; paste the card output (or anchored source from `include: [\"source\"]`) into the evidence block. Use `ast_search` when the criterion is about a structural pattern across multiple sites."
  - **Step 2 (Gate Function IDENTIFY, user-observable behavior case):**
    "Use `trace` from the feature's real entry point to confirm the new code is on the executed path. Paste the trace output into the evidence block."
  - **Step 1 (full test suite — regression sweep):**
    "Before concluding the suite covers the change, use `impact` on the primary symbol you changed to list downstream dependents. Confirm every surfaced dependent's test ran."
  - **`## What Actually Proves a Claim` table — new row:**
    | New behavior is actually reached | `trace` from the feature's entry point shows the new code on the path | Test that constructs the call directly, bypassing the real entry |

  ### `prompts/code-review.md`
  - **Top of `## Instructions` (default step):**
    "Run `/codex-review --base <ref>` early (against `main` or the feature's base branch) and treat the findings as input. Cite findings you adopt with file:line; explicitly reject findings you disagree with and say why. Do not silently ignore."
  - **Same location (conditional, high-stakes changes):**
    "For high-stakes changes (security-sensitive code, data-loss risk, public API surface, or architecture-level changes), also run `/codex-adversarial-review --base <ref>` with focus text describing the risk area. Same citation rules."
  - **Code Quality → Correctness bullet:**
    "Use `symbol_graph` with `include: [\"contract\"]` on the changed symbol to see its current guards, throws, and invariants. Flag any behavior in the contract that isn't covered by a test."
  - **Architecture → Breaking changes bullet:**
    "Run `impact` with `changeType: \"signature_change\"` on every public symbol modified in the diff. The returned dependents are the 'breaking change' surface — the review must either confirm they're updated or call out the break explicitly."
  - **Rules section — tighten existing realism rule:**
    "**Verify suggestions against codebase reality** before making them — read the actual code. Prefer `symbol_graph` and `read` with `symbol: \"<name>\"` over paraphrasing. When a finding references a symbol, its real name and signature must appear in the finding verbatim."
  - **`If needs-fixes` section:**
    "When applying fixes inline, re-read the changed symbols with `read` using hashline anchors and edit through those anchors. For any signature change you make during fixes, re-run `impact` and update dependent files in the same session."

  ### `prompts/reproduce-bug.md`
  - **Step 1 (read error messages):** "When the error mentions a specific symbol or file, use `symbol_graph` with `include: [\"source\"]` on the symbol in the stack trace, and `read` with hashline anchors for nearby context. Copy real signatures into the reproduction report."
  - **Step 2 (check recent changes):** "Use `bash` to run `git log --oneline -20 -- <path>` on the files from the stack trace, and `git diff <suspect-commit>` if one looks likely."
  - **Step 4 (multi-component evidence):** "Use `trace` from the entry point to confirm which boundaries the real execution path actually crosses (don't assume from architecture diagrams). Instrument those specific boundaries."
  - **Step 5 (failing test):** "Before writing the failing test, use `read` with `symbol: \"<name>\"` to pull the exact signature of the function you're calling into the test."

  ### `prompts/diagnose-bug.md`
  - **Phase 1 (trace to root cause):**
    - "Use `trace` from a known entry point to see the real call order the runtime follows, not the static call graph."
    - "Use `symbol_graph` (default compact card) on the function where the bad value first appears, to list its callers — those are your next candidates to inspect."
  - **Phase 2, step 4 (understand dependencies):** "Use `symbol_graph` with `include: [\"contract\"]` on the broken function to see its documented/tested guarantees and `impact` to see its dependents."
  - **After diagnosis — assess risk:** "Use `impact` on the function containing the root cause. The returned dependents are the risk surface the 'Fixed When' acceptance criteria must cover."

  ### `prompts/done.md`
  - **Inside `### generate-docs`:** "When the document describes a new or modified API surface, use `symbol_graph` (or `read` with `symbol: \"<name>\"`) to pull the real signature into the doc. Do not paraphrase signatures from memory."
  - **Inside `### generate-bugfix-summary`:** "When describing the fix's root cause or affected code, use `symbol_graph` to confirm the symbol names and locations before including them in the summary."

## Optional / Nice-to-Have
- **O1** — The TUI flags when a pi-maintained tool referenced by prompts is not registered in the current session (dependency-visibility aid).
- **O2** — `docs/phase-tools.md` renders as a two-column table (tool × prompt files referencing it) for fast scanning.
- **O3** — A style linter test that rejects hints not matching the style patterns (imperative, single tool, no parameter schemas).

## Explicitly Deferred
- **D1** — A capability-tag → tool resolver layer.
- **D2** — A `tools:` field on `PhaseConfig` as a parallel source of truth.
- **D3** — Presence-aware conditional overlays for project-specific tools.
- **D4** — Emphasizing non-pi-authored third-party tools.
- **D5** — Dynamic, session-activity-based hint selection.
- **D6** — Multi-tool orchestration hints beyond the single `code_execution` mention in `write-plan.md`.
- **D7** — `/codex-review` / `/codex-adversarial-review` hints in plan-review (kept exclusive to `code-review.md`).
- **D8** — Step-2 bash-probe hints in reviewer phases (`review-plan.md`, `verify.md`) — probing is implementation-flavored and lives in `write-plan.md` / `implement-task.md` only.
- **D9** — `ast_search` hint in `diagnose-bug.md` Phase 2 pattern analysis (trimmed as slightly academic for diagnosticians).

## Constraints
- **C1** — Changes stay within the existing prompt-injection architecture (`prompts/*.md`, `extensions/megapowers/prompt-inject.ts`, `workflows/tool-instructions.ts`). No new assembly layer.
- **C2** — Must not duplicate the global Pi routing table (`.pi/prompt-assembler/sections/routing-table.md`) or per-tool descriptions in `.pi/prompt-assembler/tools/`.
- **C3** — The prompt file is the source of truth for inline tool guidance; no parallel config store.
- **C4** — Consistent with Phase 0: no new fragmentation of plan/review behavior.
- **C5** — Inspectable via #120's injected-context view (plain text in the assembled prompt).
- **C6** — The language style rules are binding; deviations are review-rejectable.
- **C7** — pi-maintained tools are treated as a hard dependency; prompts do not conditionalize on their presence.

## Open Questions
- **Q1** — Should `O1` (TUI missing-tool flag) be filed as a separate follow-up issue rather than implemented inside this slice?

## Recommended Direction
Edit the ten named prompt files directly (`brainstorm.md`, `write-spec.md`, `write-plan.md`, `review-plan.md`, `revise-plan.md`, `implement-task.md`, `verify.md`, `code-review.md`, `reproduce-bug.md`, `diagnose-bug.md`, `done.md`) to insert the exact hints listed under R8 at the exact step they apply to. Do not add a trailing "preferred tools" block — the point is that the tool choice is bound to the action in the same sentence.

Add `docs/phase-tools.md` inventorying: for each pi-maintained tool and each inline-referenced built-in, which prompt files reference it and what step triggers the reference. This gives us the AC's "documented mapping" without building a second source of truth.

Rely on the language-style rules to keep hints short and uniform. Unit tests verify each prompt file contains the required tool names, and a sync test confirms `docs/phase-tools.md` matches the prompt contents.

Project-specific pi tools are treated as a hard dependency — we don't try to detect their absence dynamically. A future pass (O1) can add a TUI flag when an expected tool is missing from the registered tool list, making the dependency visible rather than silent.

## Testing Implications
- Per-prompt unit tests asserting the expected tool names appear at least once (per R8). Ten prompt files; each has its own test set.
- A sync test asserting no prompt file contains a tool name not listed in `docs/phase-tools.md` (drift guard).
- A sync test asserting the mapping doc lists every prompt file that references each tool.
- Optional style-linter test (O3) validating each new hint matches one of the approved imperative patterns.
- Existing `buildInjectedPrompt` tests continue to pass unmodified — no behavioral change in the injector itself.
- Integration snapshot of assembled prompt per phase, so silent regression of inline hints is caught.
