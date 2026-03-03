---
id: 6
title: Fallback vars.revise_instructions to empty string when file is missing (AC2)
status: approved
depends_on:
  - 4
no_test: false
files_to_modify:
  - extensions/megapowers/prompt-inject.ts
  - tests/prompt-inject.test.ts
files_to_create: []
---

### Task 6: Fallback vars.revise_instructions to empty string when file is missing (AC2) [depends: 4]

**Covers:**
- AC2 — When `planMode` is `"revise"` and the revise-instructions file does not exist, `vars.revise_instructions` is set to empty string (so the template token is replaced with "" rather than left as literal `{{revise_instructions}}`)

**Files:**
- Modify: `extensions/megapowers/prompt-inject.ts`
- Test: `tests/prompt-inject.test.ts`

**Step 1 — Write the failing test**

Add to the `"buildInjectedPrompt — plan phase variable injection"` describe block in `tests/prompt-inject.test.ts`:

```typescript
  it("sets revise_instructions to empty string when file is missing in revise mode (AC2)", () => {
    setState(tmp, { phase: "plan", planMode: "revise", planIteration: 2, megaEnabled: true });
    const store = createStore(tmp);
    // No revise-instructions-1.md written — file is missing
    const result = buildInjectedPrompt(tmp, store);
    expect(result).not.toBeNull();
    // Token must be replaced (not left as literal template variable)
    expect(result).not.toContain("{{revise_instructions}}");
    // Both surrounding headings should still be present
    expect(result).toContain("## Reviewer's Instructions");
    expect(result).toContain("## Quality Bar");
  });
```

**Step 2 — Run test, verify it fails**

Run: `bun test tests/prompt-inject.test.ts --filter "sets revise_instructions to empty string"`

Expected: FAIL —
```
expect(received).not.toContain(expected)
Expected substring not to be found: "{{revise_instructions}}"
Received: "...{{revise_instructions}}..."
```
(After Task 4's implementation, `vars.revise_instructions` is only set when `content !== null`. When the file is missing, `content` is `null` and the key is never added to `vars`, leaving the token unreplaced.)

**Step 3 — Write minimal implementation**

In `extensions/megapowers/prompt-inject.ts`, update the revise block added in Task 4. Change:

```typescript
    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      if (content !== null) {
        vars.revise_instructions = content;
      }
      // AC2 empty-string fallback is added in Task 6
    }
```

To:

```typescript
    if (state.planMode === "revise" && store) {
      const filename = `revise-instructions-${state.planIteration - 1}.md`;
      const content = store.readPlanFile(state.activeIssue!, filename);
      vars.revise_instructions = content ?? "";
    }
```

The `?? ""` ensures the template token `{{revise_instructions}}` is always replaced — with the file's content when it exists, or with an empty string when it does not.

**Step 4 — Run test, verify it passes**

Run: `bun test tests/prompt-inject.test.ts --filter "sets revise_instructions to empty string"`

Expected: PASS

**Step 5 — Verify no regressions**

Run: `bun test`

Expected: all passing
