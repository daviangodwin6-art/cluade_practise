# Student To-Do

A simple to-do list web app for students, built with React and Vite. Tasks are grouped into category tabs (College, Home, Personal) and shown as a stack of animated cards.

## Features

- Category tabs with a badge counting unfinished tasks
- Add tasks with an optional due date
- Tick tasks off (they sink to the bottom) or delete them
- Sorted by due date; overdue tasks turn red
- Stacked-card animations (disabled if your system prefers reduced motion)
- Tasks and the open tab are saved in your browser's `localStorage`, so they survive a reload

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

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## Project layout

```
index.html        page shell
src/main.jsx      React entry point
src/App.jsx       the whole app: tabs, add form, task list
src/App.css       layout, theme, card stack and animations
```

## Customising

- **Categories:** edit the `CATEGORIES` array at the top of `src/App.jsx`. Tasks in a removed category stay in storage but are no longer shown.
- **Reset data:** clear the site's `localStorage` (key `student-todo`) in your browser's dev tools.

## Limitations

- Data lives only in one browser on one device; there is no account or sync.
- Tasks can't be edited in place; delete and re-add instead.
