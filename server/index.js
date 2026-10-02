import express from 'express'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.env.PORT || 3001
const DIR = process.env.DATA_DIR || join(import.meta.dirname, 'data')
const TASKS_FILE = join(DIR, 'tasks.json')
const CATS_FILE = join(DIR, 'categories.json')

mkdirSync(DIR, { recursive: true })
// a corrupt file throws here on purpose: crash loudly rather than overwrite the data on the next save
const read = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback)
const tasks = read(TASKS_FILE, [])
const categories = read(CATS_FILE, ['College', 'Home', 'Personal'])

function write(file, data) {
  // write-then-rename so a crash mid-write can't leave a half-written file
  writeFileSync(file + '.tmp', JSON.stringify(data, null, 2))
  renameSync(file + '.tmp', file)
}
const save = () => write(TASKS_FILE, tasks)
const saveCategories = () => write(CATS_FILE, categories)

const validTitle = (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 200
const validDue = (v) => v === '' || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
const validName = (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 40
// case-insensitive, so "home" can't be added next to "Home"
const findCategory = (name) => categories.findIndex((c) => c.toLowerCase() === name.trim().toLowerCase())

const app = express()
app.use(express.json())

app.get('/api/tasks', (req, res) => res.json(tasks))

app.post('/api/tasks', (req, res) => {
  const { title, category, due = '' } = req.body ?? {}
  if (!validTitle(title) || !categories.includes(category) || !validDue(due)) {
    return res.status(400).json({ error: 'title, due and an existing category are required' })
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

app.get('/api/categories', (req, res) => res.json(categories))

app.post('/api/categories', (req, res) => {
  const { name } = req.body ?? {}
  if (!validName(name)) return res.status(400).json({ error: 'name must be 1-40 characters' })
  if (findCategory(name) !== -1) return res.status(409).json({ error: 'category already exists' })
  categories.push(name.trim())
  saveCategories()
  res.status(201).json({ name: name.trim() })
})

app.patch('/api/categories/:name', (req, res) => {
  const i = categories.indexOf(req.params.name)
  if (i === -1) return res.status(404).json({ error: 'not found' })
  const { name } = req.body ?? {}
  if (!validName(name)) return res.status(400).json({ error: 'name must be 1-40 characters' })
  const j = findCategory(name)
  if (j !== -1 && j !== i) return res.status(409).json({ error: 'category already exists' })
  // tasks keep pointing at their category, so move them to the new name too
  tasks.forEach((t) => t.category === categories[i] && (t.category = name.trim()))
  categories[i] = name.trim()
  save()
  saveCategories()
  res.json({ name: categories[i] })
})

app.delete('/api/categories/:name', (req, res) => {
  const i = categories.indexOf(req.params.name)
  if (i === -1) return res.status(404).json({ error: 'not found' })
  // refuse rather than silently delete or orphan the user's tasks
  if (tasks.some((t) => t.category === categories[i])) {
    return res.status(409).json({ error: 'category still has tasks; delete or move them first' })
  }
  categories.splice(i, 1)
  saveCategories()
  res.sendStatus(204)
})

// localhost only: there is no auth, so don't expose it to the network
app.listen(PORT, '127.0.0.1', () => console.log(`API on http://127.0.0.1:${PORT}`))
