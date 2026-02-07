import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const SUPPORTED_EXTENSIONS = [
  ".ts",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".sh",
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export interface ScriptMatch {
  path: string;
  extension: SupportedExtension | "shebang";
}

export function findScriptForBase(basePath: string): ScriptMatch | null {
  for (const extension of SUPPORTED_EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (isRegularFile(candidate)) {
      return { path: candidate, extension };
    }
  }

  if (isExecutableWithShebang(basePath)) {
    return { path: basePath, extension: "shebang" };
  }

  return null;
}

export function listAvailableCommands(scriptsDir: string): string[] {
  if (!isDirectory(scriptsDir)) {
    return [];
  }

  const commands = new Set<string>();
  const entries = readdirSync(scriptsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const fileName = entry.name;
    const fullPath = path.join(scriptsDir, fileName);

    const extension = path.extname(fileName);
    if (isSupportedExtension(extension)) {
      const base = path.basename(fileName, extension);
      if (base !== "main") {
        commands.add(base);
      }
      continue;
    }

    if (isExecutableWithShebang(fullPath) && fileName !== "main") {
      commands.add(fileName);
    }
  }

  return [...commands].sort((a, b) => a.localeCompare(b));
}

export function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

export function isRegularFile(targetPath: string): boolean {
  try {
    return statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

export function isExecutableWithShebang(targetPath: string): boolean {
  try {
    const stats = statSync(targetPath);
    if (!stats.isFile()) {
      return false;
    }

    const isExecutable = (stats.mode & 0o111) !== 0;
    if (!isExecutable) {
      return false;
    }

    const head = readFileSync(targetPath, { encoding: "utf8", flag: "r" }).slice(0, 2);
    return head === "#!";
  } catch {
    return false;
  }
}

function isSupportedExtension(extension: string): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}
