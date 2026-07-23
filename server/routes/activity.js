const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');

router.get('/', (req, res) => {
  const { from, to, task_id } = req.query;

  let query = `
    SELECT a.*, t.title as task_title, p.title as project_title
    FROM activity_log a
    LEFT JOIN tasks t ON a.task_id = t.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (from) { query += ' AND a.logged_at >= ?'; params.push(from); }
  if (to) { query += ' AND a.logged_at <= ?'; params.push(to); }
  if (task_id) { query += ' AND a.task_id = ?'; params.push(Number(task_id)); }

  query += ' ORDER BY a.logged_at DESC';
  const activities = all(query, params);
  res.json(activities);
});

router.post('/', (req, res) => {
  const { task_id, note, hours_spent } = req.body;
  const result = run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [task_id || null, note, hours_spent || null]);
  const activity = get('SELECT * FROM activity_log WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(activity);
});

router.put('/:id', (req, res) => {
  const existing = get('SELECT * FROM activity_log WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Activity not found' });
  const note = req.body.note ?? existing.note;
  const hours_spent = 'hours_spent' in req.body ? (req.body.hours_spent || null) : existing.hours_spent;
  run('UPDATE activity_log SET note = ?, hours_spent = ? WHERE id = ?', [note, hours_spent, Number(req.params.id)]);
  const updated = get('SELECT * FROM activity_log WHERE id = ?', [Number(req.params.id)]);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const result = run('DELETE FROM activity_log WHERE id = ?', [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Activity not found' });
  res.json({ success: true });
});

module.exports = router;
