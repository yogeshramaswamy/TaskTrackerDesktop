// Generates a standalone TaskTracker database file packed with test data that
// exercises EVERY feature: all statuses, all priorities, projects (incl. empty
// + completed), no-project tasks, subtasks, due dates (overdue/today/this
// week/future/none), start dates, ticket URLs, tags, activity log, multiple
// journal entries, active/recurring/inactive reminders, and chat history.
//
// It does NOT touch your live data. It writes to a fresh .db file you then load
// via Settings -> Import / Restore from File.
//
//   node server/seed-testdata.js                 -> ./TaskTracker-testdata.db
//   node server/seed-testdata.js C:\path\out.db  -> custom location

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || path.join(__dirname, '..', 'TaskTracker-testdata.db');

// --- date helpers (relative to "now" so the data is always fresh) ----------
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const iso = (d) => new Date(d).toISOString();
const dateOnly = (d) => new Date(d).toISOString().split('T')[0];
const daysFromNow = (n) => new Date(now.getTime() + n * DAY);

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8'));

  const run = (sql, params = []) => {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    stmt.step();
    stmt.free();
    const r = db.exec('SELECT last_insert_rowid() as id');
    return r.length ? r[0].values[0][0] : 0;
  };

  // ---------------------------------------------------------------- projects
  const pPlatform = run('INSERT INTO projects (title, description, status) VALUES (?,?,?)', [
    'Platform Modernization',
    'Migrate services to EKS/ArgoCD/Helm3. Covers tasks across every status and priority.',
    'active',
  ]);
  const pOnboarding = run('INSERT INTO projects (title, description, status) VALUES (?,?,?)', [
    'Team Onboarding',
    'Getting new engineers set up — a lighter project.',
    'active',
  ]);
  const pArchived = run('INSERT INTO projects (title, description, status) VALUES (?,?,?)', [
    'Q1 Legacy Cleanup (completed)',
    'A finished project — all tasks done.',
    'completed',
  ]);
  const pEmpty = run('INSERT INTO projects (title, description, status) VALUES (?,?,?)', [
    'Empty Project (safe to delete)',
    'Has no tasks — use this to test project deletion.',
    'active',
  ]);

  // ------------------------------------------------------------------- tasks
  // Covers: every status, every priority, overdue/today/week/future/no due
  // date, start dates, ticket URLs, and tag combinations.
  const t = (o) => run(
    `INSERT INTO tasks (project_id, parent_id, title, description, ticket_url, status, priority, start_date, due_date, tags)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      o.project ?? null,
      o.parent ?? null,
      o.title,
      o.description ?? null,
      o.ticket ?? null,
      o.status ?? 'todo',
      o.priority ?? 'medium',
      o.start ? iso(o.start) : null,
      o.due ? iso(o.due) : null,
      JSON.stringify(o.tags ?? []),
    ],
  );

  // Platform project — a spread across statuses & priorities
  const tUrgentOverdue = t({
    project: pPlatform, title: 'Rotate leaked service credentials',
    description: 'Security flagged exposed creds — rotate immediately.',
    ticket: 'https://dev.azure.com/org/proj/_workitems/edit/1001',
    status: 'in_progress', priority: 'urgent',
    start: daysFromNow(-3), due: daysFromNow(-1), // OVERDUE
    tags: ['security', 'urgent'],
  });
  const tHighToday = t({
    project: pPlatform, title: 'ArgoCD deploy: knowcenter-admin-ui',
    description: 'Deploy and validate the admin UI via ArgoCD.',
    ticket: 'https://dev.azure.com/org/proj/_workitems/edit/1002',
    status: 'in_progress', priority: 'high',
    start: daysFromNow(-1), due: now, // DUE TODAY
    tags: ['argocd', 'deploy'],
  });
  const tMediumThisWeek = t({
    project: pPlatform, title: 'Migrate SOPS secrets to External Secrets Operator',
    status: 'todo', priority: 'medium',
    due: daysFromNow(3), // THIS WEEK
    tags: ['secrets', 'eso'],
  });
  const tLowFuture = t({
    project: pPlatform, title: 'Document the new deployment runbook',
    status: 'todo', priority: 'low',
    due: daysFromNow(20), // FUTURE
    tags: ['docs'],
  });
  const tBlocked = t({
    project: pPlatform, title: 'Enable EKS cluster autoscaling',
    description: 'Blocked: waiting on the cloud team for IAM role.',
    status: 'blocked', priority: 'high',
    due: daysFromNow(5),
    tags: ['eks', 'infra'],
  });
  const tDone = t({
    project: pPlatform, title: 'Stand up ArgoCD in staging',
    status: 'done', priority: 'high',
    start: daysFromNow(-10), due: daysFromNow(-4),
    tags: ['argocd'],
  });
  const tArchived = t({
    project: pPlatform, title: 'Spike: evaluate Helm 3 migration path',
    description: 'Archived — superseded by the main migration task.',
    status: 'archived', priority: 'low',
    tags: ['spike'],
  });
  const tNoDue = t({
    project: pPlatform, title: 'Backlog: investigate flaky integration test',
    status: 'todo', priority: 'medium', // NO due date
    tags: ['testing', 'backlog'],
  });

  // Subtasks under the "today" high task — covers nested + mixed child statuses
  t({ project: pPlatform, parent: tHighToday, title: 'Bump image tag in values.yaml', status: 'done', priority: 'high', tags: ['argocd'] });
  t({ project: pPlatform, parent: tHighToday, title: 'Sync ArgoCD app and watch rollout', status: 'in_progress', priority: 'high', tags: ['argocd'] });
  t({ project: pPlatform, parent: tHighToday, title: 'Smoke-test the admin UI login', status: 'todo', priority: 'medium', tags: ['testing'] });
  t({ project: pPlatform, parent: tBlocked, title: 'Open IAM request ticket with cloud team', status: 'done', priority: 'medium', tags: ['infra'] });

  // Onboarding project — a couple of simple tasks
  const tOnboard1 = t({ project: pOnboarding, title: 'Grant AWS SSO + Bedrock access', status: 'done', priority: 'high', due: daysFromNow(-2), tags: ['access'] });
  t({ project: pOnboarding, title: 'Walk through the deployment pipeline', status: 'todo', priority: 'medium', due: daysFromNow(4), tags: ['docs'] });
  t({ project: pOnboarding, parent: tOnboard1, title: 'Install and configure aws-cli', status: 'done', priority: 'medium' });

  // Completed project — all done
  t({ project: pArchived, title: 'Remove deprecated Jenkins jobs', status: 'done', priority: 'medium', due: daysFromNow(-30) });
  t({ project: pArchived, title: 'Decommission Tiller from clusters', status: 'done', priority: 'high', due: daysFromNow(-25) });

  // NO-PROJECT tasks — for the "tasks without a project" filter
  const tNoProj1 = t({ title: 'Personal: renew SSL cert for internal tool', status: 'todo', priority: 'high', due: daysFromNow(2), tags: ['personal'] });
  t({ title: 'Personal: read up on ESO best practices', status: 'todo', priority: 'low', tags: ['learning'] });
  t({ title: 'Personal: expense report for conference', status: 'done', priority: 'medium', due: daysFromNow(-6) });

  // -------------------------------------------------------------- activity log
  run('INSERT INTO activity_log (task_id, note, hours_spent, logged_at) VALUES (?,?,?,?)', [tUrgentOverdue, 'Identified all places the credential was used.', 1.5, iso(daysFromNow(-2))]);
  run('INSERT INTO activity_log (task_id, note, hours_spent, logged_at) VALUES (?,?,?,?)', [tUrgentOverdue, 'Rotated in vault; redeploying dependent services.', 2.0, iso(daysFromNow(-1))]);
  run('INSERT INTO activity_log (task_id, note, hours_spent, logged_at) VALUES (?,?,?,?)', [tHighToday, 'Prepared values.yaml and opened PR.', 1.0, iso(now)]);
  run('INSERT INTO activity_log (task_id, note, hours_spent, logged_at) VALUES (?,?,?,?)', [tDone, 'ArgoCD running in staging, apps syncing.', 4.5, iso(daysFromNow(-4))]);
  run('INSERT INTO activity_log (task_id, note, hours_spent, logged_at) VALUES (?,?,?,?)', [tNoProj1, 'Requested new cert from PKI team.', 0.5, iso(now)]);

  // ----------------------------------------------------------- daily journal
  run('INSERT INTO daily_journal (date, content, created_at) VALUES (?,?,?)', [
    dateOnly(daysFromNow(-2)),
    '## Focus\n- Security cred rotation kicked off\n\n## Notes\n- Found two extra services using the old secret\n\n## Blockers\n- None',
    iso(daysFromNow(-2)),
  ]);
  run('INSERT INTO daily_journal (date, content, created_at) VALUES (?,?,?)', [
    dateOnly(daysFromNow(-1)),
    '## Focus\n- Finished rotating creds\n- Started ArgoCD admin-ui deploy\n\n## Tomorrow\n- Smoke test admin UI',
    iso(daysFromNow(-1)),
  ]);
  run('INSERT INTO daily_journal (date, content, created_at) VALUES (?,?,?)', [
    dateOnly(now),
    '## Focus\n- Deploy admin-ui via ArgoCD (due today)\n- Migrate SOPS -> ESO planning\n\n## Blockers\n- EKS autoscaling waiting on IAM role',
    iso(now),
  ]);

  // ---------------------------------------------------------------- reminders
  // Active future, recurring, and an inactive one.
  const at10 = (d) => { const x = new Date(d); x.setHours(10, 0, 0, 0); return x; };
  run('INSERT INTO reminders (task_id, message, remind_at, recurring, is_active) VALUES (?,?,?,?,?)', [
    tHighToday, 'Check ArgoCD rollout status', iso(at10(daysFromNow(1))), null, 1,
  ]);
  run('INSERT INTO reminders (task_id, message, remind_at, recurring, is_active) VALUES (?,?,?,?,?)', [
    tBlocked, 'Chase cloud team on IAM role', iso(at10(daysFromNow(2))), null, 1,
  ]);
  run('INSERT INTO reminders (task_id, message, remind_at, recurring, is_active) VALUES (?,?,?,?,?)', [
    null, 'Weekly: review the backlog', iso(at10(daysFromNow(7))), 'weekly', 1,
  ]);
  run('INSERT INTO reminders (task_id, message, remind_at, recurring, is_active) VALUES (?,?,?,?,?)', [
    tNoProj1, 'Old reminder (dismissed)', iso(at10(daysFromNow(-3))), null, 0,
  ]);

  // ----------------------------------------------------------- chat history
  run("INSERT INTO claude_chat_history (role, content) VALUES (?,?)", ['user', 'What should I focus on today?']);
  run("INSERT INTO claude_chat_history (role, content) VALUES (?,?)", ['assistant', 'You have 1 task due today (ArgoCD deploy: knowcenter-admin-ui) and 1 overdue urgent task (Rotate leaked service credentials). Start with the overdue security task.']);

  // ------------------------------------------------------------------- write
  fs.writeFileSync(OUT, Buffer.from(db.export()));
  db.close();

  const count = (t) => {
    const d = new SQL.Database(fs.readFileSync(OUT));
    const r = d.exec(`SELECT COUNT(*) FROM ${t}`);
    d.close();
    return r.length ? r[0].values[0][0] : 0;
  };
  console.log('\n✅ Test database written to:\n   ' + path.resolve(OUT) + '\n');
  console.log('   Projects:        4  (1 empty, 1 completed)');
  console.log('   Tasks:          ' + count('tasks') + '  (incl. subtasks + no-project)');
  console.log('   Statuses:        todo, in_progress, done, blocked, archived');
  console.log('   Priorities:      urgent, high, medium, low');
  console.log('   Due dates:       overdue, today, this week, future, none');
  console.log('   Activity log:   ' + count('activity_log') + ' entries');
  console.log('   Journal:        ' + count('daily_journal') + ' entries');
  console.log('   Reminders:      ' + count('reminders') + '  (active, recurring, inactive)');
  console.log('   Chat history:   ' + count('claude_chat_history') + ' messages');
  console.log('\nLoad it via: Settings -> Import / Restore from File -> Choose File\n');
  process.exit(0);
})();
