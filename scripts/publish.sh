#!/bin/bash
# 把插件发布到 Cloudflare R2（spotcat 桶，https://cdn.spotcat.ai/extensions/）。
#
#   ./scripts/publish.sh translate codec     发布指定插件（官方插件在 extensions/<id>，社区插件在 registry.json）
#   ./scripts/publish.sh --changed           发布所有版本号比 CDN 上新的插件（CI 在 main 分支推送后执行）
#   ./scripts/publish.sh --index-only        只根据 registry.json 重新生成 index.json（改了推荐列表、下架插件时用）
#   DRY_RUN=1 ./scripts/publish.sh ...       只打包，不上传
#
# 每个插件独立发布：先上传 <id>/<version>.zip（永久缓存，同一版本不允许覆盖），
# 再合并进 index.json（不缓存）——客户端读到新条目时，它引用的包一定已经存在。
# 从 registry.json 移除的社区插件会在下次发布时从 index.json 下架（已上传的包保留）。
#
# 凭据：设置了 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY（R2 的 S3 密钥）和 CLOUDFLARE_ACCOUNT_ID 时
# 用 aws CLI（CI）；否则用本机已登录的 wrangler。
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

# 当前线上的 index.json（第一次发布时不存在）
curl -fsS "$CDN/index.json?t=$(date +%s)" -o "$WORK/index.json" 2>/dev/null || echo '{"extensions":[]}' > "$WORK/index.json"

online_version() { # <id>
  python3 -c 'import json,sys; print(next((e["version"] for e in json.load(open(sys.argv[1]))["extensions"] if e["id"]==sys.argv[2]), ""))' "$WORK/index.json" "$1"
}

# 社区插件：registry.json 里的 repo + ref（tag 或 commit）→ 克隆到临时目录，打印插件目录
fetch_community() { # <id>
  local spec repo ref subdir dir
  spec=$(python3 -c 'import json,sys; e=next((e for e in json.load(open("registry.json"))["community"] if e["id"]==sys.argv[1]), None); print("" if e is None else "\t".join([e["repo"], e["ref"], e.get("path", "")]))' "$1")
  [ -n "$spec" ] || { echo "未知插件：$1（不在 extensions/ 也不在 registry.json）" >&2; return 1; }
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
  [ "$manifest_id" = "$id" ] || { echo "manifest 里的 id「$manifest_id」与「$id」不一致" >&2; return 1; }

  if [ "$(online_version "$id")" = "$version" ]; then
    echo "    $version 已发布，跳过（发布新版本请先修改 manifest.json 的 version）"
    return 0
  fi
  # 带查询参数绕过 CDN 缓存：否则这次检查得到的 404 会被缓存，上传后几分钟内仍然下载不到
  if [ -z "${DRY_RUN:-}" ] && curl -fsI "$CDN/$id/$version.zip?check=$(date +%s)" >/dev/null 2>&1; then
    echo "    $CDN/$id/$version.zip 已存在，同一版本不能覆盖，请升级 version" >&2
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

# 合并：新发布的条目替换旧条目；只保留 extensions/ 和 registry.json 里还在的插件
python3 - "$WORK" "${PUBLISHED[@]+"${PUBLISHED[@]}"}" > "$WORK/index.new.json" <<'EOF'
import json, os, sys
from datetime import datetime, timezone
work, published = sys.argv[1], sys.argv[2:]
registry = json.load(open("registry.json"))
known = set(os.listdir("extensions")) | {e["id"] for e in registry["community"]}
entries = {e["id"]: e for e in json.load(open(f"{work}/index.json"))["extensions"] if e["id"] in known}
for i in published:
    entries[i] = json.load(open(f"{work}/entry-{i}.json"))
# 官方插件在前，其余按 id 排序
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
