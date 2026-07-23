const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  tasks: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/tasks${qs ? '?' + qs : ''}`);
    },
    get: (id) => request(`/tasks/${id}`),
    getSubtasks: (id) => request(`/tasks/${id}/subtasks`),
    create: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  },
  projects: {
    list: () => request('/projects'),
    get: (id) => request(`/projects/${id}`),
    getTasks: (id) => request(`/projects/${id}/tasks`),
    create: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  },
  activity: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/activity${qs ? '?' + qs : ''}`);
    },
    create: (data) => request('/activity', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/activity/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/activity/${id}`, { method: 'DELETE' }),
  },
  claude: {
    chat: (message) => request('/claude/chat', { method: 'POST', body: JSON.stringify({ message }) }),
    confirmDelete: (id) => request('/claude/confirm-delete', { method: 'POST', body: JSON.stringify({ id }) }),
    confirmDeleteBulk: (ids) => request('/claude/confirm-delete-bulk', { method: 'POST', body: JSON.stringify({ ids }) }),
    pendingDeletions: () => request('/claude/pending-deletions'),
    dismissPending: (id) => request(`/claude/pending-deletions/${id}`, { method: 'DELETE' }),
    executePlan: (actions) => request('/claude/execute-plan', { method: 'POST', body: JSON.stringify({ actions }) }),
    history: () => request('/claude/history'),
    clearHistory: () => request('/claude/history', { method: 'DELETE' }),
  },
  reminders: {
    list: () => request('/reminders'),
    create: (data) => request('/reminders', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/reminders/${id}`, { method: 'DELETE' }),
  },
  reports: {
    dashboard: () => request('/reports/dashboard'),
    weekly: () => request('/reports/weekly'),
    quarterly: (from, to) => request(`/reports/quarterly?from=${from}&to=${to}`),
  },
  journal: {
    get: (date) => request(`/journal?date=${date}`),
    list: () => request('/journal'),
    save: (date, content) => request('/journal', { method: 'POST', body: JSON.stringify({ date, content }) }),
  },
  backups: {
    list: () => request('/backups'),
    create: () => request('/backups', { method: 'POST' }),
    restore: (file) => request('/backups/restore', { method: 'POST', body: JSON.stringify({ file }) }),
    exportFile: () => request('/backups/export', { method: 'POST' }),
    importPick: () => request('/backups/import/pick', { method: 'POST' }),
    importConfirm: (filePath) => request('/backups/import/confirm', { method: 'POST', body: JSON.stringify({ filePath }) }),
  },
  settings: {
    get: () => request('/settings'),
    save: (awsProfile) => request('/settings', { method: 'PUT', body: JSON.stringify({ awsProfile }) }),
    test: () => request('/settings/test', { method: 'POST' }),
  },
};
