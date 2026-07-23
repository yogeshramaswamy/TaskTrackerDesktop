// Cross-shell launcher for the desktop app.
// Some environments set ELECTRON_RUN_AS_NODE=1, which makes the electron binary
// behave as plain Node ("app is undefined" crash). We strip it here so the app
// always launches as a real GUI regardless of the parent shell.
const { spawn } = require('child_process');
const electron = require('electron'); // resolves to the electron.exe path

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, ['.'], { stdio: 'inherit', env });
child.on('close', (code) => process.exit(code ?? 0));
