# 13 — Tailwind v4 + tailwind-merge migration

**Type:** Refactor (styling system migration)
**Status:** ready-for-agent
**PRD:** `docs/prd/prd-tailwind-migration.md`
**Stories:** PRD stories 1–18 (Tailwind migration)

## What to build

Migrate `web/`'s styling from the hand-written `iw-*` semantic stylesheet to Tailwind v4
utilities, preserving the `--iw-*` token system that drives theming. Adopt `tailwind-merge`
for conflict-safe class composition. `web/`-only; backend `src/` untouched. Visually
faithful — no redesign.

**Tailwind v4 wiring (CSS-first)**
- Add deps: `tailwindcss`, `@tailwindcss/vite` (build), `tailwind-merge` (runtime). No `clsx`/`classnames`.
- Add `@tailwindcss/vite` to `web/vite.config.ts` plugins (alongside react + react-compiler). No `tailwind.config.js`, no PostCSS.
- In `styles.css`: `@import "tailwindcss"` + an `@theme` block mapping the tokens used in markup to Tailwind color tokens via `var(--iw-*)` (e.g. `--color-canvas: var(--iw-bg-canvas)`). Map only tokens actually used as utilities.
- Leave the `:root` / `[data-theme="dark"]` token blocks **unchanged**. No `dark:` variants — theming swaps tokens under `[data-theme]`.
- Smoke-test one opacity utility (`bg-canvas/50`) early to confirm the `var(--iw-*)` format cooperates with v4 `color-mix`.

**`cn` helper (string-only)**
- `web/src/lib/cn.ts`: `twMerge(parts.filter(Boolean).join(' '))`. No object/array syntax.

**Markup migration (all components)**
- Replace `iw-*` classes on rendered elements with utilities; convert template-literal ternaries to `cn(...)`.
- `SourceView`: `className` passthrough becomes `cn(base, className)`.
- Order: a leaf component first, then `SourceView`, then `App` → `FileTree` → `FileCardNode` → `FilePalette` → source panel.

**Residual `styles.css` (expected — keep)**
- `.react-flow__*` third-party overrides (DOM React Flow renders).
- Shiki source-HTML styling: `.iw-source-panel pre` and related (injected via `dangerouslySetInnerHTML`).
- Token definitions and global resets.

**Verification (throwaway)**
- Playwright **subagent** captures a screenshot baseline of each screen/state before migrating; diff per component after; delete the harness when the slice lands.

## Acceptance criteria

- [x] Tailwind v4 builds via `@tailwindcss/vite` at `vite build`; no install/run-time build step added; `dist/` ships compiled CSS. (`npm run build`)
- [x] `@theme` bridges `--iw-*` tokens to utilities; `:root`/`[data-theme="dark"]` blocks unchanged; no `dark:` variants present. (manual-verify + grep)
- [x] `bg-canvas/50`-style opacity utility renders correctly through the token bridge. (manual-verify)
- [x] `cn` helper exists and is string-only over `tailwind-merge`; `clsx`/`classnames` absent from `package.json`. (grep + `npm test`)
- [x] All rendered-element `iw-*` classes replaced by utilities; no template-literal class ternaries remain in components. (grep)
- [x] `SourceView` override path uses `cn(base, className)`. (manual-verify)
- [x] Residual `styles.css` retains only `.react-flow__*`, Shiki/source-HTML rules, token defs, and resets. (manual-verify)
- [x] Screenshot baseline diffed before/after via Playwright subagent; no unintended visual change; harness removed on landing. (manual-verify)
- [x] Existing seam suite stays green. (`npm test`)
- [x] `npx biome check .` is clean. (test)
- [x] End-user-visible behavior and appearance unchanged. (manual-verify)

## Blocked by

- — (none; builds on landed slices 01–12)
