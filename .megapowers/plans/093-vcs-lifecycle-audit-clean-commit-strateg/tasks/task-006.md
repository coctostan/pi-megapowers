---
id: 6
title: Commit allowed dirty work during shipment finalization
status: approved
depends_on:
  - 3
  - 4
  - 5
no_test: false
files_to_modify:
  - extensions/megapowers/vcs/shipping.ts
  - tests/shipping.test.ts
files_to_create: []
---

### Task 6: Commit allowed dirty work during shipment finalization [depends: 3, 4, 5]

**Files:**
- Modify: `extensions/megapowers/vcs/shipping.ts`
- Test: `tests/shipping.test.ts`

**Step 1 — Write the failing test**
Append this test to `tests/shipping.test.ts`:

```ts
it("runs the audit status first, then stages tracked and untracked files, then re-checks status before committing", async () => {
  const calls: string[][] = [];
  const execGit: ExecGit = async (args) => {
    calls.push(args);
    if (args.join(" ") === "status --porcelain --untracked-files=all --ignored") {
      return {
        stdout: [
          " M extensions/megapowers/commands.ts",
          "?? extensions/megapowers/vcs/shipping.ts",
          "!! coverage/index.html",
        ].join("\n"),
        stderr: "",
      };
    }
    if (args.join(" ") === "status --porcelain") {
      return {
        stdout: [
          "M  extensions/megapowers/commands.ts",
          "A  extensions/megapowers/vcs/shipping.ts",
        ].join("\n"),
        stderr: "",
      };
    }
    return { stdout: "", stderr: "" };
  };

  const result = await finalizeShipment(execGit, "093-vcs-lifecycle-audit-clean-commit-strateg");

  expect(result).toEqual({
    ok: true,
    committed: true,
    audit: {
      tracked: ["extensions/megapowers/commands.ts"],
      includedUntracked: ["extensions/megapowers/vcs/shipping.ts"],
      ignoredUntracked: ["coverage/index.html"],
      blockedUntracked: [],
    },
  });

  expect(calls[0]).toEqual(["status", "--porcelain", "--untracked-files=all", "--ignored"]);
  expect(calls).toContainEqual(["add", "-u"]);
  const untrackedAdds = calls.filter((c) => c[0] === "add" && c[1] === "--");
  expect(untrackedAdds).toEqual([["add", "--", "extensions/megapowers/vcs/shipping.ts"]]);
  expect(calls).toContainEqual(["status", "--porcelain"]);
  expect(calls).toContainEqual(["commit", "-m", "chore: finalize 093-vcs-lifecycle-audit-clean-commit-strateg"]);

});
```
This mock intentionally differentiates the two status phases (`--ignored` audit vs post-stage plain porcelain) so the test proves the second status check occurs before commit.
The second mock status output uses staged porcelain codes (`M  ...`, `A  ...`), explicitly proving tracked modifications were staged into the commit candidate before `commit` runs.
The first audit snapshot intentionally uses unstaged form (` M ...`) to represent pre-finalization dirty state; the second snapshot uses staged form (`M  ...`) to prove stage/recheck sequencing.

**Step 2 — Run test, verify it fails**
Run: `bun test tests/shipping.test.ts -t "runs the audit status first, then stages tracked and untracked files, then re-checks status before committing"`
Expected: FAIL — `expect(received).toEqual(expected)` showing missing `add`/`commit` calls because Task 4 currently returns early on dirty trees.

**Step 3 — Write minimal implementation**
`audit.includedUntracked` is already filtered by Task 3 classification and Task 4 blocked-file rejection; this task stages only the pre-approved untracked set.
Retain Task 4’s blocked-file guard unchanged:

```ts
if (audit.blockedUntracked.length > 0) {
  return {
    ok: false,
    error: `Blocked suspicious untracked files: ${audit.blockedUntracked.join(", ")}`,
    blockedFiles: audit.blockedUntracked,
  };
}
```
Keep Task 4’s initial `const audit = await auditShipment(execGit);` call and reuse that same `audit` result for staging; this task adds only the stage/recheck/commit path.
Update the dirty-tree path in `finalizeShipment()` inside `extensions/megapowers/vcs/shipping.ts`:
`ExecGit` in this codebase throws on non-zero exit; therefore `await execGit(["commit", ...])` is the success check. If it returns, commit succeeded and `committed: true` is valid.

```ts
const hasTracked = audit.tracked.length > 0;
const hasIncludedUntracked = audit.includedUntracked.length > 0;
if (!hasTracked && !hasIncludedUntracked) {
  return { ok: true, committed: false, audit };
}

await execGit(["add", "-u"]);
for (const path of audit.includedUntracked) {
  await execGit(["add", "--", path]);
}

const status = await execGit(["status", "--porcelain"]);
if (!status.stdout.trim()) {
  return { ok: true, committed: false, audit };
}

await execGit(["commit", "-m", `chore: finalize ${issueSlug}`]);
return { ok: true, committed: true, audit };
`chore: finalize ${issueSlug}` is intentionally an intermediate local finalization commit. Task 9/15 squash-and-push rewrites branch history into the final shipped `feat: ship ...` commit.
```

**Step 4 — Run test, verify it passes**
Run: `bun test tests/shipping.test.ts -t "runs the audit status first, then stages tracked and untracked files, then re-checks status before committing"`
Expected: PASS

**Step 5 — Verify no regressions**
Run: `bun test`
Expected: all passing
