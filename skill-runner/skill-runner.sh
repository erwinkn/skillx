# shellcheck shell=zsh

if [[ -n "${_SCRIPTDROP_LAUNCHER_LOADED:-}" ]]; then
  return 0
fi
typeset -g _SCRIPTDROP_LAUNCHER_LOADED=1

: "${SCRIPT_SKILLS_HOME:=$HOME/.agents/skills}"
: "${SCRIPT_CLAUDE_SKILLS_HOME:=$HOME/.claude/skills}"

if (( $+functions[command_not_found_handler] )) && (( ! $+functions[_script_drop_prev_cnf_handler] )); then
  functions[_script_drop_prev_cnf_handler]=$functions[command_not_found_handler]
fi

_script_drop_run_base() {
  typeset -g _script_drop_last_ran=0
  local base="$1"
  shift
  local candidate
  local ext

  for ext in ts js mjs; do
    candidate="${base}.${ext}"
    if [[ -f "$candidate" ]]; then
      _script_drop_last_ran=1
      bun "$candidate" "$@"
      return $?
    fi
  done

  candidate="${base}.py"
  if [[ -f "$candidate" ]]; then
    _script_drop_last_ran=1
    uv run "$candidate" "$@"
    return $?
  fi

  return 1
}

_script_drop_repo_root() {
  command git -C "$PWD" rev-parse --show-toplevel 2>/dev/null
}

_script_drop_run_skill() {
  local skill_root="$1"
  shift
  local rc
  local subcommand="${1:-}"
  local skill_name="${skill_root:t}"
  local file
  local base
  local -a commands
  local -a unique_commands
  local -a sorted_commands

  [[ -d "$skill_root/scripts" ]] || return 1

  # <skill> <subcommand> ... -> scripts/<subcommand>.{ts,js,mjs,py}
  if (( $# > 0 )); then
    _script_drop_run_base "$skill_root/scripts/$1" "${@:2}"
    rc=$?
    if (( _script_drop_last_ran )); then
      return $rc
    fi
  fi

  # <skill> ... -> scripts/main.{ts,js,mjs,py}
  _script_drop_run_base "$skill_root/scripts/main" "$@"
  rc=$?
  if (( _script_drop_last_ran )); then
    return $rc
  fi

  for file in "$skill_root"/scripts/*.(py|ts|js|mjs)(N); do
    base="${file:t:r}"
    if [[ "$base" != "main" ]]; then
      commands+=("$base")
    fi
  done
  unique_commands=("${(@u)commands}")
  sorted_commands=("${(@on)unique_commands}")

  if (( ${#sorted_commands[@]} > 0 )); then
    _script_drop_last_ran=1
    if [[ -n "$subcommand" ]]; then
      echo "$skill_name: unknown command '$subcommand'" >&2
    else
      echo "$skill_name: no default 'main' script found" >&2
    fi
    echo "Usage: $skill_name <command> [args...]" >&2
    echo "Available commands: ${sorted_commands[*]}" >&2
    return 2
  fi

  return 1
}

command_not_found_handler() {
  local cmd="$1"
  shift
  local skills_home="${SCRIPT_SKILLS_HOME:-$HOME/.agents/skills}"
  local claude_skills_home="${SCRIPT_CLAUDE_SKILLS_HOME:-$HOME/.claude/skills}"
  local repo_root=""
  local rc

  repo_root="$(_script_drop_repo_root)"
  if [[ -n "$repo_root" ]]; then
    _script_drop_run_skill "$repo_root/.agents/skill/$cmd" "$@"
    rc=$?
    if (( _script_drop_last_ran )); then
      return $rc
    fi
    _script_drop_run_skill "$repo_root/.agent/skills/$cmd" "$@"
    rc=$?
    if (( _script_drop_last_ran )); then
      return $rc
    fi
    _script_drop_run_skill "$repo_root/.agents/skills/$cmd" "$@"
    rc=$?
    if (( _script_drop_last_ran )); then
      return $rc
    fi
    _script_drop_run_skill "$repo_root/.claude/skills/$cmd" "$@"
    rc=$?
    if (( _script_drop_last_ran )); then
      return $rc
    fi
  fi

  _script_drop_run_skill "$skills_home/$cmd" "$@"
  rc=$?
  if (( _script_drop_last_ran )); then
    return $rc
  fi
  _script_drop_run_skill "$HOME/.agent/skills/$cmd" "$@"
  rc=$?
  if (( _script_drop_last_ran )); then
    return $rc
  fi
  _script_drop_run_skill "$claude_skills_home/$cmd" "$@"
  rc=$?
  if (( _script_drop_last_ran )); then
    return $rc
  fi

  if (( $+functions[_script_drop_prev_cnf_handler] )); then
    _script_drop_prev_cnf_handler "$cmd" "$@"
    return $?
  fi

  echo "zsh: command not found: $cmd" >&2
  return 127
}
