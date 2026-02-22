---
id: 13
type: bugfix
status: open
created: 2026-02-22T17:06:00.000Z
---

# /mega command does nothing

Running `/mega` produces no visible output. The command is registered and doesn't error, but the dashboard doesn't render. Either `renderDashboard` is silently failing, the UI context isn't available, or the `ctx.hasUI` check is blocking rendering in interactive mode.
