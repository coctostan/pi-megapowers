## Task 1: Update brainstorm prompt requirements-capture contract

This task collides with already-implemented content in `prompts/brainstorm.md`.

### What’s wrong
- Current Step 1 assumes net-new implementation, but the required contract is already present (mode triage, `R/O/D/C/Q`, required sections, scope-preservation language).
- Current Step 2 can pass even if no meaningful work was done in this task.

### Required revision
- Keep `no_test: true`, but rewrite the task as **verify-and-patch** instead of unconditional rewrite.
- Add an explicit first action in Step 1:
  - "Read `prompts/brainstorm.md`; if all required contract elements already exist, make no content changes and record verification."
- Keep patch instructions only for missing elements.
- Add explicit AC mapping in the task body (AC 1, 2, 3, 4, 12).

### Concrete check to include
Use this exact verification command (or equivalent) in Step 2:

```bash
bash -lc 'grep -q "## Start by triaging the mode" prompts/brainstorm.md && grep -q "Exploratory" prompts/brainstorm.md && grep -q "Direct requirements" prompts/brainstorm.md && grep -q "R#" prompts/brainstorm.md && grep -q "O#" prompts/brainstorm.md && grep -q "D#" prompts/brainstorm.md && grep -q "C#" prompts/brainstorm.md && grep -q "Q#" prompts/brainstorm.md && grep -q "## Must-Have Requirements" prompts/brainstorm.md && grep -q "## Optional / Nice-to-Have" prompts/brainstorm.md && grep -q "## Explicitly Deferred" prompts/brainstorm.md && grep -q "## Constraints" prompts/brainstorm.md && grep -q "## Open Questions" prompts/brainstorm.md && grep -q "## Recommended Direction" prompts/brainstorm.md && grep -q "## Testing Implications" prompts/brainstorm.md && grep -q "scoped-down items are still preserved" prompts/brainstorm.md'
```


## Task 2: Update write-spec prompt traceability contract

This task also collides with already-implemented content in `prompts/write-spec.md`.

### What’s wrong
- Current Step 1 describes creating sections/rules that already exist (`No silent drops`, `Legacy handling`, `Requirement Traceability`, exact-once `R#` coverage).
- Current verification does not distinguish pre-existing implementation from task work.

### Required revision
- Keep `no_test: true`, but rewrite as **verify-and-patch only missing gaps**.
- Add explicit first action in Step 1 to inspect existing prompt content before editing.
- Add explicit AC mapping in the task body (AC 5, 6, 7, 8, 9, 12).

### Concrete check to include
Use this exact verification command (or equivalent) in Step 2:

```bash
bash -lc 'grep -q "## No silent drops" prompts/write-spec.md && grep -q "Every must-have requirement from the prior artifact must map to exactly one of" prompts/write-spec.md && grep -q "## Legacy handling" prompts/write-spec.md && grep -q "extract the implied requirements" prompts/write-spec.md && grep -q "present that extraction to the user for confirmation" prompts/write-spec.md && grep -q "## Requirement Traceability" prompts/write-spec.md && grep -q "every \`R#\` must appear exactly once" prompts/write-spec.md && grep -q "no \`R#\` may be omitted" prompts/write-spec.md && grep -q "include \`O#\`, \`D#\`, and \`C#\` when they materially affect scope or implementation" prompts/write-spec.md && grep -q "reduced-scope items remain visible instead of disappearing" prompts/write-spec.md'
```


## Task 3: Lock brainstorm prompt contract in prompt tests

The requested tests already exist in `tests/prompts.test.ts` under the `#118` contract block.

### What’s wrong
- Current Step 1 instructs adding tests that already exist; a literal implementation will create duplicate test names.
- Task text should account for existing tests and only patch missing assertions.

### Required revision
- Keep `no_test: true`, but rewrite Step 1 as:
  - "Inspect existing `#118` describe block; if brainstorm assertions are present, do not add duplicate tests; only add missing assertions."
- Explicitly reference existing API: `getPhasePromptTemplate("brainstorm")`.
- Add explicit AC mapping in the task body (AC 10).

### Concrete verification command
Use:

```bash
bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
```

This command targets the existing block and avoids implying new test creation is required.


## Task 4: Lock spec prompt traceability contract in prompt tests

This task has both a dependency hazard and an implementation-collision hazard.

### What’s wrong
- It modifies `tests/prompts.test.ts` but depends only on Task 2; Task 3 edits the same file.
- It asks for a separate describe block even though spec assertions already exist in the current `#118` block.

### Required revision
1. **Dependency fix:** change `depends_on` to:

```yaml
depends_on:
  - 2
  - 3
```

2. Rewrite Step 1 to extend/patch existing `#118` coverage only if needed (no duplicate tests).
3. Explicitly reference `getPhasePromptTemplate("spec")`.
4. Add explicit AC mapping in the task body (AC 11).

### Concrete verification command
Use:

```bash
bun test tests/prompts.test.ts -t "#118 requirements artifacts contract"
```


## Task 5: Document the brainstorm-to-spec requirements model

This task is partially complete in-repo (`README.md` already contains the required semantics), and it has a missing prerequisite dependency.

### What’s wrong
- `README.md` already includes the required `brainstorm`-name compatibility + `R/O/D/C/Q` + traceability wording.
- `CHANGELOG.md` is missing the #118 Unreleased entry.
- Task currently has no dependencies but should not run before prompt contract tasks are finalized.

### Required revision
1. **Dependency fix:** set dependencies to at least prompts:

```yaml
depends_on:
  - 1
  - 2
```

2. Rewrite Step 1 to:
   - verify README coverage and only patch if needed,
   - add the missing CHANGELOG Unreleased bullet(s) for #118.
3. Add explicit AC mapping in the task body (AC 13, plus AC 12 wording consistency).

### CHANGELOG content to add (example language)
Under `## [Unreleased]` add a bullet equivalent to:

```md
- **Brainstorm/spec requirements traceability contract** — Updated prompts and prompt-contract tests so `brainstorm` remains the external phase name while acting as structured requirements capture (`R#`/`O#`/`D#`/`C#`/`Q#`). `spec` now enforces `Requirement Traceability` + `No silent drops` (every `R#` mapped exactly once), including legacy handling for older unstructured brainstorm artifacts. (#118)
```

### Verification command
Use:

```bash
bash -lc 'grep -q "brainstorm phase name is kept for compatibility" README.md && grep -q "R#`/`O#`/`D#`/`C#`/`Q#" README.md && grep -q "Requirement Traceability" README.md && grep -q "No silent drops" CHANGELOG.md && grep -q "Requirement Traceability" CHANGELOG.md && grep -q "legacy" CHANGELOG.md && grep -q "(#118)" CHANGELOG.md'
```