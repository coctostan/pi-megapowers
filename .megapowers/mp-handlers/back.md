# Back Handler

Request a backward phase transition.

## Parse Arguments

```
back                → go back one phase
back <phase>        → go back to specific phase
back implement      → common: verify failed, need to fix code
back plan           → common: review found design issue
```

## Legal Backward Transitions

| From | To | When |
|------|----|------|
| review | plan | Review found structural issues with the plan |
| verify | implement | Verification failed, need code changes |
| code-review | implement | Code review found implementation issues |

Any other backward transition is illegal. Explain why.

## Execution

1. Read `.megapowers/state.json` to get current phase.
2. Determine target phase (explicit or one-step-back).
3. Validate the transition is legal.
4. **Ask for a reason.** Always. This is part of the decision provenance chain. Example: "Why go back? (e.g., 'verify found edge case in auth flow not covered by tests')"
5. **Attempt the transition:**
   - If `megapowers_signal` supports a `phase_goto` or `phase_back` action: use it.
   - If NOT yet implemented (current state — #069 is open): be honest:
     ```
     Backward transitions aren't wired in the state machine yet (#069).
     Workarounds:
     1. Edit .megapowers/state.json manually — set "phase": "<target>"
     2. Use /mega off, do the work, /mega on
     I'll record that you needed this — it's evidence for prioritizing #069.
     ```
6. **Log the backward transition** — append to `.megapowers/learnings.md`:
   ```
   ### <timestamp> — Backward transition: <from> → <to>
   Reason: <user's reason>
   Issue: #NNN
   ```
