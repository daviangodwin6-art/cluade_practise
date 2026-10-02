import { useEffect, useState } from 'react'

const FILTERS = ['All', 'Active', 'Done']
const STORAGE_KEY = 'student-todo'
const RADIUS = 52 // ring radius in the 120x120 SVG viewBox
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// only the open tab lives in the browser; tasks and categories live on the server.
// It may name a category that no longer exists, so the load effect below corrects it.
function loadTab() {
  try {
    const tab = JSON.parse(localStorage.getItem(STORAGE_KEY))?.tab
    return typeof tab === 'string' ? tab : ''
  } catch {
    return ''
  }
}

async function api(path, options) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    // server rejections carry a readable reason ("category still has tasks...")
    const body = await res.json().catch(() => ({}))
    throw Object.assign(new Error(body.error || res.status), { fromServer: true })
  }
  return res.status === 204 ? null : res.json()
}

// local date as YYYY-MM-DD, same format <input type="date"> gives us
const today = () => new Date().toLocaleDateString('en-CA')

const pad = (n) => String(n).padStart(2, '0')
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// month grid (Monday first) of all tasks, with a detail list for the selected day
function Calendar({ tasks, onToggle }) {
  const now = today()
  const [month, setMonth] = useState(now.slice(0, 7)) // YYYY-MM
  const [selected, setSelected] = useState(now)
  const [y, m] = month.split('-').map(Number)
  const shift = (d) => {
    const next = new Date(y, m - 1 + d, 1)
    setMonth(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`)
  }
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7 // blanks before the 1st
  const days = new Date(y, m, 0).getDate()
  const dayKey = (d) => `${month}-${pad(d)}`
  const onDay = (key) => tasks.filter((t) => t.due === key)
  const picked = onDay(selected)

  return (
    <aside className="calendar" aria-label="Calendar">
      <div className="cal-head">
        <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <strong>{new Date(y, m - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button onClick={() => shift(1)} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-wd">{w[0]}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={'b' + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const key = dayKey(i + 1)
          const list = onDay(key)
          const open = list.filter((t) => !t.done).length
          return (
            <button
              key={key}
              className={['cal-day', key === now && 'today', key === selected && 'picked'].filter(Boolean).join(' ')}
              aria-pressed={key === selected}
              aria-label={`${key}, ${list.length} tasks`}
              onClick={() => setSelected(key)}
            >
              {i + 1}
              {list.length > 0 && <i className={open ? 'dot' : 'dot all-done'} />}
            </button>
          )
        })}
      </div>
      <button className="cal-today" onClick={() => { setMonth(now.slice(0, 7)); setSelected(now) }}>
        Today
      </button>
      <div className="cal-detail">
        <h2>{selected}</h2>
        {picked.length === 0 && <p className="empty">No tasks due.</p>}
        <ul>
          {picked.map((t) => (
            <li key={t.id} className={t.done ? 'done' : t.due < now ? 'overdue' : ''}>
              <label>
                <input type="checkbox" checked={t.done} onChange={() => onToggle(t)} />
                <span className="title">{t.title}</span>
              </label>
              <small>{t.category}</small>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [tab, setTab] = useState(loadTab)
  const [editing, setEditing] = useState(null) // null | 'add' | 'rename': the category name form
  const [filter, setFilter] = useState('All')
  const [leaving, setLeaving] = useState(null)
  const [error, setError] = useState('')

  // run a server call; on failure show why and leave the list as it was
  const run = (fn) =>
    fn().then(
      () => setError(''),
      (err) =>
        setError(
          err.fromServer
            ? `Not saved: ${err.message}.`
            : "Couldn't reach the server, so that change wasn't saved. Is it running?",
        ),
    )

  useEffect(() => {
    run(async () => {
      const [ts, cs] = await Promise.all([api('/tasks'), api('/categories')])
      setTasks(ts)
      setCategories(cs)
      setTab((t) => (cs.includes(t) ? t : cs[0] ?? ''))
    })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tab }))
    } catch {
      // storage blocked or full: app still works for this session
    }
  }, [tab])

  function addTask(e) {
    e.preventDefault()
    const form = e.target
    const title = form.title.value.trim()
    if (!title) return
    run(async () => {
      const task = await api('/tasks', { method: 'POST', body: JSON.stringify({ title, due: form.due.value, category: tab }) })
      setTasks((ts) => [...ts, task])
      form.reset()
      form.title.focus()
    })
  }

  const toggle = (t) =>
    run(async () => {
      const updated = await api(`/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: !t.done }) })
      setTasks((ts) => ts.map((x) => (x.id === t.id ? updated : x)))
    })

  const remove = (id) =>
    run(async () => {
      try {
        await api(`/tasks/${id}`, { method: 'DELETE' })
      } catch (err) {
        setLeaving(null) // bring the card back, it was never deleted
        throw err
      }
      setTasks((ts) => ts.filter((t) => t.id !== id))
    })

  function saveCategory(e) {
    e.preventDefault()
    const name = e.target.catName.value.trim()
    if (!name) return
    const body = JSON.stringify({ name })
    run(async () => {
      if (editing === 'add') {
        const c = await api('/categories', { method: 'POST', body })
        setCategories((cs) => [...cs, c.name])
        setTab(c.name)
      } else {
        const old = tab
        const c = await api(`/categories/${encodeURIComponent(old)}`, { method: 'PATCH', body })
        // the server moved this category's tasks to the new name; mirror that here
        setCategories((cs) => cs.map((x) => (x === old ? c.name : x)))
        setTasks((ts) => ts.map((t) => (t.category === old ? { ...t, category: c.name } : t)))
        setTab(c.name)
      }
      setEditing(null)
    })
  }

  const removeCategory = () =>
    run(async () => {
      await api(`/categories/${encodeURIComponent(tab)}`, { method: 'DELETE' })
      const rest = categories.filter((c) => c !== tab)
      setCategories(rest)
      setTab(rest[0] ?? '')
    })

  // undone first, then earliest due date, undated last
  const visible = tasks
    .filter((t) => t.category === tab)
    .filter((t) => filter === 'All' || (filter === 'Done') === t.done)
    .sort((a, b) => a.done - b.done || (a.due || '9999').localeCompare(b.due || '9999'))

  // progress covers the whole open tab, not the Active/Done filter, so the ring doesn't jump around
  const inTab = tasks.filter((t) => t.category === tab)
  const doneCount = inTab.filter((t) => t.done).length
  const percent = inTab.length ? Math.round((doneCount / inTab.length) * 100) : 0

  return (
    <main>
      <h1>Student To-Do</h1>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="tabs" role="tablist">
        {categories.map((c) => {
          const open = tasks.filter((t) => t.category === c && !t.done).length
          return (
            <button
              key={c}
              role="tab"
              aria-selected={c === tab}
              onClick={() => {
                setTab(c)
                setEditing(null) // a half-typed rename must not apply to the tab we just opened
              }}
            >
              {c}
              {open > 0 && <span className="badge">{open}</span>}
            </button>
          )
        })}
      </div>

      <div className="cat-tools">
        <button onClick={() => setEditing('add')}>+ New category</button>
        {tab && (
          <>
            <button onClick={() => setEditing('rename')}>Rename “{tab}”</button>
            {/* keep one category so there is always somewhere to add tasks */}
            <button onClick={removeCategory} disabled={categories.length < 2}>
              Delete “{tab}”
            </button>
          </>
        )}
      </div>

      {editing && (
        <form key={editing + tab} className="cat-form" onSubmit={saveCategory}>
          <input
            name="catName"
            aria-label="Category name"
            defaultValue={editing === 'rename' ? tab : ''}
            placeholder="Category name"
            maxLength={40}
            autoFocus
            required
          />
          <button>Save</button>
          <button type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </form>
      )}

      <form onSubmit={addTask}>
        <input name="title" aria-label="Task" placeholder={`Add a ${tab} task`} required disabled={!tab} />
        <input name="due" type="date" aria-label="Due date" disabled={!tab} />
        <button disabled={!tab}>Add</button>
      </form>

      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f} aria-pressed={f === filter} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="layout">
      <ul key={tab + filter} className="stack">
        {visible.map((t, i) => (
          <li
            key={t.id}
            style={{ '--i': i }}
            className={[
              'card',
              t.done && 'done',
              !t.done && t.due && t.due < today() && 'overdue',
              t.id === leaving && 'leaving',
            ]
              .filter(Boolean)
              .join(' ')}
            onAnimationEnd={(e) => e.animationName === 'stack-out' && remove(t.id)}
          >
            <label>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
              <span className="title">{t.title}</span>
            </label>
            {t.due && <time dateTime={t.due}>{t.due}</time>}
            <button
              className="delete"
              aria-label={`Delete ${t.title}`}
              // no animation under reduced motion, so animationend would never fire
              onClick={() =>
                matchMedia('(prefers-reduced-motion: reduce)').matches ? remove(t.id) : setLeaving(t.id)
              }
            >
              ×
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="empty">
            {filter === 'All' ? 'Nothing here. Add a task above.' : `No ${filter.toLowerCase()} tasks.`}
          </li>
        )}
      </ul>

      <div className="side">
      <aside
        className="progress"
        role="progressbar"
        aria-label={`${tab} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="track" cx="60" cy="60" r={RADIUS} />
          <circle
            className="fill"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          />
        </svg>
        <div className="progress-text">
          <strong>{percent}%</strong>
          <span>{inTab.length ? `${doneCount} of ${inTab.length} done` : 'No tasks yet'}</span>
        </div>
      </aside>
      <Calendar tasks={tasks} onToggle={toggle} />
      </div>
      </div>
    </main>
  )
}
