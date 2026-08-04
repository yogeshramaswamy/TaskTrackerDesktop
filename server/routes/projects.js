const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');

// Turn a set of {status, count} rows into the shape the UI expects
// (per-status counts, total, and a completed% progress figure).
function summarizeCounts(taskCounts) {
  const counts = { todo: 0, in_progress: 0, done: 0, blocked: 0, archived: 0 };
  taskCounts.forEach(tc => { counts[tc.status] = tc.count; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const completed = counts.done + counts.archived;
  return { taskCounts: counts, totalTasks: total, progress: total ? Math.round((completed / total) * 100) : 0 };
}

router.get('/', (req, res) => {
  const projects = all('SELECT * FROM projects ORDER BY created_at DESC');

  const enriched = projects.map(p => {
    const taskCounts = all('SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status', [p.id]);
    return { ...p, ...summarizeCounts(taskCounts) };
  });

  // Synthetic "No Project" bucket: tasks that were never assigned to a project
  // still need to be visible with progress. Appended only when such tasks exist.
  // Uses a sentinel id the client recognizes; it has no DB row so it can't be
  // edited or deleted.
  const unassignedCounts = all("SELECT status, COUNT(*) as count FROM tasks WHERE project_id IS NULL GROUP BY status");
  const unassigned = summarizeCounts(unassignedCounts);
  if (unassigned.totalTasks > 0) {
    enriched.push({
      id: 'unassigned',
      synthetic: true,
      title: 'No Project',
      description: 'Tasks not assigned to any project',
      status: 'active',
      ...unassigned,
    });
  }

  res.json(enriched);
});

router.get('/:id', (req, res) => {
  const project = get('SELECT * FROM projects WHERE id = ?', [Number(req.params.id)]);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.get('/:id/tasks', (req, res) => {
  // Server returns a sensible "by progress" default (active work first). The
  // client owns the final order via its Progress/Custom toggle, using the
  // sort_order field carried on each row for Custom mode.
  const ORDER_BY = `
    ORDER BY
      CASE status
        WHEN 'in_progress' THEN 0
        WHEN 'blocked' THEN 1
        WHEN 'todo' THEN 2
        WHEN 'done' THEN 3
        WHEN 'archived' THEN 4
        ELSE 5
      END,
      created_at DESC
  `;

  // The synthetic "No Project" bucket maps to tasks with no project_id.
  if (req.params.id === 'unassigned') {
    const tasks = all(`SELECT * FROM tasks WHERE project_id IS NULL ${ORDER_BY}`);
    return res.json(tasks);
  }

  const tasks = all(`SELECT * FROM tasks WHERE project_id = ? ${ORDER_BY}`, [Number(req.params.id)]);
  res.json(tasks);
});

router.post('/', (req, res) => {
  const { title, description } = req.body;
  const result = run('INSERT INTO projects (title, description) VALUES (?, ?)', [title, description || null]);
  const project = get('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(project);
});

router.put('/:id', (req, res) => {
  const { title, description, status } = req.body;
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM projects WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  run("UPDATE projects SET title = ?, description = ?, status = ?, updated_at = datetime('now') WHERE id = ?", [
    title ?? existing.title, description ?? existing.description, status ?? existing.status, id
  ]);

  const project = get('SELECT * FROM projects WHERE id = ?', [id]);
  res.json(project);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);

  const existing = get('SELECT * FROM projects WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  // Block deletion while tasks are still attached to this project
  const taskCount = get('SELECT COUNT(*) as count FROM tasks WHERE project_id = ?', [id]).count;
  if (taskCount > 0) {
    return res.status(409).json({
      error: `Cannot delete: ${taskCount} task${taskCount === 1 ? '' : 's'} still assigned to this project. Reassign or delete them first.`,
    });
  }

  run('DELETE FROM projects WHERE id = ?', [id]);
  res.json({ success: true });
});

module.exports = router;
