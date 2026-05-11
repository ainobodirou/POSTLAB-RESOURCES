import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');
const host = '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType =
    contentTypes[extension] ?? 'application/octet-stream';

  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control':
      extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath =
    pathname === '/'
      ? indexFile
      : path.join(distDir, pathname.replace(/^\/+/, ''));

  try {
    const fileStats = await stat(requestedPath);

    if (fileStats.isFile()) {
      sendFile(response, requestedPath);
      return;
    }
  } catch {
    // Fall through to the SPA index file.
  }

  if (!existsSync(indexFile)) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Build output was not found. Run "npm run build" first.');
    return;
  }

  sendFile(response, indexFile);
});

server.listen(port, host, () => {
  console.log(`Serving dist on http://${host}:${port}`);
});
