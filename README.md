# SimpCity Enlarge Image

Expand embedded SimpCity thumbnail images inline instead of opening external image links.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the raw userscript URL:
   <https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/simpcity-enlarge-image.user.js>
3. Tampermonkey will detect the `.user.js` file and prompt you to install it.

## Updates

Tampermonkey checks the metadata file declared in `@updateURL`:

<https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/simpcity-enlarge-image.meta.js>

Keep `@version` in `simpcity-enlarge-image.user.js`, `simpcity-enlarge-image.meta.js`, and `CHANGELOG.md` aligned for every release.

## Features

- Intercepts clicks on embedded `img.bbImage` thumbnails on SimpCity.
- Expands `.md` and `.th` thumbnail URLs to their full image URL inline inside the thread.
- Expands Pixhost `t*.pixhost.to/thumbs/...` thumbnail URLs to their full `img*.pixhost.to/images/...` image URLs.
- Falls back to expanding the current embedded image URL when no host-specific full image pattern is known.
- Prevents normal image clicks from opening the external image link.
- Smoothly animates inline expand/collapse states.
- Clicks the expanded image again to collapse it back to the embedded thumbnail layout.
- Watches dynamically inserted thread content so lazy-loaded images are handled too.

## Supported domains

- `simpcity.cr`

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT © vylix-dev.
