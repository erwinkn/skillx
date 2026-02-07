# skill-runner

Invoke scripts by command name from zsh.

## Install

From this folder:

```bash
./install.sh
source ~/.zshrc
```

Installer target:

- `~/.agent/skill-runner.sh`

## Conventions

Resolution order for a missing command `<name>`:

1. `<git-repo-root>/.agents/skill/<name>/scripts/main.{ts,js,mjs,py}`
2. `<git-repo-root>/.agent/skills/<name>/scripts/main.{ts,js,mjs,py}`
3. `<git-repo-root>/.agents/skills/<name>/scripts/main.{ts,js,mjs,py}`
4. `<git-repo-root>/.claude/skills/<name>/scripts/main.{ts,js,mjs,py}`
5. `~/.agents/skills/<name>/scripts/main.{ts,js,mjs,py}`
6. `~/.agent/skills/<name>/scripts/main.{ts,js,mjs,py}`
7. `~/.claude/skills/<name>/scripts/main.{ts,js,mjs,py}`

`.agent(s)/skills` paths are always checked before `.claude/skills`.

`scripts/main.*` supports direct invocation:

```bash
opensrc --flag value
```

`scripts/<subcommand>.*` supports subcommands:

```bash
opensrc sync --dry-run
```

This maps to `scripts/sync.{ts,js,mjs,py}` when present.
If not present, it falls back to `scripts/main.*` and passes `sync` through as the first argument.

If a skill has no `scripts/main.*` but does have named scripts, invoking:

- `<skill>`
- `<skill> <unknown-command>`

returns a helpful error with available commands.

## Runtime mapping

- `.ts/.js/.mjs` -> `bun`
- `.py` -> `uv run`

All flags and args are passed through unchanged.
