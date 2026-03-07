import { readState } from "../state/state-io.js";
import { shipAndCreatePR } from "./shipping.js";

export function buildShipRequest(state: { activeIssue: string | null; branchName: string | null; baseBranch: string | null }) {
  return {
    issueSlug: state.activeIssue ?? "",
    branchName: state.branchName,
    baseBranch: state.baseBranch,
    commitMessage: `feat: ship ${state.activeIssue ?? "issue"}`,
    prTitle: `Ship ${state.activeIssue ?? "issue"}`,
    prBody: `Resolves ${state.activeIssue ?? "issue"}`,
  };
}

export async function runShipCli(
  state: { activeIssue: string | null; branchName: string | null; baseBranch: string | null },
  deps: {
    execGit: (args: string[]) => Promise<{ stdout: string; stderr: string }>;
    execCmd: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
    ship: (request: Parameters<typeof shipAndCreatePR>[0]) => ReturnType<typeof shipAndCreatePR>;
    log: (line: string) => void;
  },
) {
  const result = await deps.ship({
    execGit: deps.execGit,
    execCmd: deps.execCmd,
    ...buildShipRequest(state),
  });
  deps.log(JSON.stringify(result, null, 2));
  return result;
}

if (import.meta.main) {
  const state = readState(process.cwd());
  const execGit = async (args: string[]) => {
    const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error(stderr.trim() || `git ${args[0]} failed`);
    return { stdout, stderr };
  };
  const execCmd = async (cmd: string, args: string[]) => {
    const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) throw new Error(stderr.trim() || `${cmd} ${args[0]} failed`);
    return { stdout, stderr };
  };

  await runShipCli(state, {
    execGit,
    execCmd,
    ship: shipAndCreatePR,
    log: (line) => console.log(line),
  });
}
