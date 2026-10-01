import { useEffect, useState } from 'react'

const CATEGORIES = ['College', 'Home', 'Personal']
const FILTERS = ['All', 'Active', 'Done']
const STORAGE_KEY = 'student-todo'

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return {
      tasks: Array.isArray(saved?.tasks) ? saved.tasks : [],
      tab: CATEGORIES.includes(saved?.tab) ? saved.tab : CATEGORIES[0],
    }
  } catch {
    return { tasks: [], tab: CATEGORIES[0] }
  }
}

// local date as YYYY-MM-DD, same format <input type="date"> gives us
const today = () => new Date().toLocaleDateString('en-CA')

export default function App() {
  const [tasks, setTasks] = useState(() => load().tasks)
  const [tab, setTab] = useState(() => load().tab)
  const [filter, setFilter] = useState('All')
  const [leaving, setLeaving] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, tab }))
    } catch {
      // storage blocked or full: app still works for this session
    }
  }, [tasks, tab])

  function addTask(e) {
    e.preventDefault()
    const form = e.target
    const title = form.title.value.trim()
    if (!title) return
    setTasks([...tasks, { id: crypto.randomUUID(), title, due: form.due.value, done: false, category: tab }])
    form.reset()
    form.title.focus()
  }

  const toggle = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  const remove = (id) => setTasks(tasks.filter((t) => t.id !== id))

  // undone first, then earliest due date, undated last
  const visible = tasks
    .filter((t) => t.category === tab)
    .filter((t) => filter === 'All' || (filter === 'Done') === t.done)
    .sort((a, b) => a.done - b.done || (a.due || '9999').localeCompare(b.due || '9999'))

  return (
    <main>
      <h1>Student To-Do</h1>

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
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
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
