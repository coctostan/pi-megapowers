# Plan Review: 060-subagent-robustness

Scope: quick sanity check (coverage / ordering / completeness). Not a deep audit.

## Verdict: **pass** (with a few small, non-blocking suggestions)

The plan is implementable as-written, tasks are well-scoped, and every acceptance criterion is addressed by at least one task.

---

## 1) Coverage (AC ↔ tasks)

✅ **No gaps found**. The AC coverage matrix at the end of the plan correctly maps each AC to one or more tasks.

Notes (non-blocking):
- **AC3 (no warning when ready)** is logically covered by Task 3’s `if (jjStatus === ...)` branching, and Task 1 tests the `"ready"` result for the pure function. However, there is **no explicit test that session_start emits *no* notify when status is `ready`**. Consider adding one small source-level invariant test (see suggestions below).

---

## 2) Ordering / dependencies

✅ Dependencies are respected and the sequence is coherent:

- **Task 1 → Task 3**: extracting `checkJJAvailability()` first makes Task 3 wiring clean and testable.
- **Task 2 → Tasks 3 & 4**: centralizing messages before wiring session_start + dispatch is correct.
- **Tasks 5–7 → Task 8**: prompt rewrites precede the “distinct model+thinking combos” verification.
- **Task 9** comes after prompt quality work, and correctly updates the prompt builder + dispatch.
- **Task 10** is a verification-only safety net and can remain last.

No ordering issues flagged.

---

## 3) Completeness / executability

✅ Tasks are mostly self-contained, with concrete file paths and code snippets.

Specific checks:

### Task 1 (pure function in `jj.ts`)
- The proposed `ExecResult` shape matches what `pi.exec()` returns in this repo (`{ code, stdout, stderr }`), so the function signature is compatible.

### Task 2 (new `jj-messages.ts`)
- Message content meets **AC1/AC2** requirements (brew + cargo; `jj git init --colocate`).

### Task 3 (session_start wiring)
- The insertion point (“before renderDashboard”) aligns with **AC4** (informational only).
- The plan correctly guards UI calls with `ctx.hasUI`.

Non-blocking suggestion:
- Add a small invariant test for **AC3** (no notify for `ready`). Because you’re doing source-level checks in `tests/index-integration.test.ts`, an easy pattern is to assert there’s **no** `ctx.ui.notify(` call inside a `jjStatus === "ready"` branch (or simply ensure only the two explicit branches exist).

### Task 4 (dispatch error message)
- Good: updates the test to enforce actionable install/setup guidance (**AC5**).

Minor wording suggestion (non-blocking):
- `jjDispatchErrorMessage()` currently always includes “This does not appear to be a jj repository.” Even when jj is not installed, that’s slightly inaccurate. It’s still actionable and meets AC5, but you could soften it (e.g., “jj is not available (not installed or not initialized for this repo) …”).

### Tasks 5–7 (agent prompt expansion)
- Concrete, testable definition of “3+ paragraphs” and coverage requirements (task approach / TDD / signaling, etc.) matches **AC6–AC8**.
- Frontmatter values are already distinct across agents, and the rewrites keep them distinct.

### Task 9 (phase + spec/diagnosis injection)
- Correctly extends both `SubagentPromptInput` and the call site in `subagent-tools.ts`.
- Correctly chooses `diagnosis.md` for bugfix workflow and `spec.md` for feature workflow (AC10).

### Task 10 (agent resolution priority unchanged)
- Good regression test that directly reflects **AC12**.

---

## Suggested small tweaks (optional / non-blocking)

1) **Add explicit AC3 regression** in `tests/index-integration.test.ts`:
   - Confirm there’s no `ctx.ui.notify(...)` for the `ready` case.

2) **Slightly generalize the dispatch error wording** to cover both “not installed” and “not a repo” without implying one specific cause.

---

## Confirmation

If you agree with the “pass” verdict, I will:
1) approve the plan (`megapowers_signal: review_approve`), then
2) advance to implementation (`megapowers_signal: phase_next`).

Reply with **“approve and advance”** to proceed, or tell me what you want changed before approval.
