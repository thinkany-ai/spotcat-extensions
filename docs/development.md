# Building Spotcat Extensions

English | [简体中文](development.zh-CN.md)

An extension is a folder: `manifest.json` describes the **features** it provides and how they are triggered, and `index.html` is the page shown when a feature is opened (it runs in a WKWebView). Plain HTML/CSS/JS, no Swift required; React/Vue and other frameworks work too once built to static files.

Official and community extensions use exactly the same format and API. The official extensions in [`extensions/`](../extensions) make good examples.

> Building an extension with an AI agent (Claude Code, Codex …)? Have it read [`skills/spotcat-extension/SKILL.md`](../skills/spotcat-extension/SKILL.md) first.

## Folder layout

```
my-extension/
├── manifest.json   required: extension info, features, triggers, permissions
├── index.html      required (rename with the main field): the page shown for a feature
├── style.css       optional, referenced from the page with a relative path
├── main.js         optional
├── icon.png        optional; an "sf:<SF Symbol>" icon works too
├── locales/        optional: translations such as en.json, zh-Hans.json
└── README.md       recommended: features, keywords, APIs used
```

Download [`spotcat.d.ts`](../spotcat.d.ts) into your extension (or repository root) and add `/// <reference path="./spotcat.d.ts" />` at the top of your JS for API completion:

```sh
curl -fsSLO https://raw.githubusercontent.com/thinkany-ai/spotcat-extensions/main/spotcat.d.ts
```

Load scripts with a plain `<script src>`: extension pages are opened from `file://`, where ES modules (`type="module"`) may be blocked.

## Debugging

Drag (or symlink) your extension folder into Spotcat's extensions folder — *Settings › Extensions › Open Extensions Folder* opens it:

```
~/Library/Application Support/Spotcat/Extensions/<your-extension>/        # release build
~/Library/Application Support/Spotcat Dev/Extensions/<your-extension>/    # locally built dev build
```

```sh
ln -s "$PWD/my-extension" ~/Library/Application\ Support/Spotcat/Extensions/my-extension
```

- Spotcat re-reads manifests each time it is opened (at most every 5 seconds), so changes apply the next time you open it; the page reloads every time a feature is entered. You can also click *Reload* in *Settings › Extensions*.
- Extensions you add yourself are marked *Local* in *Settings › Extensions*. Debug the page with Safari: enable *Settings › Advanced › Show features for web developers* in Safari, open your extension, then find Spotcat in Safari's *Develop* menu — or right-click the page and choose *Inspect Element*.
- The store never overwrites a local extension with the same id. To work on an extension that is already in the store, uninstall the store copy in *Settings › Extensions* first.
- When working on Spotcat itself, `make dev` loads extensions straight from a sibling checkout at `../spotcat-extensions/extensions` with live reload (set `SPOTCAT_EXTENSIONS_DIR` to use another folder).

## Publishing

There are two ways into the store; either way users install with one click in *Settings › Extensions › Store*:

- **Official extensions** live in [`extensions/`](../extensions) in this repository. Bump `version` in `manifest.json`; the change is published automatically within about 30 minutes of being merged into `main`.
- **Community extensions** are open source in your own repository (ideally named `spotcat-extension-<name>`, with `manifest.json` at the root). Tag a release, then [submit it for listing](https://github.com/thinkany-ai/spotcat-extensions/issues/new?template=submit-extension.yml). After review we add it to [`registry.json`](../registry.json) and it is packed and uploaded to `cdn.spotcat.ai` within about 30 minutes. For a new version, push a new tag and reply in the issue (or open a new submission).

Before submitting, make sure that:

- `scripts/pack.py --check <extension folder>` passes (needs Python 3; clone this repository to run it)
- the `id` is unique (lowercase letters, digits and hyphens) and not already [in the store](https://cdn.spotcat.ai/extensions/index.json)
- you request only the permissions you use, and the README says which services you call when using `network`
- there is no obfuscated code and no script loaded from the network (all JS ships inside the extension so it can be reviewed)
- there is a README: features, keywords, screenshots

## manifest.json

```json
{
  "id": "codec",
  "name": "Codec",
  "version": "0.1.0",
  "description": "URL and Base64 encoding and decoding",
  "author": "Spotcat",
  "icon": "sf:chevron.left.forwardslash.chevron.right",
  "iconColor": "#3B82F6",
  "main": "index.html",
  "features": [
    {
      "code": "url-decode",
      "title": "URL Decode",
      "keywords": ["url decode", "decode"],
      "matches": [
        { "type": "regex", "pattern": "%[0-9A-Fa-f]{2}", "minLength": 3 }
      ]
    }
  ]
}
```

| Field | Description |
|---|---|
| `id` | Unique identifier: lowercase letters, digits and hyphens |
| `version` | `x.y.z`; must increase with every release |
| `name` | Extension name, shown in the header once opened |
| `icon` | `sf:<SF Symbol name>` (drawn as a colored rounded tile) or an image path relative to the extension folder (png / icns / pdf) |
| `iconColor` | Background color of an `sf:` icon; defaults to system blue |
| `main` | Entry page; defaults to `index.html` |
| `permissions` | Sensitive capabilities: `"network"` (`spotcat.fetch`), `"ai"` (`spotcat.ai`, uses the user's AI quota) |
| `defaultLocale` | Default language such as `"en"`; strings missing in the current language come from here |
| `homepage` | Optional: the extension's homepage (source repository), shown in the store |
| `minAppVersion` | Optional: the minimum Spotcat version, such as `"0.3.0"`; set it when you use new APIs |
| `features[]` | Features; each one is a tile in the search results |

### Features

| Field | Description |
|---|---|
| `code` | Feature identifier, passed to the page when entered |
| `title` | Name on the tile; also matched by keyword search |
| `icon` / `iconColor` | Optional: overrides the extension icon |
| `keywords` | Keywords. A fuzzy hit shows the feature under **Best match**; Chinese keywords also match pinyin |
| `matches` | Content-match rules; if any rule matches, the feature shows under **Suggestions** |

### Match rules

| `type` | Description |
|---|---|
| `regex` | `pattern` is an NSRegularExpression searched in the trimmed input (add `^…$` yourself for a full match) |
| `text` | Any text; only the length is checked |

Both support `minLength` (default 1) and `maxLength`.

Rules that are too broad make *Suggestions* noisy. For example, a Base64 rule of just `^[A-Za-z0-9+/=]+$` would suggest decoding when the user types `calendar`.

## Localization

Extensions follow Spotcat's interface language (System / 简体中文 / English).

**String files**: `locales/<language>.json`, a flat key → string map; `{name}` is a placeholder:

```json
{ "name": "Translate", "featureTitle": "Translate", "detected": "Detected {lang}" }
```

**manifest**: `name`, `description` and a feature's `title` / `description` / `keywords` can be written as `"__MSG_<key>__"`. Keywords expand to the strings of **every** language, so English keywords still match in the Chinese interface and vice versa.

**Language choice**: exact match → same language (e.g. `zh-Hans` for `zh-Hant`) → `en` → `defaultLocale`; missing keys fall back to `defaultLocale`.

**Pages**:

```html
<button data-i18n="copy"></button>
<textarea data-i18n-placeholder="inputPlaceholder"></textarea>
<button data-i18n-title="settings"></button>
```

```js
const { t, locale } = spotcat.i18n;
t('detected', { lang: 'English' });        // "Detected English"
new Intl.DisplayNames([locale], { type: 'language' }).of('ja'); // use Intl for language names etc.
```

`data-i18n*` attributes are filled when the page loads; call `spotcat.i18n.apply(el)` for elements you insert later.

## AI and chat

The AI service is configured once in Spotcat's settings (any OpenAI-compatible API), so extensions never handle API keys.

**Calling a model** (needs `"permissions": ["ai"]`):

```js
const { configured, model } = await spotcat.ai.info();

// whole reply at once
const text = await spotcat.ai.chat({ messages: [{ role: 'user', content: 'hi' }] });

// streaming, cancellable
const controller = new AbortController();
await spotcat.ai.chat({ messages, onDelta: (d) => (out.textContent += d), signal: controller.signal });
```

**Opening the built-in AI chat** (no permission needed): hand your results to Spotcat's chat panel as context so the user can ask follow-up questions. Esc or the back button in the chat returns to the extension with its state intact.

```js
spotcat.chat.open({
  title: 'Translate: hello world',
  context: [
    { title: 'Source (English)', content: 'hello world' },
    { title: 'Google (Simplified Chinese)', content: '你好世界' },
  ],
  prompt: '',   // optional: prefill the input
  send: false,  // optional: send the prompt right away
});
```

The context is added to the system prompt and shown as collapsible cards at the top of the chat.

## Page API: `window.spotcat`

Injected before the page loads; nothing to import. Every method returns a Promise that rejects on failure. Full types are in [`spotcat.d.ts`](../spotcat.d.ts).

```js
// called when a feature is entered (and once right after the page loads)
spotcat.onEnter(({ code, type, payload }) => {
  // type: 'keyword' (entered by keyword; payload is the typed keyword)
  //       'match'   (entered by content match; payload is the matched content)
});
```

| API | Description | Permission |
|---|---|---|
| `copyText(text)` | Copy to the clipboard | |
| `hideWindow()` | Hide the window and keep the extension open (reopening within 90 seconds returns to it) | |
| `exit()` | Leave the extension and return to search | |
| `openURL(url)` | Open an `http(s)` page or an `x-apple.systempreferences:` settings pane | |
| `openSettings(tab?)` | Open Spotcat settings; `tab` can be `general` / `profile` / `ai` / `about` | |
| `fetch(url, { method, headers, body, timeout })` | Request sent by the app, free of CORS; returns `{ status, headers, body }` | `network` |
| `detectLanguage(text)` | Detect the language: `'en'`, `'zh-Hans'` … or `null` | |
| `translate({ text, from, to })` | Offline system translation (macOS 26+, language packs required); returns `{ text, from, to }` | |
| `speak(text, lang?)` / `stopSpeaking()` | System text-to-speech | |
| `storage.get(key)` / `set(key, value)` / `remove(key)` | Private persistent storage for the extension (JSON) | |
| `i18n.locale` / `i18n.t(key, vars)` / `i18n.apply(root)` | Localization, see above | |
| `ai.info({ model })` / `ai.chat({ messages, model, onDelta, signal })` | Use the AI service configured in Spotcat; `model` is optional and defaults to the default model | `ai` |
| `chat.open({ title, context, prompt, send })` | Open the built-in AI chat with context | |

`storage` data is kept in `~/Library/Application Support/Spotcat/ExtensionData/<extension id>.json`.

## Page conventions

- Keep the background transparent (`background: transparent`) so the panel's frosted glass shows through
- Support dark mode with `@media (prefers-color-scheme: dark)`
- `Esc` is handled by Spotcat (it leaves the extension); the page never receives it
- ⌘A / ⌘C / ⌘V / ⌘X / ⌘Z work in text fields
- `http(s)` links in the page open in the default browser
- The page can only read files inside its own extension folder
- The page's own `fetch`/XHR is subject to CORS (its origin is `file://`); use `spotcat.fetch` for third-party APIs
