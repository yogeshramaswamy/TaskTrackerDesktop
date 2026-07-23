import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

export default function ClaudeChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api.claude.history().then(history => {
      const formatted = history.map(h => ({
        role: h.role,
        content: h.role === 'assistant' ? JSON.parse(h.content).message : h.content,
        actions: h.role === 'assistant' ? JSON.parse(h.content).actions : undefined,
      }));
      setMessages(formatted);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const result = await api.claude.chat(userMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.message,
        actions: result.actions,
        proposed_actions: result.proposed_actions || [],
        plan_status: result.proposed_actions?.length ? 'pending' : undefined,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, actions: [] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Claude Assistant</h2>
          <p className="text-xs text-slate-400 mt-1">Tell me what to do: create tasks, log activity, set reminders, generate reports...</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={async () => {
              if (!confirm('Clear all chat history? This cannot be undone.')) return;
              await api.claude.clearHistory();
              setMessages([]);
            }}
            className="text-xs text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-12">
            <p className="text-lg mb-4">Start a conversation</p>
            <div className="space-y-2 text-sm">
              <p className="text-slate-400">"I'm starting the API redesign project, break it into tasks"</p>
              <p className="text-slate-400">"Mark the auth task as done, I spent 3 hours"</p>
              <p className="text-slate-400">"What did I accomplish this week?"</p>
              <p className="text-slate-400">"Remind me to review PRs tomorrow at 10am"</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-800 border border-slate-700'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-600 space-y-1">
                  {msg.actions.map((a, j) => (
                    <ActionItem key={j} action={a} onDeleteConfirmed={(title) => {
                      setMessages(prev => prev.map((m, idx) => {
                        if (idx !== i) return m;
                        const updatedActions = m.actions.map((act, aidx) => aidx === j ? { ...act, pending_approval: false, success: true } : act);
                        return { ...m, actions: updatedActions };
                      }));
                    }} />
                  ))}
                </div>
              )}
              {msg.proposed_actions?.length > 0 && (
                <ProposedPlan
                  actions={msg.proposed_actions}
                  status={msg.plan_status}
                  onApprove={async () => {
                    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, plan_status: 'executing' } : m));
                    try {
                      await api.claude.executePlan(msg.proposed_actions);
                      setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, plan_status: 'done' } : m));
                    } catch (e) {
                      setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, plan_status: 'error' } : m));
                    }
                  }}
                  onCancel={() => {
                    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, plan_status: 'cancelled' } : m));
                  }}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
              <p className="text-sm text-slate-400 animate-pulse">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="p-4 border-t border-slate-700 flex gap-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          placeholder="Tell Claude what to do... (Shift+Enter for new line)"
          className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
          rows={2}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-xl text-sm font-medium self-end">
          Send
        </button>
      </form>
    </div>
  );
}

const ACTION_ICONS = {
  create_project: '📁',
  create_task: '✅',
  update_task: '✏️',
  update_project: '✏️',
  log_activity: '📝',
  create_reminder: '🔔',
  delete_task: '🗑',
};

const PRIORITY_COLORS = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
};

function ProposedPlan({ actions, status, onApprove, onCancel }) {
  if (status === 'cancelled') {
    return (
      <div className="mt-3 pt-3 border-t border-slate-600">
        <p className="text-xs text-slate-500 italic">Plan cancelled — nothing was created.</p>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="mt-3 pt-3 border-t border-slate-600">
        <p className="text-xs text-green-400">✓ All {actions.length} item{actions.length > 1 ? 's' : ''} created successfully.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mt-3 pt-3 border-t border-slate-600">
        <p className="text-xs text-red-400">✗ Something went wrong while creating. Check the task board.</p>
      </div>
    );
  }

  if (status === 'executing') {
    return (
      <div className="mt-3 pt-3 border-t border-slate-600">
        <p className="text-xs text-blue-400 animate-pulse">Creating {actions.length} item{actions.length > 1 ? 's' : ''}...</p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-600">
      <p className="text-xs text-slate-400 font-semibold mb-2">📋 Plan — {actions.length} item{actions.length > 1 ? 's' : ''} to create:</p>
      <div className="space-y-1.5 mb-3">
        {actions.map((a, i) => (
          <div key={i} className="flex items-start gap-2 bg-slate-700/50 rounded-lg px-2.5 py-2">
            <span className="text-sm shrink-0">{ACTION_ICONS[a.action] || '•'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white leading-tight">{a.title}</p>
              {a.description && <p className="text-xs text-slate-400 mt-0.5 leading-tight truncate">{a.description}</p>}
              <div className="flex gap-2 mt-0.5">
                {a.priority && <span className={`text-xs ${PRIORITY_COLORS[a.priority] || 'text-slate-400'}`}>{a.priority}</span>}
                {a.parent_id && <span className="text-xs text-slate-500">subtask</span>}
                {a.action === 'create_project' && <span className="text-xs text-blue-400">project</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
        >
          ✓ Create All
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-xs px-3 py-1.5 rounded-lg"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}

function ActionItem({ action, onDeleteConfirmed }) {
  const [status, setStatus] = useState(action.pending_approval ? 'pending' : (action.success ? 'done' : 'failed'));

  if (action.pending_approval && status === 'pending') {
    return (
      <div className="text-xs px-2 py-2 rounded bg-orange-900/30 text-orange-300 space-y-2">
        <p>⚠️ Delete task: "<strong>{action.title}</strong>" (ID: {action.id})</p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await api.claude.confirmDelete(action.id);
                setStatus('done');
                onDeleteConfirmed(action.title);
              } catch (e) {
                setStatus('failed');
              }
            }}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white"
          >
            Yes, Delete
          </button>
          <button
            onClick={() => setStatus('rejected')}
            className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded"
          >
            No, Keep it
          </button>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-400">
        ↩ Delete cancelled: {action.title}
      </div>
    );
  }

  if (status === 'done' && action.type === 'delete_task') {
    return (
      <div className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-300">
        ✓ Deleted: {action.title}
      </div>
    );
  }

  return (
    <div className={`text-xs px-2 py-1 rounded ${action.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
      {action.success ? '✓' : '✗'} {action.type}: {action.title || action.message || action.id || 'done'}
    </div>
  );
}
