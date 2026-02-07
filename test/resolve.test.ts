import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { getSkillSearchRoots } from "../src/resolve.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("getSkillSearchRoots", () => {
  test("includes repo and home paths in expected order", () => {
    const repoRoot = makeTempDir("skillx-repo-");
    const repoCwd = path.join(repoRoot, "sub", "dir");
    mkdirSync(repoCwd, { recursive: true });

    execSync("git init", { cwd: repoRoot, stdio: "ignore" });
    const canonicalRepoRoot = realpathSync(repoRoot);

    const homeDir = makeTempDir("skillx-home-");
    const codexHome = makeTempDir("skillx-codex-");

    const roots = getSkillSearchRoots({
      cwd: repoCwd,
      homeDir,
      env: {
        SCRIPT_SKILLS_HOME: "/custom/agents-skills",
        SCRIPT_CLAUDE_SKILLS_HOME: "/custom/claude-skills",
        CODEX_HOME: codexHome,
      },
    });

    expect(roots).toEqual([
      path.join(canonicalRepoRoot, ".agents", "skill"),
      path.join(canonicalRepoRoot, ".agent", "skills"),
      path.join(canonicalRepoRoot, ".agents", "skills"),
      path.join(canonicalRepoRoot, ".claude", "skills"),
      path.join(canonicalRepoRoot, ".codex", "skills"),
      "/custom/agents-skills",
      path.join(homeDir, ".agent", "skills"),
      "/custom/claude-skills",
      path.join(codexHome, "skills"),
    ]);
  });

  test("falls back to ~/.codex/skills when CODEX_HOME is not set", () => {
    const homeDir = makeTempDir("skillx-home-");

    const roots = getSkillSearchRoots({
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(roots.at(-1)).toBe(path.join(homeDir, ".codex", "skills"));
  });
});
