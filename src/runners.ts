import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { isExecutableWithShebang } from "./discovery.js";

export interface RunnerDependencies {
  commandExists?: (command: string) => boolean;
  commandVersion?: (command: string) => string | null;
  nodePath?: string;
}

export interface ExecutionPlan {
  command: string;
  args: string[];
}

export interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export class RunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunnerError";
  }
}

export async function runScript(
  scriptPath: string,
  scriptArgs: string[],
  dependencies: RunnerDependencies = {},
): Promise<RunResult> {
  const plan = resolveExecutionPlan(scriptPath, scriptArgs, dependencies);

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

export function resolveExecutionPlan(
  scriptPath: string,
  scriptArgs: string[],
  dependencies: RunnerDependencies = {},
): ExecutionPlan {
  const commandExists = dependencies.commandExists ?? defaultCommandExists;
  const commandVersion = dependencies.commandVersion ?? defaultCommandVersion;
  const nodePath = dependencies.nodePath ?? process.execPath;
  const extension = path.extname(scriptPath).toLowerCase();

  if ([".js", ".mjs", ".cjs"].includes(extension)) {
    return { command: nodePath, args: [scriptPath, ...scriptArgs] };
  }

  if ([".ts", ".mts", ".cts"].includes(extension)) {
    if (commandExists("bun")) {
      return { command: "bun", args: [scriptPath, ...scriptArgs] };
    }

    const nodeVersion = commandVersion(nodePath);
    if (nodeVersion && supportsNativeNodeTypeScript(nodeVersion)) {
      return { command: nodePath, args: [scriptPath, ...scriptArgs] };
    }

    if (commandExists("tsx")) {
      return { command: "tsx", args: [scriptPath, ...scriptArgs] };
    }

    if (commandExists("ts-node")) {
      return { command: "ts-node", args: [scriptPath, ...scriptArgs] };
    }

    if (commandExists("deno")) {
      return { command: "deno", args: ["run", scriptPath, ...scriptArgs] };
    }

    throw new RunnerError(
      [
        "No supported TypeScript runner found for .ts script.",
        `Supported TypeScript runners: bun, node (v22.18+, v23+, or v24.3+), tsx, ts-node, deno.`,
        nodeVersion
          ? `Detected node version: ${nodeVersion}.`
          : `Node version could not be detected from '${nodePath}'.`,
      ].join(" "),
    );
  }

  if (extension === ".py") {
    if (commandExists("uv")) {
      return { command: "uv", args: ["run", scriptPath, ...scriptArgs] };
    }

    if (commandExists("python3")) {
      return { command: "python3", args: [scriptPath, ...scriptArgs] };
    }

    throw new RunnerError(
      "No Python runtime found for .py script. Install `uv` (recommended) or `python3`.",
    );
  }

  if (extension === ".sh") {
    if (!commandExists("bash")) {
      throw new RunnerError("`bash` is required to run .sh scripts.");
    }
    return { command: "bash", args: [scriptPath, ...scriptArgs] };
  }

  if (isExecutableWithShebang(scriptPath)) {
    return { command: scriptPath, args: scriptArgs };
  }

  throw new RunnerError(`Unsupported script type: ${scriptPath}`);
}

function defaultCommandExists(command: string): boolean {
  return defaultCommandVersion(command) !== null;
}

function defaultCommandVersion(command: string): string | null {
  const result = spawnSync(command, ["--version"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return output.length > 0 ? output : null;
}

function supportsNativeNodeTypeScript(version: string): boolean {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return false;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (major > 24) {
    return true;
  }

  if (major === 24) {
    return minor >= 3;
  }

  if (major === 23) {
    return true;
  }

  if (major === 22) {
    return minor >= 18;
  }

  return false;
}
