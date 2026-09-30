#!/bin/bash
# Publish extensions to Cloudflare R2 (the spotcat bucket, https://cdn.spotcat.ai/extensions/).
#
#   ./scripts/publish.sh translate codec     publish these extensions (official ones in extensions/<id>, community ones in registry.json)
#   ./scripts/publish.sh --changed           publish every extension whose version is newer than the CDN's
#   ./scripts/publish.sh --index-only        only rebuild index.json from registry.json (recommended list changed, extension delisted)
#   DRY_RUN=1 ./scripts/publish.sh ...       pack only, don't upload
#
# Each extension is published on its own: first <id>/<version>.zip is uploaded (cached forever; a version can't be
# overwritten), then its entry is merged into index.json (not cached) — so any package a client sees in the index exists.
# Community extensions removed from registry.json drop out of index.json on the next publish (uploaded packages are kept).
#
# Credentials: with AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (R2 S3 keys) and CLOUDFLARE_ACCOUNT_ID set, the aws CLI is
# used (CI: the "Publish extensions" workflow in thinkany-ai/spotcat); otherwise a logged-in wrangler.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET=spotcat
PREFIX=extensions
CDN="https://cdn.spotcat.ai/$PREFIX"
REPO_URL=https://github.com/thinkany-ai/spotcat-extensions
DIST=dist
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
  : "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
  upload() { # <file> <key> <content-type> <cache-control>
    echo "    ↑ $2"
    AWS_EC2_METADATA_DISABLED=true aws s3 cp "$1" "s3://$BUCKET/$2" \
      --endpoint-url "https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com" --region auto \
      --content-type "$3" --cache-control "$4" --no-progress --only-show-errors
  }
else
  upload() {
    echo "    ↑ $2"
    npx -y wrangler@latest r2 object put "$BUCKET/$2" --file "$1" --content-type "$3" \
      --cache-control "$4" --remote >/dev/null
  }
fi
[ -n "${DRY_RUN:-}" ] && upload() { echo "    (dry run) $2"; }

IMMUTABLE="public, max-age=31536000, immutable"

# The live index.json (missing before the first publish)
curl -fsS "$CDN/index.json?t=$(date +%s)" -o "$WORK/index.json" 2>/dev/null || echo '{"extensions":[]}' > "$WORK/index.json"

online_version() { # <id>
  python3 -c 'import json,sys; print(next((e["version"] for e in json.load(open(sys.argv[1]))["extensions"] if e["id"]==sys.argv[2]), ""))' "$WORK/index.json" "$1"
}

# Community extension: clone repo + ref (tag or commit) from registry.json into a temp folder and print the extension folder
fetch_community() { # <id>
  local spec repo ref subdir dir
  spec=$(python3 -c 'import json,sys; e=next((e for e in json.load(open("registry.json"))["community"] if e["id"]==sys.argv[1]), None); print("" if e is None else "\t".join([e["repo"], e["ref"], e.get("path", "")]))' "$1")
  [ -n "$spec" ] || { echo "Unknown extension: $1 (not in extensions/ or registry.json)" >&2; return 1; }
  IFS=$'\t' read -r repo ref subdir <<< "$spec"
  dir="$WORK/src/$1"
  git clone --quiet "$repo" "$dir" >&2
  git -C "$dir" -c advice.detachedHead=false checkout --quiet "$ref" >&2
  echo "$dir/$subdir" "$repo"
}

publish_one() { # <id>
  local id=$1 dir homepage official=""
  if [ -d "extensions/$id" ]; then
    dir="extensions/$id"; homepage="$REPO_URL/tree/main/extensions/$id"; official="--official"
  else
    read -r dir homepage < <(fetch_community "$id") || true
    [ -n "${dir:-}" ] || return 1
  fi

  echo "==> $id"
  python3 scripts/pack.py "$dir" --out "$DIST" --homepage "$homepage" $official
  local version
  version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$DIST/$id/entry.json")
  local manifest_id
  manifest_id=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$DIST/$id/entry.json")
  [ "$manifest_id" = "$id" ] || { echo "manifest id \"$manifest_id\" doesn't match \"$id\"" >&2; return 1; }

  if [ "$(online_version "$id")" = "$version" ]; then
    echo "    $version is already published, skipping (bump version in manifest.json to publish a new one)"
    return 0
  fi
  # Bypass the CDN cache with a query string; otherwise this check's 404 gets cached and the upload stays unreachable for minutes
  if [ -z "${DRY_RUN:-}" ] && curl -fsI "$CDN/$id/$version.zip?check=$(date +%s)" >/dev/null 2>&1; then
    echo "    $CDN/$id/$version.zip already exists; a version can't be overwritten, bump version" >&2
    return 1
  fi

  if [ -d "$DIST/$id/$version" ]; then
    for icon in "$DIST/$id/$version"/*; do
      upload "$icon" "$PREFIX/$id/$version/$(basename "$icon")" "$(file -b --mime-type "$icon")" "$IMMUTABLE"
    done
  fi
  upload "$DIST/$id/$version.zip" "$PREFIX/$id/$version.zip" application/zip "$IMMUTABLE"
  cp "$DIST/$id/entry.json" "$WORK/entry-$id.json"
  PUBLISHED+=("$id")
}

all_ids() {
  ls extensions
  python3 -c 'import json; [print(e["id"]) for e in json.load(open("registry.json"))["community"]]'
}

PUBLISHED=()
case "${1:-}" in
  "") echo "usage: $0 <id>... | --changed | --index-only" >&2; exit 1 ;;
  --index-only) ;;
  --changed)
    for id in $(all_ids); do
      if [ -d "extensions/$id" ]; then
        local_version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "extensions/$id/manifest.json")
      else
        local_version=$(python3 -c 'import json,sys; print(next(e.get("version","") for e in json.load(open("registry.json"))["community"] if e["id"]==sys.argv[1]))' "$id")
      fi
      [ "$(online_version "$id")" = "$local_version" ] || publish_one "$id"
    done ;;
  *) for id in "$@"; do publish_one "$id"; done ;;
esac

if [ "${1:-}" = "--changed" ] && [ ${#PUBLISHED[@]} -eq 0 ]; then
  echo "Nothing changed."
  exit 0
fi

# Merge: newly published entries replace old ones; keep only extensions still in extensions/ or registry.json
python3 - "$WORK" "${PUBLISHED[@]+"${PUBLISHED[@]}"}" > "$WORK/index.new.json" <<'EOF'
import json, os, sys
from datetime import datetime, timezone
work, published = sys.argv[1], sys.argv[2:]
registry = json.load(open("registry.json"))
known = set(os.listdir("extensions")) | {e["id"] for e in registry["community"]}
entries = {e["id"]: e for e in json.load(open(f"{work}/index.json"))["extensions"] if e["id"] in known}
for i in published:
    entries[i] = json.load(open(f"{work}/entry-{i}.json"))
# Official extensions first, then by id
ordered = sorted(entries.values(), key=lambda e: (not e.get("official"), e["id"]))
print(json.dumps({
    "version": 1,
    "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "recommended": [i for i in registry["recommended"] if i in entries],
    "extensions": ordered,
}, ensure_ascii=False, indent=2))
EOF

if [ -n "${DRY_RUN:-}" ]; then
  mkdir -p "$DIST"
  cp "$WORK/index.new.json" "$DIST/index.json"
  echo "Dry run: $DIST/index.json"
  exit 0
fi
upload "$WORK/index.new.json" "$PREFIX/index.json" "application/json; charset=utf-8" "no-store, max-age=0"
echo "Published ${PUBLISHED[*]:-(index only)} → $CDN/index.json"
