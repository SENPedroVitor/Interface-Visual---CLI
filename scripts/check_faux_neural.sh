#!/usr/bin/env bash
set -u

EXPECTED_PATH="third_party/faux-neural"
EXPECTED_URL="https://github.com/SENPedroVitor/Faux-Neural.git"
EXPECTED_SHA="528ce9f703b5f9da749737be3f7be05345cbb983"

failures=0

report() {
  printf '%s\n' "$1"
}

divergence() {
  report "DIVERGENCE: $1"
  failures=$((failures + 1))
}

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  report "DIVERGENCE: not running inside a git repository"
  exit 1
}

cd "$root" || exit 1

report "Checking Faux-Neural submodule"
report "Expected path: $EXPECTED_PATH"
report "Expected URL: $EXPECTED_URL"
report "Expected SHA: $EXPECTED_SHA"

if [ ! -f .gitmodules ]; then
  divergence ".gitmodules is missing"
else
  actual_url="$(git config --file .gitmodules --get "submodule.$EXPECTED_PATH.url" 2>/dev/null || true)"
  actual_path="$(git config --file .gitmodules --get "submodule.$EXPECTED_PATH.path" 2>/dev/null || true)"

  if [ "$actual_path" != "$EXPECTED_PATH" ]; then
    divergence ".gitmodules path is '${actual_path:-<missing>}'"
  fi

  if [ "$actual_url" != "$EXPECTED_URL" ]; then
    divergence ".gitmodules URL is '${actual_url:-<missing>}'"
  fi
fi

tree_entry="$(git ls-tree HEAD "$EXPECTED_PATH" 2>/dev/null || true)"
if [ -z "$tree_entry" ]; then
  divergence "submodule gitlink is missing from HEAD"
else
  gitlink_sha="$(printf '%s\n' "$tree_entry" | awk '{print $3}')"
  if [ "$gitlink_sha" != "$EXPECTED_SHA" ]; then
    divergence "gitlink SHA is '$gitlink_sha'"
  else
    report "Gitlink SHA matches"
  fi
fi

submodule_status="$(git submodule status -- "$EXPECTED_PATH" 2>/dev/null || true)"
if [ -z "$submodule_status" ]; then
  divergence "git submodule status did not report $EXPECTED_PATH"
else
  report "Submodule status: $submodule_status"
  status_prefix="$(printf '%s' "$submodule_status" | cut -c1)"
  if [ "$status_prefix" != " " ]; then
    divergence "submodule status prefix is '$status_prefix'"
  fi
fi

if [ ! -d "$EXPECTED_PATH/.git" ] && [ ! -f "$EXPECTED_PATH/.git" ]; then
  divergence "submodule working tree is not initialized"
else
  worktree_sha="$(git -C "$EXPECTED_PATH" rev-parse HEAD 2>/dev/null || true)"
  if [ "$worktree_sha" != "$EXPECTED_SHA" ]; then
    divergence "submodule working tree SHA is '${worktree_sha:-<missing>}'"
  else
    report "Working tree SHA matches"
  fi

  dirty_status="$(git -C "$EXPECTED_PATH" status --short 2>/dev/null || true)"
  if [ -n "$dirty_status" ]; then
    divergence "submodule working tree has local changes:"
    printf '%s\n' "$dirty_status"
  else
    report "Submodule working tree is clean"
  fi
fi

if [ "$failures" -eq 0 ]; then
  report "Faux-Neural submodule check passed"
else
  report "Faux-Neural submodule check found $failures divergence(s)"
fi

exit "$failures"
