import http from 'node:http';
import { getBrandingConfig, isDevBrandingEnabled } from '../src/lib/dev-branding.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.TENOPS_DESIGN_PORT || 4176);
const files = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/styles.css', ['styles.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/icons.js', ['icons.js', 'text/javascript']], ['/navigation.js', ['navigation.js', 'text/javascript']], ['/branding.js', ['branding.js', 'text/javascript']], ['/ASSESSMENT.md', ['ASSESSMENT.md', 'text/plain']], ['/README.md', ['README.md', 'text/plain']]]);

// Explicit source-owned assets only. Bytes remain in public/ and are never copied or edited.
for (const name of ['tenarten-logo-steel-welcome.webp','logo.png','dev-branding/tendev-overlay.webp','dev-branding/development-environment.webp','tenops-gold-app-icon-192.png','tenops-gold-app-icon-512.png','tenops-gold-apple-touch-icon.png','tendev-app-icon-192.png','tendev-app-icon-512.png','tendev-apple-touch-icon.png']) files.set('/'+name, ['../public/'+name,name.endsWith('.webp')?'image/webp':'image/png']);
function reviewBranding(flag){const config=getBrandingConfig(isDevBrandingEnabled(flag));const prefix=config.showDeveloperArtwork?'tendev':'tenops-gold';return {...config,header:{authenticatedLogo:'/tenarten-logo-steel-welcome.webp',lockedLogo:'/logo.png',authenticatedProductName:config.showDeveloperArtwork?getBrandingConfig(false).productName:config.productName,subtitle:config.subtitle??'Operations Control',developmentWordmark:'/dev-branding/tendev-overlay.webp',developmentIdentity:'/dev-branding/development-environment.webp'},metadata:{title:config.productName+' Cloud — Dashboard',icon192:'/'+prefix+'-app-icon-192.png',icon512:'/'+prefix+'-app-icon-512.png',appleIcon:'/'+prefix+'-apple-touch-icon.png',themeColor:config.defaultAppearance==='dark'?'#11151b':'#eef1f4'}};}
const reviewBrandingScript='globalThis.TENOPS_REVIEW_BRANDING='+JSON.stringify({production:reviewBranding(undefined),tendev:reviewBranding('true')})+';';

const previewRoutes = new Set(['/production','/pre-production','/my-work','/manpower-reporting','/material-usage','/inventory','/activity','/samples','/proposals','/purchasing','/transmittals','/contacts','/catalog','/settings']);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Read-only local preview'); }
  if (url.pathname === '/branding-config.js') { res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(req.method === 'HEAD' ? undefined : reviewBrandingScript); }
  const entry = files.get(url.pathname) || (previewRoutes.has(url.pathname) ? files.get('/') : undefined);
  if (!entry) { res.writeHead(404); return res.end('Not found'); }
  try {
    const body = await readFile(path.join(root, entry[0]));
    res.writeHead(200, {'Content-Type': entry[1].startsWith('image/') ? entry[1] : `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Preview file unavailable'); }
});
server.listen(port, '127.0.0.1', () => console.log(`TenOps design review: http://127.0.0.1:${port} (synthetic data; no backend)`));
server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose TENOPS_DESIGN_PORT explicitly.` : error.message); process.exitCode = 1; });
