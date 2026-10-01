# Historical Feature: Clean Context Windows (#080)

> Superseded by #130 for session handling. This document records historical intent, not the current session API contract.

#080 aimed to give each phase/task a focused context window. Its implementation called the underlying session manager's newSession() during model-tool execution. That reset changed storage without replacing the agent runtime and split persisted tool calls from their results. Pi's canonical session projection exposed the resulting invalid provider history.

Current policy after #130:
- Megapowers transition tools preserve the current Pi session and its transcript.
- They continue to update workflow state, gates, task completion, and plan-review artifacts.
- Fresh sessions are user-initiated with Pi's /new command between runs, not automatic side effects of workflow tools.
- Workflow state and artifacts remain on disk; the next agent start builds context from that current state.
- Context injection occurs at agent start, not before every follow-up provider request inside an already-running tool loop.
- No raw/read-only session-manager mutation, command-only session API invoked from a tool, or deferred-reset workaround is supported.

The historical done-phase/close_issue cleanup shipped with #080 remains separate from this session-compatibility correction. TypeScript casts do not fail at runtime or make mutating a read-only API safe.
