import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Journal() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    api.journal.get(date).then(entry => setContent(entry.content || '')).catch(console.error);
  }, [date]);

  useEffect(() => {
    api.journal.list().then(setEntries).catch(console.error);
  }, []);

  const save = async () => {
    await api.journal.save(date, content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    api.journal.list().then(setEntries);
  };

  return (
    <div className="p-8 flex gap-8">
      <div className="flex-1 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Daily Journal</h2>
          <input type="date" className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What did you work on today? Any blockers? What's the plan for tomorrow?"
          className="w-full h-96 bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm focus:outline-none focus:border-blue-500 resize-none"
        />

        <div className="flex items-center gap-3 mt-4">
          <button onClick={save} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">Save</button>
          {saved && <span className="text-green-400 text-sm">Saved!</span>}
        </div>
      </div>

      <div className="w-64">
        <h3 className="text-sm font-semibold text-slate-400 mb-3">Recent Entries</h3>
        <div className="space-y-1">
          {entries.map(e => (
            <button
              key={e.id}
              onClick={() => setDate(e.date)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${e.date === date ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-300'}`}
            >
              {e.date}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
