// Real Auth/REST plus the unchanged actual Admin handler. No hosted forwarding or session mocks.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
const cfg = JSON.parse(readFileSync('.tmp-label-permission-validation/config.json'));
assert.equal(cfg.appOrigin, 'http://localhost:4318');
assert.equal(cfg.authOrigin, 'http://127.0.0.1:55583');
assert.equal(cfg.restOrigin, 'http://127.0.0.1:55584');
export const routeFetch = (url, options) => {
 const request = new URL(url); assert.equal(request.origin, cfg.appOrigin);
 for (const [prefix, origin] of [['/auth/v1', cfg.authOrigin], ['/rest/v1', cfg.restOrigin]]) if (request.pathname.startsWith(prefix + '/')) return fetch(origin + request.pathname.slice(prefix.length) + request.search, options);
 throw new Error('Unexpected local request');
};
let handler;
const env = { SUPABASE_URL: cfg.appOrigin, SUPABASE_ANON_KEY: cfg.anonKey, SUPABASE_SERVICE_ROLE_KEY: cfg.serviceKey, TENOPS_ALLOWED_ORIGINS: cfg.appOrigin };
const factory = (url, key, options = {}) => { assert.equal(url, cfg.appOrigin); return createClient(url, key, { ...options, global: { ...options.global, fetch: routeFetch } }); };
new Function('Deno', 'createClient', (await transform(readFileSync('supabase/functions/admin-manage-users/index.ts', 'utf8').replace(/^import .*;\n/, ''), { loader: 'ts', format: 'cjs' })).code)({ env: { get: key => env[key] }, serve: fn => handler = fn }, factory);
const root = '/private/tmp/tenops-sample-label-permission-build/out';
const server = createServer(async (req, res) => {
 try {
  const url = new URL(req.url, cfg.appOrigin);
  if (req.headers.origin && req.headers.origin !== cfg.appOrigin) { res.writeHead(403).end(); return; }
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 2000000) throw new Error('Oversize request'); }
  const options = { method: req.method, headers: Object.fromEntries(Object.entries(req.headers).filter(([key]) => !['host', 'connection', 'content-length', 'accept-encoding'].includes(key))), ...(raw ? { body: raw } : {}) };
  if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/') || url.pathname === '/functions/v1/admin-manage-users') {
   const response = url.pathname.startsWith('/functions/') ? await handler(new Request(url, options)) : await routeFetch(url, options);
   const headers = Object.fromEntries(response.headers); delete headers['content-encoding']; delete headers['content-length'];
   res.writeHead(response.status, headers).end(Buffer.from(await response.arrayBuffer())); return;
  }
  if (url.pathname.startsWith('/functions/')) { res.writeHead(404).end(); return; }
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index';
  const file = [relative, relative + '.html', path.join(relative, 'index.html')].map(value => path.resolve(root, value)).find(value => value.startsWith(root + '/') && existsSync(value) && statSync(value).isFile());
  if (!file) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain' })[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(file));
 } catch { res.writeHead(500).end('Local validation request failed'); }
});
server.listen(4318, '::1', () => console.log('Isolated permission validation: http://localhost:4318 (real Auth/REST, local Admin handler)'));
