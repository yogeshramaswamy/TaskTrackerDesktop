const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');

router.get('/', (req, res) => {
  const { status, priority, project_id, parent_id, include_archived } = req.query;

  // Auto-archive: move tasks that have been 'done' for 3+ days to 'archived'
  run(`UPDATE tasks SET status = 'archived', updated_at = datetime('now')
    WHERE status = 'done' AND updated_at <= datetime('now', '-3 days')`);

  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  // Hide archived by default unless explicitly requested
  if (!include_archived && status !== 'archived') {
    query += " AND status != 'archived'";
  }

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (priority) { query += ' AND priority = ?'; params.push(priority); }
  if (project_id) {
    if (project_id === 'none') {
      query += ' AND project_id IS NULL';
    } else {
      query += ' AND project_id = ?'; params.push(Number(project_id));
    }
  }
  if (parent_id !== undefined) {
    if (parent_id === 'null') {
      query += ' AND parent_id IS NULL';
    } else if (parent_id === 'any') {
      // Every subtask (any task that has a parent), regardless of which one.
      query += ' AND parent_id IS NOT NULL';
    } else {
      query += ' AND parent_id = ?'; params.push(Number(parent_id));
    }
  }

  query += ' ORDER BY created_at DESC';
  const tasks = all(query, params);
  res.json(tasks);
});

router.get('/:id', (req, res) => {
  const task = get('SELECT * FROM tasks WHERE id = ?', [Number(req.params.id)]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

router.get('/:id/subtasks', (req, res) => {
  const subtasks = all('SELECT * FROM tasks WHERE parent_id = ? ORDER BY created_at ASC', [Number(req.params.id)]);
  res.json(subtasks);
});

// Return every descendant of a task (its subtasks, their subtasks, ... all the
// way down), each tagged with its depth. Used by the delete confirmation so the
// user can see exactly what a cascade delete will remove. Depth is capped as a
// guard against a cyclic parent_id chain.
router.get('/:id/descendants', (req, res) => {
  const rootId = Number(req.params.id);
  const descendants = [];
  let frontier = [rootId];
  let depth = 1;
  const seen = new Set([rootId]);

  while (frontier.length && depth <= 20) {
    const placeholders = frontier.map(() => '?').join(',');
    const children = all(
      `SELECT id, title, status, parent_id FROM tasks WHERE parent_id IN (${placeholders})`,
      frontier
    );
    const next = [];
    for (const child of children) {
      if (seen.has(child.id)) continue; // guard against cycles
      seen.add(child.id);
      descendants.push({ ...child, depth });
      next.push(child.id);
    }
    frontier = next;
    depth++;
  }

  res.json(descendants);
});

// Persist a manual ordering. Body: { ids: [taskId, ...] } in the desired
// top-to-bottom order. sort_order is set to the array index for each id, so a
// later "ORDER BY sort_order" reproduces exactly this arrangement.
router.put('/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array is required' });

  ids.forEach((id, index) => {
    run("UPDATE tasks SET sort_order = ?, updated_at = datetime('now') WHERE id = ?", [index, Number(id)]);
  });
  res.json({ success: true, count: ids.length });
});

router.post('/', (req, res) => {
  const { project_id, parent_id, title, description, ticket_url, status, priority, start_date, due_date, tags } = req.body;

  const result = run(`
    INSERT INTO tasks (project_id, parent_id, title, description, ticket_url, status, priority, start_date, due_date, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    project_id || null,
    parent_id || null,
    title,
    description || null,
    ticket_url || null,
    status || 'todo',
    priority || 'medium',
    start_date || null,
    due_date || null,
    JSON.stringify(tags || [])
  ]);

  const task = get('SELECT * FROM tasks WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const { title, description, ticket_url, status, priority, start_date, due_date, tags, project_id, parent_id } = req.body;
  const id = Number(req.params.id);

  const existing = get('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  run(`
    UPDATE tasks SET
      title = ?, description = ?, ticket_url = ?, status = ?, priority = ?,
      start_date = ?, due_date = ?, tags = ?, project_id = ?, parent_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `, [
    title ?? existing.title,
    description ?? existing.description,
    ticket_url ?? existing.ticket_url,
    status ?? existing.status,
    priority ?? existing.priority,
    start_date !== undefined ? start_date : existing.start_date,
    due_date !== undefined ? due_date : existing.due_date,
    tags ? JSON.stringify(tags) : existing.tags,
    project_id !== undefined ? project_id : existing.project_id,
    parent_id !== undefined ? parent_id : existing.parent_id,
    id
  ]);

  const task = get('SELECT * FROM tasks WHERE id = ?', [id]);
  res.json(task);
});

router.delete('/:id', (req, res) => {
  const result = run('DELETE FROM tasks WHERE id = ?', [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});

module.exports = router;
