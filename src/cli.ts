import { dispatchSkillCommand } from "./dispatch.js";
import { readFileSync } from "node:fs";
import { listAvailableSkills } from "./list.js";
import { SUPPORTED_EXTENSIONS } from "./discovery.js";

const SUPPORTED_EXTENSIONS_TEXT = SUPPORTED_EXTENSIONS.join(", ");

const HELP_TEXT = `skillx - Run skill scripts from skill directories

Usage:
  skillx <skill> [args...]
  skillx <skill> <script-name> [args...]
  skillx --list

Examples:
  skillx my-skill --dry-run
  skillx my-skill do --dry-run
  skillx --list

Entrypoint:
  main.{py,ts,js}

Supported script extensions:
  ${SUPPORTED_EXTENSIONS_TEXT}
`;

export interface CliDependencies {
  stdout?: Pick<NodeJS.WriteStream, "write">;
  stderr?: Pick<NodeJS.WriteStream, "write">;
  dispatchSkillCommandImpl?: typeof dispatchSkillCommand;
  listAvailableSkillsImpl?: typeof listAvailableSkills;
}

export async function main(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const dispatchSkillCommandImpl = dependencies.dispatchSkillCommandImpl ?? dispatchSkillCommand;
  const listAvailableSkillsImpl = dependencies.listAvailableSkillsImpl ?? listAvailableSkills;

  if (argv.length === 0) {
    stderr.write(HELP_TEXT);
    return 1;
  }

  const firstArg = argv[0];
  if (!firstArg) {
    stderr.write(HELP_TEXT);
    return 1;
  }

  if (firstArg === "-h" || firstArg === "--help") {
    stdout.write(HELP_TEXT);
    return 0;
  }

  if (firstArg === "-v" || firstArg === "--version") {
    stdout.write(`${getPackageVersion()}\n`);
    return 0;
  }

  if (firstArg === "--list") {
    if (argv.length > 1) {
      stderr.write("skillx: --list does not accept positional arguments\n");
      return 1;
    }

    const skills = listAvailableSkillsImpl();
    if (skills.length === 0) {
      stdout.write("No skills found.\n");
      return 0;
    }

    for (const skill of skills) {
      stdout.write(`${skill.name}\n`);
    }
    return 0;
  }

  if (isInvalidSkillName(firstArg)) {
    stderr.write(`skillx: invalid skill name '${firstArg}'\n`);
    return 1;
  }

  const result = await dispatchSkillCommandImpl(firstArg, argv.slice(1));

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return 1;
  }

  return result.code;
}

function isInvalidSkillName(skillName: string): boolean {
  return skillName.includes("/") || skillName.includes("\\") || skillName.includes("..") || skillName.length === 0;
}

function getPackageVersion(): string {
  try {
    const packageJsonPath = new URL("../package.json", import.meta.url);
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // Ignore version lookup failures and fallback below.
  }

  return "0.0.0";
}
