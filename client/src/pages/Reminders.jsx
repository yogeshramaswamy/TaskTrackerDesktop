import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ task_id: '', message: '', date: '', time: '', recurring: '' });

  const load = () => api.reminders.list().then(setReminders).catch(console.error);
  const loadCompleted = () => api.reminders.listCompleted().then(setCompleted).catch(console.error);

  useEffect(() => {
    load();
    api.tasks.list().then(setTasks).catch(console.error);
  }, []);

  const toggleCompleted = () => {
    const next = !showCompleted;
    setShowCompleted(next);
    if (next) loadCompleted();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const remind_at = `${form.date}T${form.time}:00`;
    await api.reminders.create({
      task_id: form.task_id ? Number(form.task_id) : null,
      message: form.message,
      remind_at,
      recurring: form.recurring || null,
    });
    setForm({ task_id: '', message: '', date: '', time: '', recurring: '' });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id) => {
    await api.reminders.delete(id);
    load();
  };

  const upcoming = reminders;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Reminders</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleCompleted}
            className={`px-4 py-2 rounded-lg text-sm border ${showCompleted ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
          >
            {showCompleted ? 'Hide completed' : 'Show completed'}
          </button>
          <button onClick={() => setShowForm(!showForm)} className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm">+ New Reminder</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-slate-800 rounded-lg p-4 mb-6 space-y-3 border border-slate-700">
          <input
            className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm"
            placeholder="Reminder message"
            value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            required
          />
          <select className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" value={form.task_id} onChange={e => setForm({ ...form, task_id: e.target.value })}>
            <option value="">No task (standalone reminder)</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-3">
            <input type="date" className="bg-slate-700 rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            <input type="time" className="bg-slate-700 rounded-lg px-3 py-2 text-sm" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
            <select className="bg-slate-700 rounded-lg px-3 py-2 text-sm" value={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.value })}>
              <option value="">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm">Set Reminder</button>
          </div>
        </form>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Upcoming ({upcoming.length})</h3>
          <div className="space-y-2">
            {upcoming.map(r => (
              <ReminderCard key={r.id} reminder={r} onDelete={handleDelete} onUpdate={load} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length === 0 && !showForm && !showCompleted && (
        <div className="text-center text-slate-500 mt-12">
          <p className="text-lg mb-2">No upcoming reminders</p>
          <p className="text-sm">Click "+ New Reminder" or set one from the task edit form</p>
        </div>
      )}

      {showCompleted && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-3 text-slate-400">Completed ({completed.length})</h3>
          {completed.length === 0 ? (
            <p className="text-sm text-slate-500">No completed reminders yet.</p>
          ) : (
            <div className="space-y-2">
              {completed.map(r => (
                <CompletedReminderCard
                  key={r.id}
                  reminder={r}
                  onDelete={async (id) => { await api.reminders.delete(id); loadCompleted(); }}
                  onReschedule={() => { loadCompleted(); load(); }}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CompletedReminderCard({ reminder, onDelete, onReschedule }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editMessage, setEditMessage] = useState(reminder.message);
  const [editDate, setEditDate] = useState(reminder.remind_at.split('T')[0]);
  const [editTime, setEditTime] = useState(reminder.remind_at.split('T')[1]?.slice(0, 5) || '');
  const [saving, setSaving] = useState(false);

  // A completed reminder has already fired, so "editing" it means creating a
  // fresh active reminder with the new details and marking this one deleted
  // (mirrors how snooze/update work for active reminders).
  const reschedule = async () => {
    setSaving(true);
    try {
      await api.reminders.create({
        task_id: reminder.task_id,
        message: editMessage,
        remind_at: `${editDate}T${editTime}:00`,
        recurring: reminder.recurring || null,
      });
      await api.reminders.delete(reminder.id);
      onReschedule();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/60 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4 flex items-center gap-4 opacity-90">
        <div className="w-10 h-10 rounded-full bg-green-900/30 border border-green-700 flex items-center justify-center text-lg">
          ✓
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-300 line-through decoration-slate-600">{reminder.message}</p>
          <div className="flex gap-3 mt-1 text-xs text-slate-500">
            <span>Fired {new Date(reminder.remind_at).toLocaleDateString()} at {new Date(reminder.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {reminder.task_title && (
              <button
                onClick={() => {
                  if (reminder.task_parent_id) {
                    navigate('/subtasks', { state: { taskId: reminder.task_id, parentId: reminder.task_parent_id } });
                  } else {
                    navigate('/tasks', { state: { taskId: reminder.task_id } });
                  }
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                Task: {reminder.task_title}
              </button>
            )}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-slate-400 hover:text-white px-2 py-1">
          {expanded ? 'Close' : 'Edit'}
        </button>
        <button onClick={() => onDelete(reminder.id)} className="text-xs text-slate-500 hover:text-red-400 px-2 py-1">Dismiss</button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3 space-y-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Message</p>
            <input
              className="w-full bg-slate-700 rounded-lg px-3 py-1.5 text-sm"
              value={editMessage}
              onChange={e => setEditMessage(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">New Date/Time</p>
            <div className="flex gap-2 items-center">
              <input type="date" className="bg-slate-700 rounded-lg px-3 py-1.5 text-sm" value={editDate} onChange={e => setEditDate(e.target.value)} />
              <input type="time" className="bg-slate-700 rounded-lg px-3 py-1.5 text-sm" value={editTime} onChange={e => setEditTime(e.target.value)} />
              <button
                onClick={reschedule}
                disabled={saving || !editMessage || !editDate || !editTime}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs"
              >
                {saving ? 'Saving…' : 'Reschedule'}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">Reschedule creates a new active reminder and removes this completed one.</p>
        </div>
      )}
    </div>
  );
}

function ReminderCard({ reminder, onDelete, onUpdate }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editDate, setEditDate] = useState(reminder.remind_at.split('T')[0]);
  const [editTime, setEditTime] = useState(reminder.remind_at.split('T')[1]?.slice(0, 5) || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const snooze = async (minutes) => {
    const newTime = new Date(new Date(reminder.remind_at).getTime() + minutes * 60 * 1000);
    await api.reminders.delete(reminder.id);
    await api.reminders.create({
      task_id: reminder.task_id,
      message: reminder.message,
      remind_at: newTime.toISOString(),
      recurring: reminder.recurring || null,
    });
    onUpdate();
  };

  const updateTime = async () => {
    const remind_at = `${editDate}T${editTime}:00`;
    await api.reminders.delete(reminder.id);
    await api.reminders.create({
      task_id: reminder.task_id,
      message: reminder.message,
      remind_at,
      recurring: reminder.recurring || null,
    });
    onUpdate();
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-750"
      >
        <div className="w-10 h-10 rounded-full bg-orange-900/40 border border-orange-700 flex items-center justify-center text-lg">
          🔔
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{reminder.message}</p>
          <div className="flex gap-3 mt-1 text-xs text-slate-400">
            <span>{new Date(reminder.remind_at).toLocaleDateString()} at {new Date(reminder.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {reminder.recurring && <span className="text-blue-400">Repeats {reminder.recurring}</span>}
            {reminder.task_title && <span>Task: {reminder.task_title}</span>}
          </div>
        </div>
        <span className="text-xs text-slate-500">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3 space-y-3">
          <div>
            <p className="text-xs text-slate-400 mb-2">Snooze</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => snooze(15)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">+15 min</button>
              <button onClick={() => snooze(30)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">+30 min</button>
              <button onClick={() => snooze(60)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">+1 hour</button>
              <button onClick={() => snooze(180)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">+3 hours</button>
              <button onClick={() => snooze(1440)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">+1 day</button>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">Update Date/Time</p>
            <div className="flex gap-2 items-center">
              <input type="date" className="bg-slate-700 rounded-lg px-3 py-1.5 text-sm" value={editDate} onChange={e => setEditDate(e.target.value)} />
              <input type="time" className="bg-slate-700 rounded-lg px-3 py-1.5 text-sm" value={editTime} onChange={e => setEditTime(e.target.value)} />
              <button onClick={updateTime} disabled={!editDate || !editTime} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs">Update</button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-700">
            {reminder.task_id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (reminder.task_parent_id) {
                    navigate('/subtasks', { state: { taskId: reminder.task_id, parentId: reminder.task_parent_id } });
                  } else {
                    navigate('/tasks', { state: { taskId: reminder.task_id } });
                  }
                }}
                className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded bg-blue-900/20"
              >
                → Open {reminder.task_parent_id ? 'Subtask' : 'Task'}: {reminder.task_title}
              </button>
            ) : <span />}
            <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded bg-red-900/20">Delete Reminder</button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-700" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold text-red-400 mb-2">Delete Reminder</h4>
            <p className="text-sm text-slate-300 mb-4">Are you sure you want to delete this reminder?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">No, Cancel</button>
              <button onClick={() => { onDelete(reminder.id); setShowDeleteConfirm(false); }} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
