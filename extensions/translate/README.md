# Translate (translate)

Compare translations from several services side by side, inspired by Easydict and the uTools translator.

- Any text shows up under *Suggestions* — press ↩ to translate it; or enter with the keywords `translate` / `翻译` / `fy`
- Detects the source language: Chinese → English, anything else → Simplified Chinese; both can be set manually
- One card per service, each collapsible, with retry, speak and copy
- `↩` translate now, `⇧↩` new line, `⌘↩` copy the first result and close

## Services

| Service | Notes |
|---|---|
| System Translation | The macOS 26 Translation framework: offline and free; download languages in *System Settings › General › Language & Region › Translation Languages* |
| Google Translate | The free `translate.googleapis.com` endpoint, no setup; unreachable on some networks |
| AI Translation | Uses the AI service configured in Spotcat (`spotcat.ai`, needs the `ai` permission) |

Every translation has *Ask AI*, which opens Spotcat's AI chat with the source and the translation as context.

Service toggles, target language and other settings (the button at the right of the language bar) are saved in `spotcat.storage`. The interface is available in English and Simplified Chinese (`locales/`); language names come from `Intl.DisplayNames` in the interface language.

## Files

```
translate/
├── manifest.json   declares the network and ai permissions; a text rule lets any text trigger it
├── locales/        en.json, zh-Hans.json
├── index.html
├── style.css
├── languages.js    language list and per-service language code mapping
├── services.js     translation services (add an entry to SERVICES for a new one)
└── main.js         page logic
```

## Spotcat APIs used

`onEnter`, `i18n`, `detectLanguage`, `translate`, `fetch`, `ai`, `chat.open`, `speak` / `stopSpeaking`, `copyText`, `hideWindow`, `storage`, `openURL`, `openSettings`
