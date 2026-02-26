# New Issue Handler

Create an issue conversationally. Goal: zero-to-working in 30 seconds.

## Parse Arguments

Everything after `new` is the description. Examples:
- `/mp new add dark mode toggle to settings page`
- `/mp new users can't log in when password has special characters`
- `/mp new refactor the auth module to use JWT`

## Execution

1. **Classify**: Is this a `feature` or `bugfix`? Infer from description. If ambiguous, ask (one question max).
2. **Generate slug**: lowercase, hyphens, ≤40 chars. From the description.
3. **Get next ID**: Read `.megapowers/issues/`, find highest existing number, add 1. If no issues exist, start at 1.
4. **Write the issue file** to `.megapowers/issues/<NNN>-<slug>.md`:

```markdown
---
id: <NNN>
title: <clean title>
type: <feature|bugfix>
status: open
created: <YYYY-MM-DD>
---

# <Title>

<2-3 sentences expanding on the user's description>

## Context
<Any relevant context inferred or from conversation>

## Acceptance Criteria
- [ ] <derived from description — keep it concrete and testable>
```

5. **Report**: "Issue #NNN created: `<slug>`. Start now with `/issue <slug>`, or come back later."
6. **Ask**: "Want to start working on this now?"

## Rules

- **One question maximum.** Infer everything else. Speed over precision.
- **Don't over-specify.** The brainstorm/spec phases will flesh things out. The issue is a starting point, not a contract.
- **Acceptance criteria should be testable** — "user can X" not "improve X."
