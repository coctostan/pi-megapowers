# Session compatibility verification

Megapowers transition tools must preserve the current Pi session. These checks are for #130 and later compatibility updates. Run from the pi-megapowers repository root with Bun. All workflow fixtures and session files below are temporary and removed in finally; never point the fixture cwd at a real project.

## Automated regressions

Run `bun test`. The persistence tests cover phase/task transitions, review verdicts, errors, non-transition signals, sibling result orders, nested outer-call pairing, and updated context at the next agent start.

## Installed-host offline check

Set PI_SESSION_MANAGER_MODULE to the installed Pi dist/core/session-manager.js. On the reproduction machine this is /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js. This check invokes the actual registered tool against the real manager and projects canonical context, without provider access.

Copy the following complete command into a Bun-capable shell from the repository root:

```sh
PI_SESSION_MANAGER_MODULE=/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js bun -e '
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { registerTools } from "./extensions/megapowers/register-tools.ts";
import { createInitialState } from "./extensions/megapowers/state/state-machine.ts";
import { writeState, readState } from "./extensions/megapowers/state/state-io.ts";

const cwd = mkdtempSync(join(tmpdir(), "megapowers-compatibility-"));
try {
  writeState(cwd, { ...createInitialState(), activeIssue: "001-smoke", workflow: "feature", phase: "brainstorm" });
  mkdirSync(join(cwd, ".megapowers", "issues"), { recursive: true });
  writeFileSync(join(cwd, ".megapowers", "issues", "001-smoke.md"),
    "---\nid: 1\ntype: feature\nstatus: in-progress\ncreated: 2026-01-01T00:00:00.000Z\n---\n# Smoke\nDisposable fixture");
  let transcripts: any[][];
  let sessionIdChanged = false;
  if (process.env.MEGA_SMOKE_MODEL) {
    const sessions = join(cwd, "sessions");
    const args = ["--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files",
      "--extension", resolve("extensions/megapowers/index.ts"),
      "--session-dir", sessions, "--tools", "read,megapowers_signal",
      "--model", process.env.MEGA_SMOKE_MODEL, "--print"];
    if (process.env.MEGA_SMOKE_PROVIDER_EXTENSION) {
      args.push("--extension", process.env.MEGA_SMOKE_PROVIDER_EXTENSION);
    }
    args.push("Call megapowers_signal with action phase_next exactly once. After receiving its result, call read on .megapowers/issues/001-smoke.md. Do not call any other transition. Finally reply SESSION_SMOKE_OK.");
    const run = spawnSync("pi", args, { cwd, encoding: "utf8", timeout: 90000 });
    if (run.error || run.status !== 0) throw new Error(JSON.stringify({ status: run.status, error: String(run.error ?? ""), stderr: run.stderr }));
    const files = readdirSync(sessions).filter(f => f.endsWith(".jsonl"));
    sessionIdChanged = files.length !== 1;
    transcripts = files.map(f => readFileSync(join(sessions, f), "utf8").trim().split("\n")
      .map(line => JSON.parse(line)).filter(e => e.type === "message").map(e => e.message));
    const results = transcripts.flat().filter(m => m.role === "toolResult");
    if (results.filter(m => m.toolName === "megapowers_signal").length !== 1 ||
        !results.some(m => m.toolName === "read") || !run.stdout.includes("SESSION_SMOKE_OK")) {
      throw new Error("Live smoke did not complete the requested transition and follow-up read");
    }
  } else {
    const modulePath = process.env.PI_SESSION_MANAGER_MODULE;
    if (!modulePath) throw new Error("Set PI_SESSION_MANAGER_MODULE to the installed Pi dist/core/session-manager.js");
    const { SessionManager } = await import(pathToFileURL(modulePath).href);
    const manager = SessionManager.inMemory(cwd);
    const oldId = manager.getSessionId();
    const id = "call_compatibility_smoke";
    manager.appendMessage({ role: "user", content: "Continue", timestamp: 0 });
    manager.appendMessage({ role: "assistant",
      content: [{ type: "toolCall", id, name: "megapowers_signal", arguments: { action: "phase_next" } }],
      api: "openai-responses", provider: "openai", model: "offline", stopReason: "toolUse", timestamp: 1,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
    const tools: Record<string, any> = {};
    registerTools({ registerTool: (tool: any) => { tools[tool.name] = tool; },
      exec: async () => ({ code: 1, stdout: "", stderr: "" }) } as any, {});
    const result = await tools.megapowers_signal.execute(id, { action: "phase_next" }, undefined, undefined,
      { cwd, hasUI: false, sessionManager: manager });
    manager.appendMessage({ role: "toolResult", toolCallId: id, toolName: "megapowers_signal",
      content: result.content, isError: false, timestamp: 2 });
    sessionIdChanged = manager.getSessionId() !== oldId;
    transcripts = [manager.buildSessionProjection().messages];
  }
  const orphaned = transcripts.flatMap(messages => {
    const calls = new Set(messages.filter(m => m.role === "assistant")
      .flatMap(m => m.content.filter((c: any) => c.type === "toolCall").map((c: any) => c.id)));
    return messages.filter(m => m.role === "toolResult" && !calls.has(m.toolCallId)).map(m => m.toolCallId);
  });
  const errors = transcripts.flat().filter(m => m.role === "assistant" && m.stopReason === "error")
    .map(m => m.errorMessage);
  const report = { mode: process.env.MEGA_SMOKE_MODEL ?? "offline", phase: readState(cwd).phase,
    sessionIdChanged, orphaned, errors };
  console.log(JSON.stringify(report));
  if (report.phase !== "spec" || sessionIdChanged || orphaned.length || errors.length) {
    throw new Error("Session compatibility smoke failed");
  }
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
'
```

Expected offline output: phase spec, sessionIdChanged false, orphaned [], errors []. An external module path unavailable on another machine is an environment limitation, not a passing smoke. Use that machine's installed module path rather than adding Pi to the repo's pure unit-test dependencies.

## Optional live provider checks

The SAME command supports live mode when MEGA_SMOKE_MODEL is set to an actual available provider/model ID. Choose IDs using `pi --list-models`; do not print credentials or use credential-export commands.

Run once with an available OpenAI/OpenAI Codex model and once with an available Anthropic model. If a model's provider comes from an extension rather than built-in Pi, also set MEGA_SMOKE_PROVIDER_EXTENSION to that provider extension's absolute entry point. It is explicitly loaded into an otherwise extension-isolated child process. The user's anthropic-cc provider may require this.

In live mode the command starts a fresh Pi process in its disposable cwd, explicitly loads the corrected extension, requests one gated phase advance followed by a read tool and a final reply, then verifies each persisted session's call/result pairs. Live mode does not use PI_SESSION_MANAGER_MODULE. If run through an agent harness, use its process manager for the potentially long provider checks rather than a shell background job.

Expected live output: selected model ID, phase spec, sessionIdChanged false, orphaned [], errors [], with no tool-call pairing rejection. Each run uses a new temporary fixture; it never repeats task completion in a real project.

Record Bun/Pi versions, model/provider IDs, command result, and the JSON report in the issue's verify.md. Treat unavailable credentials, provider-extension setup, quota, transport errors, or timeout as explicit limitations/failures, not live-provider PASS. Unit/real-manager checks alone do not establish a live Anthropic result.

## Reload and historical-session cautions

After changing local extension source, reload Pi before issuing ANY live Megapowers transition. In this self-hosted issue, do not call task_done through the old loaded runtime after Task 1: ask the user to run /reload first. Verify the signal/review tool descriptions match the corrected session-preserving policy; use /new once if the current transcript is already corrupted.

This fix does not repair historical orphaned transcripts or implement an automatic fresh-context handoff. User-initiated /new between runs remains the supported way to start a clean session; workflow artifacts/state persist separately.
