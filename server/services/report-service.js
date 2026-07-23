const { getAiClient } = require('./ai-client');
const { all, get } = require('../db/database');

async function generateReport(from, to) {
  const completedTasks = all(`
    SELECT t.*, p.title as project_title
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.status = 'done' AND t.updated_at BETWEEN ? AND ?
    ORDER BY t.updated_at DESC
  `, [from, to]);

  const activities = all(`
    SELECT a.*, t.title as task_title, p.title as project_title
    FROM activity_log a
    LEFT JOIN tasks t ON a.task_id = t.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE a.logged_at BETWEEN ? AND ?
    ORDER BY a.logged_at DESC
  `, [from, to]);

  const totalHours = (get('SELECT COALESCE(SUM(hours_spent), 0) as total FROM activity_log WHERE logged_at BETWEEN ? AND ?', [from, to]) || { total: 0 }).total;

  const projects = all(`
    SELECT DISTINCT p.* FROM projects p
    JOIN tasks t ON t.project_id = p.id
    WHERE t.updated_at BETWEEN ? AND ?
  `, [from, to]);

  const prompt = `Generate a professional quarterly performance review summary based on this data.

Period: ${from} to ${to}
Total Hours Logged: ${totalHours}

Projects Worked On:
${JSON.stringify(projects, null, 2)}

Completed Tasks (${completedTasks.length}):
${JSON.stringify(completedTasks, null, 2)}

Activity Log (${activities.length} entries):
${JSON.stringify(activities, null, 2)}

Please provide:
1. Executive Summary (2-3 sentences)
2. Key Accomplishments (bullet points)
3. Projects & Contributions (grouped by project)
4. Skills Demonstrated
5. Areas of Impact
6. Metrics (tasks completed, hours invested, projects contributed to)

Format as markdown. Be professional and achievement-oriented. Focus on impact and outcomes.`;

  const { client, model } = getAiClient();
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    markdown: response.content[0].text,
    stats: {
      tasksCompleted: completedTasks.length,
      totalHours,
      projectsCount: projects.length,
      activitiesLogged: activities.length,
    },
  };
}

module.exports = { generateReport };
