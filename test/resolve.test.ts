import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { getSkillCandidatePaths, getSkillSearchRoots } from "../src/resolve.js";

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
        SCRIPT_OPENCLAW_SKILLS_HOME: "/custom/openclaw-skills",
        CODEX_HOME: codexHome,
      },
    });

    expect(roots).toEqual([
      path.join(canonicalRepoRoot, ".agents", "skill"),
      path.join(canonicalRepoRoot, ".agent", "skills"),
      path.join(canonicalRepoRoot, ".agents", "skills"),
      path.join(canonicalRepoRoot, ".claude", "skills"),
      path.join(canonicalRepoRoot, ".codex", "skills"),
      path.join(canonicalRepoRoot, "skills"),
      "/custom/agents-skills",
      path.join(homeDir, ".agent", "skills"),
      "/custom/claude-skills",
      "/custom/openclaw-skills",
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

  test("falls back to ~/.openclaw/skills when OpenClaw env vars are not set", () => {
    const homeDir = makeTempDir("skillx-home-");

    const roots = getSkillSearchRoots({
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(roots.at(-2)).toBe(path.join(homeDir, ".openclaw", "skills"));
  });

  test("prepends configured custom path in candidate paths", () => {
    const homeDir = makeTempDir("skillx-home-");
    const configuredSkillRoot = makeTempDir("skillx-custom-skill-");

    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillPaths: {
            opensrc: configuredSkillRoot,
          },
        },
        null,
        2,
      ) + "\n",
    );

    const paths = getSkillCandidatePaths("opensrc", {
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(paths[0]).toBe(configuredSkillRoot);
    expect(paths).toContain(path.join(homeDir, ".agents", "skills", "opensrc"));
  });

  test("prepends configured custom roots in search roots", () => {
    const homeDir = makeTempDir("skillx-home-");
    const customRoot = makeTempDir("skillx-custom-root-");

    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillRoots: [customRoot],
        },
        null,
        2,
      ) + "\n",
    );

    const roots = getSkillSearchRoots({
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(roots[0]).toBe(customRoot);
    expect(roots).toContain(path.join(homeDir, ".agents", "skills"));
  });
});
