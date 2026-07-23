const schedule = require('node-schedule');
const notifier = require('node-notifier');
const path = require('path');
const { run, all, get } = require('../db/database');

const scheduledJobs = new Map();

function scheduleReminder(reminder) {
  if (scheduledJobs.has(reminder.id)) {
    scheduledJobs.get(reminder.id).cancel();
  }

  const remindAt = new Date(reminder.remind_at);
  if (remindAt <= new Date()) return;

  const job = schedule.scheduleJob(remindAt, () => {
    notifier.notify({
      title: 'TaskTracker Pro',
      message: reminder.message,
      icon: path.join(__dirname, '../../client/public/icon.svg'),
      sound: true,
      wait: true,
    });

    if (reminder.recurring) {
      const next = new Date(remindAt);
      if (reminder.recurring === 'daily') next.setDate(next.getDate() + 1);
      else if (reminder.recurring === 'weekly') next.setDate(next.getDate() + 7);

      run('UPDATE reminders SET remind_at = ? WHERE id = ?', [next.toISOString(), reminder.id]);
      const updated = get('SELECT * FROM reminders WHERE id = ?', [reminder.id]);
      scheduleReminder(updated);
    } else {
      run('UPDATE reminders SET is_active = 0 WHERE id = ?', [reminder.id]);
    }

    scheduledJobs.delete(reminder.id);
  });

  scheduledJobs.set(reminder.id, job);
}

function cancelReminder(id) {
  if (scheduledJobs.has(id)) {
    scheduledJobs.get(id).cancel();
    scheduledJobs.delete(id);
  }
}

function initReminders() {
  const activeReminders = all('SELECT * FROM reminders WHERE is_active = 1');
  activeReminders.forEach(scheduleReminder);
  console.log(`Loaded ${activeReminders.length} active reminders`);
}

module.exports = { scheduleReminder, cancelReminder, initReminders };
