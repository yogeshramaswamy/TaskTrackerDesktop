import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TaskBoard from './pages/TaskBoard';
import Subtasks from './pages/Subtasks';
import Projects from './pages/Projects';
import ClaudeChat from './pages/ClaudeChat';
import Reports from './pages/Reports';
import Journal from './pages/Journal';
import Reminders from './pages/Reminders';
import Settings from './pages/Settings';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { to: '/tasks', label: 'Tasks', icon: '☐' },
  { to: '/subtasks', label: 'Subtasks', icon: '☑' },
  { to: '/projects', label: 'Projects', icon: '◈' },
  { to: '/reminders', label: 'Reminders', icon: '🔔' },
  { to: '/chat', label: 'Claude', icon: '◉' },
  { to: '/reports', label: 'Reports', icon: '◪' },
  { to: '/journal', label: 'Journal', icon: '▤' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  return (
    <div className="flex h-screen">
      <nav className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold text-blue-400">TaskTracker Pro</h1>
        </div>
        <div className="flex-1 p-2 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
          Local only - your data stays here
        </div>
      </nav>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<TaskBoard />} />
          <Route path="/subtasks" element={<Subtasks />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/chat" element={<ClaudeChat />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
