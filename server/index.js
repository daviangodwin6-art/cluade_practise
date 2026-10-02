import express from 'express'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.env.PORT || 3001
const DIR = join(import.meta.dirname, 'data')
const FILE = join(DIR, 'tasks.json')

mkdirSync(DIR, { recursive: true })
// a corrupt file throws here on purpose: crash loudly rather than overwrite the data on the next save
const tasks = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : []

function save() {
  // write-then-rename so a crash mid-write can't leave a half-written file
  writeFileSync(FILE + '.tmp', JSON.stringify(tasks, null, 2))
  renameSync(FILE + '.tmp', FILE)
}

const validTitle = (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 200
const validDue = (v) => v === '' || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))

const app = express()
app.use(express.json())

app.get('/api/tasks', (req, res) => res.json(tasks))

app.post('/api/tasks', (req, res) => {
  const { title, category, due = '' } = req.body ?? {}
  if (!validTitle(title) || typeof category !== 'string' || !category.trim() || !validDue(due)) {
    return res.status(400).json({ error: 'title, category and due must be valid' })
  }
  const task = { id: crypto.randomUUID(), title: title.trim(), due, done: false, category }
  tasks.push(task)
  save()
  res.status(201).json(task)
})

app.patch('/api/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id)
  if (!task) return res.status(404).json({ error: 'not found' })
  const { done, title, due } = req.body ?? {}
  if (
    (done !== undefined && typeof done !== 'boolean') ||
    (title !== undefined && !validTitle(title)) ||
    (due !== undefined && !validDue(due))
  ) {
    return res.status(400).json({ error: 'done, title or due is invalid' })
  }
  if (done !== undefined) task.done = done
  if (title !== undefined) task.title = title.trim()
  if (due !== undefined) task.due = due
  save()
  res.json(task)
})

app.delete('/api/tasks/:id', (req, res) => {
  const i = tasks.findIndex((t) => t.id === req.params.id)
  if (i === -1) return res.status(404).json({ error: 'not found' })
  tasks.splice(i, 1)
  save()
  res.sendStatus(204)
})

// localhost only: there is no auth, so don't expose it to the network
app.listen(PORT, '127.0.0.1', () => console.log(`API on http://127.0.0.1:${PORT}`))
