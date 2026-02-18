import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getConfiguredSkillPath, getConfiguredSkillRoots } from "./config.js";

export interface ResolveContext {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export function resolveRepoRoot(cwd: string): string | null {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return null;
  }

  const repoRoot = result.stdout.trim();
  return repoRoot.length > 0 ? repoRoot : null;
}

export function getSkillSearchRoots(context: ResolveContext = {}): string[] {
  const cwd = context.cwd ?? process.cwd();
  const env = context.env ?? process.env;
  const homeDir = context.homeDir ?? os.homedir();
  const configuredSkillRoots = getConfiguredSkillRoots(context);

  const repoRoot = resolveRepoRoot(cwd);

  const skillsHome = env.SCRIPT_SKILLS_HOME ?? path.join(homeDir, ".agents", "skills");
  const agentSkillsHome = path.join(homeDir, ".agent", "skills");
  const claudeSkillsHome = env.SCRIPT_CLAUDE_SKILLS_HOME ?? path.join(homeDir, ".claude", "skills");
  const openClawBaseHome = env.OPENCLAW_HOME ?? homeDir;
  const openClawStateDir = env.OPENCLAW_STATE_DIR ?? path.join(openClawBaseHome, ".openclaw");
  const openClawSkillsHome =
    env.SCRIPT_OPENCLAW_SKILLS_HOME ?? path.join(openClawStateDir, "skills");
  const codexSkillsHome = env.CODEX_HOME
    ? path.join(env.CODEX_HOME, "skills")
    : path.join(homeDir, ".codex", "skills");

  const roots: string[] = [];

  if (repoRoot) {
    roots.push(path.join(repoRoot, ".agents", "skill"));
    roots.push(path.join(repoRoot, ".agent", "skills"));
    roots.push(path.join(repoRoot, ".agents", "skills"));
    roots.push(path.join(repoRoot, ".claude", "skills"));
    roots.push(path.join(repoRoot, ".codex", "skills"));
    roots.push(path.join(repoRoot, "skills"));
  }

  roots.push(skillsHome);
  roots.push(agentSkillsHome);
  roots.push(claudeSkillsHome);
  roots.push(openClawSkillsHome);
  roots.push(codexSkillsHome);

  const orderedRoots = [...configuredSkillRoots, ...roots];
  const seen = new Set<string>();
  const dedupedRoots: string[] = [];
  for (const root of orderedRoots) {
    if (seen.has(root)) {
      continue;
    }

    seen.add(root);
    dedupedRoots.push(root);
  }

  return dedupedRoots;
}

export function getSkillCandidatePaths(skillName: string, context: ResolveContext = {}): string[] {
  const candidatePaths = getSkillSearchRoots(context).map((root) => path.join(root, skillName));
  const configuredPath = getConfiguredSkillPath(skillName, context);
  if (!configuredPath || candidatePaths.includes(configuredPath)) {
    return candidatePaths;
  }

  return [configuredPath, ...candidatePaths];
}
