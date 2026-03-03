/** Injected command executor — throws on non-zero exit. */
export type ExecCmd = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export type PRResult =
  | { ok: true; url: string }
  | { ok: false; error: string }
  | { skipped: true; reason: string };

/**
 * AC11, AC12: Create a GitHub PR via `gh` CLI.
 * Checks gh availability first; returns skipped if not installed.
 */
export async function createPR(
  execCmd: ExecCmd,
  branchName: string,
  title: string,
  body: string,
): Promise<PRResult> {
  try {
    await execCmd("gh", ["--version"]);
  } catch {
    return { skipped: true, reason: "gh CLI not installed" };
  }

  try {
    const result = await execCmd("gh", [
      "pr",
      "create",
      "--title",
      title,
      "--body",
      body,
      "--head",
      branchName,
    ]);

    return { ok: true, url: result.stdout.trim() };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "createPR failed";
    return { ok: false, error: message };
  }
}
