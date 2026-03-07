## Task 3: Add shipment audit for tracked, untracked, and ignored files

The current `DENYLIST` plan matches against the full porcelain path:

```ts
if (DENYLIST.some((pattern) => pattern.test(parsed.path))) blockedUntracked.push(parsed.path);
```

That misses suspicious files outside the repo root, e.g. `apps/web/.env.local` or `tmp/.DS_Store`, because the current regexes are anchored like `^\.env(?:\..+)?$`.

Use a nested-path fixture in Step 1 so the task proves the real behavior:

```ts
stdout: [
  " M extensions/megapowers/commands.ts",
  "?? extensions/megapowers/vcs/shipping.ts",
  "?? apps/web/.env.local",
  "!! coverage/index.html",
].join("\n"),
```

and update the expectation to:

```ts
expect(result).toEqual({
  tracked: ["extensions/megapowers/commands.ts"],
  includedUntracked: ["extensions/megapowers/vcs/shipping.ts"],
  ignoredUntracked: ["coverage/index.html"],
  blockedUntracked: ["apps/web/.env.local"],
});
```

Then implement denylist matching on the basename, not the full path:

```ts
const DENYLIST: RegExp[] = [
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /^npm-debug\.log$/,
  /^yarn-error\.log$/,
  /^\.env(?:\..+)?$/,
];

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

if (parsed.code === "??") {
  const name = basename(parsed.path);
  if (DENYLIST.some((pattern) => pattern.test(name))) blockedUntracked.push(parsed.path);
  else includedUntracked.push(parsed.path);
  continue;
}
```

Also add an explicit `**Covers:**` line. This task is the audit-classification prerequisite for AC7/AC8/AC9, not AC6.

## Task 15: Extend VCS coverage with a real-git lifecycle regression

This task is still too broad for one RED/GREEN cycle. It currently tries to prove activation, switch-away, finalization, squash, push, and PR creation in a single integration test, but those seams already have dedicated unit coverage in:

- `tests/vcs-commands.test.ts`
- `tests/vcs-base-branch-activation.test.ts`
- `tests/shipping.test.ts`
- `tests/branch-manager.test.ts`
- `tests/pr-creator.test.ts`

Narrow Task 15 to the integration-specific behavior the unit tests cannot prove: **a real git repo ends up with one clean shipped commit on the remote after finalization + squash + push**.

Rewrite Step 1 so it sets up the feature branch directly and focuses on shipping behavior:

```ts
it("ships one clean remote commit in a real git repo", async () => {
  runGit("git checkout -b feat/002-second", tmp);

  writeFileSync(join(tmp, "tracked.ts"), "export const tracked = 1;\n");
  runGit("git add tracked.ts", tmp);
  runGit('git commit -m "WIP: local"', tmp);

  writeFileSync(join(tmp, "tracked.ts"), "export const tracked = 2;\n");
  writeFileSync(join(tmp, "new-file.ts"), "export const second = 2;\n");

  const execGit: ExecGit = async (args) => {
    const result = spawnSync("git", args, { cwd: tmp, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error((result.stderr || "").trim() || `git ${args[0]} failed`);
    }
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  };

  const execCmd: ExecCmd = async (_cmd, args) => {
    if (args[0] === "--version") return { stdout: "gh version 2.0.0\n", stderr: "" };
    if (args[0] === "pr") return { stdout: "https://github.com/org/repo/pull/42\n", stderr: "" };
    throw new Error(`unexpected gh args: ${args.join(" ")}`);
  };

  const result = await shipAndCreatePR({
    execGit,
    execCmd,
    issueSlug: "002-second",
    branchName: "feat/002-second",
    baseBranch: "main",
    commitMessage: "feat: ship 002-second",
    prTitle: "Ship 002-second",
    prBody: "Resolves 002-second",
  });

  expect(runGit("git rev-list --count main..feat/002-second", tmp).trim()).toBe("1");
  const remoteBranchLog = runGit(`git --git-dir=${remote} log refs/heads/feat/002-second --oneline`, tmp);
  expect(remoteBranchLog).toContain("feat: ship 002-second");
  expect(remoteBranchLog).not.toContain("chore: finalize 002-second");
  expect(remoteBranchLog).not.toContain("WIP: local");
  expect(result).toEqual({ ok: true, finalized: true, pushed: true, pr: { ok: true, url: "https://github.com/org/repo/pull/42" } });
});
```

That makes Step 2 concrete. The expected failure should be something like:

`Expected: FAIL — remote history still contains "WIP: local" or "chore: finalize 002-second" until squash-before-push is wired correctly.`

Also add an explicit `**Covers:** AC18` line.

## Task 17: Add regression for non-main base validation short-circuit

As written, this task is redundant after its own dependencies. Task 16 already captures a non-main `baseBranch`, and Task 9 already makes `validateShipTarget(request.branchName, request.baseBranch)` the first guard. That means this new test should already pass immediately after Tasks 9 and 16, so Step 2 cannot honestly be a RED step.

Do **not** keep this as a standalone post-implementation TDD task.

Use one of these two fixes:

1. **Preferred:** merge the non-main-base regression into Task 9 and delete Task 17.
   - Keep Task 16 as the activation-side proof that `baseBranch: "release/2026.03"` is persisted.
   - In Task 9 Step 1, add a second validate-short-circuit case using the captured non-main base:

```ts
const result = await shipAndCreatePR({
  execGit,
  execCmd,
  issueSlug: "093-vcs-lifecycle-audit-clean-commit-strateg",
  branchName: "release/2026.03",
  baseBranch: "release/2026.03",
  commitMessage: "feat: ship 093-vcs-lifecycle-audit-clean-commit-strateg",
  prTitle: "Ship 093-vcs-lifecycle-audit-clean-commit-strateg",
  prBody: "Resolves 093-vcs-lifecycle-audit-clean-commit-strateg",
});

expect(result).toEqual({
  ok: false,
  step: "validate",
  error: "Cannot ship: branchName must differ from baseBranch (release/2026.03).",
  pushed: false,
});
expect(gitCalls).toEqual([]);
expect(ghCalled).toBe(false);
```

2. **If you keep Task 17:** change it into a documentation/coverage-mapping task instead of a fake RED/GREEN task. It should not claim a failing Step 2 when the behavior already exists.

Do not leave the current five-step TDD shape in place for Task 17 unless the task is retargeted to a behavior that is genuinely unimplemented before its Step 3.
