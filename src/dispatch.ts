import path from "node:path";
import { findScriptForBase, isDirectory, listAvailableCommands } from "./discovery.js";
import { runScript, type RunResult, RunnerError } from "./runners.js";
import { getSkillCandidatePaths, type ResolveContext } from "./resolve.js";

export interface DispatchContext extends ResolveContext {
  stderr?: Pick<NodeJS.WriteStream, "write">;
  runScriptImpl?: (scriptPath: string, args: string[]) => Promise<RunResult>;
}

export interface DispatchResult {
  handled: boolean;
  code: number;
  signal: NodeJS.Signals | null;
}

export async function dispatchSkillCommand(
  skillName: string,
  args: string[],
  context: DispatchContext = {},
): Promise<DispatchResult> {
  const stderr = context.stderr ?? process.stderr;

  const candidatePaths = getSkillCandidatePaths(skillName, context);
  for (const skillRoot of candidatePaths) {
    const result = await dispatchWithinSkillRoot(skillName, skillRoot, args, context);
    if (result.handled) {
      return result;
    }
  }

  stderr.write(`skillx: command not found: ${skillName}\n`);
  return { handled: false, code: 127, signal: null };
}

export async function dispatchWithinSkillRoot(
  skillName: string,
  skillRoot: string,
  args: string[],
  context: Pick<DispatchContext, "stderr" | "runScriptImpl"> = {},
): Promise<DispatchResult> {
  const stderr = context.stderr ?? process.stderr;
  const runScriptImpl = context.runScriptImpl ?? runScript;

  const scriptsDir = path.join(skillRoot, "scripts");
  if (!isDirectory(scriptsDir)) {
    return { handled: false, code: 1, signal: null };
  }

  const subcommand = args[0];

  if (subcommand) {
    const subcommandScript = findScriptForBase(path.join(scriptsDir, subcommand));
    if (subcommandScript) {
      return runSelectedScript(subcommandScript.path, args.slice(1), runScriptImpl, stderr);
    }
  }

  const mainScript = findScriptForBase(path.join(scriptsDir, "main"));
  if (mainScript) {
    return runSelectedScript(mainScript.path, args, runScriptImpl, stderr);
  }

  const commands = listAvailableCommands(scriptsDir);
  if (commands.length > 0) {
    if (subcommand) {
      stderr.write(`${skillName}: unknown command '${subcommand}'\n`);
    } else {
      stderr.write(`${skillName}: no default 'main' script found\n`);
    }

    stderr.write(`Usage: ${skillName} <command> [args...]\n`);
    stderr.write(`Available commands: ${commands.join(" ")}\n`);

    return { handled: true, code: 2, signal: null };
  }

  return { handled: false, code: 1, signal: null };
}

async function runSelectedScript(
  scriptPath: string,
  scriptArgs: string[],
  runScriptImpl: (scriptPath: string, args: string[]) => Promise<RunResult>,
  stderr: Pick<NodeJS.WriteStream, "write">,
): Promise<DispatchResult> {
  try {
    const result = await runScriptImpl(scriptPath, scriptArgs);
    return {
      handled: true,
      code: result.code ?? 1,
      signal: result.signal,
    };
  } catch (error) {
    if (error instanceof RunnerError) {
      stderr.write(`skillx: ${error.message}\n`);
      return { handled: true, code: 1, signal: null };
    }

    throw error;
  }
}
