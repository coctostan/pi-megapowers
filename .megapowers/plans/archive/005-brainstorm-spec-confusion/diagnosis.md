## Root Cause

The `message` event handler in `index.ts` unconditionally calls `ui.handlePhaseTransition()` after every agent message, as long as valid transitions exist from the current phase. There is no concept of "open-ended phases" vs "gate-driven phases".

Certain phases are **exploratory** by nature — brainstorm, reproduce, and diagnose are meant for iterative conversation. The agent and user go back and forth refining ideas. Offering a phase transition after every single message breaks this flow.

Other phases are **gate-driven** — once an artifact is produced (spec.md, plan.md, etc.), the transition prompt makes sense because there's a natural stopping point.

### Analysis

The fix should distinguish between these two phase types:

**Open-ended phases** (suppress automatic transition prompts):
- `brainstorm` — user is exploring ideas
- `reproduce` — user is investigating the bug
- `diagnose` — user is analyzing root cause

**Gate-driven phases** (auto-prompt is appropriate):
- `spec` → plan (gated by spec.md existing)
- `plan` → review/implement (gated by plan.md existing)
- `review` → implement (gated by review approval)
- `implement` → verify (gated by all tasks done)
- `verify` → code-review/done
- `code-review` → done

For open-ended phases, transitions should only happen via explicit user action (`/phase next`).

## Fixed When

1. Brainstorm phase does NOT prompt for transition after every message
2. Reproduce and diagnose phases do NOT prompt for transition after every message
3. `/phase next` still works to manually trigger transition from any phase
4. Gate-driven phases (spec, plan, review, implement, verify, code-review) still auto-prompt
