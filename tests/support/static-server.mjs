import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'out');
const port = Number(process.env.PORT || 3000);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://${request.headers.host}`).pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidates = [relativePath, `${relativePath}.html`, join(relativePath, 'index.html')];
  const filePath = candidates
    .map(candidate => normalize(join(root, candidate)))
    .find(candidate => candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile());

  if (!filePath) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
}).listen(port, 'localhost');
