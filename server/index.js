const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initDb } = require('./db/database');
const { initReminders } = require('./services/reminder-service');

const tasksRouter = require('./routes/tasks');
const projectsRouter = require('./routes/projects');
const activityRouter = require('./routes/activity');
const claudeRouter = require('./routes/claude');
const remindersRouter = require('./routes/reminders');
const reportsRouter = require('./routes/reports');
const journalRouter = require('./routes/journal');
const backupRouter = require('./routes/backup');
const settingsRouter = require('./routes/settings');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../client/dist')));

app.use('/api/tasks', tasksRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/claude', claudeRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/journal', journalRouter);
app.use('/api/backups', backupRouter);
app.use('/api/settings', settingsRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

async function start() {
  await initDb();
  initReminders();
  app.listen(config.port, () => {
    console.log(`TaskTracker Pro server running on http://localhost:${config.port}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
