import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { findScriptForBase, listAvailableCommands } from "../src/discovery.js";

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

describe("discovery", () => {
  test("uses deterministic extension priority", () => {
    const root = makeTempDir("skillx-discovery-");
    const base = path.join(root, "main");

    writeFileSync(`${base}.js`, "console.log('js');\n");
    writeFileSync(`${base}.ts`, "console.log('ts');\n");

    const match = findScriptForBase(base);

    expect(match).toEqual({
      path: `${base}.ts`,
      extension: ".ts",
    });
  });

  test("lists named commands excluding main", () => {
    const scriptsDir = makeTempDir("skillx-scripts-");
    mkdirSync(scriptsDir, { recursive: true });

    writeFileSync(path.join(scriptsDir, "main.ts"), "console.log('main');\n");
    writeFileSync(path.join(scriptsDir, "sync.ts"), "console.log('sync');\n");
    writeFileSync(path.join(scriptsDir, "check.py"), "print('check')\n");

    const shebangCmd = path.join(scriptsDir, "deploy");
    writeFileSync(shebangCmd, "#!/usr/bin/env bash\necho deploy\n");
    chmodSync(shebangCmd, 0o755);

    expect(listAvailableCommands(scriptsDir)).toEqual(["check", "deploy", "sync"]);
  });
});
