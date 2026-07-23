const express = require('express');
const router = express.Router();
const { backupDb, restoreDb, listBackups, validateDbFile, importDbFile, exportDbTo } = require('../db/database');
const { initReminders } = require('../services/reminder-service');

router.get('/', (req, res) => {
  const backups = listBackups();
  res.json(backups);
});

router.post('/', (req, res) => {
  const path = backupDb();
  res.json({ success: true, path });
});

router.post('/restore', (req, res) => {
  const { file } = req.body;
  if (!file) return res.status(400).json({ error: 'file is required' });
  try {
    restoreDb(file);
    res.json({ success: true, message: 'Database restored. Restart the server to apply.' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Export: open a native Save dialog and write the current database there
// (e.g. to OneDrive/USB). Returns the path it was saved to.
router.post('/export', async (req, res) => {
  if (typeof global.pickSaveDbPath !== 'function') {
    return res.status(500).json({ error: 'Export is only available in the desktop app.' });
  }
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dest = await global.pickSaveDbPath(`tasktracker-backup-${stamp}.db`);
  if (!dest) return res.json({ canceled: true });
  try {
    exportDbTo(dest);
    res.json({ success: true, path: dest });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Step 1: open the native file picker, validate the chosen file, and report
// what's inside it. Does NOT change anything yet.
router.post('/import/pick', async (req, res) => {
  if (typeof global.pickDbFile !== 'function') {
    return res.status(500).json({ error: 'File picker is only available in the desktop app.' });
  }
  const filePath = await global.pickDbFile();
  if (!filePath) return res.json({ canceled: true });

  const check = validateDbFile(filePath);
  if (!check.valid) return res.status(400).json({ error: check.error, filePath });
  res.json({ valid: true, filePath, summary: check.summary });
});

// Step 2: actually import the file the user confirmed. Re-validates for safety,
// backs up current data, swaps the DB, and refreshes scheduled reminders.
router.post('/import/confirm', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath is required' });
  try {
    const summary = importDbFile(filePath);
    initReminders(); // reschedule reminders from the newly imported data
    res.json({ success: true, summary });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
