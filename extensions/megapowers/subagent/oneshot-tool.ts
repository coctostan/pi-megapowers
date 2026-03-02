import type { Dispatcher } from "./dispatcher.js";
import { readState } from "../state/state-io.js";
import {
  createPipelineWorkspace,
  squashPipelineWorkspace,
  cleanupPipelineWorkspace,
  type ExecGit,
} from "./pipeline-workspace.js";
import { parseStepResult } from "./pipeline-results.js";

export interface OneshotToolInput {
  task: string;
  agent?: string;
  timeoutMs?: number;
}

export interface OneshotToolOutput {
  id: string;
  output?: string;
  filesChanged?: string[];
  error?: string;
}

export async function handleOneshotTool(
  projectRoot: string,
  input: OneshotToolInput,
  dispatcher: Dispatcher,
  execGit: ExecGit,
): Promise<OneshotToolOutput> {
  const state = readState(projectRoot);
  if (!state.megaEnabled) return { id: "", error: "Megapowers is disabled." };

  const id = `oneshot-${Date.now()}`;

  const ws = await createPipelineWorkspace(projectRoot, id, execGit);
  if ((ws as any).error) return { id, error: `Workspace creation failed: ${(ws as any).error}` };

  const dispatch = await dispatcher.dispatch({
    agent: input.agent ?? "worker",
    task: input.task,
    cwd: ws.workspacePath,
    timeoutMs: input.timeoutMs,
  });

  const parsed = parseStepResult(dispatch);

  let workspaceError: string | undefined;

  if (dispatch.exitCode === 0) {
    const squash = await squashPipelineWorkspace(projectRoot, id, execGit);
    if ((squash as any).error) workspaceError = `Squash failed: ${(squash as any).error}`;
  } else {
    const cleanup = await cleanupPipelineWorkspace(projectRoot, id, execGit);
    if ((cleanup as any).error) workspaceError = `Cleanup failed: ${(cleanup as any).error}`;
  }

  return {
    id,
    output: parsed.finalOutput || undefined,
    filesChanged: parsed.filesChanged.length ? parsed.filesChanged : undefined,
    error: workspaceError ?? (dispatch.exitCode === 0 ? undefined : dispatch.error ?? parsed.error),
  };
}
