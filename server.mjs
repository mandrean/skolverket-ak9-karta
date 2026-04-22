import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 5173);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
]);

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(text);
}

async function serveStatic(req, res, pathname) {
  const publicRoot = path.join(__dirname, 'public');
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const decoded = decodeURIComponent(requestedPath);
  const fullPath = path.normalize(path.join(publicRoot, decoded));

  if (!fullPath.startsWith(publicRoot)) return sendText(res, 403, 'Forbidden');

  try {
    const stats = await stat(fullPath);
    if (!stats.isFile()) return sendText(res, 404, 'Not found');
    const ext = path.extname(fullPath);
    const data = await readFile(fullPath);
    res.writeHead(200, {
      'Content-Type': mimeTypes.get(ext) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch (err) {
    if (err?.code === 'ENOENT') return sendText(res, 404, 'Not found');
    console.error(err);
    return sendText(res, 500, 'Internal server error');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET') return sendText(res, 405, 'Method not allowed');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    return sendText(res, 200, JSON.stringify({ ok: true, mode: 'static-json', time: new Date().toISOString() }, null, 2), 'application/json; charset=utf-8');
  }
  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Statisk Skolverket-karta körs på http://localhost:${PORT}`);
  console.log('Appen läser bara lokala JSON-filer i public/data/.');
  console.log('Uppdatera data med: npm run build:data:all');
});
