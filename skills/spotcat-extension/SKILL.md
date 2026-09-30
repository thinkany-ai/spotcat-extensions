---
name: spotcat-extension
description: Build, debug and publish extensions for Spotcat, the macOS launcher (thinkany-ai/spotcat). Use when the user wants to create a new Spotcat extension or plugin (插件/扩展), change an existing one, write its manifest.json, use the window.spotcat API (clipboard, storage, fetch, AI, chat, translate, speak), debug it in Spotcat, or submit it to the Spotcat extension store.
---

# 开发 Spotcat 扩展

Spotcat 扩展是一个目录：`manifest.json` 声明功能和触发方式，`index.html` 是进入功能后显示的页面，运行在 WKWebView 中。纯 HTML/CSS/JS，不需要 Swift，也不需要构建步骤。页面通过注入的 `window.spotcat` 调用系统能力。

## 权威参考

写代码前先读这两份文件。它们可能比本 skill 新，以它们为准：

- 开发文档：`docs/development.md`（在 spotcat-extensions 仓库里时），或 `https://raw.githubusercontent.com/thinkany-ai/spotcat-extensions/main/docs/development.md`
- API 类型：`spotcat.d.ts`，或 `https://raw.githubusercontent.com/thinkany-ai/spotcat-extensions/main/spotcat.d.ts`

参考实现在 `https://github.com/thinkany-ai/spotcat-extensions/tree/main/extensions`：`codec` 是简单的单页工具，`translate` 用到了网络、AI、朗读和对话。

## 流程

1. **确认需求**：用户输入什么时出现（关键词？内容匹配？），进入后做什么，需要哪些权限（`network` / `ai`）。
2. **从模板开始**：复制本 skill 的 `template/` 到新目录。社区扩展建议单独建仓库，命名为 `spotcat-extension-<名字>`，`manifest.json` 放在仓库根目录。然后下载 `spotcat.d.ts` 到同一目录，模板的 `main.js` 已经引用了它。
3. **改 manifest**：
   - `id` 全局唯一，只能用小写字母、数字和连字符；`version` 用 `x.y.z`。
   - 每个 feature 是搜索结果里的一个格子，`code` 会在进入时传给页面。
   - `keywords` 用于关键词进入，中文自动支持拼音。`matches` 用于内容匹配，要写得窄一些：规则太宽会让「匹配推荐」变嘈杂。
   - 界面文案全部走 `locales/<语言>.json`，manifest 里写 `"__MSG_key__"`。至少提供 `en` 和 `zh-Hans`。
   - `permissions` 只声明真正用到的：`network` 对应 `spotcat.fetch`，`ai` 对应 `spotcat.ai.*`。
   - `icon` 用 `"sf:<SF Symbol 名>"` 加 `iconColor`，或用扩展目录里的 png。
4. **写页面**：在 `spotcat.onEnter(({ code, type, payload }) => …)` 里初始化。`type` 为 `'match'` 时，`payload` 是用户输入的内容。
5. **调试**：见下文。
6. **校验**：在 spotcat-extensions 仓库里运行 `python3 scripts/pack.py --check <扩展目录>`，没有 clone 仓库时先 clone。
7. **发布**：见下文。

## 页面约定（必须遵守）

- `html, body { background: transparent; }`：让 Spotcat 面板的毛玻璃透出来。用 `@media (prefers-color-scheme: dark)` 适配深色模式。
- 用普通的 `<script src="main.js">`，不要用 `type="module"`：页面以 `file://` 打开，ES Module 可能被拦截。
- 所有 JS/CSS 都随扩展一起打包，不从 CDN 加载脚本。审核时会拒绝远程脚本和混淆代码。
- 访问第三方接口用 `spotcat.fetch`（需要 `network` 权限，不受 CORS 限制），不要用页面自己的 `fetch`。
- `Esc` 由 Spotcat 处理（退出扩展），页面收不到；不要依赖它。
- 持久化用 `spotcat.storage`，不要用 `localStorage`。
- 用户可见的文字都通过 `data-i18n` / `data-i18n-placeholder` / `data-i18n-title` 或 `spotcat.i18n.t(key, vars)` 取文案。
- 需要 AI 时先调 `spotcat.ai.info()`，`configured` 为 false 时引导用户 `spotcat.openSettings('ai')`，不要让扩展自己管理 API Key。
- 想让用户针对结果继续追问时，用 `spotcat.chat.open({ title, context, prompt })`。

## 调试

把扩展目录拖到（或软链接到）Spotcat 的扩展目录：

```sh
ln -s "$PWD" ~/Library/Application\ Support/Spotcat/Extensions/<id>
# 本地构建的开发版 Spotcat 用：~/Library/Application Support/Spotcat Dev/Extensions/
```

- 呼出 Spotcat（间隔 5 秒以上会重新读取 manifest），输入关键词进入功能。也可以在「设置 › 扩展」点「重新加载」。页面每次进入功能都会重新加载。
- 扩展在「设置 › 扩展」里显示为「本地」，可以在这里查看功能是否正确解析、启用或禁用。
- 页面报错时：在 Safari 设置 › 高级里勾选「显示网页开发者功能」，然后在 Safari「开发」菜单里找到 Spotcat 的页面打开 Web Inspector；也可以在页面上右键「检查元素」。
- 插件市场里已有同 id 的扩展时，先在「设置 › 扩展」卸载市场版本，否则会冲突。
- 你不能替用户操作 Spotcat 界面。告诉用户具体的测试步骤：输入什么、预期看到什么，并提醒在浅色和深色外观下都看一遍。

## 发布到插件市场

- **社区扩展**（用户自己的仓库）：
  1. 推送到公开的 GitHub 仓库，写好 README（功能、关键词、截图、权限用途）和开源许可证。
  2. 打一个 tag，与 `version` 一致，如 `v1.0.0`。
  3. 在 `https://github.com/thinkany-ai/spotcat-extensions/issues/new?template=submit-extension.yml` 提交收录申请。
  4. 维护者审核后加入 `registry.json`，CI 打包上传到 `cdn.spotcat.ai`。
  5. 发布新版本时提高 `version`、打新 tag，并在 issue 里回复。
- **官方扩展**（spotcat-extensions 仓库的 `extensions/<id>`）：提高 `version`，提 PR；合并到 `main` 后 30 分钟内自动发布。

提交前的检查清单：
- [ ] `scripts/pack.py --check` 通过
- [ ] `id` 没有和已上架的扩展重复（见 `https://cdn.spotcat.ai/extensions/index.json`）
- [ ] 文案有 `en` 和 `zh-Hans`，页面背景透明，深色模式正常
- [ ] 只声明用到的权限；README 写明会访问哪些域名、发给 AI 哪些内容
- [ ] 没有远程脚本、没有混淆代码
- [ ] 用到新 API 时填写 `minAppVersion`
