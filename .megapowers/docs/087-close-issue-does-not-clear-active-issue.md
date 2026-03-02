Verification is complete.

- Full suite run fresh: `bun test --dots` → **679 pass, 0 fail, exit 0**
- Bug reproduction re-run from diagnosis (close-issue flow + short-text queue case) → original stuck-active-issue symptom **did not reproduce**
- Targeted regression run: `bun test tests/hooks-close-issue.test.ts` → **6 pass, 0 fail, exit 0**

I saved the full report to:

- `.megapowers/plans/087-close-issue-does-not-clear-active-issue/verify.md`

Then I advanced workflow state with:

- `megapowers_signal({ action: "phase_next" })` → phase advanced to **done**.