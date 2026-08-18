const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');
const { generateReport } = require('../services/report-service');

router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const todayTasks = all("SELECT * FROM tasks WHERE status IN ('todo', 'in_progress') ORDER BY priority DESC, due_date ASC");
  const todayActivity = all(`
    SELECT a.*, t.title as task_title
    FROM activity_log a
    LEFT JOIN tasks t ON a.task_id = t.id
    WHERE date(a.logged_at) = ?
    ORDER BY a.logged_at DESC
  `, [today]);
  const overdue = all("SELECT * FROM tasks WHERE due_date != '' AND due_date IS NOT NULL AND due_date < ? AND status NOT IN ('done', 'archived')", [today]);

  // Auto-archive: move tasks that have been 'done' for 3+ days to 'archived'
  run(`UPDATE tasks SET status = 'archived', updated_at = datetime('now')
    WHERE status = 'done' AND updated_at <= datetime('now', '-3 days')`);

  const stats = {
    total: (get('SELECT COUNT(*) as c FROM tasks WHERE parent_id IS NULL') || { c: 0 }).c,
    subtasks: (get('SELECT COUNT(*) as c FROM tasks WHERE parent_id IS NOT NULL') || { c: 0 }).c,
    done: (get("SELECT COUNT(*) as c FROM tasks WHERE status = 'done'") || { c: 0 }).c,
    archived: (get("SELECT COUNT(*) as c FROM tasks WHERE status = 'archived'") || { c: 0 }).c,
    inProgress: (get("SELECT COUNT(*) as c FROM tasks WHERE status = 'in_progress'") || { c: 0 }).c,
    todo: (get("SELECT COUNT(*) as c FROM tasks WHERE status = 'todo'") || { c: 0 }).c,
  };

  res.json({ todayTasks, todayActivity, overdue, stats });
});

router.get('/weekly', (req, res) => {
  const { from, to } = req.query;

  // Default window: the last 7 days up to now.
  const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();
  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({ error: 'invalid from/to date' });
  }
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const completed = all(
    "SELECT * FROM tasks WHERE status = 'done' AND updated_at >= ? AND updated_at < ?",
    [startIso, endIso]
  );
  const activities = all(`
    SELECT a.*, t.title as task_title
    FROM activity_log a
    LEFT JOIN tasks t ON a.task_id = t.id
    WHERE a.logged_at >= ? AND a.logged_at < ?
    ORDER BY a.logged_at DESC
  `, [startIso, endIso]);
  const totalHours = (get(
    'SELECT COALESCE(SUM(hours_spent), 0) as total FROM activity_log WHERE logged_at >= ? AND logged_at < ?',
    [startIso, endIso]
  ) || { total: 0 }).total;

  res.json({ completed, activities, totalHours, from: startIso, to: endIso });
});

router.get('/quarterly', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to query params required' });

  try {
    const report = await generateReport(from, to);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
