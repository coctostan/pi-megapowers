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
