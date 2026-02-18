import os from "node:os";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isDirectory } from "./discovery.js";

export interface ConfigContext {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

interface SkillxConfig {
  skillPaths?: Record<string, string>;
  skillRoots?: string[];
}

interface ReadConfigOptions {
  throwOnInvalid?: boolean;
}

export interface SaveSkillPathResult {
  configPath: string;
  resolvedSkillPath: string;
}

export interface SaveSkillRootResult {
  configPath: string;
  resolvedSkillRoot: string;
}

export function getConfigPath(context: ConfigContext = {}): string {
  const env = context.env ?? process.env;
  const homeDir = context.homeDir ?? os.homedir();
  return env.SKILLX_CONFIG ?? path.join(homeDir, ".skillx", "config.json");
}

export function getConfiguredSkillPath(skillName: string, context: ConfigContext = {}): string | null {
  const configPath = getConfigPath(context);
  const config = readSkillxConfig(context, { throwOnInvalid: false });
  const configuredPath = config.skillPaths?.[skillName];
  if (typeof configuredPath !== "string" || configuredPath.length === 0) {
    return null;
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return resolveConfiguredPath(configPath, configuredPath);
}

export function getConfiguredSkillPaths(context: ConfigContext = {}): Record<string, string> {
  const configPath = getConfigPath(context);
  const config = readSkillxConfig(context, { throwOnInvalid: false });
  const entries = Object.entries(config.skillPaths ?? {});
  const resolved: Record<string, string> = {};

  for (const [skillName, configuredPath] of entries) {
    resolved[skillName] = resolveConfiguredPath(configPath, configuredPath);
  }

  return resolved;
}

export function getConfiguredSkillRoots(context: ConfigContext = {}): string[] {
  const configPath = getConfigPath(context);
  const config = readSkillxConfig(context, { throwOnInvalid: false });
  const resolvedRoots = (config.skillRoots ?? []).map((root) => resolveConfiguredPath(configPath, root));

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const root of resolvedRoots) {
    if (seen.has(root)) {
      continue;
    }

    seen.add(root);
    deduped.push(root);
  }

  return deduped;
}

export function saveSkillPathOverride(
  skillName: string,
  skillPath: string,
  context: ConfigContext = {},
): SaveSkillPathResult {
  const cwd = context.cwd ?? process.cwd();
  const resolvedSkillPath = path.resolve(cwd, skillPath);

  if (!isDirectory(resolvedSkillPath)) {
    throw new Error(`skill path is not a directory: ${resolvedSkillPath}`);
  }

  const configPath = getConfigPath(context);
  const current = readSkillxConfig(context, { throwOnInvalid: true });
  const nextSkillPaths: Record<string, string> = { ...(current.skillPaths ?? {}), [skillName]: resolvedSkillPath };

  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify({ skillPaths: nextSkillPaths, skillRoots: current.skillRoots ?? [] }, null, 2) + "\n",
    "utf8",
  );

  return { configPath, resolvedSkillPath };
}

export function saveSkillRoot(skillRoot: string, context: ConfigContext = {}): SaveSkillRootResult {
  const cwd = context.cwd ?? process.cwd();
  const resolvedSkillRoot = path.resolve(cwd, skillRoot);

  if (!isDirectory(resolvedSkillRoot)) {
    throw new Error(`skills root is not a directory: ${resolvedSkillRoot}`);
  }

  const configPath = getConfigPath(context);
  const current = readSkillxConfig(context, { throwOnInvalid: true });
  const existingRoots = (current.skillRoots ?? []).map((root) => resolveConfiguredPath(configPath, root));
  const nextSkillRoots = existingRoots.includes(resolvedSkillRoot)
    ? existingRoots
    : [...existingRoots, resolvedSkillRoot];

  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify({ skillPaths: current.skillPaths ?? {}, skillRoots: nextSkillRoots }, null, 2) + "\n",
    "utf8",
  );

  return { configPath, resolvedSkillRoot };
}

function readSkillxConfig(context: ConfigContext, options: ReadConfigOptions): SkillxConfig {
  const configPath = getConfigPath(context);

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const parsed = parseConfigJson(raw, configPath, options.throwOnInvalid ?? false);
  if (!parsed) {
    return {};
  }

  return parsed;
}

function parseConfigJson(raw: string, configPath: string, throwOnInvalid: boolean): SkillxConfig | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) {
      if (throwOnInvalid) {
        throw new Error(`invalid config format in ${configPath}`);
      }
      return null;
    }

    const skillPathsValue = parsed.skillPaths;
    const skillRootsValue = parsed.skillRoots;
    if (skillPathsValue !== undefined && !isPlainObject(skillPathsValue)) {
      if (throwOnInvalid) {
        throw new Error(`invalid skillPaths in ${configPath}`);
      }
      return null;
    }
    if (skillRootsValue !== undefined && !isStringArray(skillRootsValue)) {
      if (throwOnInvalid) {
        throw new Error(`invalid skillRoots in ${configPath}`);
      }
      return null;
    }

    const normalizedSkillPaths: Record<string, string> = {};
    if (isPlainObject(skillPathsValue)) {
      for (const [key, value] of Object.entries(skillPathsValue)) {
        if (typeof value === "string" && value.length > 0) {
          normalizedSkillPaths[key] = value;
        }
      }
    }

    const normalizedSkillRoots: string[] = [];
    if (isStringArray(skillRootsValue)) {
      for (const root of skillRootsValue) {
        if (root.length > 0) {
          normalizedSkillRoots.push(root);
        }
      }
    }

    return { skillPaths: normalizedSkillPaths, skillRoots: normalizedSkillRoots };
  } catch (error) {
    if (throwOnInvalid) {
      if (error instanceof Error) {
        throw new Error(`failed to parse config at ${configPath}: ${error.message}`);
      }
      throw new Error(`failed to parse config at ${configPath}`);
    }
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function resolveConfiguredPath(configPath: string, configuredPath: string): string {
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return path.resolve(path.dirname(configPath), configuredPath);
}
