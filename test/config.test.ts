import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getConfiguredSkillPath,
  getConfiguredSkillRoots,
  saveSkillPathOverride,
  saveSkillRoot,
} from "../src/config.js";

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

describe("config", () => {
  test("saves custom skill path in ~/.skillx/config.json by default", () => {
    const homeDir = makeTempDir("skillx-home-");
    const skillRoot = makeTempDir("skillx-custom-skill-");

    const result = saveSkillPathOverride("alpha", skillRoot, {
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(result.configPath).toBe(path.join(homeDir, ".skillx", "config.json"));
    expect(result.resolvedSkillPath).toBe(skillRoot);

    const raw = readFileSync(result.configPath, "utf8");
    const parsed = JSON.parse(raw) as { skillPaths?: Record<string, string> };
    expect(parsed.skillPaths?.alpha).toBe(skillRoot);

    const resolved = getConfiguredSkillPath("alpha", {
      cwd: homeDir,
      homeDir,
      env: {},
    });
    expect(resolved).toBe(skillRoot);
  });

  test("resolves relative config path entries against config directory", () => {
    const homeDir = makeTempDir("skillx-home-");
    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillPaths: {
            alpha: "../skills/alpha",
          },
        },
        null,
        2,
      ) + "\n",
    );

    const resolved = getConfiguredSkillPath("alpha", {
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(resolved).toBe(path.join(homeDir, "skills", "alpha"));
  });

  test("rejects non-directory skill path on save", () => {
    const homeDir = makeTempDir("skillx-home-");
    const missingPath = path.join(homeDir, "does-not-exist");

    expect(() =>
      saveSkillPathOverride("alpha", missingPath, {
        cwd: homeDir,
        homeDir,
        env: {},
      }),
    ).toThrow("skill path is not a directory");
  });

  test("saves custom skills root and deduplicates entries", () => {
    const homeDir = makeTempDir("skillx-home-");
    const skillRoot = makeTempDir("skillx-custom-roots-");

    const first = saveSkillRoot(skillRoot, {
      cwd: homeDir,
      homeDir,
      env: {},
    });
    const second = saveSkillRoot(skillRoot, {
      cwd: homeDir,
      homeDir,
      env: {},
    });

    expect(first.configPath).toBe(path.join(homeDir, ".skillx", "config.json"));
    expect(second.resolvedSkillRoot).toBe(skillRoot);

    const roots = getConfiguredSkillRoots({
      cwd: homeDir,
      homeDir,
      env: {},
    });
    expect(roots).toEqual([skillRoot]);
  });

  test("resolves relative skills root entries against config directory", () => {
    const homeDir = makeTempDir("skillx-home-");
    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillRoots: ["../skills"],
        },
        null,
        2,
      ) + "\n",
    );

    const roots = getConfiguredSkillRoots({
      cwd: homeDir,
      homeDir,
      env: {},
    });
    expect(roots).toEqual([path.join(homeDir, "skills")]);
  });

  test("rejects non-directory skill root on save", () => {
    const homeDir = makeTempDir("skillx-home-");
    const missingPath = path.join(homeDir, "missing-roots");

    expect(() =>
      saveSkillRoot(missingPath, {
        cwd: homeDir,
        homeDir,
        env: {},
      }),
    ).toThrow("skills root is not a directory");
  });

  test("preserves skillRoots when saving skill path overrides", () => {
    const homeDir = makeTempDir("skillx-home-");
    const skillRoot = makeTempDir("skillx-custom-skill-");
    const rootsDir = makeTempDir("skillx-custom-roots-");

    const configPath = path.join(homeDir, ".skillx", "config.json");
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          skillRoots: [rootsDir],
        },
        null,
        2,
      ) + "\n",
    );

    saveSkillPathOverride("alpha", skillRoot, {
      cwd: homeDir,
      homeDir,
      env: {},
    });

    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as { skillRoots?: string[] };
    expect(parsed.skillRoots).toEqual([rootsDir]);
  });
});
