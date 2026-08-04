const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');
const { scheduleReminder, cancelReminder } = require('../services/reminder-service');

router.get('/', (req, res) => {
  // ?status=completed returns fired reminders; default returns active ones.
  // Deleted reminders (status='deleted') are never returned.
  const wantCompleted = req.query.status === 'completed';
  const reminders = all(`
    SELECT r.*, t.title as task_title, t.parent_id as task_parent_id
    FROM reminders r
    LEFT JOIN tasks t ON r.task_id = t.id
    WHERE r.status = ?
    ORDER BY r.remind_at ${wantCompleted ? 'DESC' : 'ASC'}
  `, [wantCompleted ? 'completed' : 'active']);
  res.json(reminders);
});

router.post('/', (req, res) => {
  const { task_id, message, remind_at, recurring } = req.body;
  const result = run('INSERT INTO reminders (task_id, message, remind_at, recurring) VALUES (?, ?, ?, ?)', [task_id || null, message, remind_at, recurring || null]);
  const reminder = get('SELECT * FROM reminders WHERE id = ?', [result.lastInsertRowid]);
  scheduleReminder(reminder);
  res.status(201).json(reminder);
});

router.delete('/:id', (req, res) => {
  cancelReminder(Number(req.params.id));
  const result = run("UPDATE reminders SET is_active = 0, status = 'deleted' WHERE id = ?", [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Reminder not found' });
  res.json({ success: true });
});

module.exports = router;
