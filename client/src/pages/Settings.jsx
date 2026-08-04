import { useState, useEffect } from 'react';
import { api } from '../lib/api';

// Collapsible accordion section. Body only mounts when open. Defined at module
// scope (not inside Settings) so its identity is stable across renders —
// otherwise inputs inside it would lose focus on every keystroke.
function Section({ open, onToggle, title, titleClass = '', badge, children }) {
  return (
    <section className="mb-3 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/40 text-left"
      >
        <span className="flex items-center gap-2">
          <h3 className={`text-lg font-semibold ${titleClass}`}>{title}</h3>
          {badge}
        </span>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export default function Settings() {
  const [backups, setBackups] = useState([]);
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');

  // Tag library
  const [tags, setTags] = useState([]);
  const [tagForm, setTagForm] = useState({ name: '', description: '' });
  const [editingTagId, setEditingTagId] = useState(null);
  const [tagError, setTagError] = useState('');

  // Import (restore from a file chosen by the user)
  const [importCandidate, setImportCandidate] = useState(null); // { filePath, summary }
  const [importBusy, setImportBusy] = useState(false);

  // Which accordion section is expanded (only one at a time).
  const [openSection, setOpenSection] = useState('ai');
  const toggleSection = (key) => setOpenSection(prev => (prev === key ? null : key));

  // AWS profile settings
  const [awsProfile, setAwsProfile] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-west-2');
  const [awsSource, setAwsSource] = useState('none');
  const [awsSaving, setAwsSaving] = useState(false);
  const [awsTesting, setAwsTesting] = useState(false);
  const [awsStatus, setAwsStatus] = useState(null); // { ok, text }

  const load = () => {
    api.backups.list().then(setBackups).catch(console.error);
    api.claude.pendingDeletions().then(setPending).catch(console.error);
    api.tags.list().then(setTags).catch(console.error);
    api.settings.get().then(s => {
      setAwsProfile(s.awsProfile || '');
      setAwsRegion(s.awsRegion || 'us-west-2');
      setAwsSource(s.source || 'none');
    }).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const saveAws = async () => {
    setAwsSaving(true);
    setAwsStatus(null);
    try {
      await api.settings.save(awsProfile);
      setAwsSource(awsProfile.trim() ? 'settings' : 'none');
      setAwsStatus({ ok: true, text: 'Saved. Use "Test connection" to verify it works.' });
    } catch (err) {
      setAwsStatus({ ok: false, text: err.message });
    } finally {
      setAwsSaving(false);
    }
  };

  const testAws = async () => {
    setAwsTesting(true);
    setAwsStatus(null);
    try {
      await api.settings.save(awsProfile); // save first so we test what's shown
      const res = await api.settings.test();
      setAwsStatus({ ok: true, text: res.message || 'Connected successfully.' });
    } catch (err) {
      setAwsStatus({ ok: false, text: err.message });
    } finally {
      setAwsTesting(false);
    }
  };

  const createBackup = async () => {
    await api.backups.create();
    setMessage('Backup created successfully');
    load();
    setTimeout(() => setMessage(''), 3000);
  };

  // Export: native Save dialog writes the current DB wherever the user picks.
  const exportFile = async () => {
    setMessage('');
    try {
      const res = await api.backups.exportFile();
      if (res.canceled) return;
      setMessage(`Exported to: ${res.path}`);
      setTimeout(() => setMessage(''), 8000);
    } catch (err) {
      setMessage('Export failed: ' + err.message);
    }
  };

  // Open native file picker + validate. On success, show the confirm dialog.
  const pickImportFile = async () => {
    setMessage('');
    try {
      const res = await api.backups.importPick();
      if (res.canceled) return;
      setImportCandidate({ filePath: res.filePath, summary: res.summary });
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  // User confirmed in the dialog — do the actual replace.
  const confirmImport = async () => {
    if (!importCandidate) return;
    setImportBusy(true);
    try {
      const res = await api.backups.importConfirm(importCandidate.filePath);
      const s = res.summary || {};
      setImportCandidate(null);
      setMessage(`Imported successfully — ${s.projects ?? 0} projects, ${s.tasks ?? 0} tasks. A backup of your previous data was saved.`);
      load();
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      setMessage('Import failed: ' + err.message);
      setImportCandidate(null);
    } finally {
      setImportBusy(false);
    }
  };

  const restore = async (file) => {
    if (!confirm(`Restore database from "${file}"?\n\nThis will replace all current data. You'll need to restart the server after.`)) return;
    try {
      await api.backups.restore(file);
      setMessage('Database restored! Restart the server (Ctrl+C → npm start) to apply.');
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const toggleSelect = (taskId) => {
    setSelected(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const selectAll = () => {
    if (selected.length === pending.length) {
      setSelected([]);
    } else {
      setSelected(pending.map(p => p.task_id));
    }
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} task(s)? This cannot be undone.`)) return;
    await api.claude.confirmDeleteBulk(selected);
    setSelected([]);
    setMessage(`${selected.length} task(s) deleted`);
    load();
    setTimeout(() => setMessage(''), 3000);
  };

  const dismissPending = async (id) => {
    await api.claude.dismissPending(id);
    load();
  };

  const resetTagForm = () => { setTagForm({ name: '', description: '' }); setEditingTagId(null); setTagError(''); };

  const saveTag = async () => {
    const name = tagForm.name.trim();
    if (!name) { setTagError('Tag name is required'); return; }
    setTagError('');
    try {
      if (editingTagId) {
        await api.tags.update(editingTagId, { name, description: tagForm.description.trim() });
      } else {
        await api.tags.create({ name, description: tagForm.description.trim() });
      }
      resetTagForm();
      api.tags.list().then(setTags).catch(console.error);
    } catch (err) {
      setTagError(err.message);
    }
  };

  const editTag = (t) => { setEditingTagId(t.id); setTagForm({ name: t.name, description: t.description || '' }); setTagError(''); };

  const deleteTag = async (t) => {
    if (!confirm(`Delete tag "${t.name}"?\n\nThis removes it from the library only — tags already on tasks stay put.`)) return;
    await api.tags.delete(t.id);
    if (editingTagId === t.id) resetTagForm();
    api.tags.list().then(setTags).catch(console.error);
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">Settings & Backups</h2>

      {message && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-6 text-sm text-green-300">
          {message}
        </div>
      )}

      <Section open={openSection === 'ai'} onToggle={() => toggleSection('ai')} title="AI Access (AWS Bedrock)">
        <p className="text-xs text-slate-400 mb-4">
          Claude features use your local AWS Bedrock access. Enter your AWS profile name
          (the one from <span className="font-mono">~/.aws/config</span> that has Bedrock access).
          Region is fixed to <span className="font-mono">{awsRegion}</span>.
          {awsSource === 'env' && <span className="text-slate-500"> Currently using the profile from .env until you set one here.</span>}
        </p>
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">AWS Profile Name</label>
            <input
              type="text"
              value={awsProfile}
              onChange={e => setAwsProfile(e.target.value)}
              placeholder="e.g. aiaccess"
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">AWS Region</label>
            <input
              type="text"
              value={awsRegion}
              disabled
              className="w-full bg-slate-900/60 text-slate-500 rounded-lg px-3 py-2 text-sm font-mono cursor-not-allowed"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveAws}
              disabled={awsSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
            >{awsSaving ? 'Saving...' : 'Save'}</button>
            <button
              onClick={testAws}
              disabled={awsTesting || !awsProfile.trim()}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
            >{awsTesting ? 'Testing...' : 'Test connection'}</button>
          </div>
          {awsStatus && (
            <p className={`text-xs rounded-lg px-3 py-2 ${awsStatus.ok ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
              {awsStatus.text}
            </p>
          )}
        </div>
      </Section>

      {pending.length > 0 && (
        <Section
          open={openSection === 'pending'}
          onToggle={() => toggleSection('pending')}
          title="Pending Deletions"
          titleClass="text-orange-400"
          badge={<span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full">{pending.length}</span>}
        >
          <div className="flex items-center justify-end mb-3">
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">
                {selected.length === pending.length ? 'Deselect All' : 'Select All'}
              </button>
              {selected.length > 0 && (
                <button onClick={deleteSelected} className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg">
                  Delete Selected ({selected.length})
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Claude requested these deletions. Select and confirm, or dismiss to keep the tasks.
          </p>
          <div className="space-y-2">
            {pending.map(p => (
              <div key={p.id} className="bg-slate-800 rounded-lg p-3 flex items-center gap-3 border border-slate-700">
                <input
                  type="checkbox"
                  checked={selected.includes(p.task_id)}
                  onChange={() => toggleSelect(p.task_id)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <p className="text-sm">{p.task_title}</p>
                  <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                    {p.status && <span>Status: {p.status}</span>}
                    {p.priority && <span>Priority: {p.priority}</span>}
                    <span>Requested: {new Date(p.requested_at).toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={() => dismissPending(p.id)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700">Dismiss</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        open={openSection === 'tags'}
        onToggle={() => toggleSection('tags')}
        title="Tag Library"
        badge={tags.length > 0 && <span className="text-xs bg-slate-600 text-slate-200 px-2 py-0.5 rounded-full">{tags.length}</span>}
      >
        <p className="text-xs text-slate-400 mb-4">
          Define reusable tags with a short description. When you add tags to a task or subtask,
          these show up as autocomplete suggestions (press <span className="font-mono">Tab</span> to complete),
          and the description appears on hover.
        </p>
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={tagForm.name}
              onChange={e => setTagForm({ ...tagForm, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveTag(); } }}
              placeholder="Tag name (e.g. urgent)"
              className="sm:w-48 bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={tagForm.description}
              onChange={e => setTagForm({ ...tagForm, description: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveTag(); } }}
              placeholder="Description (optional)"
              className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={saveTag} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm whitespace-nowrap">
              {editingTagId ? 'Save' : 'Add Tag'}
            </button>
            {editingTagId && (
              <button onClick={resetTagForm} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
            )}
          </div>
          {tagError && <p className="text-xs text-red-400 mb-3">{tagError}</p>}

          {tags.length === 0 ? (
            <p className="text-sm text-slate-500">No tags defined yet. Add one above.</p>
          ) : (
            <div className="space-y-1.5">
              {tags.map(t => (
                <div key={t.id} className="flex items-center gap-3 bg-slate-900/40 rounded-lg px-3 py-2">
                  <span className="text-sm text-slate-200 font-medium whitespace-nowrap">#{t.name}</span>
                  <span className="flex-1 text-xs text-slate-400 truncate">{t.description || <span className="italic text-slate-600">no description</span>}</span>
                  <button onClick={() => editTag(t)} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700">Edit</button>
                  <button onClick={() => deleteTag(t)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-slate-700">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section open={openSection === 'move'} onToggle={() => toggleSection('move')} title="Backup & Move Data">
        <div className="flex items-center justify-end mb-3">
          <div className="flex gap-2">
            <button onClick={exportFile} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm">Export…</button>
            <button onClick={pickImportFile} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">Import…</button>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          <strong className="text-slate-300">Export</strong> saves a copy of all your data to a file you choose
          (e.g. OneDrive or a USB drive) — great for backups or moving to a new computer.{' '}
          <strong className="text-slate-300">Import</strong> loads a TaskTracker database file
          (<span className="font-mono">tasks.db</span>); it's validated first, and your current data is backed up
          automatically before it's replaced.
        </p>
      </Section>

      <Section open={openSection === 'backups'} onToggle={() => toggleSection('backups')} title="Database Backups">
        <div className="flex items-center justify-end mb-3">
          <button onClick={createBackup} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">Create Backup Now</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Backups are automatically created before every Claude AI action. You can also create manual backups. Last 20 are kept.
        </p>

        <div className="space-y-2">
          {backups.length === 0 && <p className="text-sm text-slate-500">No backups yet. They'll be created automatically when you use Claude chat.</p>}
          {backups.map((b, idx) => (
            <div key={b} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between border border-slate-700">
              <div>
                <p className="text-sm font-mono">{b}</p>
                {idx === 0 && <span className="text-xs text-green-400">Latest</span>}
              </div>
              <button onClick={() => restore(b)} className="text-xs bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-lg">Restore</button>
            </div>
          ))}
        </div>
      </Section>

      <Section open={openSection === 'how'} onToggle={() => toggleSection('how')} title="How It Works">
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700 text-sm text-slate-300 space-y-2">
          <p>- A backup is automatically saved <strong>before every Claude AI action</strong></p>
          <p>- When Claude suggests deleting a task, it goes to <strong>Pending Deletions</strong> above</p>
          <p>- You can approve (select + delete) or dismiss (keep the task)</p>
          <p>- Last 20 backups are kept, older ones are auto-removed</p>
          <p>- To restore: click "Restore" on any backup, then restart the server</p>
        </div>
      </Section>

      {importCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !importBusy && setImportCandidate(null)}>
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold text-lg mb-2">File looks good ✓</h4>
            <p className="text-sm text-slate-300 mb-3">
              This TaskTracker database contains:
            </p>
            <div className="bg-slate-900/60 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Projects</span><span className="font-medium">{importCandidate.summary?.projects ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Tasks</span><span className="font-medium">{importCandidate.summary?.tasks ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Journal entries</span><span className="font-medium">{importCandidate.summary?.journalEntries ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Reminders</span><span className="font-medium">{importCandidate.summary?.reminders ?? 0}</span></div>
            </div>
            <p className="text-xs text-orange-300 bg-orange-900/20 border border-orange-800/50 rounded-lg px-3 py-2 mb-4">
              ⚠️ Do you want to import it? This replaces <strong>all</strong> current data with the fresh data
              from this file — anything currently in the app will be gone. (A backup of your current data is
              saved first, just in case.)
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setImportCandidate(null)} disabled={importBusy} className="px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50">Cancel</button>
              <button onClick={confirmImport} disabled={importBusy} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm">
                {importBusy ? 'Importing…' : 'Yes, Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
