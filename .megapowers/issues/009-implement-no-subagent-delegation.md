---
id: 9
type: bugfix
status: open
created: 2026-02-22T17:00:00.000Z
---

# Implement phase doesn't use subagents for task execution

The implement phase prompt mentions subagent delegation as an option, but the LLM never actually delegates tasks to subagents. It always works inline. This defeats the purpose of parallel task execution and makes the implement phase slower than necessary.

Need to either: make the prompt more explicit about when/how to delegate, or auto-delegate tasks that have no dependencies on each other.
