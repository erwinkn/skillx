# skillx

`skillx` makes scripts in a skill's `scripts/` directory executable by convention:

- `scripts/main.{ts,js,py,sh}` -> `skillx <skill> ...`
- `scripts/<command>.{ts,js,py,sh}` -> `skillx <skill> <command> ...`

If `scripts/<command>.*` is missing, `skillx` falls back to `scripts/main.*` and passes `<command>` as the first argument.

## Install

```bash
npm i -g skillx
pnpm i -g skillx
bun i -g skillx
```

## Usage

```bash
skillx <skill> [args...]
skillx <skill> <script-name> [args...]
skillx --list
skillx --add-path <skill> <path>
skillx --add-root <path>
```

Examples:

```bash
skillx my-skill --dry-run
skillx my-skill do --dry-run
skillx --list
skillx --add-path my-skill ~/Code/my-skill
skillx --add-root ~/Code/my-skills
```

`skillx --list` prints available skill names that have executable scripts.

## Resolution order

When you run `skillx <skill> ...`, skill directories are checked in this order:

1. Custom skill path from config (`~/.skillx/config.json`, or `$SKILLX_CONFIG`)
2. Custom skills roots from config (`skillRoots` list)
3. `<git-repo-root>/.agents/skill/<skill>`
4. `<git-repo-root>/.agent/skills/<skill>`
5. `<git-repo-root>/.agents/skills/<skill>`
6. `<git-repo-root>/.claude/skills/<skill>`
7. `<git-repo-root>/.codex/skills/<skill>`
8. `<git-repo-root>/skills/<skill>` (OpenClaw workspace skills)
9. `~/.agents/skills/<skill>` (or `$SCRIPT_SKILLS_HOME/<skill>` if set)
10. `~/.agent/skills/<skill>`
11. `~/.claude/skills/<skill>` (or `$SCRIPT_CLAUDE_SKILLS_HOME/<skill>` if set)
12. `~/.openclaw/skills/<skill>` (or `$SCRIPT_OPENCLAW_SKILLS_HOME/<skill>` if set, using `$OPENCLAW_STATE_DIR` or `$OPENCLAW_HOME` when present)
13. `$CODEX_HOME/skills/<skill>` (fallback `~/.codex/skills/<skill>`)

## Custom skill path config

Set a custom location for a specific skill:

```bash
skillx --add-path <skill> <path>
```

Add an entire skills folder (containing many `<skill>/scripts/...` directories):

```bash
skillx --add-root <path>
```

By default, mappings are saved to `~/.skillx/config.json`:

```json
{
  "skillPaths": {
    "my-skill": "/absolute/path/to/my-skill"
  },
  "skillRoots": [
    "/absolute/path/to/my-skills"
  ]
}
```

Use `$SKILLX_CONFIG` to store this config file elsewhere.

## Script dispatch behavior

Within a matched skill directory:

- `skillx <skill> <name> ...` tries `scripts/<name>.*` first.
- If `scripts/<name>.*` is missing, it falls back to `scripts/main.*` and passes `<name>` through as the first argument.
- `skillx <skill> ...` runs `scripts/main.*`.
- If `main` is missing but named scripts exist, `skillx` shows available commands and exits with code `2`.

## Supported script targets

- `.js`, `.mjs`, `.cjs` -> `node`
- `.ts`, `.mts`, `.cts` -> `bun` (preferred), then `node` (native TS support), `tsx`, `ts-node`, `deno`
- `.py` -> `uv run` (preferred), fallback `python3`
- `.sh` -> `bash`
- executable files with a shebang (`#!...`) -> executed directly

Node native TypeScript execution is used when Node supports it (`v22.18+`, `v23+`, or `v24.3+`).

All args are forwarded unchanged.
