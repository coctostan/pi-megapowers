export type ExecShell = (
  cmd: string,
  cwd: string,
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export interface VerifyResult {
  passed: boolean;
  exitCode: number;
  output: string;
  durationMs: number;
}

export async function runVerifyStep(
  testCommand: string,
  cwd: string,
  exec: ExecShell,
): Promise<VerifyResult> {
  const t0 = Date.now();
  const result = await exec(testCommand, cwd);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return {
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    output,
    durationMs: Date.now() - t0,
  };
}
