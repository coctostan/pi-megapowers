# Testing Conventions

- **Run:** `bun test` (all) or `bun test tests/{file}.test.ts` (single)
- **Location:** `tests/` directory. One test file per source module.
- **Naming:** `{module-name}.test.ts` mirrors source file
- **Framework:** `bun:test` — `describe`, `it`, `expect`, `beforeEach`, `afterEach`
- **Tests are pure.** No pi dependency. No network. No shared state.
- **File-system tests** use temp dirs: `mkdtempSync(join(tmpdir(), "prefix-"))`. Clean up in `afterEach` with `rmSync(tmp, { recursive: true, force: true })`.
- **State factory:** `makeState(overrides)` — create test state, override only what the test cares about.
- **TDD cycle:** Write test → run it (must fail) → write implementation → run it (must pass).
- **Coverage:** Every source module gets a test file. No exceptions unless the module is pure wiring (index.ts).
