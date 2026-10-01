# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: Vite dev server on port 5173 (also configured in `.claude/launch.json` for the preview pane)
- `npm run build`: production build into `dist/`
- `npm run preview`: serve the built `dist/`

There is no linter and no test suite. Verify changes by running the dev server and exercising the UI, and by checking that `npm run build` succeeds.

## Architecture

A deliberately tiny React 19 + Vite app (plain JavaScript, no router, no state library, no animation library). Essentially all logic lives in `src/App.jsx`; `src/main.jsx` only mounts it and imports `src/App.css`.

- **State:** `tasks` (`{ id, title, due, done, category }`) and the active `tab`. The visible list is derived on each render: filter by `category === tab`, then sort (undone first, then earliest due date, undated last). Don't store the derived list.
- **Categories:** the `CATEGORIES` array at the top of `App.jsx` is the single source of truth for the tabs. Adding or renaming one is a one-line change; tasks keep their category string, so removing a category hides its tasks without deleting them.
- **Persistence:** both `tasks` and `tab` are saved as one JSON blob under the `student-todo` localStorage key. `load()` runs through lazy `useState` initialisers and falls back to empty/default on corrupt or blocked storage. Keep the try/catch around reads and writes. If the stored shape changes, `load()` must still accept the old shape.
- **Animations are CSS-only and coupled to the JSX:**
  - The `<ul>` is keyed by `tab`, so switching tabs remounts it and replays the `stack-in` keyframe. Removing that `key` silently kills the tab-switch animation.
  - Each card gets `style={{ '--i': index }}` and the CSS staggers with `animation-delay: calc(var(--i) * 50ms)`.
  - Deleting does not remove the task immediately: it sets `leaving`, which adds the `stack-out` class, and the task is removed in `onAnimationEnd` when `e.animationName === 'stack-out'`. If you rename the keyframe, update that string in the JSX too.
  - Under `prefers-reduced-motion` the CSS disables animations, so no `animationend` would ever fire. The delete handler therefore checks the media query in JS and removes the task directly. Keep both sides in sync.
- **Rendering user text:** task titles are rendered as React text children (never `dangerouslySetInnerHTML`), so input like `<b>x</b>` shows literally.
- **Dates:** due dates are `YYYY-MM-DD` strings (the format of `<input type="date">`). Overdue is a plain string comparison against `today()`, which uses the local date (`toLocaleDateString('en-CA')`), not UTC.
