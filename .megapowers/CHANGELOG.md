

## 2026-02-22 — Done-phase action feedback

- Selecting an action from the done-phase menu (e.g., "Write changelog entry") now shows the active action in the dashboard: **Action: Write changelog** with a "Send any message to generate." instruction
- The status bar now reflects the active action: `📋 #014 done → Write changelog` instead of just `📋 #014 done`
- Previously, selecting an action showed no persistent feedback — only a transient notification that was easy to miss, leaving users at a blank prompt unsure what happened


## 2026-02-22 — Phase transition guidance

- After transitioning to a new phase, the notification now includes actionable guidance (e.g., "Transitioned to: spec. Send a message to write the spec.") instead of just the phase name
- The dashboard shows a persistent instruction line for every phase, so you always know what to do next — no more blank prompt with zero context
- Phases that already had detailed dashboard content (implement tasks, done-phase actions) are unaffected
