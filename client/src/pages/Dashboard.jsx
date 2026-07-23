import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('tasks');
  const [filter, setFilter] = useState(null);
  const [popup, setPopup] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.reports.dashboard(),
      api.tasks.list({ include_archived: 'true' }),
    ]).then(([dashData, tasks]) => {
      setData(dashData);
      setAllTasks(tasks);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (!data) return <div className="p-8 text-red-400">Failed to load dashboard</div>;

  const { todayTasks, todayActivity, overdue, stats } = data;

  const getFilteredTasks = () => {
    if (filter === 'total') return allTasks.filter(t => !t.parent_id && t.status !== 'archived');
    if (filter === 'subtasks') return allTasks.filter(t => t.parent_id && t.status !== 'archived');
    if (filter === 'in_progress') return allTasks.filter(t => t.status === 'in_progress');
    if (filter === 'todo') return allTasks.filter(t => t.status === 'todo');
    if (filter === 'done') return allTasks.filter(t => t.status === 'done');
    if (filter === 'archived') return allTasks.filter(t => t.status === 'archived');
    return null;
  };

  const filteredByCard = getFilteredTasks();

  const activeTasks = viewMode === 'tasks'
    ? todayTasks.filter(t => !t.parent_id)
    : todayTasks;

  const handleTaskClick = (task) => {
    setPopup(task);
  };

  const goToTask = () => {
    navigate('/tasks');
    setPopup(null);
  };

  const goToSubtasks = () => {
    const taskId = popup.parent_id || popup.id;
    navigate(`/subtasks?task=${taskId}`);
    setPopup(null);
  };

  const handleCardClick = (key) => {
    setFilter(filter === key ? null : key);
  };

  return (
    <div className="p-8 max-w-6xl">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-6 gap-3 mb-8">
        <StatCard label="Total Tasks" value={stats.total} color="blue" active={filter === 'total'} onClick={() => handleCardClick('total')} />
        <StatCard label="Subtasks" value={stats.subtasks} color="purple" active={filter === 'subtasks'} onClick={() => handleCardClick('subtasks')} />
        <StatCard label="In Progress" value={stats.inProgress} color="yellow" active={filter === 'in_progress'} onClick={() => handleCardClick('in_progress')} />
        <StatCard label="To Do" value={stats.todo} color="slate" active={filter === 'todo'} onClick={() => handleCardClick('todo')} />
        <StatCard label="Completed" value={stats.done} color="green" active={filter === 'done'} onClick={() => handleCardClick('done')} />
        <StatCard label="Archived" value={stats.archived} color="gray" active={filter === 'archived'} onClick={() => handleCardClick('archived')} />
      </div>

      {filteredByCard && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">
              {filter === 'total' && 'All Tasks'}
              {filter === 'subtasks' && 'All Subtasks'}
              {filter === 'in_progress' && 'In Progress'}
              {filter === 'todo' && 'To Do'}
              {filter === 'done' && 'Completed'}
              {filter === 'archived' && 'Archived'}
              {' '}({filteredByCard.length})
            </h3>
            <button onClick={() => setFilter(null)} className="text-sm text-white px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700">← Back to Dashboard</button>
          </div>
          <div className="space-y-2 max-h-96 overflow-auto">
            {filteredByCard.map(t => (
              <div
                key={t.id}
                onClick={() => handleTaskClick(t)}
                className="bg-slate-800 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-slate-600 border border-transparent"
              >
                <span className={`w-2 h-2 rounded-full ${statusDot(t.status)}`} />
                <span className="flex-1 text-sm">
                  {t.parent_id && <span className="text-slate-500 mr-1">↳</span>}
                  <span className="text-slate-500 font-mono mr-1.5">#{t.id}</span>
                  <span className={t.status === 'archived' ? 'text-slate-500' : ''}>{t.title}</span>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${priorityColor(t.priority)}`}>{t.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(t.status)}`}>{statusLabel(t.status)}</span>
              </div>
            ))}
            {filteredByCard.length === 0 && <p className="text-sm text-slate-500">No tasks</p>}
          </div>
        </section>
      )}

      {!filteredByCard && overdue.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Overdue ({overdue.length})</h3>
          <div className="space-y-2">
            {overdue.map(t => (
              <div key={t.id} onClick={() => handleTaskClick(t)} className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex justify-between cursor-pointer hover:border-red-600">
                <span><span className="text-slate-500 font-mono mr-1.5">#{t.id}</span>{t.title}</span>
                <span className="text-red-400 text-sm">{t.due_date?.split('T')[0]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!filteredByCard && (
        <div className="grid grid-cols-2 gap-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Active Tasks ({activeTasks.length})</h3>
              <div className="flex bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('tasks')}
                  className={`px-3 py-1 rounded-md text-xs ${viewMode === 'tasks' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Tasks Only
                </button>
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1 rounded-md text-xs ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  All
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {activeTasks.slice(0, 15).map(t => (
                <div
                  key={t.id}
                  onClick={() => handleTaskClick(t)}
                  className="bg-slate-800 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-slate-600 border border-transparent"
                >
                  <span className={`w-2 h-2 rounded-full ${t.status === 'in_progress' ? 'bg-yellow-400' : 'bg-slate-500'}`} />
                  <span className="flex-1 text-sm">
                    {t.parent_id && <span className="text-slate-500 mr-1">↳</span>}
                    <span className="text-slate-500 font-mono mr-1.5">#{t.id}</span>
                    {t.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${priorityColor(t.priority)}`}>{t.priority}</span>
                </div>
              ))}
              {activeTasks.length === 0 && <p className="text-slate-500 text-sm">No active tasks</p>}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Today's Activity</h3>
            <div className="space-y-2">
              {todayActivity.slice(0, 10).map(a => (
                <div key={a.id} className="bg-slate-800 rounded-lg p-3">
                  <p className="text-sm">{a.note}</p>
                  {a.task_title && <p className="text-xs text-slate-400 mt-1">on: {a.task_title}</p>}
                  {a.hours_spent && <p className="text-xs text-blue-400 mt-1">{a.hours_spent}h logged</p>}
                </div>
              ))}
              {todayActivity.length === 0 && <p className="text-slate-500 text-sm">No activity logged today</p>}
            </div>
          </section>
        </div>
      )}

      {popup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPopup(null)}>
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-700" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold mb-1">{popup.title}</h4>
            <p className="text-xs text-slate-400 mb-4">Where do you want to go?</p>
            <div className="space-y-2">
              <button onClick={goToTask} className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2.5 text-sm text-left flex items-center gap-3">
                <span className="text-lg">☐</span>
                <div>
                  <p className="font-medium">Task Board</p>
                  <p className="text-xs text-blue-200">View in Kanban board</p>
                </div>
              </button>
              <button onClick={goToSubtasks} className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-2.5 text-sm text-left flex items-center gap-3">
                <span className="text-lg">☑</span>
                <div>
                  <p className="font-medium">Subtasks</p>
                  <p className="text-xs text-slate-300">View/manage subtasks for this task</p>
                </div>
              </button>
              <button onClick={() => setPopup(null)} className="w-full text-center text-sm text-slate-400 hover:text-white py-2">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, active, onClick }) {
  const colors = {
    blue: 'bg-blue-900/30 border-blue-700',
    purple: 'bg-purple-900/30 border-purple-700',
    green: 'bg-green-900/30 border-green-700',
    yellow: 'bg-yellow-900/30 border-yellow-700',
    slate: 'bg-slate-800 border-slate-600',
    gray: 'bg-slate-800/50 border-slate-600',
  };
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-4 cursor-pointer transition-all ${colors[color]} ${active ? 'ring-2 ring-white/50 scale-105' : 'hover:scale-102 hover:brightness-110'}`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

function priorityColor(p) {
  const map = { urgent: 'bg-red-700 text-red-100', high: 'bg-orange-700 text-orange-100', medium: 'bg-blue-700 text-blue-100', low: 'bg-slate-600 text-slate-200' };
  return map[p] || map.medium;
}

function statusDot(s) {
  const map = { todo: 'bg-slate-500', in_progress: 'bg-yellow-400', done: 'bg-green-400', blocked: 'bg-red-400', archived: 'bg-slate-600' };
  return map[s] || map.todo;
}

function statusBadge(s) {
  const map = { todo: 'bg-slate-700 text-slate-300', in_progress: 'bg-yellow-900/40 text-yellow-300', done: 'bg-green-900/40 text-green-300', blocked: 'bg-red-900/40 text-red-300', archived: 'bg-slate-700 text-slate-400' };
  return map[s] || map.todo;
}

function statusLabel(s) {
  const map = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', blocked: 'Blocked', archived: 'Archived' };
  return map[s] || s;
}
