# Codec (codec)

URL and Base64 encoding and decoding.

| Feature | Keywords | Content match |
|---|---|---|
| URL Encode | `url encode`, `encode`, `编码` | — |
| URL Decode | `url decode`, `decode`, `解码` | contains `%XX` escapes |
| Base64 Encode | `base64`, `encode`, `编码` | — |
| Base64 Decode | `base64 decode`, `decode`, `解码` | looks like Base64 with mixed case, digits or symbols |

## Files

```
codec/
├── manifest.json   features and triggers (strings reference locales via __MSG_key__)
├── locales/        en.json, zh-Hans.json
├── index.html      page structure
├── style.css       styles (transparent background + dark mode)
└── main.js         encoding logic; uses spotcat.onEnter / i18n / copyText / hideWindow / chat.open
```

*Ask AI* in the result area opens Spotcat's AI chat with the input and the result as context.

## Shortcuts

- `⌘↩` copy the result and close
- `Esc` back to search
