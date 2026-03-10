## Task 1: Truncate all issue-list widget renderer output to terminal width

Add an explicit `**Covers:**` line immediately under the task heading so the implementation task is traceable to the diagnosis "Fixed When" criteria. Right now the task content addresses the bug, but it never states which acceptance criteria it covers.

Use a line like this:

```md
**Covers:** Fixed When 1 (list/detail/action-menu screens honor render width), Fixed When 2 (no emitted line exceeds terminal width for long titles/descriptions/batch slugs), Fixed When 3 (regression test measures rendered line width directly).
```

Keep the rest of the task as-is unless you also want to make the traceability even clearer by adding a short sentence in Step 1 that the regression test covers all three custom-widget screens.
