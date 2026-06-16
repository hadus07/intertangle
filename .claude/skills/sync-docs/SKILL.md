---
name: sync-docs
description: Sync PRD and issue docs to reflect a code change — tick acceptance criteria, move completed issues to resolved/, edit the PRD only on design deviations. Use after completing a change, or when the user types /sync-docs.
---

Sync `docs/prd/` and `docs/issues/` to reflect the change just made. Edit and `git mv` only — never commit. Report what changed at the end.

## Read the change

1. `git diff HEAD` plus untracked files. If the working tree is clean, use `git diff HEAD~1`.
2. Use the conversation context for *why* the change was made. The diff is the source of truth for *what* changed.

## Map to an issue

3. Get the current branch (`git branch --show-current`). Strip the leading number (`01-walking-skeleton` → `01`) and find `docs/issues/open/NN-*.md`.
4. If the branch matches no open issue (e.g. on `main`), **ask the user which issue** this change belongs to. Do not guess.

## Update the issue

5. Walk the acceptance criteria. Tick `- [ ]` → `- [x]` **only with evidence**:
   - the diff plainly implements the criterion, or
   - a relevant test covers it and passes (run that one test if cheap — never the full suite).
   - Manual-only criteria (per CLAUDE.md: chip expansion, fuzzy palette, pan/zoom, visual highlighting) — tick from the diff and append ` (manual-verify)` to the line.
   - Genuinely uncertain → leave blank.
6. If implementation diverged from the issue's plan, append a one-line note under the relevant section.
7. If **all** criteria are now checked: `git mv docs/issues/open/NN-*.md docs/issues/resolved/NN-*.md` (keep the same filename). Partial progress stays in `open/`.

## Update the PRD (only on deviation)

8. Edit `docs/prd/prd-import-graph-explorer.md` **only** if the change deviates from or extends locked design: a new or dropped user story, a changed scaffold decision, a new/relaxed constraint. Routine implementation that matches the PRD leaves it untouched.
9. When you do edit the PRD, **flag it prominently** in your report — changing locked design is the user's call to review.

## Uncovered work

10. If the change does work that **no open issue covers** (bug fix, scope discovered mid-slice), do not auto-create anything. Flag it: "this change touches X, which no open issue tracks — create an issue?" and let the user decide.

## Report, don't commit

11. Make edits and `git mv` only. **Never commit.** End with a short report: boxes ticked, issues moved, PRD edits (if any), and anything flagged. The user owns the landing commit.
