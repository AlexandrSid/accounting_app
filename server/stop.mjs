import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PID_FILE = path.join(__dirname, '..', 'runtime', 'server.pid');

if (!fs.existsSync(PID_FILE)) {
  console.error('No PID file found. Is the server running?');
  process.exit(1);
}

const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);

if (isNaN(pid)) {
  console.error('PID file contains invalid data.');
  process.exit(1);
}

try {
  if (process.platform === 'win32') {
    execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
  } else {
    process.kill(pid, 'SIGTERM');
  }
  fs.unlinkSync(PID_FILE);
  console.log('Server stopped.');
} catch (err) {
  if (err.code === 'ESRCH') {
    // Process was already gone; clean up stale PID file
    fs.unlinkSync(PID_FILE);
    console.log('Server was not running. Stale PID file removed.');
  } else {
    console.error(`Failed to stop server (PID ${pid}):`, err.message);
    process.exit(1);
  }
}
