const { initDb } = require('./db/database');

initDb().then(() => {
  const { run, get } = require('./db/database');

  // Create a project
  const project = run('INSERT INTO projects (title, description) VALUES (?, ?)', [
    'CSM Evidence Analysis Platform',
    'Migrating evidence analysis services to new microservice architecture with improved performance and reliability'
  ]);
  const projectId = project.lastInsertRowid;
  console.log('Created project:', projectId);

  // Create a main task
  const task1 = run(`INSERT INTO tasks (project_id, title, description, status, priority, due_date, tags) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    projectId,
    'Implement API Gateway routing',
    'Set up API gateway to route traffic between legacy and new microservices',
    'in_progress',
    'high',
    '2026-07-28',
    JSON.stringify(['backend', 'infrastructure'])
  ]);
  const task1Id = task1.lastInsertRowid;
  console.log('Created task:', task1Id);

  // Create subtasks under the main task
  const sub1 = run(`INSERT INTO tasks (project_id, parent_id, title, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)`, [
    projectId, task1Id, 'Define route mapping for legacy endpoints', 'done', 'high', JSON.stringify(['backend'])
  ]);
  console.log('Created subtask 1:', sub1.lastInsertRowid);

  const sub2 = run(`INSERT INTO tasks (project_id, parent_id, title, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)`, [
    projectId, task1Id, 'Configure load balancer health checks', 'in_progress', 'medium', JSON.stringify(['infrastructure'])
  ]);
  console.log('Created subtask 2:', sub2.lastInsertRowid);

  const sub3 = run(`INSERT INTO tasks (project_id, parent_id, title, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)`, [
    projectId, task1Id, 'Write integration tests for new routes', 'todo', 'medium', JSON.stringify(['testing'])
  ]);
  console.log('Created subtask 3:', sub3.lastInsertRowid);

  // Create another standalone task
  const task2 = run(`INSERT INTO tasks (project_id, title, description, status, priority, due_date, tags) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    projectId,
    'Update Helm charts for new service deployment',
    'Add new service definitions and resource limits to helm charts',
    'todo',
    'medium',
    '2026-08-01',
    JSON.stringify(['devops', 'k8s'])
  ]);
  console.log('Created task 2:', task2.lastInsertRowid);

  // A completed task
  const task3 = run(`INSERT INTO tasks (project_id, title, status, priority, tags) VALUES (?, ?, ?, ?, ?)`, [
    projectId, 'Set up CI/CD pipeline for evidence-analysis service', 'done', 'high', JSON.stringify(['devops'])
  ]);
  console.log('Created task 3:', task3.lastInsertRowid);

  // Log some activity
  run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [
    task1Id, 'Analyzed existing route patterns and documented mapping strategy', 2.0
  ]);
  run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [
    task1Id, 'Implemented gateway config and tested with staging traffic', 3.5
  ]);
  run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [
    task3.lastInsertRowid, 'Pipeline complete - builds, tests, and deploys to dev/staging', 4.0
  ]);

  // Add a journal entry
  const today = new Date().toISOString().split('T')[0];
  run('INSERT INTO daily_journal (date, content) VALUES (?, ?)', [
    today,
    '## Today\n- Worked on API gateway routing for evidence analysis\n- Reviewed PR from team on helm chart updates\n- Standup: discussed timeline for Q3 migration milestone\n\n## Blockers\n- Waiting on network team for firewall rules\n\n## Tomorrow\n- Finish health check config\n- Start integration tests'
  ]);

  // Add a reminder
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(10, 0, 0, 0);
  run('INSERT INTO reminders (task_id, message, remind_at) VALUES (?, ?, ?)', [
    task1Id, 'Follow up with network team on firewall rules', tomorrow.toISOString()
  ]);

  console.log('\nDone! Demo data created:');
  console.log('- 1 Project: CSM Evidence Analysis Platform');
  console.log('- 3 Tasks (1 in progress, 1 todo, 1 done)');
  console.log('- 3 Subtasks under the main task');
  console.log('- 3 Activity log entries');
  console.log('- 1 Journal entry (today)');
  console.log('- 1 Reminder (tomorrow 10am)');
});
