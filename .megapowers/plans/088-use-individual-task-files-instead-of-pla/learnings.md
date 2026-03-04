# Learnings — Issue 088

- **Conflating null and error returns into one handler is a code smell.** `readPlanTask` returns three states: `null` (file not found), `{ error: string }` (parse failure), and `EntityDoc<T>` (success). The initial implementation collapsed the first two into a single "not found" message. When a file exists but has malformed frontmatter, users would see a misleading "not found" error. Always map each failure variant to a distinct, accurate message.

- **Out-of-scope clauses in specs are sometimes too broad.** The spec said "removing `extractTaskSection` is out of scope (may have other callers)" — a note meant to protect the shared `extractPlanTasks` utility in `plan-parser.ts`. But the local, non-exported `extractTaskSection` copy inside `pipeline-tool.ts` has no callers at all and became dead code. Specs should be specific about which symbol in which file is out of scope.

- **Two sources of truth for task data create a split-mind failure mode.** Before this issue, `writePlanTask` stored rich structured data in task files, but `pipeline-tool.ts` ignored them and re-parsed `plan.md`. An update to a task file body would never reach the pipeline. Making one store canonical (task files) and the other derived-only (`plan.md` via `legacy-plan-bridge.ts`) eliminates the ambiguity.

- **Gate semantics improve with validation, not just existence checks.** `requireTaskFiles` calls `listPlanTasks` which parses each file and silently skips malformed ones. A directory full of malformed YAML would still fail the gate — the gate reports "no task files found" even though files physically exist. This is intentional and correct: the gate checks for usable tasks, not mere file presence.

- **Test setup for gates requires all layers to be satisfied.** Many pre-existing tests that were testing plan→implement transitions only wrote `plan.md`. After switching to `requireTaskFiles`, those tests failed because the gate now checks the tasks directory. Fixing test setup to `writePlanTask` alongside `writeArtifact` was the bulk of the test-change work — a reminder that gate changes ripple broadly through test fixtures.

- **Subagent `pipeline-tool` error checking is worth treating as a layered guard.** The task-file missing/malformed check is placed before workspace creation, which means no orphaned git worktrees are created for bad inputs. Ordering guards from cheapest (in-memory state checks) to most expensive (git operations) keeps failures fast and clean.
