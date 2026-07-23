const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');

router.get('/', (req, res) => {
  const { date } = req.query;
  if (date) {
    const entry = get('SELECT * FROM daily_journal WHERE date = ?', [date]);
    return res.json(entry || { date, content: '' });
  }
  const entries = all('SELECT * FROM daily_journal ORDER BY date DESC LIMIT 30');
  res.json(entries);
});

router.post('/', (req, res) => {
  const { date, content } = req.body;
  const today = date || new Date().toISOString().split('T')[0];

  const existing = get('SELECT * FROM daily_journal WHERE date = ?', [today]);
  if (existing) {
    run('UPDATE daily_journal SET content = ? WHERE date = ?', [content, today]);
  } else {
    run('INSERT INTO daily_journal (date, content) VALUES (?, ?)', [today, content]);
  }

  const entry = get('SELECT * FROM daily_journal WHERE date = ?', [today]);
  res.json(entry);
});

module.exports = router;
