# 03 — Expand card to view highlighted source

**Type:** AFK
**Stories:** 16, 17, 18, 19

## What to build

Let any card expand to show its full source, syntax-highlighted, read live from disk.

- `GET /file?path=<relative>` reads the requested source file **live** from disk and
  returns it **server-side Shiki-highlighted** as HTML, using a single shared highlighter
  instance.
- The route confines `path` to within the scanned project directory; requests resolving
  outside it (`../` escapes, absolute paths) are rejected. This is a trust-boundary
  security guard.
- Expanding a card fetches `/file` and renders the highlighted HTML in a fixed
  max-height, scrollable box. The frontend carries no highlighting dependency.
- Because source is read on demand, expanded content always reflects current disk state.

## Acceptance criteria

- [x] Expanding a card shows its full source with TS/JS syntax highlighting. (manual-verify)
- [x] Source is shown in a height-capped, scrollable box. (manual-verify)
- [x] Editing a file on disk and re-expanding shows the updated contents. (manual-verify)
- [x] `GET /file?path=<valid in-project>` returns highlighted HTML.
- [x] `GET /file?path=<../escape>` and absolute out-of-project paths are rejected — covered by a security test at the trust boundary.

## Blocked by

- 01 — Walking skeleton
