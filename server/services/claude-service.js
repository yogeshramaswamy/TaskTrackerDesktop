const { getAiClient } = require('./ai-client');
const { run, all, get, backupDb } = require('../db/database');

const SYSTEM_PROMPT = `You are a personal task management assistant integrated into TaskTracker Pro. You help the user manage their work tasks, projects, and track progress.

AVAILABLE ACTIONS:
1. create_project: {action: "create_project", title: "...", description: "..."}
2. create_task: {action: "create_task", title: "...", description: "...", project_id: null|number, parent_id: null|number, priority: "low|medium|high|urgent", due_date: null|"YYYY-MM-DD", tags: [...]}
3. update_task: {action: "update_task", id: number, ...fields_to_update}
4. delete_task: {action: "delete_task", id: number}
5. log_activity: {action: "log_activity", task_id: number|null, note: "...", hours_spent: number|null}
6. create_reminder: {action: "create_reminder", task_id: null|number, message: "...", remind_at: "YYYY-MM-DDTHH:mm:ss", recurring: null|"daily"|"weekly"}
7. update_project: {action: "update_project", id: number, ...fields_to_update}

RESPONSE FORMAT:
Always respond with a JSON object:
{
  "message": "Your conversational response to the user",
  "actions": [...immediate actions that execute right away],
  "proposed_actions": [...creation actions shown to user for approval before executing]
}

CRITICAL RULES FOR proposed_actions vs actions:
- PUT IN proposed_actions (shown as preview, user must approve): create_task, create_project, update_task, update_project
- PUT IN actions (execute immediately, non-destructive only): log_activity, create_reminder, delete_task
- NEVER put a create_* or update_* action in "actions" — creating or changing tasks/projects always requires user approval, so use "proposed_actions" for those
- When proposing changes, describe clearly in "message" what you plan to do and why, then list it as a plan
- Note: the app enforces this server-side — any create_* or update_* you place in "actions" is moved to the approval plan automatically, so prefer proposed_actions directly

RULES:
- When creating subtasks, use parent_id to link them to a parent task
- When breaking down a project, first create the project, then tasks under it
- Be proactive: suggest task breakdowns, remind about deadlines, etc.
- For status updates, use: todo, in_progress, done, blocked
- For priorities, use: low, medium, high, urgent
- Keep responses concise and actionable
- When the user asks about progress, summarize from the context provided
- For delete_task: the user will be asked for confirmation before it executes`;

function getContext() {
  const projects = all('SELECT * FROM projects WHERE status = "active"');
  const tasks = all('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 50');
  const recentActivity = all('SELECT a.*, t.title as task_title FROM activity_log a LEFT JOIN tasks t ON a.task_id = t.id ORDER BY a.logged_at DESC LIMIT 20');

  return `
CURRENT STATE:
Projects: ${JSON.stringify(projects, null, 2)}

Tasks (recent 50): ${JSON.stringify(tasks, null, 2)}

Recent Activity: ${JSON.stringify(recentActivity, null, 2)}
`;
}

async function chat(userMessage) {
  const context = getContext();

  run('INSERT INTO claude_chat_history (role, content) VALUES (?, ?)', ['user', userMessage]);

  const { client, model } = getAiClient();
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT + '\n\n' + context,
    messages: [{ role: 'user', content: userMessage }],
  });

  const responseText = response.content[0].text;
  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = { message: responseText, actions: [] }; }
    } else {
      parsed = { message: responseText, actions: [] };
    }
  }

  // Security guardrail: the model's output is untrusted (task/project text is
  // fed into the prompt, so a malicious task description could try to inject
  // actions). Only non-destructive actions may auto-execute; any create_* or
  // update_* the model tried to run immediately is forced into the approval
  // plan instead, no matter what it claimed.
  const requested = Array.isArray(parsed.actions) ? parsed.actions : [];
  const proposed = Array.isArray(parsed.proposed_actions) ? parsed.proposed_actions : [];

  const autoRun = [];
  const forcedToApproval = [];
  for (const action of requested) {
    if (AUTO_EXECUTABLE.has(action && action.action)) {
      autoRun.push(action);
    } else {
      forcedToApproval.push(action);
    }
  }

  const executedActions = [];
  if (autoRun.length > 0) {
    backupDb();
  }
  for (const action of autoRun) {
    executedActions.push(executeAction(action));
  }

  // Validate every proposed action before it ever reaches the UI, so the
  // approve button can't be tricked into applying a malformed/unknown action.
  const proposedActions = [...proposed, ...forcedToApproval]
    .map(validateAction)
    .filter(Boolean);

  run('INSERT INTO claude_chat_history (role, content) VALUES (?, ?)', ['assistant', JSON.stringify(parsed)]);

  return {
    message: parsed.message,
    actions: executedActions,
    proposed_actions: proposedActions,
  };
}

// Actions safe to run without explicit user approval. delete_task only *stages*
// a pending deletion (it never deletes here), so it belongs in this set.
const AUTO_EXECUTABLE = new Set(['log_activity', 'create_reminder', 'delete_task']);

const VALID_STATUS = new Set(['todo', 'in_progress', 'done', 'blocked', 'archived']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'urgent']);
const VALID_PROJECT_STATUS = new Set(['active', 'archived', 'on_hold', 'completed']);
const VALID_RECURRING = new Set(['daily', 'weekly']);

// Coerce to a positive integer id, or null if not a usable id.
function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Normalize + whitelist an action's fields. Returns a sanitized action, or
// null if the action is unknown or missing what it needs. Applied to every
// action before it is executed or shown for approval.
function validateAction(action) {
  if (!action || typeof action.action !== 'string') return null;

  switch (action.action) {
    case 'create_project':
      if (!action.title) return null;
      return {
        action: 'create_project',
        title: String(action.title),
        description: action.description != null ? String(action.description) : null,
      };
    case 'update_project': {
      const id = toId(action.id);
      if (!id) return null;
      const out = { action: 'update_project', id };
      if (action.title != null) out.title = String(action.title);
      if (action.description != null) out.description = String(action.description);
      if (action.status != null && VALID_PROJECT_STATUS.has(action.status)) out.status = action.status;
      return out;
    }
    case 'create_task':
      if (!action.title) return null;
      return {
        action: 'create_task',
        title: String(action.title),
        description: action.description != null ? String(action.description) : null,
        project_id: toId(action.project_id),
        parent_id: toId(action.parent_id),
        status: VALID_STATUS.has(action.status) ? action.status : 'todo',
        priority: VALID_PRIORITY.has(action.priority) ? action.priority : 'medium',
        due_date: action.due_date != null ? String(action.due_date) : null,
        tags: Array.isArray(action.tags) ? action.tags.map(String) : [],
      };
    case 'update_task': {
      const id = toId(action.id);
      if (!id) return null;
      const out = { action: 'update_task', id };
      if (action.title != null) out.title = String(action.title);
      if (action.description != null) out.description = String(action.description);
      if (action.status != null && VALID_STATUS.has(action.status)) out.status = action.status;
      if (action.priority != null && VALID_PRIORITY.has(action.priority)) out.priority = action.priority;
      if (action.due_date != null) out.due_date = String(action.due_date);
      if (Array.isArray(action.tags)) out.tags = action.tags.map(String);
      return out;
    }
    case 'delete_task': {
      const id = toId(action.id);
      return id ? { action: 'delete_task', id } : null;
    }
    case 'log_activity':
      if (action.note == null) return null;
      return {
        action: 'log_activity',
        task_id: toId(action.task_id),
        note: String(action.note),
        hours_spent: action.hours_spent != null && !Number.isNaN(Number(action.hours_spent))
          ? Number(action.hours_spent) : null,
      };
    case 'create_reminder':
      if (action.message == null || action.remind_at == null) return null;
      return {
        action: 'create_reminder',
        task_id: toId(action.task_id),
        message: String(action.message),
        remind_at: String(action.remind_at),
        recurring: VALID_RECURRING.has(action.recurring) ? action.recurring : null,
      };
    default:
      return null;
  }
}

function executeAction(rawAction) {
  // Re-validate at the point of execution. This covers both the chat path and
  // the /execute-plan approval path (whose payload round-trips through the
  // client and must not be trusted blindly).
  const action = validateAction(rawAction);
  if (!action) {
    return { type: rawAction && rawAction.action, success: false, error: 'Invalid or unknown action' };
  }
  switch (action.action) {
    case 'create_project': {
      const result = run('INSERT INTO projects (title, description) VALUES (?, ?)', [action.title, action.description || null]);
      return { type: 'create_project', success: true, id: result.lastInsertRowid, title: action.title };
    }
    case 'create_task': {
      const result = run(`
        INSERT INTO tasks (project_id, parent_id, title, description, status, priority, due_date, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        action.project_id || null,
        action.parent_id || null,
        action.title,
        action.description || null,
        action.status || 'todo',
        action.priority || 'medium',
        action.due_date || null,
        JSON.stringify(action.tags || [])
      ]);
      return { type: 'create_task', success: true, id: result.lastInsertRowid, title: action.title };
    }
    case 'update_task': {
      const { id, action: _, ...fields } = action;
      const existing = get('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!existing) return { type: 'update_task', success: false, error: 'Task not found' };

      run(`UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, tags = ?, updated_at = datetime('now') WHERE id = ?`, [
        fields.title ?? existing.title,
        fields.description ?? existing.description,
        fields.status ?? existing.status,
        fields.priority ?? existing.priority,
        fields.due_date ?? existing.due_date,
        fields.tags ? JSON.stringify(fields.tags) : existing.tags,
        id
      ]);
      return { type: 'update_task', success: true, id, title: fields.title || existing.title };
    }
    case 'delete_task': {
      const taskToDelete = get('SELECT * FROM tasks WHERE id = ?', [action.id]);
      if (!taskToDelete) return { type: 'delete_task', success: false, error: 'Task not found' };
      const existing = get('SELECT * FROM pending_deletions WHERE task_id = ?', [action.id]);
      if (!existing) {
        run('INSERT INTO pending_deletions (task_id, task_title) VALUES (?, ?)', [action.id, taskToDelete.title]);
      }
      return { type: 'delete_task', success: false, pending_approval: true, id: action.id, title: taskToDelete.title };
    }
    case 'log_activity': {
      const result = run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [action.task_id || null, action.note, action.hours_spent || null]);
      return { type: 'log_activity', success: true, id: result.lastInsertRowid };
    }
    case 'create_reminder': {
      const result = run('INSERT INTO reminders (task_id, message, remind_at, recurring) VALUES (?, ?, ?, ?)', [action.task_id || null, action.message, action.remind_at, action.recurring || null]);
      const { scheduleReminder } = require('./reminder-service');
      const reminder = get('SELECT * FROM reminders WHERE id = ?', [result.lastInsertRowid]);
      scheduleReminder(reminder);
      return { type: 'create_reminder', success: true, id: result.lastInsertRowid, message: action.message };
    }
    case 'update_project': {
      const { id, action: _, ...fields } = action;
      const existing = get('SELECT * FROM projects WHERE id = ?', [id]);
      if (!existing) return { type: 'update_project', success: false, error: 'Project not found' };

      run("UPDATE projects SET title = ?, description = ?, status = ?, updated_at = datetime('now') WHERE id = ?", [
        fields.title ?? existing.title, fields.description ?? existing.description, fields.status ?? existing.status, id
      ]);
      return { type: 'update_project', success: true, id };
    }
    default:
      return { type: action.action, success: false, error: 'Unknown action' };
  }
}

function getChatHistory() {
  return all('SELECT * FROM claude_chat_history ORDER BY created_at DESC LIMIT 50').reverse();
}

module.exports = { chat, getChatHistory, executeAction };
