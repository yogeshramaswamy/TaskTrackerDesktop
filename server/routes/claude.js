const express = require('express');
const router = express.Router();
const { chat, getChatHistory, executeAction, executePlan } = require('../services/claude-service');
const { run, get, backupDb, getDb, saveDb } = require('../db/database');

router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const result = await chat(message);
    res.json(result);
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Failed to process message: ' + err.message });
  }
});

router.post('/confirm-delete', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const task = get('SELECT * FROM tasks WHERE id = ?', [Number(id)]);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  backupDb();
  run('DELETE FROM tasks WHERE id = ?', [Number(id)]);
  run('DELETE FROM pending_deletions WHERE task_id = ?', [Number(id)]);
  res.json({ success: true, title: task.title });
});

router.post('/confirm-delete-bulk', (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: 'ids array is required' });

  backupDb();
  const deleted = [];
  for (const id of ids) {
    const task = get('SELECT * FROM tasks WHERE id = ?', [Number(id)]);
    if (task) {
      run('DELETE FROM tasks WHERE id = ?', [Number(id)]);
      run('DELETE FROM pending_deletions WHERE task_id = ?', [Number(id)]);
      deleted.push(task.title);
    }
  }
  res.json({ success: true, deleted });
});

router.get('/pending-deletions', (req, res) => {
  const { all } = require('../db/database');
  const pending = all('SELECT pd.*, t.status, t.priority FROM pending_deletions pd LEFT JOIN tasks t ON pd.task_id = t.id WHERE t.id IS NOT NULL ORDER BY pd.requested_at DESC');
  res.json(pending);
});

router.delete('/pending-deletions/:id', (req, res) => {
  run('DELETE FROM pending_deletions WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

router.post('/execute-plan', (req, res) => {
  const { actions } = req.body;
  if (!actions || !actions.length) return res.status(400).json({ error: 'actions array is required' });
  backupDb();
  try {
    // All-or-nothing: parent tasks and their nested subtasks commit together,
    // or the whole plan rolls back and nothing is created.
    const results = executePlan(actions);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Plan failed and was rolled back: ' + err.message });
  }
});

router.get('/history', (req, res) => {
  const history = getChatHistory();
  res.json(history);
});

router.delete('/history', (req, res) => {
  getDb().exec('DELETE FROM claude_chat_history');
  saveDb();
  res.json({ success: true });
});

module.exports = router;
