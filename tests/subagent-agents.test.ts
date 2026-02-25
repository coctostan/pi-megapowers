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

  it("rejects unsafe agent names with path traversal", () => {
    expect(resolveAgent("../worker", tmp)).toBeNull();
    expect(resolveAgent("..\\worker", tmp)).toBeNull();
    expect(resolveAgent("nested/worker", tmp)).toBeNull();
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

describe("worker agent system prompt quality", () => {
  it("has at least 3 paragraphs in system prompt", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const paragraphs = agent!.systemPrompt!.split(/\n\n+/).filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("covers task execution approach", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("task");
    expect(prompt).toContain("minimal");
  });

  it("covers TDD workflow expectations", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("test");
    expect(prompt).toContain("fail");
  });

  it("covers completion signaling", () => {
    const content = readFileSync(join(agentsDir, "worker.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("complete");
  });
});

describe("scout agent system prompt quality", () => {
  it("has at least 3 paragraphs in system prompt", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const paragraphs = agent!.systemPrompt!.split(/\n\n+/).filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("covers investigation approach", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("investigat");
  });

  it("covers structuring findings with file references", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("file");
    expect(prompt).toContain("line");
  });

  it("covers depth vs breadth guidance", () => {
    const content = readFileSync(join(agentsDir, "scout.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("breadth");
  });
});

describe("reviewer agent system prompt quality", () => {
  it("has at least 3 paragraphs in system prompt", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const paragraphs = agent!.systemPrompt!.split(/\n\n+/).filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("covers review methodology", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("review");
    expect(prompt).toContain("correct");
  });

  it("covers blocking vs non-blocking issues", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("block");
  });

  it("covers feedback format with file/line references", () => {
    const content = readFileSync(join(agentsDir, "reviewer.md"), "utf-8");
    const agent = parseAgentFrontmatter(content);
    const prompt = agent!.systemPrompt!.toLowerCase();
    expect(prompt).toContain("file");
    expect(prompt).toContain("line");
    expect(prompt).toContain("sever");
  });
});

describe("builtin agent differentiation", () => {
  it("no two builtin agents share the same model+thinking combination", () => {
    const agentFiles = ["worker.md", "scout.md", "reviewer.md"];
    const combos = new Set<string>();
    for (const file of agentFiles) {
      const content = readFileSync(join(agentsDir, file), "utf-8");
      const agent = parseAgentFrontmatter(content);
      expect(agent).not.toBeNull();
      const combo = `${agent!.model}|${agent!.thinking}`;
      expect(combos.has(combo)).toBe(false);
      combos.add(combo);
    }
    expect(combos.size).toBe(3);
  });
});

describe("agent resolution priority unchanged (AC12)", () => {
  it("resolves project > home > builtin in correct order", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "ac12-project-"));
    const fakeHome = mkdtempSync(join(tmpdir(), "ac12-home-"));
    const projectAgentsDir = join(projectDir, ".megapowers", "agents");
    const userAgentsDir = join(fakeHome, ".megapowers", "agents");
    mkdirSync(projectAgentsDir, { recursive: true });
    mkdirSync(userAgentsDir, { recursive: true });

    // Only builtin exists
    const builtinAgent = resolveAgent("worker", projectDir, fakeHome);
    expect(builtinAgent).not.toBeNull();

    // User home overrides builtin
    writeFileSync(join(userAgentsDir, "worker.md"), `---\nname: worker\nmodel: home-model\n---\nHome.`);
    const homeAgent = resolveAgent("worker", projectDir, fakeHome);
    expect(homeAgent!.model).toBe("home-model");

    // Project overrides home
    writeFileSync(join(projectAgentsDir, "worker.md"), `---\nname: worker\nmodel: project-model\n---\nProject.`);
    const projectAgent = resolveAgent("worker", projectDir, fakeHome);
    expect(projectAgent!.model).toBe("project-model");

    rmSync(projectDir, { recursive: true, force: true });
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
