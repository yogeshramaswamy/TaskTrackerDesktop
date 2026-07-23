# Moving TaskTracker to a New Computer

All your TaskTracker data lives in a single self-contained file — `tasks.db`.
Moving to a new computer means: **grab that one file, then import it in the app
on the new machine.** Nothing is stored in the cloud.

---

## The 3 steps

### 1. On the OLD computer — grab your `tasks.db`
1. **Close TaskTracker** (fully quit — don't copy the file while it's running).
2. Press `Win + R`, paste `%APPDATA%\tasktracker-desktop`, hit Enter.
3. Copy **`tasks.db`** to somewhere you can reach from the new machine —
   **OneDrive**, a USB drive, or a Teams message to yourself.

> That single file contains everything: projects, tasks, subtasks, activity log,
> journal, and reminders.

### 2. On the NEW computer — install and open the app
1. Copy over `TaskTracker-<version>-portable.exe` and run it.
2. Let the window open. (You don't need to close it this time.)

### 3. On the NEW computer — import the file (one click)
1. Get your `tasks.db` onto the new machine (download from OneDrive, plug in the
   USB, etc.).
2. In the app: **Settings → Import / Restore from File → Choose File…**
3. Pick your `tasks.db`. The app checks it and shows a **"File looks good ✓"**
   summary (how many projects, tasks, etc.).
4. Click **Yes, Import** → **all your data is now on the new machine.**

That's it — no digging through folders on the new machine. The import validates
the file first, and automatically backs up whatever was there before replacing it.

---

## After migrating: set up AI access

Your AWS profile does **not** travel inside `tasks.db`, so set it once on the new
machine:

1. Open the app → **Settings → AI Access**.
2. Enter your AWS profile name → **Test connection**.

(Your local AWS SSO must be set up on the new machine too:
`aws sso login --profile <name>`.)

> Want to skip this? On the old machine also copy `settings.json` (same
> `%APPDATA%\tasktracker-desktop` folder) and, on the new machine *before first
> launch*, drop it into that folder. Optional — re-typing the profile takes 30
> seconds.

---

## Safety notes

- **Copy `tasks.db` while the app is closed** so you don't catch a half-saved file.
- **Keep the old computer's copy** until you've confirmed the new machine shows
  everything. Don't wipe the old machine first.
- Importing on the new machine **replaces** any data already there — but it saves
  a backup first, recoverable from **Settings → Database Backups**.

---

## Where everything lives (reference)

```
C:\Users\<you>\AppData\Roaming\tasktracker-desktop\
├── tasks.db        ← your data (this is the file you move)
├── settings.json   ← AWS profile (optional to move)
└── backups\        ← automatic + manual snapshots
```

| Item        | Location                          |
|-------------|-----------------------------------|
| Data folder | `%APPDATA%\tasktracker-desktop`   |
| Your data   | `tasks.db`                        |
| AWS profile | `settings.json`                   |
| Backups     | `backups\`                        |

---

## Tip: keep `tasks.db` on OneDrive as a backup

Since the whole database is one file, you can periodically copy `tasks.db` to
OneDrive (while the app is closed) as an off-machine backup. If your laptop dies,
you just install the app on a new one and **Import** that file — you're back
exactly where you left off.

> **Note:** don't run the app *directly* against a OneDrive-synced copy — the app
> writes to `%APPDATA%`. Treat the OneDrive copy as a backup/transfer file you
> import, not the live database.
