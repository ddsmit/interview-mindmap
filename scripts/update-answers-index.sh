#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
answers_dir="$repo_root/answers"
index_file="$answers_dir/index.json"

if [[ ! -d "$answers_dir" ]]; then
  echo "answers directory not found: $answers_dir" >&2
  exit 1
fi

tmp_list="$(mktemp)"
trap 'rm -f "$tmp_list"' EXIT
find "$answers_dir" -maxdepth 1 -type f -name '*.md' -print \
  | sed "s|^$answers_dir/||" \
  | LC_ALL=C sort > "$tmp_list"

{
  printf '{\n'
  printf '  "files": [\n'

  line_count="$(wc -l < "$tmp_list" | tr -d '[:space:]')"
  i=0
  while IFS= read -r file; do
    i=$((i + 1))
    if [[ "$i" -lt "$line_count" ]]; then
      printf '    "%s",\n' "$file"
    else
      printf '    "%s"\n' "$file"
    fi
  done < "$tmp_list"

  printf '  ]\n'
  printf '}\n'
} > "$index_file"
