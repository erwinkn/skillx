import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { dispatchSkillCommand } from "../src/dispatch.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeMainScript(dir: string): void {
  mkdirSync(path.join(dir, "scripts"), { recursive: true });
  writeFileSync(path.join(dir, "scripts", "main.ts"), "console.log('ok');\n");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("dispatchSkillCommand precedence", () => {
  test("uses highest-priority repo path first", async () => {
    const repoRoot = makeTempDir("skillx-repo-");
    const cwd = path.join(repoRoot, "nested");
    mkdirSync(cwd, { recursive: true });
    execSync("git init", { cwd: repoRoot, stdio: "ignore" });
    const canonicalRepoRoot = realpathSync(repoRoot);

    writeMainScript(path.join(repoRoot, ".agents", "skill", "opensrc"));
    writeMainScript(path.join(repoRoot, ".agents", "skills", "opensrc"));

    const homeDir = makeTempDir("skillx-home-");
    writeMainScript(path.join(homeDir, ".agents", "skills", "opensrc"));

    const invokedPaths: string[] = [];

    const result = await dispatchSkillCommand("opensrc", ["--dry-run"], {
      cwd,
      homeDir,
      env: {},
      runScriptImpl: async (scriptPath) => {
        invokedPaths.push(scriptPath);
        return { code: 0, signal: null };
      },
    });

    expect(result.code).toBe(0);
    expect(invokedPaths).toEqual([
      path.join(canonicalRepoRoot, ".agents", "skill", "opensrc", "scripts", "main.ts"),
    ]);
  });

  test("checks codex home after claude home", async () => {
    const homeDir = makeTempDir("skillx-home-");

    writeMainScript(path.join(homeDir, ".claude", "skills", "opensrc"));
    writeMainScript(path.join(homeDir, ".codex", "skills", "opensrc"));

    const invokedPaths: string[] = [];

    const result = await dispatchSkillCommand("opensrc", [], {
      cwd: homeDir,
      homeDir,
      env: {},
      runScriptImpl: async (scriptPath) => {
        invokedPaths.push(scriptPath);
        return { code: 0, signal: null };
      },
    });

    expect(result.code).toBe(0);
    expect(invokedPaths).toEqual([
      path.join(homeDir, ".claude", "skills", "opensrc", "scripts", "main.ts"),
    ]);
  });

  test("checks openclaw home before codex home", async () => {
    const homeDir = makeTempDir("skillx-home-");

    writeMainScript(path.join(homeDir, ".openclaw", "skills", "opensrc"));
    writeMainScript(path.join(homeDir, ".codex", "skills", "opensrc"));

    const invokedPaths: string[] = [];

    const result = await dispatchSkillCommand("opensrc", [], {
      cwd: homeDir,
      homeDir,
      env: {},
      runScriptImpl: async (scriptPath) => {
        invokedPaths.push(scriptPath);
        return { code: 0, signal: null };
      },
    });

    expect(result.code).toBe(0);
    expect(invokedPaths).toEqual([
      path.join(homeDir, ".openclaw", "skills", "opensrc", "scripts", "main.ts"),
    ]);
  });

  test("checks configured custom path before discovered roots", async () => {
    const repoRoot = makeTempDir("skillx-repo-");
    const cwd = path.join(repoRoot, "nested");
    mkdirSync(cwd, { recursive: true });
    execSync("git init", { cwd: repoRoot, stdio: "ignore" });

    writeMainScript(path.join(repoRoot, ".agents", "skills", "opensrc"));

    const homeDir = makeTempDir("skillx-home-");
    const configuredRoot = makeTempDir("skillx-custom-");
    writeMainScript(path.join(configuredRoot, "opensrc"));

    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillPaths: {
            opensrc: path.join(configuredRoot, "opensrc"),
          },
        },
        null,
        2,
      ) + "\n",
    );

    const invokedPaths: string[] = [];

    const result = await dispatchSkillCommand("opensrc", [], {
      cwd,
      homeDir,
      env: {},
      runScriptImpl: async (scriptPath) => {
        invokedPaths.push(scriptPath);
        return { code: 0, signal: null };
      },
    });

    expect(result.code).toBe(0);
    expect(invokedPaths).toEqual([path.join(configuredRoot, "opensrc", "scripts", "main.ts")]);
  });

  test("checks configured custom root before discovered roots", async () => {
    const repoRoot = makeTempDir("skillx-repo-");
    const cwd = path.join(repoRoot, "nested");
    mkdirSync(cwd, { recursive: true });
    execSync("git init", { cwd: repoRoot, stdio: "ignore" });

    writeMainScript(path.join(repoRoot, ".agents", "skills", "opensrc"));

    const homeDir = makeTempDir("skillx-home-");
    const customSkillsRoot = makeTempDir("skillx-custom-root-");
    writeMainScript(path.join(customSkillsRoot, "opensrc"));

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

    const invokedPaths: string[] = [];

    const result = await dispatchSkillCommand("opensrc", [], {
      cwd,
      homeDir,
      env: {},
      runScriptImpl: async (scriptPath) => {
        invokedPaths.push(scriptPath);
        return { code: 0, signal: null };
      },
    });

    expect(result.code).toBe(0);
    expect(invokedPaths).toEqual([path.join(customSkillsRoot, "opensrc", "scripts", "main.ts")]);
  });
});
