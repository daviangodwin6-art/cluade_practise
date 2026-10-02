import { useEffect, useState } from 'react'

const FILTERS = ['All', 'Active', 'Done']
const STORAGE_KEY = 'student-todo'

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
    </main>
  )
}
