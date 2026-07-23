const { initDb } = require('./db/database');

initDb().then(() => {
  const { run } = require('./db/database');

  // Create the project
  const project = run('INSERT INTO projects (title, description) VALUES (?, ?)', [
    'Hayes CSM Evidence Analysis - Platform Modernization',
    'Migrating from Jenkins/Helm2/Tiller/SOPS architecture to modern GitOps with ArgoCD, Helm 3, GitHub Actions, and AWS Secrets Manager'
  ]);
  const pid = project.lastInsertRowid;

  // --- COMPLETED: Infrastructure (Terraform) ---
  const t1 = run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'AWS Infrastructure (Terraform)', 'EKS, RDS, KMS, S3, IAM, DNS - deployed to staging in us-west-2', 'done', 'urgent', JSON.stringify(['terraform', 'infrastructure'])
  ]);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, 'EKS cluster v1.35 provisioned', 'done', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, 'RDS PostgreSQL 16.6 with Secrets Manager', 'done', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, '3 KMS keys (EBS, RDS, S3)', 'done', 'medium']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, '7 S3 buckets provisioned', 'done', 'medium']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, '5 IAM roles with Pod Identity/IRSA', 'done', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, 'SNS topic + SQS queue (content-delivery)', 'done', 'medium']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, 'VPC CNI custom networking (100.66.0.0/16)', 'done', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t1.lastInsertRowid, 'Private Route 53 DNS', 'done', 'medium']);

  // --- COMPLETED: K8s Platform Layer ---
  const t2 = run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'Kubernetes Platform Layer (ArgoCD)', 'Cluster infra-level apps deployed via ArgoCD', 'done', 'urgent', JSON.stringify(['k8s', 'argocd'])
  ]);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t2.lastInsertRowid, 'ArgoCD bootstrapped and running', 'done', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t2.lastInsertRowid, 'AWS Load Balancer Controller', 'done', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t2.lastInsertRowid, 'Cluster Autoscaler', 'done', 'medium']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t2.lastInsertRowid, 'External Secrets Operator (replaces SOPS)', 'done', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t2.lastInsertRowid, 'Datadog monitoring', 'done', 'medium']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t2.lastInsertRowid, 'Falcon Sensor security', 'done', 'medium']);

  // --- IN PROGRESS: Jenkins Reverse Engineering ---
  const t3 = run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'Reverse-engineer Jenkins Value Files & Manifests', 'Extract runtime-generated values from Jenkins, convert to static version-controlled values files per microservice. Highest-risk unknown.', 'in_progress', 'urgent', JSON.stringify(['jenkins', 'helm', 'migration'])
  ]);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t3.lastInsertRowid, 'Map Jenkins pipeline variables per service', 'in_progress', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t3.lastInsertRowid, 'Extract runtime-generated Helm values', 'in_progress', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t3.lastInsertRowid, 'Convert to static values files per microservice', 'todo', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t3.lastInsertRowid, 'Document all environment-specific variables', 'todo', 'medium']);

  // --- NOT STARTED: Helm Chart Upgrade ---
  const t4 = run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'Helm Chart Upgrade to v3', 'Upgrade 9-10 microservice charts to Helm 3, remove Tiller dependencies', 'todo', 'high', JSON.stringify(['helm', 'migration'])
  ]);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t4.lastInsertRowid, 'Remove Tiller dependencies from all charts', 'todo', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t4.lastInsertRowid, 'Align charts to Helm 3 best practices', 'todo', 'medium']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t4.lastInsertRowid, 'Test charts in staging cluster', 'todo', 'medium']);

  // --- NOT STARTED: GitHub Actions ---
  const t5 = run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'GitHub Actions CI Pipelines (per microservice)', 'Replace monolithic Jenkins with independent GHA workflows per service', 'todo', 'high', JSON.stringify(['ci', 'github-actions'])
  ]);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t5.lastInsertRowid, 'Design reusable workflow template', 'todo', 'high']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t5.lastInsertRowid, 'Create workflows for all 9-10 microservices', 'todo', 'medium']);
  run('INSERT INTO tasks (project_id, parent_id, title, status, priority) VALUES (?, ?, ?, ?, ?)', [pid, t5.lastInsertRowid, 'Configure ECR image push per service', 'todo', 'medium']);

  // --- NOT STARTED: Database ---
  run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'Database Schema Migration', 'Re-create schema in new RDS instance, evaluate Flyway/Liquibase for automation', 'todo', 'high', JSON.stringify(['database', 'rds'])
  ]);

  // --- NOT STARTED: App Deployment ---
  run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'Application Deployment via ArgoCD + Validation', 'Deploy all 9-10 microservices through ArgoCD in staging, validate end-to-end', 'todo', 'high', JSON.stringify(['argocd', 'deployment'])
  ]);

  // --- NOT STARTED: SQS & Auth ---
  run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'SQS Consumer & PingFed/PingOne Integration Audit', 'Map SQS consumers and PingFederate auth integration points for new env', 'todo', 'medium', JSON.stringify(['sqs', 'auth', 'integration'])
  ]);

  // --- NOT STARTED: Route 53 ---
  run('INSERT INTO tasks (project_id, title, description, status, priority, tags) VALUES (?, ?, ?, ?, ?, ?)', [
    pid, 'Route 53 Secure Endpoint Exposure', 'Expose endpoints with TLS, WAF, access policies per Symplr standards', 'todo', 'medium', JSON.stringify(['networking', 'security'])
  ]);

  // --- Activity Logs ---
  run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [
    t1.lastInsertRowid, 'Completed full Terraform codebase for staging (EKS, RDS, KMS, S3, IAM, DNS) - all modules reusable for QA/prod', 40.0
  ]);
  run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [
    t2.lastInsertRowid, 'Deployed ArgoCD, LB Controller, Autoscaler, ESO, Datadog, Falcon Sensor to staging cluster', 24.0
  ]);
  run('INSERT INTO activity_log (task_id, note, hours_spent) VALUES (?, ?, ?)', [
    t3.lastInsertRowid, 'Started analyzing Jenkins pipelines - mapping variables and dynamic value generation patterns', 6.0
  ]);

  console.log('Done! Added Hayes Platform Modernization project.');
  console.log('Project ID:', pid);
  console.log('- 9 main tasks (2 done, 1 in progress, 6 todo)');
  console.log('- 20+ subtasks');
  console.log('- 3 activity log entries (70 hours total)');
});
