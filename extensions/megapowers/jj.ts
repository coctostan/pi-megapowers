import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// --- Pure parsing/building functions (testable without pi) ---

export function parseChangeId(output: string): string | null {
  const match = output.match(/(?:^|\s)([a-z]{8,})\s/m);
  return match?.[1] ?? null;
}

export function parseHasConflicts(output: string): boolean {
  return output.includes("has conflicts");
}

export function buildNewChangeArgs(description: string, parent?: string): string[] {
  if (parent) return ["new", parent, "-m", description];
  return ["new", "-m", description];
}

export function buildDescribeArgs(description: string): string[] {
  return ["describe", "-m", description];
}

export function buildSquashArgs(): string[] {
  return ["squash"];
}

export function buildBookmarkSetArgs(name: string): string[] {
  return ["bookmark", "set", name];
}

export function buildLogArgs(revset?: string): string[] {
  if (revset) return ["log", "-r", revset];
  return ["log"];
}

export function buildDiffArgs(changeId: string): string[] {
  return ["diff", "--summary", "-r", changeId];
}

export function buildAbandonArgs(changeId: string): string[] {
  return ["abandon", changeId];
}

export function buildSquashIntoArgs(parentChangeId: string): string[] {
  return ["squash", "--from", `all:children(${parentChangeId})`, "--into", parentChangeId];
}

export function formatChangeDescription(issueSlug: string, phase: string, suffix?: string): string {
  const desc = suffix ? `${phase} ${suffix}` : phase;
  return `mega(${issueSlug}): ${desc}`;
}

// --- JJ interface (used by extension, wraps pi.exec) ---

export interface JJ {
  isJJRepo(): Promise<boolean>;
  getCurrentChangeId(): Promise<string | null>;
  getChangeDescription(): Promise<string>;
  hasConflicts(): Promise<boolean>;
  newChange(description: string, parent?: string): Promise<string | null>;
  describe(description: string): Promise<void>;
  squash(): Promise<void>;
  bookmarkSet(name: string): Promise<void>;
  log(revset?: string): Promise<string>;
  diff(changeId: string): Promise<string>;
  abandon(changeId: string): Promise<void>;
  squashInto(parentChangeId: string): Promise<void>;
}

export function createJJ(pi: ExtensionAPI): JJ {
  async function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    return pi.exec("jj", args);
  }

  return {
    async isJJRepo(): Promise<boolean> {
      const result = await run(["root"]);
      return result.code === 0;
    },

    async getCurrentChangeId(): Promise<string | null> {
      const result = await run(["log", "-r", "@", "--no-graph", "-T", "change_id"]);
      if (result.code !== 0) return null;
      return result.stdout.trim() || null;
    },

    async getChangeDescription(): Promise<string> {
      const result = await run(["log", "-r", "@", "--no-graph", "-T", "description"]);
      return result.stdout.trim();
    },

    async hasConflicts(): Promise<boolean> {
      const result = await run(["status"]);
      return parseHasConflicts(result.stdout);
    },

    async newChange(description: string, parent?: string): Promise<string | null> {
      const result = await run(buildNewChangeArgs(description, parent));
      return parseChangeId(result.stderr + result.stdout);
    },

    async describe(description: string): Promise<void> {
      await run(buildDescribeArgs(description));
    },

    async squash(): Promise<void> {
      await run(buildSquashArgs());
    },

    async bookmarkSet(name: string): Promise<void> {
      await run(buildBookmarkSetArgs(name));
    },

    async log(revset?: string): Promise<string> {
      const result = await run(buildLogArgs(revset));
      return result.stdout;
    },

    async diff(changeId: string): Promise<string> {
      const result = await run(buildDiffArgs(changeId));
      return result.stdout;
    },

    async abandon(changeId: string): Promise<void> {
      await run(buildAbandonArgs(changeId));
    },

    async squashInto(parentChangeId: string): Promise<void> {
      await run(buildSquashIntoArgs(parentChangeId));
    },
  };
}
