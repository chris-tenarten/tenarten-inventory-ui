import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export async function mockManpowerAuth(page: Page, role = 'lead') {
  const file = readFileSync('.env.local', 'utf8');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? file.match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
  if (!url) throw new Error('Missing Supabase URL for local browser mock');
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  const user = { id: '00000000-0000-0000-0000-000000000004', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-09-21T00:00:00Z' };
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: 4102444800 })).toString('base64url')}.local-fixture`;
  await page.addInitScript(({ storageKey, user, token }) => {
    localStorage.setItem(storageKey, JSON.stringify({ access_token: token, refresh_token: 'local-fixture', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user }));
  }, { storageKey, user, token });
  await page.route('**/auth/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }));
  await page.route('**/rest/v1/rpc/**', route => {
    const rpc = new URL(route.request().url()).pathname.split('/').at(-1);
    if (rpc !== 'get_my_app_user' && rpc !== 'ensure_my_welcome_notification') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rpc === 'get_my_app_user' ? [{ user_id: user.id, display_name: 'Browser fixture', role, is_active: true }] : []) });
  });
}
