import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';

const STATUS_COLORS = {
  todo: 'bg-slate-500',
  in_progress: 'bg-yellow-400',
  done: 'bg-green-400',
  blocked: 'bg-red-400',
};
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked' };

const REPORT_TYPES = [
  { key: 'weekly', label: 'Weekly Summary', icon: '⊞' },
  { key: 'projects', label: 'Project Progress', icon: '◈' },
  { key: 'quarterly', label: 'Quarterly Review', icon: '◪' },
];

export default function Reports() {
  const [selected, setSelected] = useState('weekly');
  const [weekly, setWeekly] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [subtasksMap, setSubtasksMap] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [quarterly, setQuarterly] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  useEffect(() => {
    api.reports.weekly().then(setWeekly).catch(console.error);
    api.projects.list().then(setProjects).catch(console.error);
  }, []);

  const selectProject = async (p) => {
    setSelectedProject(p);
    setExpandedTasks({});
    setTaskNotes({});
    const t = await api.projects.getTasks(p.id);
    const parents = t.filter(task => !task.parent_id);
    const children = t.filter(task => task.parent_id);
    const subMap = {};
    children.forEach(st => {
      if (!subMap[st.parent_id]) subMap[st.parent_id] = [];
      subMap[st.parent_id].push(st);
    });
    setProjectTasks(parents);
    setSubtasksMap(subMap);
  };

  const toggleTask = async (taskId) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    if (!taskNotes[taskId]) {
      const notes = await api.activity.list({ task_id: taskId });
      setTaskNotes(prev => ({ ...prev, [taskId]: notes }));
    }
  };

  const generateQuarterly = async () => {
    if (!dateRange.from || !dateRange.to) return;
    setLoading(true);
    try {
      const report = await api.reports.quarterly(dateRange.from, dateRange.to);
      setQuarterly(report);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex gap-8 h-full">
      {/* Left panel */}
      <div className="w-64 shrink-0">
        <h2 className="text-2xl font-bold mb-4">Reports</h2>
        <div className="space-y-1">
          {REPORT_TYPES.map(r => (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${selected === r.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <span className="text-lg">{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>

        {selected === 'projects' && (
          <div className="mt-6">
            <h4 className="text-xs text-slate-400 font-semibold mb-2 uppercase">Projects</h4>
            <div className="space-y-1">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedProject?.id === p.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  <span className="block truncate">{p.title}</span>
                  <span className="text-xs text-slate-500">{p.progress}% complete</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-auto">
        {selected === 'weekly' && <WeeklyReport weekly={weekly} />}
        {selected === 'projects' && (
          <ProjectReport
            project={selectedProject}
            tasks={projectTasks}
            subtasksMap={subtasksMap}
            expandedTasks={expandedTasks}
            taskNotes={taskNotes}
            toggleTask={toggleTask}
          />
        )}
        {selected === 'quarterly' && (
          <QuarterlyReport
            dateRange={dateRange}
            setDateRange={setDateRange}
            quarterly={quarterly}
            loading={loading}
            onGenerate={generateQuarterly}
          />
        )}
      </div>
    </div>
  );
}

function WeeklyReport({ weekly }) {
  if (!weekly) return <p className="text-slate-400">Loading...</p>;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Weekly Summary</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-2xl font-bold text-green-400">{weekly.completed.length}</p>
          <p className="text-sm text-slate-400">Tasks Completed</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-2xl font-bold text-blue-400">{weekly.totalHours}h</p>
          <p className="text-sm text-slate-400">Hours Logged</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-2xl font-bold text-purple-400">{weekly.activities.length}</p>
          <p className="text-sm text-slate-400">Activities</p>
        </div>
      </div>

      <section>
        <h4 className="text-lg font-semibold mb-3">Completed This Week</h4>
        <div className="space-y-1">
          {weekly.completed.map((t, idx) => (
            <div key={t.id} className="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
              <span className="text-sm font-mono text-slate-400 w-6">{idx + 1}.</span>
              <span className="flex-1 text-sm line-through text-slate-400">{t.title}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-green-900/40 text-green-300">Done</span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
          ))}
          {weekly.completed.length === 0 && <p className="text-sm text-slate-500">No tasks completed this week</p>}
        </div>
      </section>

      <section>
        <h4 className="text-lg font-semibold mb-3">Activity Log</h4>
        <div className="space-y-1">
          {weekly.activities.slice(0, 20).map((a, idx) => (
            <div key={a.id} className="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
              <span className="text-sm font-mono text-slate-400 w-6">{idx + 1}.</span>
              <div className="flex-1">
                <p className="text-sm">{a.note}</p>
                <div className="flex gap-3 mt-1">
                  {a.task_title && <span className="text-xs text-slate-400">Task: {a.task_title}</span>}
                </div>
              </div>
              {a.hours_spent && <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">{a.hours_spent}h</span>}
              <span className="text-xs text-slate-500">{new Date(a.logged_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectReport({ project, tasks, subtasksMap, expandedTasks, taskNotes, toggleTask }) {
  if (!project) {
    return (
      <div className="text-center text-slate-500 mt-12">
        <p className="text-lg">Select a project from the left panel</p>
      </div>
    );
  }

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const todoCount = tasks.filter(t => t.status === 'todo').length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">{project.title}</h3>
        {project.description && <p className="text-sm text-slate-400 mt-1">{project.description}</p>}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-2xl font-bold">{project.totalTasks}</p>
          <p className="text-sm text-slate-400">Total Tasks</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-green-900">
          <p className="text-2xl font-bold text-green-400">{doneCount}</p>
          <p className="text-sm text-slate-400">Completed</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-yellow-900">
          <p className="text-2xl font-bold text-yellow-400">{inProgressCount}</p>
          <p className="text-sm text-slate-400">In Progress</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-2xl font-bold text-slate-300">{todoCount}</p>
          <p className="text-sm text-slate-400">To Do</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">Overall Progress</span>
          <span className="font-bold">{project.progress}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
        </div>
      </div>

      <section>
        <h4 className="text-lg font-semibold mb-3">Tasks</h4>
        <div className="space-y-1">
          {tasks.map((t, idx) => (
            <div key={t.id}>
              <div
                onClick={() => toggleTask(t.id)}
                className="bg-slate-800 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-slate-600 border border-transparent"
              >
                <span className="text-sm font-mono text-slate-400 w-6">{idx + 1}.</span>
                <span className={`flex-1 text-sm ${t.status === 'done' || t.status === 'archived' ? 'line-through text-slate-500' : ''}`}>{t.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeColor(t.status)}`}>{STATUS_LABELS[t.status]}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[t.status]}`} />
                {(subtasksMap[t.id] || taskNotes[t.id]?.length) && (
                  <span className="text-xs text-slate-500">{expandedTasks[t.id] ? '▼' : '▶'}</span>
                )}
              </div>

              {expandedTasks[t.id] && (
                <div className="ml-8 mt-1 mb-2 border-l-2 border-slate-700 pl-4 space-y-1">
                  {/* Subtasks */}
                  {subtasksMap[t.id] && subtasksMap[t.id].map((st, sIdx) => (
                    <div key={st.id} className="bg-slate-800/60 rounded-lg p-2.5 flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 w-8">{idx + 1}.{sIdx + 1}</span>
                      <span className={`flex-1 text-sm ${st.status === 'done' || st.status === 'archived' ? 'line-through text-slate-500' : ''}`}>{st.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeColor(st.status)}`}>{STATUS_LABELS[st.status]}</span>
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[st.status]}`} />
                    </div>
                  ))}

                  {/* Notes */}
                  {taskNotes[t.id] && taskNotes[t.id].length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Progress Notes</p>
                      {taskNotes[t.id].map(n => (
                        <div key={n.id} className="bg-slate-700/30 rounded-lg p-2.5">
                          <p className="text-xs">{n.note}</p>
                          <div className="flex gap-3 mt-1 text-xs text-slate-500">
                            <span>{new Date(n.logged_at).toLocaleDateString()} {new Date(n.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {n.hours_spent && <span className="text-blue-400">{n.hours_spent}h</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuarterlyReport({ dateRange, setDateRange, quarterly, loading, onGenerate }) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Quarterly Performance Review</h3>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-end gap-4">
        <div>
          <label className="text-sm text-slate-400 block mb-1">From</label>
          <input type="date" className="bg-slate-700 rounded px-3 py-2 text-sm" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} />
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">To</label>
          <input type="date" className="bg-slate-700 rounded px-3 py-2 text-sm" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} />
        </div>
        <button onClick={onGenerate} disabled={loading || !dateRange.from || !dateRange.to} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm">
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {quarterly && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-green-400">{quarterly.stats.tasksCompleted}</p>
              <p className="text-xs text-slate-400">Tasks Done</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-blue-400">{quarterly.stats.totalHours}h</p>
              <p className="text-xs text-slate-400">Hours</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-purple-400">{quarterly.stats.projectsCount}</p>
              <p className="text-xs text-slate-400">Projects</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
              <p className="text-2xl font-bold text-orange-400">{quarterly.stats.activitiesLogged}</p>
              <p className="text-xs text-slate-400">Activities</p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{quarterly.markdown}</ReactMarkdown>
          </div>
        </div>
      )}

      {!quarterly && !loading && (
        <div className="text-center text-slate-500 mt-12">
          <p>Select a date range and click Generate to create your performance review</p>
          <p className="text-xs mt-2">Claude will analyze your completed tasks, activity logs, and projects to generate a professional summary</p>
        </div>
      )}
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
