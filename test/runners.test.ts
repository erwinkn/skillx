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
  test("prefers bun for TypeScript files", () => {
    const plan = resolveExecutionPlan("/tmp/main.ts", ["sync", "--dry-run"], {
      commandExists: (cmd) => cmd === "bun" || cmd === "tsx",
      commandVersion: () => "v25.6.0",
      nodePath: "/node/bin/node",
    });

    expect(plan).toEqual({
      command: "bun",
      args: ["/tmp/main.ts", "sync", "--dry-run"],
    });
  });

  test("uses node for TypeScript files when native support is available", () => {
    const plan = resolveExecutionPlan("/tmp/main.ts", ["sync", "--dry-run"], {
      commandExists: (cmd) => cmd === "tsx",
      commandVersion: (cmd) => (cmd === "/node/bin/node" ? "v25.6.0" : null),
      nodePath: "/node/bin/node",
    });

    expect(plan).toEqual({
      command: "/node/bin/node",
      args: ["/tmp/main.ts", "sync", "--dry-run"],
    });
  });

  test("falls back to tsx when bun is unavailable and node lacks native support", () => {
    const plan = resolveExecutionPlan("/tmp/main.ts", ["sync", "--dry-run"], {
      commandExists: (cmd) => cmd === "tsx",
      commandVersion: (cmd) => (cmd === "/node/bin/node" ? "v20.10.0" : null),
      nodePath: "/node/bin/node",
    });

    expect(plan).toEqual({
      command: "tsx",
      args: ["/tmp/main.ts", "sync", "--dry-run"],
    });
  });

  test("falls back to ts-node when bun, node, and tsx are unavailable", () => {
    const plan = resolveExecutionPlan("/tmp/main.ts", ["sync"], {
      commandExists: (cmd) => cmd === "ts-node",
      commandVersion: (cmd) => (cmd === "/node/bin/node" ? "v20.10.0" : null),
      nodePath: "/node/bin/node",
    });

    expect(plan).toEqual({
      command: "ts-node",
      args: ["/tmp/main.ts", "sync"],
    });
  });

  test("falls back to deno when other TypeScript runners are unavailable", () => {
    const plan = resolveExecutionPlan("/tmp/main.ts", ["sync"], {
      commandExists: (cmd) => cmd === "deno",
      commandVersion: (cmd) => (cmd === "/node/bin/node" ? "v20.10.0" : null),
      nodePath: "/node/bin/node",
    });

    expect(plan).toEqual({
      command: "deno",
      args: ["run", "/tmp/main.ts", "sync"],
    });
  });

  test("throws explicit supported runner error when no TypeScript runner exists", () => {
    expect(() =>
      resolveExecutionPlan("/tmp/main.ts", [], {
        commandExists: () => false,
        commandVersion: (cmd) => (cmd === "/node/bin/node" ? "v20.10.0" : null),
        nodePath: "/node/bin/node",
      }),
    ).toThrow(
      "Supported TypeScript runners: bun, node (v22.18+, v23+, or v24.3+), tsx, ts-node, deno.",
    );
  });

  test("maps JavaScript files to node", () => {
    const plan = resolveExecutionPlan("/tmp/main.js", ["--dry-run"], {
      nodePath: "/node/bin/node",
    });

    expect(plan).toEqual({
      command: "/node/bin/node",
      args: ["/tmp/main.js", "--dry-run"],
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
