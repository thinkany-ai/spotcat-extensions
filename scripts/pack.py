#!/usr/bin/env python3
"""校验并打包 Spotcat 插件。

    scripts/pack.py <插件目录> [--out dist] [--homepage URL] [--official]
    scripts/pack.py --check <插件目录>...      只校验，不打包（CI 用）

打包产物（发布脚本上传到 cdn.spotcat.ai/extensions/）：
    <out>/<id>/<version>.zip        插件目录的全部文件（manifest.json 在 zip 根目录），内容相同则字节相同
    <out>/<id>/<version>/icon.*     manifest 里的图标是图片时一并输出，插件市场列表用
    <out>/<id>/entry.json           index.json 中这个插件的条目（url / 图标地址按 CDN 路径填好）
"""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

CDN = "https://cdn.spotcat.ai/extensions"
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$")
MSG_RE = re.compile(r"^__MSG_(\w+)__$")
PERMISSIONS = {"network", "ai"}
MATCH_TYPES = {"regex", "text"}
# 不打进包里的文件
EXCLUDE_NAMES = {".DS_Store", "Thumbs.db"}
EXCLUDE_DIRS = {".git", "node_modules", ".github"}
# 固定时间戳，保证同样的文件打出同样的 zip（sha256 稳定）
ZIP_TIME = (2020, 1, 1, 0, 0, 0)


class PackError(Exception):
    pass


def load_manifest(directory: Path) -> dict:
    path = directory / "manifest.json"
    if not path.is_file():
        raise PackError(f"{directory}: 缺少 manifest.json")
    try:
        return json.loads(path.read_text("utf-8"))
    except json.JSONDecodeError as e:
        raise PackError(f"{path}: JSON 格式错误：{e}")


def load_locales(directory: Path) -> dict:
    locales = {}
    folder = directory / "locales"
    if folder.is_dir():
        for file in sorted(folder.glob("*.json")):
            try:
                locales[file.stem] = json.loads(file.read_text("utf-8"))
            except json.JSONDecodeError as e:
                raise PackError(f"{file}: JSON 格式错误：{e}")
    return locales


def validate(directory: Path) -> tuple[dict, dict]:
    m = load_manifest(directory)
    locales = load_locales(directory)
    errors = []

    def need(key, kind=str):
        if not isinstance(m.get(key), kind) or (kind is str and not m[key].strip()):
            errors.append(f"缺少或无效的字段 {key}")

    for key in ("id", "name", "version"):
        need(key)
    if isinstance(m.get("id"), str) and not ID_RE.match(m["id"]):
        errors.append(f"id「{m['id']}」只能用小写字母、数字和连字符")
    if isinstance(m.get("version"), str) and not VERSION_RE.match(m["version"]):
        errors.append(f"version「{m['version']}」应为 x.y.z")
    if isinstance(m.get("minAppVersion"), str) and not VERSION_RE.match(m["minAppVersion"]):
        errors.append(f"minAppVersion「{m['minAppVersion']}」应为 x.y.z")
    if not (directory / m.get("main", "index.html")).is_file():
        errors.append(f"入口页面 {m.get('main', 'index.html')} 不存在")
    for p in m.get("permissions") or []:
        if p not in PERMISSIONS:
            errors.append(f"未知权限「{p}」，可用：{', '.join(sorted(PERMISSIONS))}")
    icon = m.get("icon")
    if isinstance(icon, str) and not icon.startswith("sf:") and not (directory / icon).is_file():
        errors.append(f"图标文件 {icon} 不存在")

    features = m.get("features")
    if not isinstance(features, list) or not features:
        errors.append("features 至少要有一个功能")
        features = []
    codes = set()
    for i, f in enumerate(features):
        where = f"features[{i}]"
        if not isinstance(f.get("code"), str) or not f["code"]:
            errors.append(f"{where} 缺少 code")
        elif f["code"] in codes:
            errors.append(f"{where} code「{f['code']}」重复")
        else:
            codes.add(f["code"])
        if not isinstance(f.get("title"), str) or not f["title"]:
            errors.append(f"{where} 缺少 title")
        for j, rule in enumerate(f.get("matches") or []):
            if rule.get("type") not in MATCH_TYPES:
                errors.append(f"{where}.matches[{j}] type 应为 regex 或 text")
            elif rule["type"] == "regex":
                try:
                    re.compile(rule.get("pattern") or "")
                except re.error as e:
                    # Python 与 NSRegularExpression 语法略有差异，这里只做粗查
                    errors.append(f"{where}.matches[{j}] 正则可能有误：{e}")
                if not rule.get("pattern"):
                    errors.append(f"{where}.matches[{j}] regex 缺少 pattern")

    # __MSG_key__ 必须能在默认语言里找到
    default = m.get("defaultLocale") or "en"
    if locales and default not in locales:
        errors.append(f"defaultLocale「{default}」没有对应的 locales/{default}.json")
    for text in collect_texts(m):
        match = MSG_RE.match(text)
        if match and match.group(1) not in locales.get(default, {}):
            errors.append(f"文案 {text} 在 locales/{default}.json 中不存在")

    if errors:
        raise PackError(f"{directory}:\n  - " + "\n  - ".join(errors))
    return m, locales


def collect_texts(m: dict):
    yield m.get("name", "")
    if m.get("description"):
        yield m["description"]
    for f in m.get("features") or []:
        yield f.get("title", "")
        if f.get("description"):
            yield f["description"]
        yield from f.get("keywords") or []


def localize(text, m: dict, locales: dict):
    """把 "__MSG_key__" 展开成 {语言: 文案}；普通文本原样返回"""
    if not isinstance(text, str):
        return text
    match = MSG_RE.match(text)
    if not match:
        return text
    key = match.group(1)
    default = locales.get(m.get("defaultLocale") or "en", {})
    return {lang: msgs.get(key, default.get(key, text)) for lang, msgs in locales.items()}


def files_to_pack(directory: Path):
    for path in sorted(directory.rglob("*")):
        rel = path.relative_to(directory)
        if any(part in EXCLUDE_DIRS for part in rel.parts) or path.name in EXCLUDE_NAMES:
            continue
        if path.is_symlink():
            raise PackError(f"{path}: 插件里不能有软链接")
        if path.is_file():
            yield path, rel.as_posix()


def pack(directory: Path, out: Path, homepage: str | None, official: bool) -> dict:
    m, locales = validate(directory)
    ext_id, version = m["id"], m["version"]
    target = out / ext_id
    target.mkdir(parents=True, exist_ok=True)

    zip_path = target / f"{version}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path, name in files_to_pack(directory):
            info = zipfile.ZipInfo(name, ZIP_TIME)
            info.external_attr = 0o644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, path.read_bytes())
    data = zip_path.read_bytes()

    icon = m.get("icon")
    if isinstance(icon, str) and not icon.startswith("sf:"):
        source = directory / icon
        icon_name = "icon" + source.suffix.lower()
        (target / version).mkdir(exist_ok=True)
        (target / version / icon_name).write_bytes(source.read_bytes())
        icon = f"{CDN}/{ext_id}/{version}/{icon_name}"

    entry = {
        "id": ext_id,
        "version": version,
        "name": localize(m["name"], m, locales),
        "description": localize(m.get("description"), m, locales),
        "author": m.get("author"),
        "icon": icon,
        "iconColor": m.get("iconColor"),
        "permissions": m.get("permissions") or [],
        "features": [
            {"code": f["code"], "title": localize(f["title"], m, locales)} for f in m["features"]
        ],
        "homepage": homepage or m.get("homepage"),
        "minAppVersion": m.get("minAppVersion"),
        "official": official,
        "url": f"{CDN}/{ext_id}/{version}.zip",
        "sha256": hashlib.sha256(data).hexdigest(),
        "size": len(data),
        "published": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    entry = {k: v for k, v in entry.items() if v is not None}
    (target / "entry.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n", "utf-8")
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dirs", nargs="+", type=Path)
    parser.add_argument("--check", action="store_true", help="只校验")
    parser.add_argument("--out", type=Path, default=Path("dist"))
    parser.add_argument("--homepage")
    parser.add_argument("--official", action="store_true")
    args = parser.parse_args()

    failed = False
    for directory in args.dirs:
        try:
            if args.check:
                m, _ = validate(directory)
                print(f"ok  {m['id']} {m['version']}")
            else:
                entry = pack(directory, args.out, args.homepage, args.official)
                print(f"packed {entry['id']} {entry['version']} ({entry['size']} bytes)")
        except PackError as e:
            print(f"error: {e}", file=sys.stderr)
            failed = True
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
