## Goal

Build a focused V1 of issue backlog UX that makes issues easier to scan and manage without changing the underlying markdown-based issue system. The feature adds priority- and milestone-aware active issue listing, a first-class archive operation, and a separate archived issue view so the backlog remains readable as it grows while preserving an auditable history of archived work.

## Acceptance Criteria

1. The issue model accepts `archived` as a valid issue status when parsing issue frontmatter.
2. Active issue queries exclude files stored under `.megapowers/issues/archive/`.
3. Archived issue queries read files stored under `.megapowers/issues/archive/`.
4. Active issue list ordering sorts issues by milestone before priority.
5. Within the same milestone, active issue list ordering sorts lower numeric priority before higher numeric priority.
6. When milestone and priority are equal or absent, active issue list ordering sorts older issues before newer issues.
7. Active issue list rendering groups issues under milestone headers.
8. Each active issue list item renders the issue id.
9. Each active issue list item renders the issue title.
10. Each active issue list item renders the issue status.
11. Each active issue list item renders the issue priority when a priority is present.
12. Archived issues do not appear in the default active issue list.
13. Triageable issue filtering excludes archived issues.
14. Archiving an active-directory issue moves its markdown file into `.megapowers/issues/archive/`.
15. Archiving an issue rewrites its frontmatter status to `archived`.
16. Archiving an issue writes an `archived:` timestamp to frontmatter.
17. Archiving preserves the issue id.
18. Archiving preserves the issue slug.
19. Archiving preserves the issue title.
20. Archiving is allowed for issues whose prior status is `open`.
21. Archiving is allowed for issues whose prior status is `in-progress`.
22. Archiving is allowed for issues whose prior status is `done`.
23. Attempting to archive a missing issue returns a clear error.
24. Attempting to archive an already archived issue returns a clear error.
25. Archiving a non-active issue does not reset workflow state.
26. Archiving the currently active issue resets workflow state so no active issue remains selected.
27. After archiving the currently active issue, active issue selection flows do not show that issue as active.
28. The archived issue view lists archived issues without reintroducing them into the default active issue list.
29. Idle prompt issue summaries do not include archived issues in the open issue list.
30. Existing active issue selection flows continue to work for non-archived issues.

## Out of Scope

- Interactive reprioritization or reordering workflows
- Automatic priority renumbering
- Automatic archiving on issue completion
- New storage backends or caching layers
- Changes to milestone or priority creation semantics
- Batch-specific archive workflows beyond preserving existing behavior
- Archive restore/unarchive functionality
- Archive reason capture unless it falls out trivially from implementation

## Open Questions

None.
