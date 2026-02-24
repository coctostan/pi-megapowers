import { describe, it, expect } from "bun:test";
import { existsSync, existsSync as fileExists, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAgentFrontmatter, type AgentDef } from "../extensions/megapowers/subagent-agents.js";

const thisTestDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(thisTestDir, "..", "agents");

describe("parseAgentFrontmatter", () => {
  it("parses all four frontmatter fields", () => {
    const md = `---
name: worker
model: claude-sonnet-4-20250514
tools: [read, write, bash]
thinking: full
---

You are a worker agent.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent).toEqual({
      name: "worker",
      model: "claude-sonnet-4-20250514",
      tools: ["read", "write", "bash"],
      thinking: "full",
      systemPrompt: "You are a worker agent.",
    });
  });

  it("handles missing optional fields", () => {
    const md = `---
name: scout
---

Scout agent.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.name).toBe("scout");
    expect(agent!.model).toBeUndefined();
    expect(agent!.tools).toBeUndefined();
    expect(agent!.thinking).toBeUndefined();
    expect(agent!.systemPrompt).toBe("Scout agent.");
  });

  it("returns null for content without frontmatter", () => {
    const agent = parseAgentFrontmatter("Just a normal markdown file.");
    expect(agent).toBeNull();
  });

  it("parses tools as comma-separated string", () => {
    const md = `---
name: helper
tools: read, write
---
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "write"]);
  });

  it("parses tools as YAML array syntax", () => {
    const md = `---
name: helper
tools: [read, write, bash]
---
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "write", "bash"]);
  });

  it("parses tools as multiline YAML dash-item array", () => {
    const md = `---
name: helper
tools:
  - read
  - write
  - bash
---

Helper agent.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "write", "bash"]);
    expect(agent!.name).toBe("helper");
    expect(agent!.systemPrompt).toBe("Helper agent.");
  });

  it("parses tools as multiline YAML dash-item with other fields after", () => {
    const md = `---
name: worker
tools:
  - read
  - bash
thinking: full
---
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.tools).toEqual(["read", "bash"]);
    expect(agent!.thinking).toBe("full");
  });

  it("trims whitespace from body as system prompt", () => {
    const md = `---
name: test
---

  Some prompt text.

`;
    const agent = parseAgentFrontmatter(md);
    expect(agent!.systemPrompt).toBe("Some prompt text.");
  });

  it("returns null when name field is missing", () => {
    const md = `---
model: some-model
---

No name.
`;
    const agent = parseAgentFrontmatter(md);
    expect(agent).toBeNull();
  });
});

describe("builtin agent files", () => {
  it("worker.md exists and parses with correct name", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
    expect(agent!.model).toBeDefined();
    expect(agent!.tools).toBeDefined();
    expect(agent!.systemPrompt).toBeDefined();
  });

  it("scout.md exists and parses with correct name", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("scout");
    expect(agent!.tools).toEqual(["read", "bash"]);
  });

  it("reviewer.md exists and parses with correct name", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("reviewer");
  });
});

import { resolveAgent, BUILTIN_AGENTS_DIR } from "../extensions/megapowers/subagent-agents.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";


describe("resolveAgent", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "agent-resolve-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("finds agent in project .megapowers/agents/ directory", () => {
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: fast-model\n---\nProject worker.`);

    const agent = resolveAgent("worker", tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
    expect(agent!.model).toBe("fast-model");
  });

  it("falls back to builtin agents when not found in project", () => {
    const agent = resolveAgent("worker", tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
  });

  it("returns null for unknown agent name", () => {
    const agent = resolveAgent("nonexistent-agent-xyz", tmp);
    expect(agent).toBeNull();
  });

  it("project agent takes priority over builtin", () => {
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: custom-model\n---\nCustom.`);

    const agent = resolveAgent("worker", tmp);
    expect(agent!.model).toBe("custom-model");
  });

  it("uses default worker agent when no agent name specified", () => {
    const agent = resolveAgent(undefined, tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
  });

  it("searches user home directory between project and builtin", () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "agent-home-test-"));
    const userAgentsDir = join(fakeHome, ".megapowers", "agents");
    mkdirSync(userAgentsDir, { recursive: true });
    writeFileSync(join(userAgentsDir, "worker.md"), `---\nname: worker\nmodel: home-model\n---\nHome worker.`);

    const agent = resolveAgent("worker", tmp, fakeHome);
    expect(agent).not.toBeNull();
    expect(agent!.model).toBe("home-model");

    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("skips files with invalid frontmatter and continues search", () => {
    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nmodel: broken\n---\nNo name field.`);

    const agent = resolveAgent("worker", tmp);
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("worker");
    expect(agent!.model).not.toBe("broken");
  });

  it("project agent takes priority over user home agent", () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "agent-home-test-"));
    const userAgentsDir = join(fakeHome, ".megapowers", "agents");
    mkdirSync(userAgentsDir, { recursive: true });
    writeFileSync(join(userAgentsDir, "worker.md"), `---\nname: worker\nmodel: home-model\n---\nHome.`);

    const projectAgentsDir = join(tmp, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: project-model\n---\nProject.`);

    const agent = resolveAgent("worker", tmp, fakeHome);
    expect(agent!.model).toBe("project-model");

    rmSync(fakeHome, { recursive: true, force: true });
  });
});

describe("UPSTREAM.md", () => {
  it("exists in extensions/megapowers/ directory", () => {
    const upstreamPath = join(thisTestDir, "..", "extensions", "megapowers", "UPSTREAM.md");
    expect(fileExists(upstreamPath)).toBe(true);
  });

  it("contains pinned commit reference", () => {
    const upstreamPath = join(thisTestDir, "..", "extensions", "megapowers", "UPSTREAM.md");
    const content = readFileSync(upstreamPath, "utf-8");
    expect(content).toContain("1281c04");
  });
});
