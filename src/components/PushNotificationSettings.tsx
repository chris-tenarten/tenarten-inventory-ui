"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { deviceSupport, disablePushDevice, enablePushDevice, inspectPushDevice, preparePushWorker, pushConfiguration, type PushConfiguration, type PushState } from '@/lib/web-push';

export default function PushNotificationSettings() {
  const auth = useAuth();
  const account = auth.accessAllowed ? auth.profile?.userId : undefined;
  const [state, setState] = useState<PushState | null>(null);
  const [config, setConfig] = useState<PushConfiguration | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!account) { setState(null); setConfig(null); return; }
    const support = deviceSupport();
    const next = await inspectPushDevice(account);
    const configuration = support.supported ? await pushConfiguration().catch(() => null) : null;
    if (generation.current !== request) return;
    setState(next); setConfig(configuration);
    // Ready before a future click; no permission request or subscription on mount.
    if (next.supported && !next.needsInstall && configuration) await preparePushWorker().catch(() => {});
  }, [account]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      // Generation counter, not a DOM ref: invalidate pending account work.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current; window.clearTimeout(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh]);
  function change(enable: boolean) {
    if (!account || busy) return;
    const request = generation.current;
    setBusy(true); setMessage('');
    const work = enable && config ? enablePushDevice(account, config) : disablePushDevice(account);
    void work.then(() => { if (request === generation.current) setMessage(enable ? 'This device is registered. Message delivery is not active yet.' : 'Notifications are disabled on this device.'); })
      .catch(cause => { if (request === generation.current) setMessage(cause instanceof Error ? cause.message : 'Unable to update this device.'); })
      .finally(() => { setBusy(false); void refresh(); });
  }
  return <section id="notifications" className="mt-6 scroll-mt-20 border border-slate-300 bg-white p-4" aria-labelledby="push-settings-title">
    <h2 id="push-settings-title" className="text-lg font-bold text-slate-950">Device notifications</h2>
    <p className="mt-1 text-sm text-slate-600">Prepare this device for direct-message notifications. Message delivery is not active yet.</p>
    {!account ? <p className="mt-3 text-sm text-slate-600">Sign in with an active TenOps account to manage this device.</p> : !state ? <p role="status" className="mt-3 text-sm">Checking this device…</p> : <>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="font-semibold">Browser</dt><dd>{state.supported ? 'Supported' : 'Not supported'}</dd></div>
        <div><dt className="font-semibold">Installation</dt><dd>{state.installed ? 'Home Screen app' : state.needsInstall ? 'Home Screen installation needed' : 'Browser tab'}</dd></div>
        <div><dt className="font-semibold">Permission</dt><dd>{state.permission === 'default' ? 'Not requested' : state.permission === 'granted' ? 'Allowed' : state.permission === 'denied' ? 'Blocked' : 'Unavailable'}</dd></div>
      </dl>
      <p className="mt-3 text-sm font-semibold">{state.registered ? 'Registered on this device' : 'Not registered on this device'}</p>
      {state.needsInstall ? <p className="mt-2 text-sm text-slate-600">In Safari, open Share, choose Add to Home Screen, then open TenOps from its Home Screen icon.</p> : null}
      {state.permission === 'denied' ? <p className="mt-2 text-sm text-slate-600">Allow notifications in your browser settings or iPhone Settings → Notifications for this Home Screen app. Return here and retry.</p> : null}
      {!state.configured && state.supported ? <p className="mt-2 text-sm text-slate-600">Device registration is not available in this environment yet. You can still disable an existing registration.</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !state.supported || state.needsInstall || state.permission === 'denied' || !config || state.registered} onClick={() => change(true)} className="min-h-11 border border-blue-700 bg-blue-50 px-3 text-sm font-semibold text-blue-900 disabled:opacity-50">{busy ? 'Updating…' : 'Enable notifications on this device'}</button>
        <button type="button" disabled={busy} onClick={() => change(false)} className="min-h-11 border border-slate-400 px-3 text-sm font-semibold disabled:opacity-50">Disable on this device</button>
        <button type="button" disabled={busy} onClick={() => { setMessage(''); void refresh(); }} className="min-h-11 px-3 text-sm font-semibold underline">Check again</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">This setting applies to this installation only. Other devices are managed separately. In-app notifications remain available.</p>
      {state.error ? <p role="status" className="mt-3 text-sm text-amber-800">{state.error}</p> : null}
    </>}
    {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
  </section>;
}
