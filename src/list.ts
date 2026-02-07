import path from "node:path";
import { readdirSync } from "node:fs";
import { findScriptForBase, isDirectory, listAvailableCommands } from "./discovery.js";
import { getSkillSearchRoots, type ResolveContext } from "./resolve.js";

export interface ListedSkill {
  name: string;
  root: string;
}

export function listAvailableSkills(context: ResolveContext = {}): ListedSkill[] {
  const roots = getSkillSearchRoots(context);
  const seen = new Set<string>();
  const skills: ListedSkill[] = [];

  for (const root of roots) {
    if (!isDirectory(root)) {
      continue;
    }

    const entries = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const name of entries) {
      if (seen.has(name)) {
        continue;
      }

      const skillRoot = path.join(root, name);
      if (!hasRunnableScripts(skillRoot)) {
        continue;
      }

      seen.add(name);
      skills.push({ name, root: skillRoot });
    }
  }

  return skills;
}

function hasRunnableScripts(skillRoot: string): boolean {
  const scriptsDir = path.join(skillRoot, "scripts");
  if (!isDirectory(scriptsDir)) {
    return false;
  }

  if (findScriptForBase(path.join(scriptsDir, "main"))) {
    return true;
  }

  return listAvailableCommands(scriptsDir).length > 0;
}
