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
