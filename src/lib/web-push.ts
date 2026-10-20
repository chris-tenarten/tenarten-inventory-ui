import { supabase } from './supabase';

export type DeviceBinding = { id: string; owner: string; generation: number };
export type PushConfiguration = { environment: string; public_key: string; key_version: string };
export type PushState = { supported: boolean; installed: boolean; needsInstall: boolean; permission: NotificationPermission | 'unsupported'; registered: boolean; error: string; configured: boolean };
const storageKey = 'tenops.push.device.v1';
const pendingKey = 'tenops.push.revocations.v1';
let epoch = 0;
let serial: Promise<unknown> = Promise.resolve();
let owner: string | null = null;
function stored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function binding(): DeviceBinding | null { return stored<DeviceBinding | null>(storageKey, null); }
function queue(task: () => Promise<unknown>) { const next = serial.then(task, task); serial = next.catch(() => {}); return next; }
function tombstone(value: DeviceBinding) {
  const pending = stored<DeviceBinding[]>(pendingKey, []);
  save(pendingKey, [...pending.filter(row => row.id !== value.id), value].slice(-32));
}
async function rpc<T>(name: string, args = {}, expectedOwner?: string): Promise<T> {
  let token: string | undefined;
  if (expectedOwner) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== expectedOwner) throw new Error('Device cleanup is pending for the original account.');
    token = data.session.access_token;
  }
  const query = supabase.rpc(name, args);
  // Pin owner-sensitive requests to the verified session, even if auth changes before fetch.
  if (token) query.setHeader('Authorization', `Bearer ${token}`);
  const { data, error } = await query.abortSignal(AbortSignal.timeout(4000));
  if (error) throw new Error('Device registration could not be updated. Check your connection and retry.');
  return data as T;
}
export function deviceSupport(): Omit<PushState, 'registered' | 'error' | 'configured'> {
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { supported, installed, needsInstall: appleMobile && !installed, permission: supported ? Notification.permission : 'unsupported' };
}
export async function preparePushWorker() {
  if (!deviceSupport().supported) throw new Error('This browser does not support device notifications.');
  await within(navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
  return within(navigator.serviceWorker.ready);
}
function within<T>(work: PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Device update timed out. Retry Disable on this device.')), 4500);
    Promise.resolve(work).then(resolve, reject).finally(() => window.clearTimeout(timer));
  });
}
async function localUnsubscribe() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await within(navigator.serviceWorker.getRegistration('/'));
  if (!registration) return;
  for (const notification of await within(registration.getNotifications())) notification.close();
  const subscription = await within(registration.pushManager.getSubscription());
  if (subscription && !await within(subscription.unsubscribe())) throw new Error('Browser subscription could not be removed. Retry Disable on this device.');
}
async function revoke(value: DeviceBinding) {
  const confirmed = await rpc<boolean>('revoke_my_web_push_subscription', { p_id: value.id, p_generation: value.generation }, value.owner);
  if (!confirmed) throw new Error('Device cleanup is pending. Sign in to the original account and retry Disable on this device.');
  save(pendingKey, stored<DeviceBinding[]>(pendingKey, []).filter(row => row.id !== value.id));
}
async function cleanup(account: string | null, expectedId?: string) {
  const current = binding();
  if (expectedId && current?.id !== expectedId) return;
  if (current) { tombstone(current); localStorage.removeItem(storageKey); }
  let error: unknown;
  // Local unsubscribe remains possible when auth or network is already gone.
  try { await localUnsubscribe(); } catch (cause) { error = cause; }
  await Promise.all(stored<DeviceBinding[]>(pendingKey, []).filter(row => row.owner === account).map(async value => {
    try { await revoke(value); } catch (cause) { error ??= cause; }
  }));
  if (error) throw error;
}
/** Called before explicit sign-out, while the old session is still valid. Never blocks sign-out on failure. */
export async function releasePushDevice() {
  ++epoch;
  const previous = owner;
  owner = null;
  await queue(() => cleanup(previous)).catch(() => {});
}
/** Auth resolution invalidates pending work synchronously; I/O is deferred outside auth callbacks. */
export function setPushAccount(next: string | null) {
  if (owner === next && (next !== null || !binding())) return;
  owner = next;
  ++epoch;
  void queue(async () => {
    if (owner !== next) return;
    const current = binding();
    if ((current && current.owner !== next) || !next) await cleanup(next);
    if (next) {
      for (const value of stored<DeviceBinding[]>(pendingKey, []).filter(row => row.owner === next)) await revoke(value);
    }
  }).catch(() => {});
}
export async function inspectPushDevice(account: string): Promise<PushState> {
  const support = deviceSupport();
  const result: PushState = { ...support, registered: false, configured: false, error: '' };
  if (!support.supported) return result;
  try {
    const config = await rpc<PushConfiguration | null>('get_my_web_push_configuration');
    result.configured = Boolean(config?.public_key);
    const current = binding();
    if (current?.owner !== account) {
      const pending = stored<DeviceBinding[]>(pendingKey, []);
      if (pending.length) result.error = pending.some(row => row.owner === account)
        ? 'Device cleanup is pending. Check your connection and choose Disable on this device to retry.'
        : 'Cleanup for a previous account is pending. Sign in to that account and choose Disable on this device.';
      return result;
    }
    const registration = await within(navigator.serviceWorker.getRegistration('/'));
    const subscription = await registration?.pushManager.getSubscription();
    if (support.permission !== 'granted' || !subscription || (subscription.expirationTime !== null && subscription.expirationTime <= Date.now())) {
      await queue(() => cleanup(account, current.id));
      return result;
    }
    const status = await rpc<{ enabled: boolean; generation: number } | null>('get_my_web_push_subscription', { p_id: current.id });
    result.registered = status?.enabled === true && status.generation === current.generation;
    if (!result.registered) await queue(() => cleanup(account, current.id));
  } catch (cause) { result.error = cause instanceof Error ? cause.message : 'Unable to check this device.'; }
  return result;
}
export function enablePushDevice(account: string, config: PushConfiguration) {
  const support = deviceSupport();
  if (!support.supported || support.needsInstall) return Promise.reject(new Error('Open the installed Home Screen app to enable notifications.'));
  if (owner !== account) return Promise.reject(new Error('Verify your account before enabling notifications.'));
  if (!config.public_key) return Promise.reject(new Error('Device registration is not configured yet.'));
  const request = epoch;
  // Start permission request synchronously in the click stack, before any await.
  const permission = Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission);
  return permission.then(answer => {
    if (answer !== 'granted') throw new Error('Notifications are not allowed. Change the permission in browser or iPhone Settings, then retry.');
    return queue(async () => {
      const valid = () => request === epoch && owner === account;
      if (!valid()) throw new Error('Your account changed. Please retry.');
      try {
        // Always create a fresh local subscription after an account change or failed registration.
        await cleanup(account);
        if (!valid()) throw new Error('Your account changed. Please retry.');
        const registration = await preparePushWorker();
        const key = Uint8Array.from(atob(config.public_key.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));
        const subscription = await within(registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
        if (!valid()) { await localUnsubscribe(); throw new Error('Your account changed. Please retry.'); }
        const provisional: DeviceBinding = { id: crypto.randomUUID(), generation: 1, owner: account };
        // Persist only an opaque ID before the RPC: timeout may mean server accepted it.
        tombstone(provisional);
        const registered = await rpc<{ id: string; generation: number }>('register_my_web_push_subscription', {
          p_id: provisional.id, p_environment: config.environment, p_key_version: config.key_version, p_subscription: subscription.toJSON(),
        }, account);
        const value = { ...registered, owner: account };
        if (!valid()) { tombstone(value); await revoke(value).catch(() => {}); await localUnsubscribe(); throw new Error('Your account changed. Please retry.'); }
        save(storageKey, value);
        save(pendingKey, stored<DeviceBinding[]>(pendingKey, []).filter(row => row.id !== provisional.id));
      } catch (cause) { await cleanup(account).catch(() => {}); throw cause; }
    });
  });
}
export async function pushConfiguration() { return rpc<PushConfiguration | null>('get_my_web_push_configuration'); }
export function disablePushDevice(account: string) { ++epoch; return queue(() => cleanup(account)); }
