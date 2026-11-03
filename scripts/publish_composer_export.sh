#!/usr/bin/env bash
# Publish a han-compose web export to the composer bucket ids-input serves from
# (`composer/src/index.js`). The export is copied exactly as `export-web` wrote it; its `.work/` folder
# and its own markers stay behind. Nothing here deploys the Worker: it serves whatever the bucket holds,
# so a new export is this script and nothing else.
#
#   scripts/publish_composer_export.sh ~/projects/Philology/exports/serif-8156f83 [--dry-run]
#
# The version is the export's own (``.export` carries it`), so a folder cannot be published under a name
# that is not the one its manifest was built for.
set -euo pipefail
directory="$(cd "${1:?usage: scripts/publish_composer_export.sh EXPORT_DIR [--dry-run]}" && pwd -P)"
dry_run="${2:-}"
bucket="${COMPOSER_BUCKET:-ids-input-composer}"

[ "$dry_run" = --dry-run -o -z "$dry_run" ] || { echo "$dry_run is not a flag this script knows" >&2; exit 1; }
# `export-web` writes `.complete` last: a folder without it is an export that was cut short.
[ -f "$directory/.complete" ] || { echo "$directory is not a finished export: no .complete" >&2; exit 1; }
[ -f "$directory/manifest.json" ] || { echo "$directory has no manifest.json" >&2; exit 1; }

version="$(jq -er '.version' "$directory/.export")"
[ "$(jq -er '.composer.commit' "$directory/manifest.json")" = "${version%%-*}" ] \
  || { echo "the manifest's commit is not the version's: $version" >&2; exit 1; }
[ "$(jq -er '.composer.dirty' "$directory/manifest.json")" = false ] \
  || { echo "$version was exported from a tree with uncommitted changes" >&2; exit 1; }
format="$(jq -er '.format' "$directory/manifest.json")"
[ "$format" = 6 ] || { echo "$version is format $format; the client reads 6" >&2; exit 1; }

# The shards the manifest counts are the shards on disk; a half-packed export passes `rclone` silently.
for kind in records hosts; do
  expected="$(jq -er ".files.$kind.files" "$directory/manifest.json")"
  folder="$([ "$kind" = records ] && echo g || echo p)"
  found="$(find "$directory/$folder" -type f | wc -l)"
  [ "$found" = "$expected" ] || { echo "$folder/ holds $found files, the manifest says $expected" >&2; exit 1; }
done

echo "publishing $version ($(jq -r '.format' "$directory/manifest.json") format, $(jq -r '.files.records.entries' "$directory/manifest.json") records)"

if [ "$dry_run" = --dry-run ]; then
  rclone copy "$directory" "r2:$bucket/$version" --exclude '.work/**' --exclude '.export' --exclude '.complete' \
    --dry-run --stats-one-line 2>&1 | tail -2
  echo "dry run: nothing written"
  exit 0
fi

rclone copy "$directory" "r2:$bucket/$version" \
  --exclude '.work/**' --exclude '.export' --exclude '.complete' \
  --transfers 16 --checkers 32 --stats-one-line --stats 30s

# `versions.json` lists what the bucket holds, newest first. The Worker serves it at /versions.json, and
# another site reads it to choose an export instead of hard-coding one.
# `rclone cat` of a file the bucket does not hold exits 0 and prints nothing, and `jq` with no input
# document answers nothing either: the list starts as an empty one.
current="$(rclone cat "r2:$bucket/versions.json" 2>/dev/null || true)"
[ -n "$current" ] || current='[]'
updated="$(printf '%s' "$current" | jq -c --arg v "$version" '[ $v ] + (map(select(. != $v)))')"
printf '%s\n' "$updated" | rclone rcat "r2:$bucket/versions.json"

rclone check "$directory" "r2:$bucket/$version" --exclude '.work/**' --exclude '.export' --exclude '.complete' --size-only >/dev/null
echo "published $version; versions.json now $(printf '%s' "$updated" | jq -r 'join(", ")')"
