// Portable, loopback-only test data source for the exact exported TenOps app.
// No database, migrations, hosted connections, persistent writes or printer integration.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const flag = process.argv.find(value => value.startsWith('--port='));
const port = flag ? Number(flag.slice(7)) : 3000;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a valid local port.');
const origin = `http://localhost:${port}`;
const samples = JSON.parse(readFileSync(path.join(root, 'fixtures/samples.json'), 'utf8'));
const id = '00000000-0000-0000-0000-000000000010';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'dymo-print-test@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-10-13T00:00:00Z' };
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp: 4102444800 })).toString('base64url')}.local-test-only`;
const session = { access_token: token, refresh_token: 'local-test-only', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user };
const profile = { user_id: id, display_name: 'DYMO print test — local fixture', role: 'guest', is_active: true, read_only: true, messaging_write: false, production_blend_manage: false };
const readCapabilities = new Set(['readOperationalData', 'viewIntake', 'previewOperationalDocuments']);
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };

const server = createServer(async (req, res) => {
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  if (!allowedHosts.has(req.headers.host) || (req.headers.origin && req.headers.origin !== origin)) return json(res, 403, { message: 'Local print-test origin required.' });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'GET,POST,HEAD,OPTIONS' }).end(); return;
  }
  try {
    const url = new URL(req.url, origin);
    let body = {};
    if (req.method === 'POST') {
      let raw = '';
      for await (const part of req) { raw += part; if (raw.length > 1000000) throw new Error('Oversize request'); }
      body = raw ? JSON.parse(raw) : {};
    }
    const name = url.pathname.split('/').at(-1);
    if (url.pathname.startsWith('/auth/v1/')) return json(res, 200, name === 'token' ? session : user);
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      if (name === 'get_my_app_access') return json(res, 200, [profile]);
      if (name === 'get_my_app_user') return json(res, 200, [profile]);
      if (name === 'list_samples') return json(res, 200, samples);
      if (name === 'has_app_capability') return json(res, 200, readCapabilities.has(body.p_capability));
      if (/^(get_|list_|search_|suggest_)/.test(name)) return json(res, 200, []);
      return json(res, 403, { message: 'Read-only DYMO print test: saving, issuance and access changes are disabled.' });
    }
    if (url.pathname.startsWith('/rest/v1/')) return json(res, req.method === 'GET' || req.method === 'HEAD' ? 200 : 403, req.method === 'GET' || req.method === 'HEAD' ? [] : { message: 'Read-only print test.' });
    if (url.pathname.startsWith('/functions/') || !['GET', 'HEAD'].includes(req.method)) return json(res, 403, { message: 'Read-only print test: backend actions are disabled.' });
    const app = path.join(root, 'app');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index';
    const file = [relative, relative + '.html', path.join(relative, 'index.html')]
      .map(value => path.resolve(app, value)).find(value => value.startsWith(app + path.sep) && existsSync(value) && statSync(value).isFile());
    if (!file) return json(res, 404, { message: 'Not found.' });
    const extension = path.extname(file);
    let data = readFileSync(file);
    if (extension === '.html') data = Buffer.from(data.toString().replace('</head>', `<script>localStorage.setItem('sb-localhost-auth-token',${JSON.stringify(JSON.stringify(session))});</script></head>`));
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain' }[extension] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { json(res, 400, { message: 'The local print-test request could not be processed.' }); }
});
server.on('error', error => { console.error(`Cannot start local print test: ${error.message}. Use port 3000 on the test workstation; do not stop an unrelated process.`); process.exitCode = 1; });
server.listen(port, 'localhost', () => console.log(`${port === 3000 ? '' : 'HTTP smoke-test port only; the built app API requires localhost:3000.\n'}Open ${origin}/samples?open=${samples[0].sample.id}\nLocal read-only fixture. No hosted services or printer commands. Stop with Ctrl+C.`));
