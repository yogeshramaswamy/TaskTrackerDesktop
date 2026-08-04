import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../lib/api';

// Default "by progress" order: active work first, completed last.
const STATUS_RANK = { in_progress: 0, blocked: 1, todo: 2, done: 3, archived: 4 };
function byProgress(a, b) {
  const ra = STATUS_RANK[a.status] ?? 5;
  const rb = STATUS_RANK[b.status] ?? 5;
  if (ra !== rb) return ra - rb;
  return (b.id) - (a.id); // newer first within a status, mirrors created_at DESC
}
// Custom order: honour saved sort_order (nulls last), then fall back to progress.
function byCustom(a, b) {
  const sa = a.sort_order == null ? Infinity : a.sort_order;
  const sb = b.sort_order == null ? Infinity : b.sort_order;
  if (sa !== sb) return sa - sb;
  return byProgress(a, b);
}

const STATUS_COLORS = {
  todo: 'bg-slate-500',
  in_progress: 'bg-yellow-400',
  done: 'bg-green-400',
  blocked: 'bg-red-400',
};

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };

const PRIORITY_BADGE = {
  urgent: 'bg-red-900/40 text-red-300',
  high: 'bg-orange-900/40 text-orange-300',
  medium: 'bg-yellow-900/40 text-yellow-300',
  low: 'bg-slate-700 text-slate-400',
};

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [selected, setSelected] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [subtasksMap, setSubtasksMap] = useState({});
  const [sortMode, setSortMode] = useState('progress'); // 'progress' | 'custom'

  const navigate = useNavigate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Per-project sort-mode preference, remembered across sessions.
  const readSortMode = (projectId) => {
    try {
      const map = JSON.parse(localStorage.getItem('project_sort_modes') || '{}');
      return map[projectId] || 'progress';
    } catch { return 'progress'; }
  };
  const persistSortMode = (projectId, mode) => {
    try {
      const map = JSON.parse(localStorage.getItem('project_sort_modes') || '{}');
      map[projectId] = mode;
      localStorage.setItem('project_sort_modes', JSON.stringify(map));
    } catch { /* ignore */ }
  };

  const load = () => api.projects.list().then(setProjects).catch(err => console.error('Projects load error:', err));
  useEffect(() => { load(); }, []);

  // Open a top-level task in the Task Board in edit mode (matches Reminders behavior)
  const openTask = (task) => navigate('/tasks', { state: { taskId: task.id } });

  // Open a subtask in the Subtasks page in edit mode
  const openSubtask = (subtask) => navigate('/subtasks', { state: { taskId: subtask.id, parentId: subtask.parent_id } });

  const confirmDelete = async () => {
    setDeleteError('');
    try {
      await api.projects.delete(deleteTarget.id);
      if (selected?.id === deleteTarget.id) { setSelected(null); setTasks([]); }
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  const selectProject = async (p) => {
    setSelected(p);
    setExpandedTasks({});
    setSubtasksMap({});
    const mode = readSortMode(p.id);
    setSortMode(mode);
    const t = await api.projects.getTasks(p.id);
    const parentTasks = t.filter(task => !task.parent_id);
    const childTasks = t.filter(task => task.parent_id);

    const cmp = mode === 'custom' ? byCustom : byProgress;
    const subMap = {};
    childTasks.forEach(st => {
      if (!subMap[st.parent_id]) subMap[st.parent_id] = [];
      subMap[st.parent_id].push(st);
    });
    Object.keys(subMap).forEach(pid => subMap[pid].sort(cmp));

    parentTasks.sort(cmp);
    setTasks(parentTasks);
    setSubtasksMap(subMap);
  };

  const changeSortMode = (mode) => {
    setSortMode(mode);
    if (selected) persistSortMode(selected.id, mode);
    const cmp = mode === 'custom' ? byCustom : byProgress;
    setTasks(prev => [...prev].sort(cmp));
    setSubtasksMap(prev => {
      const next = {};
      Object.keys(prev).forEach(pid => { next[pid] = [...prev[pid]].sort(cmp); });
      return next;
    });
  };

  // Fired when a drag completes: compute the new order, apply it locally, and
  // persist the arrangement to the server.
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex);
    setTasks(reordered);
    try {
      await api.tasks.reorder(reordered.map(t => t.id));
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  // Same as handleDragEnd, but for the subtasks under a given parent.
  const handleSubtaskDragEnd = async (parentId, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = subtasksMap[parentId] || [];
    const oldIndex = list.findIndex(t => t.id === active.id);
    const newIndex = list.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(list, oldIndex, newIndex);
    setSubtasksMap(prev => ({ ...prev, [parentId]: reordered }));
    try {
      await api.tasks.reorder(reordered.map(t => t.id));
    } catch (err) {
      console.error('Subtask reorder failed:', err);
    }
  };

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Inline edit of a single field (priority/status) from a row's badge. Updates
  // the DB, patches local state, and — in progress mode — re-sorts when status
  // changes so the row moves to its new group. isSubtask targets the sub map.
  const updateField = async (task, field, value, isSubtask) => {
    if (task[field] === value) return;
    try {
      await api.tasks.update(task.id, { [field]: value });
    } catch (err) {
      console.error('Update failed:', err);
      return;
    }
    if (isSubtask) {
      setSubtasksMap(prev => {
        const updated = prev[task.parent_id].map(st => st.id === task.id ? { ...st, [field]: value } : st);
        if (field === 'status' && sortMode === 'progress') updated.sort(byProgress);
        return { ...prev, [task.parent_id]: updated };
      });
    } else {
      setTasks(prev => {
        const next = prev.map(t => t.id === task.id ? { ...t, [field]: value } : t);
        if (field === 'status' && sortMode === 'progress') next.sort(byProgress);
        return next;
      });
      // Reflect the change in the project's progress bar in the sidebar.
      if (field === 'status') load();
    }
  };

  return (
    <div className="p-8 flex gap-8">
      <div className="w-80 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Projects</h2>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg text-sm">+ New</button>
        </div>
        <div className="space-y-2">
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => selectProject(p)}
              className={`group bg-slate-800 rounded-lg p-4 cursor-pointer border ${selected?.id === p.id ? 'border-blue-500' : 'border-transparent hover:border-slate-600'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className={`font-medium flex-1 ${p.synthetic ? 'text-slate-400 italic' : ''}`}>{p.title}</h3>
                {!p.synthetic && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditProject(p); }}
                      className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/20"
                      title="Edit project"
                    >✏️</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteError(''); setDeleteTarget(p); }}
                      className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-900/20"
                      title="Delete project"
                    >🚮</button>
                  </div>
                )}
              </div>
              {p.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{p.totalTasks} tasks</span>
                  <span>{p.progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
            </div>
          ))}
          {projects.length === 0 && <p className="text-sm text-slate-500">No projects yet. Create one or use Claude chat.</p>}
        </div>
      </div>

      {selected && (
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">{selected.title}</h3>
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => changeSortMode('progress')}
                className={`px-3 py-1 rounded-md text-xs ${sortMode === 'progress' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Auto-sort: active work first, done tasks last"
              >
                By progress
              </button>
              <button
                onClick={() => changeSortMode('custom')}
                className={`px-3 py-1 rounded-md text-xs ${sortMode === 'custom' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Drag tasks to arrange your own order"
              >
                Custom
              </button>
            </div>
          </div>
          {sortMode === 'custom' && tasks.length > 1 && (
            <p className="text-xs text-slate-500 mb-2">↕ Drag the handle to reorder. Your order is saved for this project.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {tasks.map((t, idx) => (
                  <SortableTaskRow
                    key={t.id}
                    task={t}
                    index={idx}
                    draggable={sortMode === 'custom'}
                    expanded={expandedTasks[t.id]}
                    subtasks={subtasksMap[t.id]}
                    onToggle={() => toggleTask(t.id)}
                    onOpen={() => openTask(t)}
                    onOpenSubtask={openSubtask}
                    onUpdateField={updateField}
                    sensors={sensors}
                    onSubtaskDragEnd={handleSubtaskDragEnd}
                  />
                ))}
                {tasks.length === 0 && <p className="text-sm text-slate-500">No tasks in this project</p>}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {showForm && <ProjectForm onClose={() => setShowForm(false)} onSave={() => { load(); setShowForm(false); }} />}

      {editProject && (
        <ProjectForm
          project={editProject}
          onClose={() => setEditProject(null)}
          onSave={() => {
            load();
            if (selected?.id === editProject.id) api.projects.get(editProject.id).then(setSelected).catch(() => {});
            setEditProject(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteProjectConfirm
          project={deleteTarget}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
    </div>
  );
}

function SortableTaskRow({ task, index, draggable, expanded, subtasks, onToggle, onOpen, onOpenSubtask, onUpdateField, sensors, onSubtaskDragEnd }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={onToggle}
        className={`group bg-slate-800 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-750 border ${isDragging ? 'border-blue-500' : 'border-transparent hover:border-slate-600'}`}
      >
        {draggable && (
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 select-none"
            title="Drag to reorder"
          >⠿</span>
        )}
        <span className="text-sm font-mono text-slate-400 w-6">{index + 1}.</span>
        <span className={`flex-1 text-sm ${task.status === 'done' || task.status === 'archived' ? 'line-through text-slate-500' : ''}`}>{task.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Open task in edit mode"
        >✏️</button>
        <BadgeSelect
          value={task.priority || 'medium'}
          options={PRIORITY_OPTIONS}
          className={`capitalize ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium}`}
          onChange={(v) => onUpdateField(task, 'priority', v, false)}
        />
        <BadgeSelect
          value={task.status}
          options={STATUS_OPTIONS}
          label={STATUS_LABELS[task.status]}
          className={statusBadgeColor(task.status)}
          onChange={(v) => onUpdateField(task, 'status', v, false)}
        />
        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[task.status]}`} />
        {subtasks && (
          <span className="text-xs text-slate-500">{expanded ? '▼' : '▶'} {subtasks.length}</span>
        )}
      </div>

      {expanded && subtasks && (
        <div className="ml-8 mt-1 mb-2 border-l-2 border-slate-700 pl-4 space-y-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onSubtaskDragEnd(task.id, e)}>
            <SortableContext items={subtasks.map(st => st.id)} strategy={verticalListSortingStrategy}>
              {subtasks.map((st, sIdx) => (
                <SortableSubtaskRow
                  key={st.id}
                  subtask={st}
                  label={`${index + 1}.${sIdx + 1}`}
                  draggable={draggable}
                  onOpen={() => onOpenSubtask(st)}
                  onUpdateField={onUpdateField}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function SortableSubtaskRow({ subtask: st, label, draggable, onOpen, onUpdateField }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: st.id,
    disabled: !draggable,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`group bg-slate-800/60 rounded-lg p-2.5 flex items-center gap-3 border ${isDragging ? 'border-blue-500' : 'border-transparent'}`}>
      {draggable && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 select-none text-xs"
          title="Drag to reorder"
        >⠿</span>
      )}
      <span className="text-xs font-mono text-slate-500 w-8">{label}</span>
      <span className={`flex-1 text-sm ${st.status === 'done' || st.status === 'archived' ? 'line-through text-slate-500' : ''}`}>{st.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Open subtask in edit mode"
      >✏️</button>
      <BadgeSelect
        value={st.priority || 'medium'}
        options={PRIORITY_OPTIONS}
        className={`capitalize ${PRIORITY_BADGE[st.priority] || PRIORITY_BADGE.medium}`}
        onChange={(v) => onUpdateField(st, 'priority', v, true)}
      />
      <BadgeSelect
        value={st.status}
        options={STATUS_OPTIONS}
        label={STATUS_LABELS[st.status]}
        className={statusBadgeColor(st.status)}
        onChange={(v) => onUpdateField(st, 'status', v, true)}
      />
      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[st.status]}`} />
    </div>
  );
}

// A pill badge that opens a small dropdown to change its value inline. Clicks
// are kept from bubbling so they don't toggle the row or start a drag.
function BadgeSelect({ value, options, label, className, onChange }) {
  const [open, setOpen] = useState(false);

  // Close when clicking anywhere outside this badge.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  return (
    <span className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs px-2 py-0.5 rounded ${className} hover:ring-1 hover:ring-slate-400 transition-shadow`}
        title="Click to change"
      >
        {label || value}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-slate-900 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[110px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setOpen(false); onChange(opt.value); }}
              className={`block w-full text-left text-xs px-3 py-1.5 hover:bg-slate-700 ${opt.value === value ? 'text-white font-medium' : 'text-slate-300'}`}
            >
              {opt.value === value ? '✓ ' : '  '}{opt.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function DeleteProjectConfirm({ project, error, onConfirm, onCancel }) {
  const blocked = project.totalTasks > 0;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-700" onClick={e => e.stopPropagation()}>
        <h4 className="font-semibold text-red-400 mb-2">Delete Project</h4>
        {blocked ? (
          <p className="text-sm text-slate-300 mb-4">
            "<span className="text-white">{project.title}</span>" has <span className="text-white font-medium">{project.totalTasks} task{project.totalTasks === 1 ? '' : 's'}</span> assigned to it. Reassign or delete those tasks first, then you can remove the project.
          </p>
        ) : (
          <p className="text-sm text-slate-300 mb-4">Delete "<span className="text-white">{project.title}</span>"? This cannot be undone.</p>
        )}
        {error && <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white">{blocked ? 'Close' : 'No, Cancel'}</button>
          {!blocked && <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">Yes, Delete</button>}
        </div>
      </div>
    </div>
  );
}

function statusBadgeColor(status) {
  const map = {
    todo: 'bg-slate-700 text-slate-300',
    in_progress: 'bg-yellow-900/40 text-yellow-300',
    done: 'bg-green-900/40 text-green-300',
    blocked: 'bg-red-900/40 text-red-300',
  };
  return map[status] || map.todo;
}

function ProjectForm({ project, onClose, onSave }) {
  const [title, setTitle] = useState(project?.title || '');
  const [description, setDescription] = useState(project?.description || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (project) {
      await api.projects.update(project.id, { title, description });
    } else {
      await api.projects.create({ title, description });
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-bold">{project ? 'Edit Project' : 'New Project'}</h3>
        <input className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="Project title" value={title} onChange={e => setTitle(e.target.value)} required />
        <textarea className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">{project ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
