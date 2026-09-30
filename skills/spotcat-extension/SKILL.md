---
name: spotcat-extension
description: Build, debug and publish extensions for Spotcat, the macOS launcher (thinkany-ai/spotcat). Use when the user wants to create a new Spotcat extension or plugin (插件/扩展), change an existing one, write its manifest.json, use the window.spotcat API (clipboard, storage, fetch, AI, chat, translate, speak), debug it in Spotcat, or submit it to the Spotcat extension store.
---

# Building Spotcat extensions

A Spotcat extension is a folder: `manifest.json` declares features and how they are triggered, and `index.html` is the page shown once a feature is opened, running in a WKWebView. Plain HTML/CSS/JS — no Swift and no build step required. The page reaches system capabilities through the injected `window.spotcat`.

## Authoritative references

Read these two files before writing code. They may be newer than this skill; they win on any conflict:

- Developer docs: `docs/development.md` (inside the spotcat-extensions repository) or `https://raw.githubusercontent.com/thinkany-ai/spotcat-extensions/main/docs/development.md`
- API types: `spotcat.d.ts` or `https://raw.githubusercontent.com/thinkany-ai/spotcat-extensions/main/spotcat.d.ts`

Reference implementations live in `https://github.com/thinkany-ai/spotcat-extensions/tree/main/extensions`: `codec` is a simple single-page tool; `translate` uses network, AI, text-to-speech and chat.

## Workflow

1. **Pin down the behavior**: what input makes it appear (keywords? content match?), what it does once opened, and which permissions it needs (`network` / `ai`).
2. **Start from the template**: copy this skill's `template/` into a new folder. A community extension should get its own repository named `spotcat-extension-<name>`, with `manifest.json` at the root. Download `spotcat.d.ts` into the same folder; the template's `main.js` already references it.
3. **Edit the manifest**:
   - `id` must be globally unique: lowercase letters, digits and hyphens. `version` is `x.y.z`.
   - Each feature is one tile in the search results; its `code` is passed to the page when entered.
   - `keywords` open the feature by keyword (Chinese keywords also match pinyin). `matches` open it by content match — keep rules narrow, since broad rules make *Suggestions* noisy.
   - Put every user-facing string in `locales/<language>.json` and write `"__MSG_key__"` in the manifest. Provide at least `en` and `zh-Hans`.
   - Declare only the `permissions` you use: `network` for `spotcat.fetch`, `ai` for `spotcat.ai.*`.
   - Use `"sf:<SF Symbol name>"` plus `iconColor` for `icon`, or a png inside the extension.
4. **Write the page**: initialize in `spotcat.onEnter(({ code, type, payload }) => …)`. When `type` is `'match'`, `payload` is what the user typed.
5. **Debug**: see below.
6. **Validate**: run `python3 scripts/pack.py --check <extension folder>` from the spotcat-extensions repository (clone it if needed).
7. **Publish**: see below.

## Page rules (required)

- `html, body { background: transparent; }` so the Spotcat panel's frosted glass shows through. Support dark mode with `@media (prefers-color-scheme: dark)`.
- Use a plain `<script src="main.js">`, not `type="module"`: pages are opened from `file://`, where ES modules may be blocked.
- Ship all JS/CSS inside the extension; never load scripts from a CDN. Remote scripts and obfuscated code are rejected in review.
- Call third-party APIs with `spotcat.fetch` (needs `network`, free of CORS), not the page's own `fetch`.
- `Esc` is handled by Spotcat (it leaves the extension) and never reaches the page; don't rely on it.
- Persist data with `spotcat.storage`, not `localStorage`.
- Take every visible string from `data-i18n` / `data-i18n-placeholder` / `data-i18n-title` or `spotcat.i18n.t(key, vars)`.
- Before using AI, call `spotcat.ai.info()`; if `configured` is false, point the user to `spotcat.openSettings('ai')`. Never make the extension manage API keys itself.
- To let the user ask follow-up questions about a result, use `spotcat.chat.open({ title, context, prompt })`.

## Debugging

Drag (or symlink) the extension folder into Spotcat's extensions folder:

```sh
ln -s "$PWD" ~/Library/Application\ Support/Spotcat/Extensions/<id>
# for a locally built dev copy of Spotcat: ~/Library/Application Support/Spotcat Dev/Extensions/
```

- Open Spotcat (manifests are re-read at most every 5 seconds) and type a keyword to enter the feature, or click *Reload* in *Settings › Extensions*. The page reloads every time the feature is entered.
- The extension shows as *Local* in *Settings › Extensions*, where you can check that its features were parsed and enable or disable them.
- For page errors: enable *Settings › Advanced › Show features for web developers* in Safari, then open the Spotcat page from Safari's *Develop* menu to get the Web Inspector — or right-click the page and choose *Inspect Element*.
- If the store already has an extension with the same id, uninstall the store copy in *Settings › Extensions* first to avoid a conflict.
- You can't drive the Spotcat UI for the user. Give concrete test steps — what to type, what they should see — and remind them to check both light and dark appearance.

## Publishing to the store

- **Community extensions** (the user's own repository):
  1. Push to a public GitHub repository with a README (features, keywords, screenshots, what permissions are used for) and an open-source license.
  2. Tag a release matching `version`, e.g. `v1.0.0`.
  3. Submit it at `https://github.com/thinkany-ai/spotcat-extensions/issues/new?template=submit-extension.yml`.
  4. After review, maintainers add it to `registry.json` and it is packed and uploaded to `cdn.spotcat.ai` within about 30 minutes.
  5. For a new version: bump `version`, push a new tag and reply in the issue.
- **Official extensions** (`extensions/<id>` in spotcat-extensions): bump `version` and open a PR; it is published within about 30 minutes of merging into `main`.

Checklist before submitting:
- [ ] `scripts/pack.py --check` passes
- [ ] the `id` isn't already taken (see `https://cdn.spotcat.ai/extensions/index.json`)
- [ ] strings exist in `en` and `zh-Hans`; the background is transparent; dark mode looks right
- [ ] only the permissions in use are declared; the README lists the domains called and what is sent to AI
- [ ] no remote scripts, no obfuscated code
- [ ] `minAppVersion` is set if new APIs are used
