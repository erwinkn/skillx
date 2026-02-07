import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveExecutionPlan, RunnerError } from "../src/runners.js";

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

describe("resolveExecutionPlan", () => {
  test("maps TypeScript files to node + tsx", () => {
    const plan = resolveExecutionPlan("/tmp/main.ts", ["sync", "--dry-run"], {
      nodePath: "/node/bin/node",
      tsxCliPath: "/deps/tsx/cli.mjs",
    });

    expect(plan).toEqual({
      command: "/node/bin/node",
      args: ["/deps/tsx/cli.mjs", "/tmp/main.ts", "sync", "--dry-run"],
    });
  });

  test("prefers uv for Python when available", () => {
    const plan = resolveExecutionPlan("/tmp/main.py", ["--dry-run"], {
      commandExists: (cmd) => cmd === "uv" || cmd === "python3",
    });

    expect(plan).toEqual({
      command: "uv",
      args: ["run", "/tmp/main.py", "--dry-run"],
    });
  });

  test("falls back to python3 when uv is unavailable", () => {
    const plan = resolveExecutionPlan("/tmp/main.py", ["--dry-run"], {
      commandExists: (cmd) => cmd === "python3",
    });

    expect(plan).toEqual({
      command: "python3",
      args: ["/tmp/main.py", "--dry-run"],
    });
  });

  test("throws a helpful error when no Python runtime exists", () => {
    expect(() =>
      resolveExecutionPlan("/tmp/main.py", [], {
        commandExists: () => false,
      }),
    ).toThrow(RunnerError);
  });

  test("runs shebang executable directly", () => {
    const tempDir = makeTempDir("skillx-runner-");
    const scriptPath = path.join(tempDir, "main");

    writeFileSync(scriptPath, "#!/usr/bin/env bash\necho hi\n");
    chmodSync(scriptPath, 0o755);

    const plan = resolveExecutionPlan(scriptPath, ["--dry-run"], {
      commandExists: () => true,
    });

    expect(plan).toEqual({
      command: scriptPath,
      args: ["--dry-run"],
    });
  });
});
