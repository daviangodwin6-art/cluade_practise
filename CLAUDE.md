# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run server`: the API on `127.0.0.1:3001`. Run it in a second terminal next to `npm run dev`; the app shows an error banner and can't load tasks without it.
- `npm run dev`: Vite dev server on port 5173, proxying `/api` to the API (also configured in `.claude/launch.json` for the preview pane, which does not start the API)
- `npm run build`: production build into `dist/`
- `npm run preview`: serve the built `dist/`

There is no linter and no test suite. Verify changes by running the dev server and exercising the UI, and by checking that `npm run build` succeeds.

## Architecture

A deliberately tiny React 19 + Vite app (plain JavaScript, no router, no state library, no animation library) plus a small Express API. Essentially all UI logic lives in `src/App.jsx` (`src/main.jsx` only mounts it and imports `src/App.css`); the API is the single file `server/index.js`.

- **API (`server/index.js`):** `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`, and `GET/POST /api/categories`, `PATCH/DELETE /api/categories/:name`. Tasks and categories are held in memory and written to `server/data/tasks.json` and `categories.json` (both git-ignored, `server/data` can be moved with the `DATA_DIR` env var) after every change, via write-then-rename. A corrupt file crashes startup on purpose. It binds to `127.0.0.1` only because there is no auth. The server validates input (title 1-200 chars, `due` is `YYYY-MM-DD` or empty, `done` is boolean, category name 1-40 chars) and generates the `id`. `POST /api/tasks` requires an existing category; renaming a category moves its tasks; deleting one that still has tasks is a `409`.
- **Categories:** the server's `categories.json` is the only source (defaults College/Home/Personal); `App.jsx` loads it with the tasks and has no hardcoded list. The tools row under the tabs adds, renames and deletes categories through the API (one inline name form, `editing` state). Delete is disabled for the last category, and the server's `409` for a non-empty category is shown in the error banner. The open tab is stored by name, so on load a name that no longer exists falls back to the first category.
- **Testing the API:** run a second server on another port against a scratch folder (`DATA_DIR=<tmp> PORT=3999 node server/index.js`) so tests don't touch real tasks. A server may already be listening on 3001 with old code; check before assuming `npm run server` started.
- **State:** `tasks` (`{ id, title, due, done, category }`, loaded from the API), the active `tab` (persisted in the browser), and the All/Active/Done `filter` (view-only, resets to All on reload). The visible list is derived on each render: filter by `category === tab`, then by `filter`, then sort (undone first, then earliest due date, undated last). Don't store the derived list.
- **Categories:** the `CATEGORIES` array at the top of `App.jsx` is the single source of truth for the tabs. Adding or renaming one is a one-line change; tasks keep their category string, so removing a category hides its tasks without deleting them.
- **Persistence:** tasks and categories live on the server. `App.jsx` calls the API through the `api()` helper (paths like `/tasks`, `/categories/...`, with category names `encodeURIComponent`-ed) and updates state from each response (no optimistic updates). Every call goes through `run()`, which shows an error banner on failure (the server's own reason for a rejection, or a "can't reach the server" message) and leaves the list unchanged; a failed delete also clears `leaving` so the card reappears. Only `tab` is stored in the browser (`student-todo` localStorage key, `{ tab }`); `loadTab()` falls back to the default on corrupt or blocked storage, so keep its try/catch. Tasks stored in localStorage by earlier versions are ignored, not migrated.
- **Animations are CSS-only and coupled to the JSX:**
  - The `<ul>` is keyed by `tab + filter`, so switching tabs or filters remounts it and replays the `stack-in` keyframe. Removing that `key` silently kills the switch animation.
  - Each card gets `style={{ '--i': index }}` and the CSS staggers with `animation-delay: calc(var(--i) * 50ms)`.
  - Deleting does not remove the task immediately: it sets `leaving`, which adds the `stack-out` class, and the task is removed in `onAnimationEnd` when `e.animationName === 'stack-out'`. If you rename the keyframe, update that string in the JSX too.
  - Under `prefers-reduced-motion` the CSS disables animations, so no `animationend` would ever fire. The delete handler therefore checks the media query in JS and removes the task directly. Keep both sides in sync.
- **Progress ring:** the list and an `<aside className="progress">` sit in a two-column `.layout` grid (ring stacks above the list under 640px). The percentage is done ÷ total for the whole open tab, deliberately ignoring the All/Active/Done filter so it doesn't change when you filter. The ring is two SVG circles; the green one is drawn with `stroke-dasharray`/`stroke-dashoffset` from `RADIUS` and `CIRCUMFERENCE` (so a change to the radius must keep the SVG `viewBox`, the `r` attributes and those constants consistent). Colors come from the `--green` and `--track` variables, which have dark-mode values.
- **Calendar:** the `Calendar` component in `App.jsx` sits with the ring in a sticky `.side` column (under 640px `.side` becomes `display: contents`, so the ring stays above the list and the calendar goes below it). It shows tasks from every category, grouped by an exact match on `due`; its own state is the shown month and the selected day, and ticking a task calls the shared `toggle`. No API of its own.
- **Rendering user text:** task titles are rendered as React text children (never `dangerouslySetInnerHTML`), so input like `<b>x</b>` shows literally.
- **Dates:** due dates are `YYYY-MM-DD` strings (the format of `<input type="date">`). Overdue is a plain string comparison against `today()`, which uses the local date (`toLocaleDateString('en-CA')`), not UTC.
