import { createRequire } from "node:module";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { isExecutableWithShebang } from "./discovery.js";

const require = createRequire(import.meta.url);

export interface RunnerDependencies {
  commandExists?: (command: string) => boolean;
  tsxCliPath?: string;
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
  const nodePath = dependencies.nodePath ?? process.execPath;
  const extension = path.extname(scriptPath).toLowerCase();

  if ([".js", ".mjs", ".cjs"].includes(extension)) {
    return { command: nodePath, args: [scriptPath, ...scriptArgs] };
  }

  if ([".ts", ".mts", ".cts"].includes(extension)) {
    const tsxCliPath = dependencies.tsxCliPath ?? require.resolve("tsx/dist/cli.mjs");
    return { command: nodePath, args: [tsxCliPath, scriptPath, ...scriptArgs] };
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
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });

  return !result.error;
}
