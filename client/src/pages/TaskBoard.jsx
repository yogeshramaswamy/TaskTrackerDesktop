import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

const STATUSES = ['todo', 'in_progress', 'done', 'blocked'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };
const STATUS_COLORS = { todo: 'border-slate-600', in_progress: 'border-yellow-600', done: 'border-green-600', blocked: 'border-red-600', archived: 'border-slate-500' };

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_CHIP = {
  urgent: { off: 'bg-red-900/40 text-red-400 hover:bg-red-900/70', on: 'bg-red-600 text-white ring-2 ring-red-400' },
  high:   { off: 'bg-orange-900/40 text-orange-400 hover:bg-orange-900/70', on: 'bg-orange-500 text-white ring-2 ring-orange-400' },
  medium: { off: 'bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/70', on: 'bg-yellow-500 text-white ring-2 ring-yellow-400' },
  low:    { off: 'bg-slate-700/60 text-slate-400 hover:bg-slate-700', on: 'bg-slate-500 text-white ring-2 ring-slate-400' },
};

const DEFAULT_FILTERS = { project: 'all', priorities: [], dueDate: 'all', search: '', showArchived: false };

function isToday(d) {
  if (!d) return false;
  const dt = new Date(d), t = new Date();
  return dt.getFullYear() === t.getFullYear() && dt.getMonth() === t.getMonth() && dt.getDate() === t.getDate();
}
function isThisWeek(d) {
  if (!d) return false;
  const dt = new Date(d), now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay());
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return dt >= start && dt <= end;
}
function isOverdue(d) {
  if (!d) return false;
  return new Date(d) < new Date() && !isToday(d);
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [savedViews, setSavedViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem('taskboard_views') || '{}'); } catch { return {}; }
  });
  const [viewName, setViewName] = useState('');
  const location = useLocation();

  const load = useCallback(() => {
    const params = { parent_id: 'null' };
    if (filters.showArchived) params.include_archived = 'true';
    api.tasks.list(params).then(setTasks).catch(console.error);
    api.projects.list().then(setProjects).catch(console.error);
  }, [filters.showArchived]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (location.state?.taskId) {
      api.tasks.get(location.state.taskId).then(t => {
        if (t) { setEditTask(t); setShowForm(true); }
      }).catch(() => {});
    }
  }, [location.state]);

  const updateStatus = async (id, status) => {
    await api.tasks.update(id, { status });
    load();
  };

  const togglePriority = (p) => {
    setFilters(f => ({
      ...f,
      priorities: f.priorities.includes(p) ? f.priorities.filter(x => x !== p) : [...f.priorities, p],
    }));
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    const updated = { ...savedViews, [viewName.trim()]: filters };
    setSavedViews(updated);
    localStorage.setItem('taskboard_views', JSON.stringify(updated));
    setViewName('');
  };

  const deleteView = (name) => {
    const updated = { ...savedViews };
    delete updated[name];
    setSavedViews(updated);
    localStorage.setItem('taskboard_views', JSON.stringify(updated));
  };

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (filters.project === 'none' && t.project_id != null) return false;
    if (filters.project !== 'all' && filters.project !== 'none' && String(t.project_id) !== String(filters.project)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority)) return false;
    if (filters.dueDate === 'today' && !isToday(t.due_date)) return false;
    if (filters.dueDate === 'this_week' && !isThisWeek(t.due_date)) return false;
    if (filters.dueDate === 'overdue' && !isOverdue(t.due_date)) return false;
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  }), [tasks, filters]);

  const activeStatuses = filters.showArchived ? [...STATUSES, 'archived'] : STATUSES;
  const STATUS_LABELS_ALL = { ...STATUS_LABELS, archived: 'Archived' };
  const hasActiveFilters = filters.project !== 'all' || filters.priorities.length > 0 || filters.dueDate !== 'all' || filters.search !== '' || filters.showArchived;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Task Board</h2>
        <button onClick={() => { setEditTask(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">+ New Task</button>
      </div>

      {/* Filter bar */}
      <div className="bg-slate-800/60 rounded-xl p-3 mb-5 space-y-2.5">

        {/* Row 1: search + save view */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
            <input
              className="w-full bg-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-sm placeholder:text-slate-500"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div className="flex gap-1 items-center">
            <input
              className="bg-slate-700 rounded-lg px-2 py-1.5 text-xs w-28 placeholder:text-slate-500"
              placeholder="View name..."
              value={viewName}
              onChange={e => setViewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveView()}
            />
            <button
              onClick={saveView}
              disabled={!viewName.trim()}
              title="Save current filters as a named view"
              className="bg-slate-600 hover:bg-slate-500 disabled:opacity-40 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap"
            >
              Save View
            </button>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-600 hover:border-slate-400 whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Row 2: project, priority, due date, archived toggle */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Project */}
          <select
            className="bg-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 border border-slate-600 hover:border-slate-400"
            value={filters.project}
            onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}
          >
            <option value="all">All projects</option>
            <option value="none">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          {/* Priority chips */}
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 mr-0.5">Priority:</span>
            {PRIORITIES.map(p => (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={`px-2 py-0.5 rounded text-xs font-medium capitalize transition-all ${filters.priorities.includes(p) ? PRIORITY_CHIP[p].on : PRIORITY_CHIP[p].off}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Due date presets */}
          <div className="flex gap-1 items-center">
            <span className="text-xs text-slate-500 mr-0.5">Due:</span>
            {[['all', 'All'], ['today', 'Today'], ['this_week', 'This Week'], ['overdue', 'Overdue']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilters(f => ({ ...f, dueDate: val }))}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                  filters.dueDate === val
                    ? 'bg-blue-600 text-white'
                    : val === 'overdue'
                      ? 'bg-slate-600/60 hover:bg-slate-600 text-red-400'
                      : 'bg-slate-600/60 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Archived toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto" onClick={() => setFilters(f => ({ ...f, showArchived: !f.showArchived }))}>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${filters.showArchived ? 'bg-purple-600' : 'bg-slate-600'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${filters.showArchived ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-slate-400 select-none">Show archived</span>
          </label>
        </div>

        {/* Active filter tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1 pt-0.5 border-t border-slate-700/60">
            {filters.project !== 'all' && (
              <FilterTag
                label={filters.project === 'none' ? 'No project' : (projects.find(p => String(p.id) === String(filters.project))?.title ?? 'Project')}
                color="bg-blue-900/50 text-blue-300"
                onRemove={() => setFilters(f => ({ ...f, project: 'all' }))}
              />
            )}
            {filters.priorities.map(p => (
              <FilterTag key={p} label={p} color="bg-slate-700 text-slate-300" onRemove={() => togglePriority(p)} />
            ))}
            {filters.dueDate !== 'all' && (
              <FilterTag
                label={{ today: 'Due today', this_week: 'Due this week', overdue: 'Overdue' }[filters.dueDate]}
                color="bg-slate-700 text-slate-300"
                onRemove={() => setFilters(f => ({ ...f, dueDate: 'all' }))}
              />
            )}
            {filters.search && (
              <FilterTag label={`"${filters.search}"`} color="bg-slate-700 text-slate-300" onRemove={() => setFilters(f => ({ ...f, search: '' }))} />
            )}
            {filters.showArchived && (
              <FilterTag label="Archived" color="bg-purple-900/50 text-purple-300" onRemove={() => setFilters(f => ({ ...f, showArchived: false }))} />
            )}
          </div>
        )}

        {/* Saved views */}
        {Object.keys(savedViews).length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-slate-700/60 pt-2 items-center">
            <span className="text-xs text-slate-500 mr-1">Saved views:</span>
            {Object.keys(savedViews).map(name => (
              <div key={name} className="flex items-center bg-slate-700/50 rounded-full overflow-hidden border border-slate-600">
                <button onClick={() => setFilters(savedViews[name])} className="text-xs text-slate-300 hover:text-white px-2.5 py-0.5">{name}</button>
                <button onClick={() => deleteView(name)} className="text-xs text-slate-500 hover:text-red-400 pr-2 pl-0.5">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kanban board */}
      <div className={`grid gap-4 ${activeStatuses.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {activeStatuses.map(status => {
          const col = filteredTasks.filter(t => t.status === status);
          return (
            <div key={status} className={`border-t-2 ${STATUS_COLORS[status]} rounded-lg bg-slate-800/50 p-3 ${status === 'archived' ? 'opacity-70' : ''}`}>
              <h3 className="text-sm font-semibold mb-3 text-slate-300">{STATUS_LABELS_ALL[status]} ({col.length})</h3>
              <div className="space-y-2">
                {col.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    projects={projects}
                    onStatusChange={updateStatus}
                    onEdit={(t) => { setEditTask(t); setShowForm(true); }}
                    onDelete={async (id) => { await api.tasks.delete(id); load(); }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <TaskForm
          task={editTask}
          projects={projects}
          onClose={() => setShowForm(false)}
          onSave={load}
        />
      )}
    </div>
  );
}

function FilterTag({ label, color, onRemove }) {
  return (
    <span className={`${color} text-xs px-2 py-0.5 rounded-full flex items-center gap-1`}>
      {label}
      <button onClick={onRemove} className="opacity-60 hover:opacity-100 leading-none">✕</button>
    </span>
  );
}

function TaskCard({ task, projects, onStatusChange, onEdit, onDelete }) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const projectName = projects.find(p => p.id === task.project_id)?.title;
  const overdue = isOverdue(task.due_date) && task.status !== 'done' && task.status !== 'archived';

  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium flex-1">{task.title}</p>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(task)} className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/20" title="Edit">✏️</button>
          <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-900/20" title="Delete">🚮</button>
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmDelete
          title={task.title}
          onConfirm={() => { onDelete(task.id); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {projectName && (
        <span className="inline-block mt-1 text-xs bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded">{projectName}</span>
      )}
      {task.description && <p className="text-xs text-slate-400 mt-1">{task.description}</p>}
      {task.ticket_url && (
        <a href={task.ticket_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 block truncate" onClick={e => e.stopPropagation()}>
          🎫 {task.ticket_url.replace(/^https?:\/\//, '').slice(0, 40)}
        </a>
      )}
      <div className="flex items-center gap-2 mt-2">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className="text-xs bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-slate-300"
        >
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {task.priority && (
          <span className={`text-xs capitalize ${PRIORITY_CHIP[task.priority]?.off.split(' ')[1] ?? 'text-slate-500'}`}>{task.priority}</span>
        )}
      </div>
      {(task.start_date || task.due_date) && (
        <div className={`text-xs mt-1 ${overdue ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
          {overdue && <span className="mr-1">⚠</span>}
          {task.start_date && <span>{task.start_date.split('T')[0]}</span>}
          {task.start_date && task.due_date && <span> → </span>}
          {task.due_date && <span>{task.due_date.split('T')[0]}</span>}
        </div>
      )}
      <button onClick={() => navigate(`/subtasks?task=${task.id}`)} className="text-xs text-blue-400 mt-2 hover:underline">
        subtasks →
      </button>
    </div>
  );
}

function TaskForm({ task, projects, onClose, onSave }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    ticket_url: task?.ticket_url || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    start_date: task?.start_date?.split('T')[0] || '',
    due_date: task?.due_date?.split('T')[0] || '',
    project_id: task?.project_id || '',
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
    const data = { ...form, project_id: form.project_id || null, start_date: form.start_date || null, due_date: form.due_date || null };
    if (task) {
      await api.tasks.update(task.id, data);
    } else {
      await api.tasks.create(data);
    }
    onSave();
    onClose();
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto py-6 px-4">
      <div className="bg-slate-800 rounded-xl flex flex-col transition-all duration-200 resize overflow-auto" style={{ width: '768px', minWidth: '480px', maxWidth: '95vw', minHeight: '420px', maxHeight: '92vh' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h3 className="text-lg font-bold">{task ? 'Edit Task' : 'New Task'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className={`${leftCls} border-r border-slate-700 p-5 overflow-auto shrink-0 transition-all duration-200`}>
            <form id="task-form" onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title <span className="text-red-400">*</span></label>
                <input className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Deploy auth service" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
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
              <div>
                <label className="text-xs text-slate-400 block mb-1">Project</label>
                <select className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </form>
          </div>

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
                    <textarea
                      className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm"
                      placeholder="What did you do? What's remaining?"
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      rows={2}
                    />
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

        <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-700 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button type="submit" form="task-form" className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg text-sm">Save</button>
        </div>
      </div>
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
        <textarea className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm" value={text} onChange={e => setText(e.target.value)} rows={2} autoFocus />
        <div className="flex gap-2 items-center">
          <input type="number" step="0.5" min="0" className="w-20 bg-slate-700 rounded px-2 py-1 text-xs" placeholder="Hours" value={hours} onChange={e => setHours(e.target.value)} />
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
    <div onClick={() => setEditing(true)} className="bg-slate-700/50 hover:bg-slate-700 rounded-lg p-2.5 cursor-pointer" title="Click to edit">
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
        <h4 className="font-semibold text-red-400 mb-2">Delete Task</h4>
        <p className="text-sm text-slate-300 mb-4">Are you sure you want to delete "<span className="text-white">{title}</span>"? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white">No, Cancel</button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}
