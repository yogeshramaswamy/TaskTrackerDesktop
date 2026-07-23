import { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const STATUSES = ['todo', 'in_progress', 'done', 'blocked'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };
const STATUS_COLORS = { todo: 'border-slate-600', in_progress: 'border-yellow-600', done: 'border-green-600', blocked: 'border-red-600' };

export default function Subtasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(searchParams.get('task') || '');
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [pendingEditId, setPendingEditId] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api.tasks.list({ parent_id: 'null' }).then(setTasks).catch(console.error);
  }, []);

  useEffect(() => {
    if (location.state?.taskId && location.state?.parentId) {
      const parentId = String(location.state.parentId);
      const editId = String(location.state.taskId);
      setSelectedTaskId(parentId);
      setPendingEditId(editId);
      api.tasks.getSubtasks(parentId).then(data => {
        setSubtasks(data);
        const t = data.find(t => String(t.id) === editId);
        if (t) { setEditTask(t); setShowForm(true); }
      }).catch(console.error);
    }
  }, [location.state]);

  useEffect(() => {
    if (selectedTaskId) {
      api.tasks.getSubtasks(selectedTaskId).then(data => {
        setSubtasks(data);
      }).catch(console.error);
      setSearchParams({ task: selectedTaskId });
    } else {
      setSubtasks([]);
    }
  }, [selectedTaskId]);

  const loadSubtasks = () => {
    if (selectedTaskId) {
      api.tasks.getSubtasks(selectedTaskId).then(setSubtasks).catch(console.error);
    }
  };


  const updateStatus = async (id, status) => {
    await api.tasks.update(id, { status });
    loadSubtasks();
  };

  const selectedTask = tasks.find(t => String(t.id) === String(selectedTaskId));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Subtasks</h2>
        {selectedTaskId && (
          <button onClick={() => { setEditTask(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">+ New Subtask</button>
        )}
      </div>

      <div className="mb-6 bg-slate-800 rounded-lg p-4">
        <label className="text-sm text-slate-400 block mb-2">Select Parent Task</label>
        <select
          value={selectedTaskId}
          onChange={e => setSelectedTaskId(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Choose a task --</option>
          {tasks.map(t => (
            <option key={t.id} value={t.id}>[{t.status}] {t.title}</option>
          ))}
        </select>
        {selectedTask && selectedTask.description && (
          <p className="text-xs text-slate-400 mt-2">{selectedTask.description}</p>
        )}
      </div>

      {!selectedTaskId && (
        <div className="text-center text-slate-500 mt-12">
          <p className="text-lg">Select a parent task to view its subtasks</p>
        </div>
      )}

      {selectedTaskId && (
        <div className="grid grid-cols-4 gap-4">
          {STATUSES.map(status => (
            <div key={status} className={`border-t-2 ${STATUS_COLORS[status]} rounded-lg bg-slate-800/50 p-3`}>
              <h3 className="text-sm font-semibold mb-3 text-slate-300">{STATUS_LABELS[status]} ({subtasks.filter(t => t.status === status).length})</h3>
              <div className="space-y-2">
                {subtasks.filter(t => t.status === status).map(task => (
                  <SubtaskCard key={task.id} task={task} onStatusChange={updateStatus} onEdit={(t) => { setEditTask(t); setShowForm(true); }} onDelete={async (id) => { await api.tasks.delete(id); loadSubtasks(); }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SubtaskForm
          task={editTask}
          parentId={selectedTaskId}
          parentProjectId={selectedTask?.project_id}
          onClose={() => setShowForm(false)}
          onSave={() => { loadSubtasks(); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function SubtaskCard({ task, onStatusChange, onEdit, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium flex-1">{task.title}</p>
        <div className="flex gap-1">
          <button onClick={() => onEdit(task)} className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/20" title="Edit">✏️</button>
          <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-900/20" title="Delete">🚮</button>
        </div>
      </div>
      {task.description && <p className="text-xs text-slate-400 mt-1">{task.description}</p>}
      <div className="flex items-center gap-2 mt-2">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className="text-xs bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-slate-300"
        >
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {task.priority && <span className="text-xs text-slate-500">{task.priority}</span>}
        {task.due_date && <span className="text-xs text-slate-500">{task.due_date.split('T')[0]}</span>}
      </div>
      {showDeleteConfirm && (
        <ConfirmDelete
          title={task.title}
          onConfirm={() => { onDelete(task.id); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function NoteItem({ note, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.note);
  const [hours, setHours] = useState(note.hours_spent || '');

  const save = async () => {
    await api.activity.update(note.id, { note: text.trim(), hours_spent: hours ? Number(hours) : null });
    setEditing(false);
    onUpdated();
  };

  if (editing) {
    return (
      <div className="bg-slate-700/50 rounded-lg p-2.5 space-y-2">
        <textarea
          className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          autoFocus
        />
        <div className="flex gap-2 items-center">
          <input
            type="number" step="0.5" min="0"
            className="w-20 bg-slate-700 rounded px-2 py-1 text-xs"
            placeholder="Hours"
            value={hours}
            onChange={e => setHours(e.target.value)}
          />
          <span className="text-xs text-slate-500">h</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white px-2 py-1">Cancel</button>
            <button onClick={save} disabled={!text.trim()} className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-2 py-1 rounded">Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="bg-slate-700/50 hover:bg-slate-700 rounded-lg p-2.5 cursor-pointer"
      title="Click to edit"
    >
      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
      <div className="flex gap-3 mt-1 text-xs text-slate-400">
        <span>{new Date(note.logged_at).toLocaleDateString()} {new Date(note.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        {note.hours_spent && <span>{note.hours_spent}h spent</span>}
      </div>
    </div>
  );
}

function ConfirmDelete({ title, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-700" onClick={e => e.stopPropagation()}>
        <h4 className="font-semibold text-red-400 mb-2">Delete Subtask</h4>
        <p className="text-sm text-slate-300 mb-4">Are you sure you want to delete "<span className="text-white">{title}</span>"? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white">No, Cancel</button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

function SubtaskForm({ task, parentId, parentProjectId, onClose, onSave }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    ticket_url: task?.ticket_url || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    start_date: task?.start_date?.split('T')[0] || '',
    due_date: task?.due_date?.split('T')[0] || '',
  });
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [noteHours, setNoteHours] = useState('');
  const [reminders, setReminders] = useState([]);
  const [reminderMsg, setReminderMsg] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderRecurring, setReminderRecurring] = useState('');
  const [activeTab, setActiveTab] = useState('notes');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelWide, setPanelWide] = useState(false);

  useEffect(() => {
    if (task) {
      api.activity.list({ task_id: task.id }).then(setNotes).catch(console.error);
      api.reminders.list().then(r => setReminders(r.filter(rem => rem.task_id === task.id))).catch(console.error);
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, parent_id: Number(parentId), project_id: parentProjectId || null, start_date: form.start_date || null, due_date: form.due_date || null };
    if (task) {
      await api.tasks.update(task.id, data);
    } else {
      await api.tasks.create(data);
    }
    onSave();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await api.activity.create({ task_id: task.id, note: newNote.trim(), hours_spent: noteHours ? Number(noteHours) : null });
    setNewNote(''); setNoteHours('');
    const updated = await api.activity.list({ task_id: task.id });
    setNotes(updated);
  };

  const leftCls = !task ? 'flex-1' : panelOpen ? (panelWide ? 'w-[35%]' : 'w-1/2') : 'flex-1';
  const rightCls = panelWide ? 'w-[65%]' : 'w-1/2';
  const modalMaxW = panelOpen && panelWide ? 'max-w-5xl' : 'max-w-3xl';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto py-6 px-4">
      <div className="bg-slate-800 rounded-xl flex flex-col transition-all duration-200 resize overflow-auto" style={{ width: '768px', minWidth: '480px', maxWidth: '95vw', minHeight: '420px', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h3 className="text-lg font-bold">{task ? 'Edit Subtask' : 'New Subtask'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Left column — core fields */}
          <div className={`${leftCls} border-r border-slate-700 p-5 overflow-auto shrink-0 transition-all duration-200`}>
            <form id="subtask-form" onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title <span className="text-red-400">*</span></label>
                <input className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Update Helm values" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Description</label>
                <textarea className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm resize-y" placeholder="What needs to be done?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Ticket Link</label>
                <input className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="ADO, Ivanti, Jira URL..." value={form.ticket_url} onChange={e => setForm({ ...form, ticket_url: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Status</label>
                  <select className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Priority</label>
                  <select className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                  <input type="date" className="w-full bg-slate-700 rounded-lg px-3 py-1.5 text-sm" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">End Date</label>
                  <input type="date" className="w-full bg-slate-700 rounded-lg px-3 py-1.5 text-sm" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
            </form>
          </div>

          {/* Pull-tab when panel is collapsed */}
          {task && !panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex flex-col items-center justify-center gap-2 w-10 shrink-0 bg-slate-700/40 hover:bg-slate-700 transition-colors border-l border-slate-700 text-slate-400 hover:text-white"
              title="Show Progress Notes & Reminders"
            >
              <span className="text-base">‹</span>
              <span className="text-xs font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                Notes{notes.length > 0 ? ` (${notes.length})` : ''}
              </span>
              {reminders.length > 0 && (
                <span className="text-xs font-medium" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  Reminders ({reminders.length})
                </span>
              )}
            </button>
          )}

          {/* Expanded right panel */}
          {task && panelOpen && (
            <div className={`${rightCls} flex flex-col overflow-hidden transition-all duration-200`}>
              <div className="flex items-center border-b border-slate-700 shrink-0">
                <button onClick={() => setPanelOpen(false)} className="px-2 py-2.5 text-slate-400 hover:text-white text-sm shrink-0" title="Hide panel">›</button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-2.5 text-xs font-medium ${activeTab === 'notes' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'}`}
                >
                  Progress Notes {notes.length > 0 && <span className="ml-1 bg-slate-600 px-1.5 py-0.5 rounded-full text-xs">{notes.length}</span>}
                </button>
                <button
                  onClick={() => setActiveTab('reminders')}
                  className={`flex-1 py-2.5 text-xs font-medium ${activeTab === 'reminders' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-white'}`}
                >
                  Reminders {reminders.length > 0 && <span className="ml-1 bg-slate-600 px-1.5 py-0.5 rounded-full text-xs">{reminders.length}</span>}
                </button>
                <button onClick={() => setPanelWide(w => !w)} className="px-2 py-2.5 text-slate-400 hover:text-white text-xs shrink-0" title={panelWide ? 'Shrink panel' : 'Expand panel'}>{panelWide ? '⇥' : '⇤'}</button>
              </div>

              {activeTab === 'notes' && (
                <div className="flex flex-col flex-1 overflow-hidden p-4 space-y-3">
                  <div className="flex-1 overflow-auto space-y-2 min-h-0">
                    {notes.length === 0 && <p className="text-xs text-slate-500">No notes yet</p>}
                    {notes.map(n => (
                      <NoteItem key={n.id} note={n} onUpdated={async () => {
                        const updated = await api.activity.list({ task_id: task.id });
                        setNotes(updated);
                      }} />
                    ))}
                  </div>
                  <div className="space-y-2 shrink-0">
                    <textarea className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="What did you do? What's remaining?" value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} />
                    <div className="flex gap-2 items-center">
                      <input type="number" step="0.5" min="0" className="w-20 bg-slate-700 rounded-lg px-2 py-1.5 text-sm" placeholder="Hours" value={noteHours} onChange={e => setNoteHours(e.target.value)} />
                      <span className="text-xs text-slate-500">hrs</span>
                      <button type="button" onClick={addNote} disabled={!newNote.trim()} className="ml-auto bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs">Add Note</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reminders' && (
                <div className="flex flex-col flex-1 overflow-hidden p-4 space-y-3">
                  <div className="flex-1 overflow-auto space-y-2 min-h-0">
                    {reminders.length === 0 && <p className="text-xs text-slate-500">No reminders set</p>}
                    {reminders.map(r => (
                      <div key={r.id} className="bg-slate-700/50 rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm">{r.message}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(r.remind_at).toLocaleDateString()} {new Date(r.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {r.recurring && <span className="ml-2 text-blue-400">({r.recurring})</span>}
                          </p>
                        </div>
                        <button onClick={async () => { await api.reminders.delete(r.id); setReminders(reminders.filter(x => x.id !== r.id)); }} className="text-xs text-red-400 hover:text-red-300 shrink-0 ml-2">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 shrink-0">
                    <input className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="Reminder message" value={reminderMsg} onChange={e => setReminderMsg(e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="date" className="bg-slate-700 rounded-lg px-2 py-1.5 text-xs" value={reminderDate} onChange={e => setReminderDate(e.target.value)} />
                      <input type="time" className="bg-slate-700 rounded-lg px-2 py-1.5 text-xs" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
                      <select className="bg-slate-700 rounded-lg px-2 py-1.5 text-xs" value={reminderRecurring} onChange={e => setReminderRecurring(e.target.value)}>
                        <option value="">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={!reminderMsg.trim() || !reminderDate || !reminderTime}
                      onClick={async () => {
                        const remind_at = `${reminderDate}T${reminderTime}:00`;
                        await api.reminders.create({ task_id: task.id, message: reminderMsg, remind_at, recurring: reminderRecurring || null });
                        setReminderMsg(''); setReminderDate(''); setReminderTime(''); setReminderRecurring('');
                        const updated = await api.reminders.list();
                        setReminders(updated.filter(r => r.task_id === task.id));
                      }}
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs"
                    >
                      Set Reminder
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-700 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button type="submit" form="subtask-form" className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg text-sm">Save</button>
        </div>
      </div>
    </div>
  );
}
