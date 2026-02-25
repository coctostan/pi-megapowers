// Task 1: checkJJAvailability tests
import { describe, it, expect } from "bun:test";
import {
  parseChangeId,
  parseHasConflicts,
  buildNewChangeArgs,
  buildDescribeArgs,
  buildSquashArgs,
  buildBookmarkSetArgs,
  buildLogArgs,
  formatChangeDescription,
  buildDiffArgs,
  buildAbandonArgs,
  buildSquashIntoArgs,
  checkJJAvailability,
  type JJAvailability,
  JJ_MODULE_VERSION,
} from "../extensions/megapowers/jj.js";

describe("parseChangeId", () => {
  it("extracts change ID from jj log output", () => {
    const output = "ksqxwzzm test@user.com 2026-02-18 12:00:00 abc123de\n  (empty) mega(001): brainstorm";
    expect(parseChangeId(output)).toBe("ksqxwzzm");
  });

  it("extracts change ID from jj new output", () => {
    const output = "Working copy now at: rlvkpntz 3b9a2c1e (empty) mega(001): brainstorm";
    expect(parseChangeId(output)).toBe("rlvkpntz");
  });

  it("returns null for empty output", () => {
    expect(parseChangeId("")).toBeNull();
  });
});

describe("parseHasConflicts", () => {
  it("detects conflicts in jj status", () => {
    const output = "The working copy has conflicts:\nA file.ts";
    expect(parseHasConflicts(output)).toBe(true);
  });

  it("returns false when no conflicts", () => {
    const output = "The working copy is clean";
    expect(parseHasConflicts(output)).toBe(false);
  });
});

describe("command builders", () => {
  it("buildNewChangeArgs creates correct args", () => {
    expect(buildNewChangeArgs("mega(001): brainstorm")).toEqual([
      "new", "-m", "mega(001): brainstorm",
    ]);
  });

  it("buildNewChangeArgs with parent revision", () => {
    expect(buildNewChangeArgs("mega(001): brainstorm", "main")).toEqual([
      "new", "main", "-m", "mega(001): brainstorm",
    ]);
  });

  it("buildDescribeArgs creates correct args", () => {
    expect(buildDescribeArgs("mega(001): spec complete")).toEqual([
      "describe", "-m", "mega(001): spec complete",
    ]);
  });

  it("buildSquashArgs creates correct args", () => {
    expect(buildSquashArgs()).toEqual(["squash"]);
  });

  it("buildBookmarkSetArgs creates correct args", () => {
    expect(buildBookmarkSetArgs("mega/001")).toEqual(["bookmark", "set", "mega/001"]);
  });

  it("buildLogArgs with revset", () => {
    expect(buildLogArgs("@")).toEqual(["log", "-r", "@"]);
  });

  it("buildLogArgs without revset", () => {
    expect(buildLogArgs()).toEqual(["log"]);
  });
});

describe("formatChangeDescription", () => {
  it("formats with issue slug and phase", () => {
    expect(formatChangeDescription("001-auth-refactor", "brainstorm")).toBe(
      "mega(001-auth-refactor): brainstorm"
    );
  });

  it("formats with suffix", () => {
    expect(formatChangeDescription("001-auth-refactor", "spec", "complete")).toBe(
      "mega(001-auth-refactor): spec complete"
    );
  });
});

describe("buildDiffArgs", () => {
  it("builds diff --summary for a specific change", () => {
    expect(buildDiffArgs("abc123")).toEqual(["diff", "--summary", "-r", "abc123"]);
  });
});

describe("buildAbandonArgs", () => {
  it("builds abandon for a specific change", () => {
    expect(buildAbandonArgs("abc123")).toEqual(["abandon", "abc123"]);
  });
});

describe("buildSquashIntoArgs", () => {
  it("builds squash from children into parent", () => {
    expect(buildSquashIntoArgs("parentid")).toEqual([
      "squash", "--from", "all:children(parentid)", "--into", "parentid",
    ]);
  });
});

// Task 2: jj messages
import { JJ_INSTALL_MESSAGE, JJ_INIT_MESSAGE, jjDispatchErrorMessage } from "../extensions/megapowers/jj-messages.js";

describe("jj messages", () => {
  it("JJ_INSTALL_MESSAGE includes brew and cargo install commands", () => {
    expect(JJ_INSTALL_MESSAGE).toContain("brew install jj");
    expect(JJ_INSTALL_MESSAGE).toContain("cargo install jj-cli");
  });

  it("JJ_INIT_MESSAGE includes jj git init --colocate", () => {
    expect(JJ_INIT_MESSAGE).toContain("jj git init --colocate");
  });

  it("jjDispatchErrorMessage includes install and init instructions", () => {
    const msg = jjDispatchErrorMessage();
    expect(msg).toContain("brew install jj");
    expect(msg).toContain("cargo install jj-cli");
    expect(msg).toContain("jj git init --colocate");
  });
});

describe("jj module metadata", () => {
  it("exports module version for dependency tracking", () => {
    expect(JJ_MODULE_VERSION).toBe(1);
  });
});

describe("checkJJAvailability", () => {
  it("does not call runRoot when version check fails", async () => {
    let rootCalled = false;
    await checkJJAvailability(
      async () => ({ code: 1, stdout: "", stderr: "not found" }),
      async () => { rootCalled = true; return { code: 0, stdout: "/repo", stderr: "" }; },
    );
    expect(rootCalled).toBe(false);
  });

  it("returns not-installed when jj version fails", async () => {
    const result = await checkJJAvailability(
      async () => ({ code: 1, stdout: "", stderr: "not found" }),
      async () => ({ code: 1, stdout: "", stderr: "" }),
    );
    expect(result).toBe("not-installed");
  });

  it("returns not-repo when jj is installed but jj root fails", async () => {
    const result = await checkJJAvailability(
      async () => ({ code: 0, stdout: "jj 0.25.0", stderr: "" }),
      async () => ({ code: 1, stdout: "", stderr: "" }),
    );
    expect(result).toBe("not-repo");
  });

  it("returns ready when jj is installed and repo exists", async () => {
    const result = await checkJJAvailability(
      async () => ({ code: 0, stdout: "jj 0.25.0", stderr: "" }),
      async () => ({ code: 0, stdout: "/repo", stderr: "" }),
    );
    expect(result).toBe("ready");
  });
});
