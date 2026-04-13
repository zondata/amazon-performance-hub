#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "debug snapshot must run inside a git repository" >&2
  exit 1
}

cd "$repo_root"

timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
out_root="$repo_root/out/debug-snapshots"
snapshot_dir="$out_root/$timestamp"
bundle_name="$timestamp.zip"
bundle_path="$out_root/$bundle_name"

mkdir -p "$snapshot_dir/git" "$snapshot_dir/repo-files" "$snapshot_dir/changed-files" "$snapshot_dir/logs"

branch_name="$(git branch --show-current 2>/dev/null || true)"
if [[ -z "$branch_name" ]]; then
  branch_name="DETACHED_HEAD"
fi
head_sha="$(git rev-parse HEAD)"

printf '%s\n' "$branch_name" > "$snapshot_dir/git/current-branch.txt"
printf '%s\n' "$head_sha" > "$snapshot_dir/git/head-commit.txt"
git status --short > "$snapshot_dir/git/status-short.txt" || true
git diff --binary > "$snapshot_dir/git/diff.patch" || true
git diff --cached --binary > "$snapshot_dir/git/diff-cached.patch" || true

copy_repo_file() {
  local rel_path="$1"
  local dest="$snapshot_dir/repo-files/$rel_path"
  if [[ -f "$rel_path" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp -p "$rel_path" "$dest"
    return 0
  fi
  return 1
}

task_id=""
task_file=""
if [[ -f "docs/v2/BUILD_STATUS.md" ]]; then
  copy_repo_file "docs/v2/BUILD_STATUS.md" || true
  task_id="$(
    sed -n 's/^Current task: `\([^`]*\)`.*/\1/p' docs/v2/BUILD_STATUS.md \
      | head -n 1 \
      | grep -Eo 'V2-[0-9][0-9A-Za-z-]*' \
      | head -n 1 \
      || true
  )"
  if [[ -z "$task_id" ]]; then
    task_id="$(
      sed -n 's/^- Task ID: `\([^`]*\)`.*/\1/p' docs/v2/BUILD_STATUS.md | head -n 1 || true
    )"
  fi
  if [[ -n "$task_id" ]]; then
    task_file="$(find docs/v2/tasks -maxdepth 1 -type f -name "${task_id}*.md" | sort | head -n 1 || true)"
    if [[ -n "$task_file" ]]; then
      copy_repo_file "$task_file" || true
    fi
  fi
fi

declare -A copied_logs=()

copy_log_if_present() {
  local rel_path="$1"
  local base_name
  if [[ -z "$rel_path" || ! -f "$rel_path" ]]; then
    return 0
  fi
  base_name="$(basename "$rel_path")"
  if [[ -n "${copied_logs[$base_name]:-}" ]]; then
    return 0
  fi
  cp -p "$rel_path" "$snapshot_dir/logs/$base_name"
  copied_logs["$base_name"]="$rel_path"
}

if [[ -n "${DEBUG_SNAPSHOT_LOG:-}" ]]; then
  copy_log_if_present "$DEBUG_SNAPSHOT_LOG"
fi

for candidate in \
  "out/verify-wsl.log" \
  "out/verification.log" \
  "out/web-build.log" \
  "out/test.log" \
  "verify-wsl.log" \
  "verification.log"
do
  copy_log_if_present "$candidate"
done

while IFS= read -r candidate; do
  copy_log_if_present "$candidate"
done < <(
  find out -maxdepth 2 -type f \
    \( -iname '*verify*.log' -o -iname '*build*.log' -o -iname '*test*.log' \) \
    -size -2048k 2>/dev/null \
    | sort \
    | head -n 10
)

should_exclude_changed_path() {
  local rel_path="$1"
  case "$rel_path" in
    .env|.env.*|*/.env|*/.env.*|node_modules/*|*/node_modules/*|apps/web/.next/*|out/*|dist/*)
      return 0
      ;;
  esac
  return 1
}

declare -A changed_paths=()

collect_changed_paths() {
  while IFS= read -r -d '' rel_path; do
    [[ -n "$rel_path" ]] || continue
    changed_paths["$rel_path"]=1
  done
}

collect_changed_paths < <(git diff --name-only -z)
collect_changed_paths < <(git diff --cached --name-only -z)
collect_changed_paths < <(git ls-files --others --exclude-standard -z)

copied_changed_count=0
missing_changed_count=0
excluded_changed_count=0

{
  echo "# Changed Files Manifest"
  echo
  echo "Generated at: $timestamp"
  echo "Branch: $branch_name"
  echo "HEAD: $head_sha"
  echo
  echo "Copied files:"
} > "$snapshot_dir/changed-files/MANIFEST.md"

: > "$snapshot_dir/changed-files/missing-from-working-tree.txt"

while IFS= read -r rel_path; do
  [[ -n "$rel_path" ]] || continue
  if should_exclude_changed_path "$rel_path"; then
    excluded_changed_count=$((excluded_changed_count + 1))
    continue
  fi
  if [[ -f "$rel_path" ]]; then
    mkdir -p "$snapshot_dir/changed-files/$(dirname "$rel_path")"
    cp -p "$rel_path" "$snapshot_dir/changed-files/$rel_path"
    printf -- '- `%s`\n' "$rel_path" >> "$snapshot_dir/changed-files/MANIFEST.md"
    copied_changed_count=$((copied_changed_count + 1))
  else
    printf '%s\n' "$rel_path" >> "$snapshot_dir/changed-files/missing-from-working-tree.txt"
    missing_changed_count=$((missing_changed_count + 1))
  fi
done < <(printf '%s\n' "${!changed_paths[@]}" | sort)

{
  echo
  echo "Missing paths noted in: \`changed-files/missing-from-working-tree.txt\`"
  echo "Excluded by policy count: $excluded_changed_count"
} >> "$snapshot_dir/changed-files/MANIFEST.md"

log_list="none detected"
if ((${#copied_logs[@]} > 0)); then
  log_list="$(printf '%s\n' "${!copied_logs[@]}" | sort | paste -sd ',' - | sed 's/,/, /g')"
fi

cat > "$snapshot_dir/README.md" <<EOF
# Amazon Performance Hub Debug Snapshot

This bundle captures the current WSL working state for a broken or unpushed task branch.

## Use this bundle when
- WSL verification failed and GitHub does not contain the latest broken local state.
- A fresh ChatGPT web chat needs the exact source of truth for debugging.

## ChatGPT web handoff
1. Upload this zip to a fresh ChatGPT web chat.
2. Tell the new chat: \`Use the uploaded debug snapshot bundle as the source of truth for the current broken local state. Do not assume GitHub has the latest local changes.\`
3. Ask the chat to inspect:
   - \`git/status-short.txt\`
   - \`git/diff.patch\`
   - \`git/diff-cached.patch\`
   - \`repo-files/docs/v2/BUILD_STATUS.md\`
   - the copied files under \`changed-files/\`

## Snapshot summary
- Branch: \`$branch_name\`
- HEAD: \`$head_sha\`
- Current task ID: \`${task_id:-unknown}\`
- Current task file: \`${task_file:-not found}\`
- Changed files copied: \`$copied_changed_count\`
- Missing changed paths noted separately: \`$missing_changed_count\`
- Verification logs copied: \`$log_list\`

## Exclusions
- No full repo copy
- No \`.env.local\` or other \`.env*\` files
- No \`node_modules\`
- No \`apps/web/.next\`
- No large irrelevant output trees such as \`out/\` snapshots or \`dist/\`
EOF

cat > "$snapshot_dir/MANIFEST.txt" <<EOF
timestamp=$timestamp
branch=$branch_name
head_sha=$head_sha
task_id=${task_id:-unknown}
task_file=${task_file:-not found}
copied_changed_files=$copied_changed_count
missing_changed_files=$missing_changed_count
excluded_changed_files=$excluded_changed_count
verification_logs=$log_list
EOF

(
  cd "$out_root"
  zip -qr "$bundle_name" "$timestamp"
)

echo "Debug snapshot ready"
echo "Snapshot directory: $snapshot_dir"
echo "Bundle path: $bundle_path"
echo "Current task ID: ${task_id:-unknown}"
echo "Changed files copied: $copied_changed_count"
echo "Verification logs copied: $log_list"
