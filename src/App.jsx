import { useEffect, useState } from 'react'

const CATEGORIES = ['College', 'Home', 'Personal']
const FILTERS = ['All', 'Active', 'Done']
const STORAGE_KEY = 'student-todo'

// only the open tab lives in the browser now; tasks live on the server
function loadTab() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return CATEGORIES.includes(saved?.tab) ? saved.tab : CATEGORIES[0]
  } catch {
    return CATEGORIES[0]
  }
}

async function api(path, options) {
  const res = await fetch('/api/tasks' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(res.status)
  return res.status === 204 ? null : res.json()
}

// local date as YYYY-MM-DD, same format <input type="date"> gives us
const today = () => new Date().toLocaleDateString('en-CA')

export default function App() {
  const [tasks, setTasks] = useState([])
  const [tab, setTab] = useState(loadTab)
  const [filter, setFilter] = useState('All')
  const [leaving, setLeaving] = useState(null)
  const [error, setError] = useState('')

  // run a server call; on failure show a message and leave the list as it was
  const run = (fn) =>
    fn().then(
      () => setError(''),
      () => setError("Couldn't reach the server, so that change wasn't saved. Is it running?"),
    )

  useEffect(() => {
    run(async () => setTasks(await api('')))
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
      const task = await api('', { method: 'POST', body: JSON.stringify({ title, due: form.due.value, category: tab }) })
      setTasks((ts) => [...ts, task])
      form.reset()
      form.title.focus()
    })
  }

  const toggle = (t) =>
    run(async () => {
      const updated = await api(`/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: !t.done }) })
      setTasks((ts) => ts.map((x) => (x.id === t.id ? updated : x)))
    })

  const remove = (id) =>
    run(async () => {
      try {
        await api(`/${id}`, { method: 'DELETE' })
      } catch (err) {
        setLeaving(null) // bring the card back, it was never deleted
        throw err
      }
      setTasks((ts) => ts.filter((t) => t.id !== id))
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
        {CATEGORIES.map((c) => {
          const open = tasks.filter((t) => t.category === c && !t.done).length
          return (
            <button key={c} role="tab" aria-selected={c === tab} onClick={() => setTab(c)}>
              {c}
              {open > 0 && <span className="badge">{open}</span>}
            </button>
          )
        })}
      </div>

      <form onSubmit={addTask}>
        <input name="title" aria-label="Task" placeholder={`Add a ${tab} task`} required />
        <input name="due" type="date" aria-label="Due date" />
        <button>Add</button>
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
