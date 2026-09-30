# Spotcat Extensions

English | [简体中文](README.zh-CN.md)

The extensions repository for [Spotcat](https://github.com/thinkany-ai/spotcat): source code of the official extensions, developer docs, type declarations, an agent skill for building extensions, and the listing and publishing workflow of the extension store.

Users install extensions on demand from *Settings › Extensions › Store* in Spotcat. Packages are served from `https://cdn.spotcat.ai/extensions/`.

## Official extensions

| Extension | Description |
|---|---|
| [`translate`](extensions/translate) | Compare translations from System Translation, Google Translate and AI |
| [`codec`](extensions/codec) | URL / Base64 encoding and decoding |

Community extensions are listed in [`registry.json`](registry.json).

## Building an extension

An extension is a folder with a `manifest.json` and an `index.html` — plain HTML/CSS/JS that reaches the clipboard, storage, network, AI and more through `window.spotcat`.

- **Developer docs**: [docs/development.md](docs/development.md) (Chinese)
- **Types**: [spotcat.d.ts](spotcat.d.ts)
- **AI agents**: point Claude Code, Codex or another agent at [skills/spotcat-extension/SKILL.md](skills/spotcat-extension/SKILL.md) — workflow, template and checklist. To install it as a Claude Code skill:

  ```sh
  git clone https://github.com/thinkany-ai/spotcat-extensions.git
  cp -R spotcat-extensions/skills/spotcat-extension ~/.claude/skills/
  ```

- **Debugging**: drag (or symlink) your extension folder into `~/Library/Application Support/Spotcat/Extensions/` and open Spotcat.

## Getting listed in the store

**Community extensions**

1. Open-source the extension in your own GitHub repository, ideally named `spotcat-extension-<name>`, with `manifest.json` at the repository root.
2. Validate it with `python3 scripts/pack.py --check <extension folder>`, then tag a release (e.g. `v1.0.0`, matching `version` in `manifest.json`).
3. [Submit it for listing](https://github.com/thinkany-ai/spotcat-extensions/issues/new?template=submit-extension.yml).
4. After review, a maintainer adds it to `registry.json` and CI packs and uploads it to the CDN. For a new version, push a new tag and reply in the issue.

**Official extensions**: change `extensions/<id>`, bump `version`, and it is published automatically within about 30 minutes of being merged into `main`.

## Maintainers: publishing

```sh
./scripts/publish.sh --changed           # publish every extension newer than the CDN
./scripts/publish.sh translate           # publish one extension
./scripts/publish.sh --index-only        # rebuild index.json only (recommended list changed, community extension delisted)
DRY_RUN=1 ./scripts/publish.sh --changed # pack into dist/ without uploading
```

Each extension is published on its own: first `extensions/<id>/<version>.zip` is uploaded (cached forever; a version can't be overwritten), then its entry is merged into `extensions/index.json` (not cached).

To list a community extension, add it to `community` in `registry.json`:

```json
{ "id": "hello", "repo": "https://github.com/someone/spotcat-extension-hello", "ref": "v1.0.0", "version": "1.0.0" }
```

`ref` is the reviewed tag or commit; add `"path": "subdir"` if the extension isn't at the repository root. Publishing checks that the cloned `manifest.json` has the same `id`. Remove the entry to delist it.

Extensions in `recommended` are installed automatically the first time a user runs Spotcat.

Automatic publishing runs from the [Publish extensions](https://github.com/thinkany-ai/spotcat/actions/workflows/extensions.yml) workflow in the `spotcat` repository, which holds the R2 secrets: every 30 minutes it runs `publish.sh --changed` against `main` of this repository. Run that workflow manually to publish right away (optionally with extension ids). Local publishing uses a logged-in `wrangler`.

## License

The official extensions, docs, `spotcat.d.ts` and scripts in this repository are [MIT-licensed](LICENSE). Community extensions are licensed as stated in their own repositories.
