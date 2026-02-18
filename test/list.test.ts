import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { listAvailableSkills } from "../src/list.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeScript(skillRoot: string, fileName: string): void {
  const scriptsDir = path.join(skillRoot, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  writeFileSync(path.join(scriptsDir, fileName), "echo ok\n");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("listAvailableSkills", () => {
  test("lists only skills with runnable scripts", () => {
    const homeDir = makeTempDir("skillx-home-");
    writeScript(path.join(homeDir, ".agents", "skills", "alpha"), "main.ts");
    writeScript(path.join(homeDir, ".agents", "skills", "gamma"), "do.py");
    writeScript(path.join(homeDir, ".agents", "skills", "beta"), "notes.txt");
    mkdirSync(path.join(homeDir, ".agents", "skills", "delta"), { recursive: true });

    const listed = listAvailableSkills({
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(listed.map((entry) => entry.name)).toEqual(["alpha", "gamma"]);
  });

  test("deduplicates by precedence and includes codex paths", () => {
    const repoRoot = makeTempDir("skillx-repo-");
    const repoCwd = path.join(repoRoot, "nested");
    mkdirSync(repoCwd, { recursive: true });
    execSync("git init", { cwd: repoRoot, stdio: "ignore" });
    const canonicalRepoRoot = realpathSync(repoRoot);

    const homeDir = makeTempDir("skillx-home-");

    writeScript(path.join(canonicalRepoRoot, ".codex", "skills", "zeta"), "main.sh");
    writeScript(path.join(homeDir, ".claude", "skills", "zeta"), "main.ts");
    writeScript(path.join(homeDir, ".codex", "skills", "omega"), "main.ts");

    const listed = listAvailableSkills({
      cwd: repoCwd,
      homeDir,
      env: {},
    });

    expect(listed).toEqual([
      {
        name: "zeta",
        root: path.join(canonicalRepoRoot, ".codex", "skills", "zeta"),
      },
      {
        name: "omega",
        root: path.join(homeDir, ".codex", "skills", "omega"),
      },
    ]);
  });

  test("includes OpenClaw workspace and home paths", () => {
    const repoRoot = makeTempDir("skillx-repo-");
    const repoCwd = path.join(repoRoot, "nested");
    mkdirSync(repoCwd, { recursive: true });
    execSync("git init", { cwd: repoRoot, stdio: "ignore" });
    const canonicalRepoRoot = realpathSync(repoRoot);

    const homeDir = makeTempDir("skillx-home-");

    writeScript(path.join(canonicalRepoRoot, "skills", "workspace-skill"), "main.ts");
    writeScript(path.join(homeDir, ".openclaw", "skills", "home-skill"), "main.ts");

    const listed = listAvailableSkills({
      cwd: repoCwd,
      homeDir,
      env: {},
    });

    expect(listed).toEqual([
      {
        name: "workspace-skill",
        root: path.join(canonicalRepoRoot, "skills", "workspace-skill"),
      },
      {
        name: "home-skill",
        root: path.join(homeDir, ".openclaw", "skills", "home-skill"),
      },
    ]);
  });

  test("prefers configured custom skill paths over discovered roots", () => {
    const homeDir = makeTempDir("skillx-home-");
    const configuredRoot = makeTempDir("skillx-custom-");

    writeScript(path.join(configuredRoot, "scripts-owner"), "main.ts");
    writeScript(path.join(homeDir, ".agents", "skills", "scripts-owner"), "main.ts");
    writeScript(path.join(homeDir, ".agents", "skills", "from-root"), "main.ts");

    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillPaths: {
            "scripts-owner": path.join(configuredRoot, "scripts-owner"),
          },
        },
        null,
        2,
      ) + "\n",
    );

    const listed = listAvailableSkills({
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(listed).toEqual([
      {
        name: "scripts-owner",
        root: path.join(configuredRoot, "scripts-owner"),
      },
      {
        name: "from-root",
        root: path.join(homeDir, ".agents", "skills", "from-root"),
      },
    ]);
  });

  test("includes configured custom skills roots before discovered roots", () => {
    const homeDir = makeTempDir("skillx-home-");
    const customSkillsRoot = makeTempDir("skillx-custom-root-");

    writeScript(path.join(customSkillsRoot, "alpha"), "main.ts");
    writeScript(path.join(homeDir, ".agents", "skills", "alpha"), "main.ts");
    writeScript(path.join(homeDir, ".agents", "skills", "beta"), "main.ts");

    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillRoots: [customSkillsRoot],
        },
        null,
        2,
      ) + "\n",
    );

    const listed = listAvailableSkills({
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(listed).toEqual([
      {
        name: "alpha",
        root: path.join(customSkillsRoot, "alpha"),
      },
      {
        name: "beta",
        root: path.join(homeDir, ".agents", "skills", "beta"),
      },
    ]);
  });
});
