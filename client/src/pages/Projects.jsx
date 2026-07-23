import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const STATUS_COLORS = {
  todo: 'bg-slate-500',
  in_progress: 'bg-yellow-400',
  done: 'bg-green-400',
  blocked: 'bg-red-400',
};

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };

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

  const navigate = useNavigate();

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
    const t = await api.projects.getTasks(p.id);
    const parentTasks = t.filter(task => !task.parent_id);
    const childTasks = t.filter(task => task.parent_id);

    const subMap = {};
    childTasks.forEach(st => {
      if (!subMap[st.parent_id]) subMap[st.parent_id] = [];
      subMap[st.parent_id].push(st);
    });

    setTasks(parentTasks);
    setSubtasksMap(subMap);
  };

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
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
                <h3 className="font-medium flex-1">{p.title}</h3>
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
          <h3 className="text-xl font-bold mb-4">{selected.title}</h3>
          <div className="space-y-1">
            {tasks.map((t, idx) => (
              <div key={t.id}>
                <div
                  onClick={() => toggleTask(t.id)}
                  className="group bg-slate-800 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-750 border border-transparent hover:border-slate-600"
                >
                  <span className="text-sm font-mono text-slate-400 w-6">{idx + 1}.</span>
                  <span className={`flex-1 text-sm ${t.status === 'done' ? 'line-through text-slate-500' : ''}`}>{t.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openTask(t); }}
                    className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Open task in edit mode"
                  >✏️</button>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeColor(t.status)}`}>{STATUS_LABELS[t.status]}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[t.status]}`} />
                  {subtasksMap[t.id] && (
                    <span className="text-xs text-slate-500">{expandedTasks[t.id] ? '▼' : '▶'} {subtasksMap[t.id].length}</span>
                  )}
                </div>

                {expandedTasks[t.id] && subtasksMap[t.id] && (
                  <div className="ml-8 mt-1 mb-2 border-l-2 border-slate-700 pl-4 space-y-1">
                    {subtasksMap[t.id].map((st, sIdx) => (
                      <div key={st.id} className="group bg-slate-800/60 rounded-lg p-2.5 flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500 w-8">{idx + 1}.{sIdx + 1}</span>
                        <span className={`flex-1 text-sm ${st.status === 'done' ? 'line-through text-slate-500' : ''}`}>{st.title}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); openSubtask(st); }}
                          className="text-xs text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Open subtask in edit mode"
                        >✏️</button>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeColor(st.status)}`}>{STATUS_LABELS[st.status]}</span>
                        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[st.status]}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {tasks.length === 0 && <p className="text-sm text-slate-500">No tasks in this project</p>}
          </div>
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
