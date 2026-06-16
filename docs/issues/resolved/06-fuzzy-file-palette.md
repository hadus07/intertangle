# 06 — Fuzzy file-search palette

**Type:** AFK
**Stories:** 4, 5

## What to build

Let the user start with no arguments and pick seed files interactively, and add more
root cards at any time.

- Running the CLI with no file arguments opens the browser to an empty canvas with a
  fuzzy file-search palette (`Cmd-K` style), built with **cmdk** (modal, ranked list,
  keyboard nav out of the box).
- The palette's file list comes from the graph (`/graph` already knows every local file).
- Selecting a file adds it to the canvas as a folded card.
- The same palette is available mid-session to add additional root cards.
- No entry-point guessing from `package.json` or elsewhere.

## Acceptance criteria

- [x] Running with no arguments opens an empty canvas with the search palette. (manual-verify)
- [x] Typing fuzzy-matches against the project's file list. (manual-verify)
- [x] Selecting a result adds that file as a card. (manual-verify)
- [x] `Cmd-K` reopens the palette after the canvas already has cards, adding further roots. (manual-verify)
- [x] No file is auto-seeded without an explicit arg or palette selection. (manual-verify)

## Blocked by

- 01 — Walking skeleton
