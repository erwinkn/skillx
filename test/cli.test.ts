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
