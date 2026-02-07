import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { dispatchWithinSkillRoot } from "../src/dispatch.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeScript(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, "console.log('ok');\n");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("dispatchWithinSkillRoot", () => {
  test("prefers named subcommand script over main", async () => {
    const skillRoot = makeTempDir("skillx-skill-");
    writeScript(path.join(skillRoot, "scripts", "main.ts"));
    writeScript(path.join(skillRoot, "scripts", "sync.ts"));

    const invocations: Array<{ scriptPath: string; args: string[] }> = [];

    const result = await dispatchWithinSkillRoot("opensrc", skillRoot, ["sync", "--dry-run"], {
      runScriptImpl: async (scriptPath, args) => {
        invocations.push({ scriptPath, args });
        return { code: 0, signal: null };
      },
    });

    expect(result.handled).toBe(true);
    expect(result.code).toBe(0);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toEqual({
      scriptPath: path.join(skillRoot, "scripts", "sync.ts"),
      args: ["--dry-run"],
    });
  });

  test("falls back to main when subcommand script is missing", async () => {
    const skillRoot = makeTempDir("skillx-skill-");
    writeScript(path.join(skillRoot, "scripts", "main.ts"));

    const invocations: Array<{ scriptPath: string; args: string[] }> = [];

    const result = await dispatchWithinSkillRoot("opensrc", skillRoot, ["sync", "--dry-run"], {
      runScriptImpl: async (scriptPath, args) => {
        invocations.push({ scriptPath, args });
        return { code: 0, signal: null };
      },
    });

    expect(result.handled).toBe(true);
    expect(result.code).toBe(0);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toEqual({
      scriptPath: path.join(skillRoot, "scripts", "main.ts"),
      args: ["sync", "--dry-run"],
    });
  });

  test("shows available commands when main is missing", async () => {
    const skillRoot = makeTempDir("skillx-skill-");
    writeScript(path.join(skillRoot, "scripts", "sync.ts"));

    let stderrOutput = "";

    const result = await dispatchWithinSkillRoot("opensrc", skillRoot, [], {
      stderr: {
        write(chunk: string | Uint8Array) {
          stderrOutput += String(chunk);
          return true;
        },
      },
    });

    expect(result.handled).toBe(true);
    expect(result.code).toBe(2);
    expect(stderrOutput).toContain("opensrc: no default 'main' script found");
    expect(stderrOutput).toContain("Available commands: sync");
  });

  test("reports unknown command when no main exists", async () => {
    const skillRoot = makeTempDir("skillx-skill-");
    writeScript(path.join(skillRoot, "scripts", "sync.ts"));

    let stderrOutput = "";

    const result = await dispatchWithinSkillRoot("opensrc", skillRoot, ["deploy"], {
      stderr: {
        write(chunk: string | Uint8Array) {
          stderrOutput += String(chunk);
          return true;
        },
      },
    });

    expect(result.handled).toBe(true);
    expect(result.code).toBe(2);
    expect(stderrOutput).toContain("opensrc: unknown command 'deploy'");
    expect(stderrOutput).toContain("Available commands: sync");
  });
});
