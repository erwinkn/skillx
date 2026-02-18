import { describe, expect, test } from "bun:test";
import { main } from "../src/cli.js";

describe("cli help output", () => {
  test("prints entrypoint and supported extensions with no args", async () => {
    let stdout = "";
    let stderr = "";

    const code = await main([], {
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
    });

    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("main.{py,ts,js}");
    expect(stderr).toContain("Supported script extensions:");
    expect(stderr).toContain(".ts");
    expect(stderr).toContain(".js");
    expect(stderr).toContain(".py");
  });
});

describe("cli --list", () => {
  test("prints listed skills one per line", async () => {
    let stdout = "";
    let stderr = "";

    const code = await main(["--list"], {
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
      listAvailableSkillsImpl: () => [
        { name: "alpha", root: "/tmp/alpha" },
        { name: "beta", root: "/tmp/beta" },
      ],
    });

    expect(code).toBe(0);
    expect(stdout).toBe("alpha\nbeta\n");
    expect(stderr).toBe("");
  });

  test("errors when --list has extra positional args", async () => {
    let stdout = "";
    let stderr = "";

    const code = await main(["--list", "extra"], {
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
      listAvailableSkillsImpl: () => [],
    });

    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("--list does not accept positional arguments");
  });
});

describe("cli --add-path", () => {
  test("saves a custom path for a skill", async () => {
    let stdout = "";
    let stderr = "";
    const calls: Array<{ skillName: string; skillPath: string }> = [];

    const code = await main(["--add-path", "alpha", "/tmp/alpha"], {
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
      saveSkillPathOverrideImpl: (skillName, skillPath) => {
        calls.push({ skillName, skillPath });
        return { configPath: "/home/user/.skillx/config.json", resolvedSkillPath: "/tmp/alpha" };
      },
    });

    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Saved custom path for 'alpha' -> /tmp/alpha");
    expect(stdout).toContain("Config: /home/user/.skillx/config.json");
    expect(calls).toEqual([{ skillName: "alpha", skillPath: "/tmp/alpha" }]);
  });

  test("errors when --add-path arguments are missing", async () => {
    let stdout = "";
    let stderr = "";

    const code = await main(["--add-path", "alpha"], {
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
    });

    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("--add-path requires exactly <skill> and <path>");
  });
});

describe("cli --add-root", () => {
  test("saves a custom skills root", async () => {
    let stdout = "";
    let stderr = "";
    const calls: string[] = [];

    const code = await main(["--add-root", "/tmp/skills"], {
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
      saveSkillRootImpl: (skillRoot) => {
        calls.push(skillRoot);
        return { configPath: "/home/user/.skillx/config.json", resolvedSkillRoot: "/tmp/skills" };
      },
    });

    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Saved custom skills root -> /tmp/skills");
    expect(stdout).toContain("Config: /home/user/.skillx/config.json");
    expect(calls).toEqual(["/tmp/skills"]);
  });

  test("errors when --add-root arguments are missing", async () => {
    let stdout = "";
    let stderr = "";

    const code = await main(["--add-root"], {
      stdout: {
        write(chunk: string | Uint8Array) {
          stdout += String(chunk);
          return true;
        },
      },
      stderr: {
        write(chunk: string | Uint8Array) {
          stderr += String(chunk);
          return true;
        },
      },
    });

    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("--add-root requires exactly <path>");
  });
});
