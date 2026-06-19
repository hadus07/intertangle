# 15 — Hidden patterns also hide cards on the canvas

**Type:** AFK
**Stories:** 15–18
**Source:** `docs/prd/prd-hide-patterns.md`

## What to build

Extend the `hidden` set derived in slice 14 to the canvas, so a file matching any hide
chip also has its card and edges removed from the graph — retroactively (a card already on
the canvas vanishes the moment it starts matching a new chip) and reversibly (removing the
chip brings the card back unchanged and in place).

The mechanism rides the **existing** `projectGraph` `excluded` parameter: pass the union
`new Set([...excluded, ...hidden])` into the canvas-layout path. `projectGraph` already
drops those nodes and the edges touching them and nets the per-card `imports (n)` /
`imported by (n)` counts. No `canvas.ts` change, no reducer change — `expanded` stays
untouched, which is exactly what makes the hide reversible.

## Acceptance criteria

- [x] A file matching any hide chip has its card and all edges touching it removed from the canvas. (manual-verify)
- [x] Card chip counts (`imports`/`imported by`) drop net of hidden targets, matching how `excluded` already nets them. (manual-verify)
- [x] A card already on the canvas vanishes when a newly-added chip starts matching it (retroactive). (manual-verify)
- [x] Removing the chip restores the card and its edges, unchanged and in place; the `expanded` state is never mutated by hiding. (manual-verify)
- [x] The existing `projectGraph` exclusion seam still passes — hiding reuses it rather than adding a parallel path. (test)

## Blocked by

- 14 — Glob hide-pattern chips filter the file tree and palette
