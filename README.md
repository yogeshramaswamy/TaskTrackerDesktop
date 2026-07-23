# TaskTracker Desktop

Local desktop task manager (Electron + Express + React + sql.js) with Claude AI
via AWS Bedrock.

Your data lives in your own user profile — nothing is uploaded anywhere:

```
C:\Users\<you>\AppData\Roaming\tasktracker-desktop\
├── tasks.db        ← your database (tasks, projects, subtasks)
├── settings.json   ← your saved AWS profile
└── backups\        ← automatic + manual backups
```

---

## Note on `ELECTRON_RUN_AS_NODE`

Some shells set `ELECTRON_RUN_AS_NODE=1`, which makes Electron run as plain Node
and crash with `app is undefined`. **`npm start` and `npm run restart` handle
this automatically** (they launch through `electron/launch.js`, which strips the
variable), so you don't need to do anything.

Only if you launch Electron *by hand* (`npx electron .`) do you need to unset it:

```bash
unset ELECTRON_RUN_AS_NODE               # Git Bash
Remove-Item Env:\ELECTRON_RUN_AS_NODE    # PowerShell
```

---

## Run locally

From the project folder (`C:\Users\yramaswamy\Documents\TaskTrackerDesktop`):

### Desktop app (normal use)
```bash
npm start
```
Builds the UI, then opens the desktop window. Use this for day-to-day running.

### Dev mode (while changing code)
```bash
npm run dev
```
Runs server (`:3001`) + Vite client (`:3000`) with hot reload **in the browser**
at http://localhost:3000. Fast for editing UI; not the desktop window.

### Quick relaunch (UI already built)
```bash
npx electron .
```

---

## Kill everything (stop all instances)

If a launch says the port is in use, or you want a clean slate:

```bash
# kill all Electron / TaskTracker windows
taskkill //F //IM electron.exe        //T
taskkill //F //IM TaskTracker.exe     //T

# free the server port (3001) if something is stuck on it
for pid in $(netstat -ano | grep ':3001' | grep LISTENING | awk '{print $5}' | sort -u); do taskkill //F //PID $pid; done
```

PowerShell equivalent to free the port:
```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen |
  Select-Object -Expand OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

---

## Restart (clean)

```bash
npm run restart
```
Kills any Electron/TaskTracker processes, frees ports 3001/3000, then relaunches
the desktop app.

---

## Build a shareable app

Produces a portable `.exe` and a `.zip` in `dist\` — no source code, no install
required for the recipient.

```bash
npm run dist
```

Output:
```
dist\TaskTracker-1.0.0-portable.exe   ← share this (double-click to run)
dist\TaskTracker-1.0.0.zip            ← zipped folder alternative
```

The shared build ships **empty** — no tasks, no AWS profile. On first launch a
fresh database is created; each user sets their own AWS profile in
**Settings → AI Access**.

> `npm run dist` already disables code-signing (`CSC_IDENTITY_AUTO_DISCOVERY=false`),
> which avoids the `winCodeSign` / "cannot create symbolic link" error on Windows.

---

## AI setup (Claude via Bedrock)

1. Open the app → **Settings → AI Access**.
2. Enter your AWS profile name (from `~/.aws/config`, must have Bedrock access).
3. Click **Test connection**.

Region is fixed to `us-west-2`. Requires an active AWS SSO session
(`aws sso login --profile <name>`).

---

## Test data (for trying out every feature)

A generator creates a **standalone database file** packed with sample data that
exercises every feature — all statuses, priorities, due-date buckets, subtasks,
no-project tasks, activity log, journal, reminders, and chat history. It does
**not** touch your live data; it writes a separate `.db` file you then import.

### 1. Generate the file
```bash
node server/seed-testdata.js                 # -> ./TaskTracker-testdata.db
node server/seed-testdata.js C:\path\out.db  # -> custom location
```

Dates are relative to *now*, so "overdue / today / this week" stay accurate
whenever you run it.

### 2. Load it into the app
1. Open the app → **Settings → Import / Restore from File → Choose File…**
2. Pick `TaskTracker-testdata.db`.
3. In the **"File looks good ✓"** dialog, review the counts → click **Yes, Import**.

> ⚠️ **Importing replaces all current data.** A backup of your current data is
> saved automatically first — restore it anytime from **Settings → Database
> Backups**.

### What the sample data covers
| Area        | Coverage                                                        |
|-------------|-----------------------------------------------------------------|
| Projects    | 4 — active, completed, one **empty** (test delete), one full     |
| Statuses    | todo, in_progress, done, blocked, archived                       |
| Priorities  | urgent, high, medium, low                                        |
| Due dates   | overdue, due today, this week, future, none                      |
| Subtasks    | nested under multiple parents, mixed child statuses              |
| No-project  | 3 tasks (for the "no project" filter)                            |
| Extras      | ticket URLs, tags, start dates, activity log, journal, reminders |

The seed scripts (`seed*.js`) are excluded from `npm run dist`, so this never
ships to teammates.

---

## Command reference

| Task                       | Command                          |
|----------------------------|----------------------------------|
| Run desktop app            | `npm start`                      |
| Dev mode (browser)         | `npm run dev`                    |
| Quick relaunch             | `npx electron .`                 |
| Clean restart              | `npm run restart`                |
| Build shareable exe/zip    | `npm run dist`                   |
| Build UI only              | `npm run build:client`           |
| Generate test data file    | `node server/seed-testdata.js`   |
