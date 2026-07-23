const path = require('path');
const fs = require('fs');

// User-editable settings live next to the database in the per-user data dir
// (TASKTRACKER_DATA_DIR is set by Electron's main process; falls back to this
// folder in plain dev). This is what lets each user pick their own AWS profile
// after install without editing .env or the source.
const DATA_DIR = process.env.TASKTRACKER_DATA_DIR || __dirname;
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

const AWS_REGION = 'us-west-2'; // fixed per project decision

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch (_) { /* corrupt/unreadable -> treat as empty */ }
  return {};
}

function writeSettings(next) {
  const current = readSettings();
  const merged = { ...current, ...next };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

// The effective AWS profile: stored value wins, then .env AWS_PROFILE.
function getAwsProfile() {
  const s = readSettings();
  return (s.awsProfile && s.awsProfile.trim()) || process.env.AWS_PROFILE || '';
}

function getAwsRegion() {
  return AWS_REGION;
}

module.exports = { readSettings, writeSettings, getAwsProfile, getAwsRegion, SETTINGS_PATH, AWS_REGION };
