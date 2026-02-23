Fixed. This is the **session_shutdown overwrite bug (issue 004)** hitting repeatedly — each time a new session starts, the extension loads stale state from `state.json` (which says the issue is active), and on shutdown it writes that stale state back, undoing the fix. 

The issue file `026-triage-llm-driven-batching.md` already has `status: done`. The state.json is now cleared (no active issue). 

**To prevent this from recurring**: the state-recovery logic in the extension needs to check the issue file's status on startup — if the issue is `done` in the file but `active` in state.json, it should clear the state rather than trust state.json. That's the root cause described in AGENTS.md issue 004.