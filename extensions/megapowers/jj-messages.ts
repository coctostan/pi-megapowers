export const JJ_INSTALL_MESSAGE =
  "jj (Jujutsu) is not installed. Subagent features require jj for workspace isolation.\n" +
  "Install: `brew install jj` (macOS) or `cargo install jj-cli` (all platforms).\n" +
  "All other megapowers features work without jj.";

export const JJ_INIT_MESSAGE =
  "jj is installed but this is not a jj repository. Subagent features require a jj repo.\n" +
  "For existing git repos: `jj git init --colocate`\n" +
  "All other megapowers features work without jj.";

export function jjDispatchErrorMessage(): string {
  return (
    "jj is required for subagent workspace isolation. This does not appear to be a jj repository.\n\n" +
    "To fix:\n" +
    "1. Install jj: `brew install jj` (macOS) or `cargo install jj-cli` (all platforms)\n" +
    "2. Initialize: `jj git init --colocate` (for existing git repos)\n\n" +
    "All other megapowers features work without jj."
  );
}
