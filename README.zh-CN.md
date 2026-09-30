# Spotcat Extensions

[English](README.md) | 简体中文

[Spotcat](https://github.com/thinkany-ai/spotcat) 的扩展仓库：官方扩展源码、开发文档、类型声明、给 AI agent 用的开发 skill，以及插件市场的收录和发布流程。

用户在 Spotcat「设置 › 扩展 › 插件市场」中按需安装扩展，安装包来自 `https://cdn.spotcat.ai/extensions/`。

## 官方扩展

| 扩展 | 说明 |
|---|---|
| [`translate`](extensions/translate) | 多服务对照翻译：系统翻译、Google 翻译、AI 翻译 |
| [`codec`](extensions/codec) | URL / Base64 编码解码 |

社区扩展见 [`registry.json`](registry.json)。

## 开发扩展

扩展就是一个包含 `manifest.json` 和 `index.html` 的目录，纯 HTML/CSS/JS，通过 `window.spotcat` 调用剪贴板、存储、网络、AI 等能力。

- **开发文档**：[docs/development.md](docs/development.md)
- **类型声明**：[spotcat.d.ts](spotcat.d.ts)
- **AI agent**：让 Claude Code / Codex 等先读 [skills/spotcat-extension/SKILL.md](skills/spotcat-extension/SKILL.md)，它包含开发流程、模板和检查清单。也可以安装成 Claude Code 的 skill：

  ```sh
  git clone https://github.com/thinkany-ai/spotcat-extensions.git
  cp -R spotcat-extensions/skills/spotcat-extension ~/.claude/skills/
  ```

- **调试**：把扩展目录拖到（或软链接到）`~/Library/Application Support/Spotcat/Extensions/`，呼出 Spotcat 即可使用。

## 上架到插件市场

**社区扩展**

1. 把扩展开源到你自己的 GitHub 仓库，建议命名为 `spotcat-extension-<名字>`，`manifest.json` 放在仓库根目录。
2. 用 `python3 scripts/pack.py --check <扩展目录>` 校验，然后打一个版本 tag（如 `v1.0.0`，与 `manifest.json` 的 `version` 一致）。
3. [提交收录申请](https://github.com/thinkany-ai/spotcat-extensions/issues/new?template=submit-extension.yml)。
4. 审核通过后，维护者把它加进 `registry.json`，CI 自动打包上传到 CDN。发布新版本时打新 tag 并在 issue 里回复。

**官方扩展**：修改 `extensions/<id>` 并提高 `version`，合并到 `main` 后自动发布。

## 维护者：发布

```sh
./scripts/publish.sh --changed          # 发布所有版本号比 CDN 上新的扩展（CI 在 main 推送后执行）
./scripts/publish.sh translate          # 只发布某个扩展
./scripts/publish.sh --index-only       # 只重新生成 index.json（改了推荐列表、下架社区扩展）
DRY_RUN=1 ./scripts/publish.sh --changed # 只打包到 dist/，不上传
```

每个扩展独立发布：先上传 `extensions/<id>/<version>.zip`（永久缓存，同一版本不能覆盖），再把条目合并进 `extensions/index.json`（不缓存）。

收录社区扩展时，在 `registry.json` 的 `community` 里加一项：

```json
{ "id": "hello", "repo": "https://github.com/someone/spotcat-extension-hello", "ref": "v1.0.0", "version": "1.0.0" }
```

`ref` 为审核过的 tag 或 commit；扩展不在仓库根目录时加 `"path": "子目录"`。发布时会校验克隆下来的 `manifest.json` 与这里的 `id` 一致。从 `community` 删除即下架。

`recommended` 里的扩展会在用户首次运行 Spotcat 时自动安装。

凭据：CI 需要仓库 Secrets `CLOUDFLARE_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`（spotcat 桶的 R2 读写令牌）；本地发布使用已登录的 `wrangler`。

## 许可证

本仓库的官方扩展、文档、`spotcat.d.ts` 和脚本采用 [MIT 协议](LICENSE)。社区扩展的许可证以各自仓库为准。
