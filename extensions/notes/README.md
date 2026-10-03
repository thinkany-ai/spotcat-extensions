# Notes (notes)

Jot down whatever you type in the search box, then browse, search and edit your notes.

| Feature | Keywords | Content match |
|---|---|---|
| Add Note | `记笔记`, `jbj`, `note`, `add note` | any text — the input is saved as a new note right away |
| Notes | `笔记`, `bj`, `notes`, `memo` | — |

Notes are stored locally with `spotcat.storage` (`~/Library/Application Support/Spotcat/ExtensionData/notes.json`); nothing leaves the machine unless you click *Ask AI*.

## Files

```
notes/
├── manifest.json   features and triggers (strings reference locales via __MSG_key__)
├── locales/        en.json, zh-Hans.json
├── index.html      list on the left, editor on the right
├── style.css       styles (transparent background + dark mode)
└── main.js         uses spotcat.onEnter / storage / i18n / copyText / hideWindow / chat.open
```

## Shortcuts

- `⌘N` new note · `⌘F` search · `↑` `↓` pick a note while searching, `↩` edit it
- `⌘⌫` delete (outside the editor), with undo
- `⌘↩` save and close · `Esc` back to search

## Search from Spotcat

On Spotcat 0.5.0+ the notes are passed to `spotcat.search.setItems`, so typing words from a note in the main search box shows it under *Notes*; choosing it opens the note.
