import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

  const repoRoot = resolveRepoRoot(cwd);

  const skillsHome = env.SCRIPT_SKILLS_HOME ?? path.join(homeDir, ".agents", "skills");
  const agentSkillsHome = path.join(homeDir, ".agent", "skills");
  const claudeSkillsHome = env.SCRIPT_CLAUDE_SKILLS_HOME ?? path.join(homeDir, ".claude", "skills");
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
  }

  roots.push(skillsHome);
  roots.push(agentSkillsHome);
  roots.push(claudeSkillsHome);
  roots.push(codexSkillsHome);

  return roots;
}

export function getSkillCandidatePaths(skillName: string, context: ResolveContext = {}): string[] {
  return getSkillSearchRoots(context).map((root) => path.join(root, skillName));
}
