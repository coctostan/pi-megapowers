export function isSubagentSession(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.PI_SUBAGENT === "1") return true;

  const depth = env.PI_SUBAGENT_DEPTH?.trim();
  if (!depth) return false;

  const parsed = Number(depth);
  return Number.isFinite(parsed) && parsed > 0;
}
