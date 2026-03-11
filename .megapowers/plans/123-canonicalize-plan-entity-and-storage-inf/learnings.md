# Learnings — 123-canonicalize-plan-entity-and-storage-inf

- **Dead code is safe to delete when no live module imports it.** A repository-wide `rg` import scan is sufficient confirmation — if no file imports a module, deleting it cannot cause a runtime regression. TypeScript's module system makes this auditable with high confidence.

- **[no-test] is the right classification for pure file deletions.** The only verifiable behaviors are file absence (checked with `test ! -e`) and test-suite regression (checked with `bun test`). There is no testable new logic to drive with a red-green cycle.

- **Parallel dead implementations accumulate naturally during refactors.** The root-level modules were likely the original implementation that was superseded when the `state/` subdirectory was introduced. Without a deliberate cleanup pass, the dead code stayed — misleading future readers about which path was authoritative.

- **The test-count drop is informative, not alarming.** Going from 823 → 770 tests looks like regression but is fully explained by the 3 deleted dead test files (53 tests). Tracking this explicitly in the verify report prevents false alarms.

- **Scope discipline on dead-code issues matters.** The spec explicitly deferred unifying the runtime `PlanTask` type with the storage schema — tempting to bundle, but keeping the PR minimal meant the diff was 6 deletions, trivially reviewable and safe to merge.

- **`git diff --name-status -- <path>` is the cleanest way to confirm a deletion-only change.** Used it to verify that the `state/` directory was untouched and that the diff contained exactly the expected 6 files.
