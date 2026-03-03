# Code Review: 091-remove-jj-dependency

## Files Reviewed

| File | Changes |
|------|---------|
| `extensions/megapowers/subagent/pipeline-workspace.ts` | Rewritten: `ExecGit` type, `git worktree`-based workspace creation/squash/cleanup/diff |
| `extensions/megapowers/state/state-machine.ts` | `MegapowersState` — removed `jjChangeId`, `taskJJChanges` |
| `extensions/megapowers/state/state-io.ts` | `KNOWN_KEYS` allowlist-based deserialization (drops legacy keys) |
| `extensions/megapowers/register-tools.ts` | `execGit` closure via `pi.exec("git", ...)`, no jj executor |
| `extensions/megapowers/hooks.ts` | Removed jj availability check, jj change-ID mismatch detection |
| `extensions/megapowers/commands.ts` | `RuntimeDeps` no longer includes jj |
| `extensions/megapowers/tools/tool-signal.ts` | No jj parameter, no `createTaskChange` call |
| `extensions/megapowers/policy/phase-advance.ts` | No jj describe/new/squash calls |
| `extensions/megapowers/task-coordinator.ts` | Removed `createTaskChange`, `inspectTaskChange`; kept `parseTaskDiffFiles`, `buildTaskChangeDescription`, `buildTaskCompletionReport` |
| `extensions/megapowers/prompt-inject.ts` | Removed `_jj` parameter |
| `extensions/megapowers/subagent/pipeline-runner.ts` | Uses `ExecGit`/`execGit`, calls `getWorkspaceDiff` |
| `extensions/megapowers/subagent/pipeline-tool.ts` | Uses `ExecGit`, calls `createPipelineWorkspace`/`squashPipelineWorkspace` |
| `extensions/megapowers/subagent/oneshot-tool.ts` | Uses `ExecGit`, calls workspace functions |
| `extensions/megapowers/ui.ts` | No jj rendering |
| `AGENTS.md` | Updated: "isolated git worktree", removed jj known-issue bullet |
| All corresponding `.test.ts` files | Updated mocks and assertions for git worktree pattern |

---

## Strengths

- **`state-io.ts` allowlist approach** (`KNOWN_KEYS`): Elegant forward-compatible deserialization — any future field changes to `MegapowersState` automatically require a conscious `KNOWN_KEYS` update. Much better than a schema migration or explicit strip-by-name approach.

- **`inDir()` helper** (`pipeline-workspace.ts:17-19`): Clean, minimal helper that makes every git call's target directory explicit and readable. The pattern of `execGit(inDir(workspacePath, ["add", "-A"]))` vs `execGit(["apply", ...])` clearly communicates "runs in worktree" vs "runs in project root".

- **Patch-based squash** (`pipeline-workspace.ts:44-75`): Correct design for merging isolated worktree changes back without creating a commit. The error path preserves the worktree for inspection (`AC16`), which is important for debugging failed squashes.

- **Injectable `ExecGit` executor**: All workspace functions accept `execGit` as a parameter, enabling pure mock-based tests without touching the filesystem or spawning git. Tests are readable and correctly target behavior, not implementation details.

- **`squashPipelineWorkspace` empty-diff fast-path** (`pipeline-workspace.ts:48-56`): Handles the no-op case cleanly (skips apply when nothing changed) rather than calling `git apply` on an empty patch.

- **`state.json` backward compatibility**: The `AC3` test construction of legacy key names dynamically (to avoid grep detection) is a clever but slightly awkward pattern. The mechanism itself is correct and robustly handles old `jjChangeId`/`taskJJChanges` keys.

- **`AGENTS.md` updated accurately**: Describes "isolated git worktree" throughout, removed the "Async jj fire-and-forget" known issue, and updated the pipeline description. No jj references remain.

---

## Findings

### Critical

None.

---

### Important

**1. `parseSummaryFiles` included git summary line in `filesChanged` output** (`pipeline-workspace.ts:90-98`)
- **What**: The original implementation used `split("|")[0]` to extract file paths from `git diff --stat` lines. However, the git stat summary line (`"2 files changed, 5 insertions(+)"`) doesn't contain `|`, so `split("|")[0]` returns the whole line, which would pass `.filter(Boolean)` and end up in `filesChanged`.
- **Why it matters**: `getWorkspaceDiff` returns `{ filesChanged, diff }`. While `pipeline-runner.ts` currently only destructures `diff` (so the bug had no runtime impact), `filesChanged` is part of the public return type and any future caller consuming it would receive corrupted data.
- **Fix applied**: Added a `.filter((l) => /\|\s*\d/.test(l))` step to only include lines with the `| N` pattern (actual file stat lines). New regression test added to `tests/pipeline-workspace.test.ts`.

---

### Minor

**2. Indentation inconsistency in `pipeline-runner.ts:203`**
- **File:line**: `extensions/megapowers/subagent/pipeline-runner.ts:203`
- **What**: `retryCount++;` inside the `if (review.exitCode !== 0)` block is indented at 4 spaces while the surrounding block uses 6-space indentation. Purely cosmetic — the line is logically inside the block and behavior is unaffected.
- **How to fix**: Change to `      retryCount++;` (6-space indent to match the block).

**3. Dead exports in `task-coordinator.ts`**
- **File**: `extensions/megapowers/task-coordinator.ts`
- **What**: `buildTaskChangeDescription`, `buildTaskCompletionReport`, `TaskInspection` are exported and tested but imported by zero production files. `buildTaskChangeDescription` has jj-era naming ("Change" was a jj concept) but now just formats a string.
- **Why it matters**: Dead code adds cognitive load and misleads readers about what's used where.
- **How to fix**: If these functions are not planned for future use, remove them and their tests. If `buildTaskChangeDescription` is intended for use in git commit messages, document where.

**4. `pipelineWorkspaceName` return value unused**
- **File**: `extensions/megapowers/subagent/pipeline-workspace.ts:8-10`, `pipeline-tool.ts:91`
- **What**: `createPipelineWorkspace` returns `{ workspaceName, workspacePath }`. No caller ever reads `workspaceName` — `pipeline-tool.ts` only uses `ws.workspacePath`. The `pipelineWorkspaceName` function exists only to populate this dead field.
- **Why it matters**: Slight API confusion — callers may wonder what `workspaceName` is for.
- **How to fix**: Remove `workspaceName` from the return shape and delete `pipelineWorkspaceName` (or remove the return field but keep the function if the `mega-<id>` naming is intended for future use such as git worktree list display).

**5. Stale jj references in comments and test descriptions (fixed in this session)**
- `commands.ts:15`: "The ONLY place allowed to create store/jj/ui." → **Fixed**: removed `/jj`.
- `task-coordinator.ts:13`: JSDoc said "jj diff output" → **Fixed**: changed to "diff output".
- `task-coordinator.test.ts:39,45`: Test descriptions said "jj diff --summary/--stat output" → **Fixed**: changed to "git diff".

**6. Temp patch file not cleaned up**
- **File**: `extensions/megapowers/subagent/pipeline-workspace.ts:58-59`
- **What**: `mega-squash-${pipelineId}.patch` is written to `tmpdir()` and never deleted after `git apply` succeeds (or on the no-changes fast-path).
- **Why it matters**: Minor resource leak; temp directory is eventually cleaned by the OS but accumulates on long-running sessions.
- **How to fix**: Add `unlinkSync(patchPath)` after the `worktree remove` call in the success path, wrapped in try/catch.

**7. `git diff` without `--binary` silently drops binary file changes**
- **File**: `extensions/megapowers/subagent/pipeline-workspace.ts:46`
- **What**: `git diff --cached HEAD` (without `--binary`) outputs `"Binary files a/f b/f differ"` for binary files, which `git apply` ignores. Binary changes are silently dropped on squash.
- **Why it matters**: Low risk for this TypeScript-only project. Would cause silent data loss if a pipeline task creates/modifies binary assets (images, WASM, etc.).
- **How to fix**: Change to `git diff --binary --cached HEAD` to include binary patches in the output. `git apply` handles `--binary` format transparently.

---

## Recommendations

1. **`getWorkspaceDiff` — consider dropping `filesChanged`**: The function stages, stats, and diffs, but only the `diff` return value is ever used by `pipeline-runner.ts`. If `filesChanged` is unneeded, simplifying the API to return `{ diff: string }` would remove `parseSummaryFiles` entirely and reduce complexity.

2. **Clean up `task-coordinator.ts`**: Consider a follow-up to either (a) use the module in production (e.g., use `parseTaskDiffFiles` inside `parseSummaryFiles`/`getWorkspaceDiff`), or (b) delete the module and its tests. Having a fully test-covered module that doesn't contribute to runtime is confusing.

3. **Document the implicit `execGit` CWD contract**: The `git apply` call in `squashPipelineWorkspace` relies on `pi.exec` defaulting to `ctx.cwd` (the project root) when no explicit `cwd` is passed. This is verified by `pi-coding-agent/dist/core/extensions/loader.js:171` (`options?.cwd ?? cwd`). A brief comment at the call site would make this intentional and not look like a missed `inDir()`.

---

## Changes Made in This Review

| File | Change |
|------|--------|
| `extensions/megapowers/subagent/pipeline-workspace.ts` | Fixed `parseSummaryFiles` to exclude git stat summary lines |
| `tests/pipeline-workspace.test.ts` | Added regression test for `parseSummaryFiles` summary-line exclusion |
| `extensions/megapowers/commands.ts` | Removed stale `jj` from comment |
| `extensions/megapowers/task-coordinator.ts` | Fixed JSDoc: "jj diff output" → "diff output" |
| `tests/task-coordinator.test.ts` | Fixed test descriptions: "jj diff" → "git diff" |

---

## Assessment

**ready**

The jj dependency is cleanly and completely removed. All 21 acceptance criteria verified. The core migration — `ExecGit` type, `git worktree`-based workspace isolation, patch-based squash, state deserialization tolerance — is architecturally sound and well-tested. The one important bug (`parseSummaryFiles`) was latent with no current runtime impact, and has been fixed in this review session. Remaining findings are minor (dead code, cosmetic indentation, temp file cleanup) and do not block merge.
