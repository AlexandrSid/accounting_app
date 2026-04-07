import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = 10800;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUNTIME_DIR = path.join(ROOT, 'runtime');
const PID_FILE = path.join(RUNTIME_DIR, 'server.pid');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.yml':  'text/plain',
  '.yaml': 'text/plain',
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function writePidFile() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
}

const server = http.createServer((req, res) => {
  // Prevent path traversal: resolve to ROOT and reject anything outside
  const urlPath = req.url.split('?')[0];
  const decoded = decodeURIComponent(urlPath);
  const resolved = path.resolve(ROOT, '.' + decoded);

  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
    ? path.join(resolved, 'index.html')
    : resolved;

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  writePidFile();
  console.log(`Server running at http://${HOST}:${PORT}`);
});
