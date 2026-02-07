# skillx

`skillx` is a CLI that runs scripts from skill directories.

## Install

```bash
npm i -g skillx
```

## Usage

```bash
skillx <skill> [args...]
skillx <skill> <script-name> [args...]
skillx --list
```

Examples:

```bash
skillx my-skill --dry-run
skillx my-skill do --dry-run
skillx --list
```

`skillx --list` prints available skill names that have executable scripts.

## Resolution order

When you run `skillx <skill> ...`, skill directories are checked in this order:

1. `<git-repo-root>/.agents/skill/<skill>`
2. `<git-repo-root>/.agent/skills/<skill>`
3. `<git-repo-root>/.agents/skills/<skill>`
4. `<git-repo-root>/.claude/skills/<skill>`
5. `<git-repo-root>/.codex/skills/<skill>`
6. `~/.agents/skills/<skill>` (or `$SCRIPT_SKILLS_HOME/<skill>` if set)
7. `~/.agent/skills/<skill>`
8. `~/.claude/skills/<skill>` (or `$SCRIPT_CLAUDE_SKILLS_HOME/<skill>` if set)
9. `$CODEX_HOME/skills/<skill>` (fallback `~/.codex/skills/<skill>`)

## Script dispatch behavior

Within a matched skill directory:

- `skillx <skill> <name> ...` tries `scripts/<name>.*` first.
- If `scripts/<name>.*` is missing, it falls back to `scripts/main.*` and passes `<name>` through as the first argument.
- `skillx <skill> ...` runs `scripts/main.*`.
- If `main` is missing but named scripts exist, `skillx` shows available commands and exits with code `2`.

## Supported script targets

- `.js`, `.mjs`, `.cjs` -> `node`
- `.ts`, `.mts`, `.cts` -> bundled `tsx`
- `.py` -> `uv run` (preferred), fallback `python3`
- `.sh` -> `bash`
- executable files with a shebang (`#!...`) -> executed directly

All args are forwarded unchanged.
