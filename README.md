# Student To-Do

A simple to-do list web app for students, built with React and Vite. Tasks are grouped into category tabs (College, Home, Personal) and shown as a stack of animated cards.

## Features

- Category tabs with a badge counting unfinished tasks
- Add tasks with an optional due date
- Tick tasks off (they sink to the bottom) or delete them
- Sorted by due date; overdue tasks turn red
- Stacked-card animations (disabled if your system prefers reduced motion)
- Tasks are stored on a small Express server (a JSON file), so they survive reloads and are the same in every browser; the open tab is remembered in the browser

## Setup

Requires [Node.js](https://nodejs.org/) 18 or newer (developed on Node 24).

1. Clone the repo and move into it:

   ```bash
   git clone https://github.com/daviangodwin6-art/cluade_practise.git
   cd cluade_practise
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the API server (stores tasks in `server/data/tasks.json`):

   ```bash
   npm run server
   ```

4. In a second terminal, start the dev server:

   ```bash
   npm run dev
   ```

5. Open http://localhost:5173 in your browser.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run server` | Start the API on http://127.0.0.1:3001 |
| `npm run dev` | Start the dev server with hot reload (proxies `/api` to the API) |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## Project layout

```
index.html        page shell
src/main.jsx      React entry point
src/App.jsx       the whole app: tabs, add form, task list
src/App.css       layout, theme, card stack and animations
server/index.js   Express API for tasks and categories
```

## API

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/api/tasks` | none | `200` all tasks |
| `POST` | `/api/tasks` | `{ title, category, due? }` | `201` the new task, `400` if invalid |
| `PATCH` | `/api/tasks/:id` | any of `{ done, title, due }` | `200` the task, `400` invalid, `404` unknown id |
| `DELETE` | `/api/tasks/:id` | none | `204`, or `404` unknown id |
| `GET` | `/api/categories` | none | `200` array of category names |
| `POST` | `/api/categories` | `{ name }` | `201` `{ name }`, `400` invalid (1-40 chars), `409` already exists (case-insensitive) |
| `PATCH` | `/api/categories/:name` | `{ name }` | `200` `{ name }`; tasks in it move to the new name. `404` unknown, `400` invalid, `409` name taken |
| `DELETE` | `/api/categories/:name` | none | `204`, `404` unknown, `409` if it still has tasks |

Category names with spaces must be URL-encoded (`/api/categories/Fitness%20Club`). Creating a task now requires an existing category. The React app doesn't use the category endpoints yet: its tabs still come from `CATEGORIES` in `src/App.jsx`, so renaming or deleting one of the three defaults through the API will make that tab's "Add" fail until the app is updated.

## Customising

- **Categories:** edit the `CATEGORIES` array at the top of `src/App.jsx`. Tasks in a removed category stay in storage but are no longer shown.
- **Reset data:** stop the server and delete `server/data/tasks.json` (and `categories.json` to restore the default categories).

## Limitations

- No accounts: there is one shared task list, and the API only listens on localhost (no auth).
- Tasks saved in the browser by earlier versions are not imported.
- Tasks can't be edited in place; delete and re-add instead.
