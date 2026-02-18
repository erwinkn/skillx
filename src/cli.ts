import { dispatchSkillCommand } from "./dispatch.js";
import { readFileSync } from "node:fs";
import { listAvailableSkills } from "./list.js";
import { SUPPORTED_EXTENSIONS } from "./discovery.js";
import { saveSkillPathOverride, saveSkillRoot } from "./config.js";

const SUPPORTED_EXTENSIONS_TEXT = SUPPORTED_EXTENSIONS.join(", ");

const HELP_TEXT = `skillx - Run skill scripts from skill directories

Usage:
  skillx <skill> [args...]
  skillx <skill> <script-name> [args...]
  skillx --list
  skillx --add-path <skill> <path>
  skillx --add-root <path>

Examples:
  skillx my-skill --dry-run
  skillx my-skill do --dry-run
  skillx --list
  skillx --add-path my-skill ~/Code/my-skill
  skillx --add-root ~/Code/my-skills

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
  saveSkillPathOverrideImpl?: typeof saveSkillPathOverride;
  saveSkillRootImpl?: typeof saveSkillRoot;
}

export async function main(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const dispatchSkillCommandImpl = dependencies.dispatchSkillCommandImpl ?? dispatchSkillCommand;
  const listAvailableSkillsImpl = dependencies.listAvailableSkillsImpl ?? listAvailableSkills;
  const saveSkillPathOverrideImpl = dependencies.saveSkillPathOverrideImpl ?? saveSkillPathOverride;
  const saveSkillRootImpl = dependencies.saveSkillRootImpl ?? saveSkillRoot;

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

  if (firstArg === "--add-path") {
    if (argv.length !== 3) {
      stderr.write("skillx: --add-path requires exactly <skill> and <path>\n");
      return 1;
    }

    const skillName = argv[1];
    const skillPath = argv[2];
    if (!skillName || !skillPath) {
      stderr.write("skillx: --add-path requires exactly <skill> and <path>\n");
      return 1;
    }

    if (isInvalidSkillName(skillName)) {
      stderr.write(`skillx: invalid skill name '${skillName}'\n`);
      return 1;
    }

    try {
      const saved = saveSkillPathOverrideImpl(skillName, skillPath);
      stdout.write(`Saved custom path for '${skillName}' -> ${saved.resolvedSkillPath}\n`);
      stdout.write(`Config: ${saved.configPath}\n`);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to save custom skill path";
      stderr.write(`skillx: ${message}\n`);
      return 1;
    }
  }

  if (firstArg === "--add-root") {
    if (argv.length !== 2) {
      stderr.write("skillx: --add-root requires exactly <path>\n");
      return 1;
    }

    const skillRoot = argv[1];
    if (!skillRoot) {
      stderr.write("skillx: --add-root requires exactly <path>\n");
      return 1;
    }

    try {
      const saved = saveSkillRootImpl(skillRoot);
      stdout.write(`Saved custom skills root -> ${saved.resolvedSkillRoot}\n`);
      stdout.write(`Config: ${saved.configPath}\n`);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to save custom skills root";
      stderr.write(`skillx: ${message}\n`);
      return 1;
    }
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
