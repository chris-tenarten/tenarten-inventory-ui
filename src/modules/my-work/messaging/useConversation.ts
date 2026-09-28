import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { loadMessagePage, type InboxMessage, type MessageCursor } from '../inbox';
import { RecentThreads } from './recentThreads';
import { IntentPrefetch } from './intentPrefetch';

// GlobalMessaging remounts its error boundary on close/presentation changes.
// Keep only this bounded account-owned cache across those mounts.
const recentThreads = new RecentThreads();
const intentPrefetch = new IntentPrefetch(recentThreads, loadMessagePage);
supabase.auth.onAuthStateChange((_event, session) => {
  const owner = session?.user.id ?? '';
  recentThreads.reset(owner); intentPrefetch.reset(owner);
});

export function mergeMessages(current: InboxMessage[], rows: InboxMessage[], removed: string[] = []) {
  const map = new Map(current.filter(row => !removed.includes(row.id)).map(row => [row.id, row]));
  for (const row of rows) map.set(row.id, row);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
type Stream = {
  owner: string; peer: string; alive: boolean; tail: Promise<void>; messages: InboxMessage[];
  cursor?: MessageCursor; older: boolean; loadedOlder: boolean; pending: Set<string>;
  authoritative: boolean; scheduled: boolean; timer?: ReturnType<typeof setTimeout>; fallback?: ReturnType<typeof setTimeout>;
};
const stream = (owner = '', peer = ''): Stream => ({ owner, peer, alive: !!owner && !!peer,
  tail: Promise.resolve(), messages: [], older: false, loadedOlder: false, pending: new Set(), authoritative: false, scheduled: false });

/** Serial authoritative reads; cached content never waits for channel establishment. */
export function useConversation(peer: string, owner: string, onError: (message: string) => void) {
  const cache = useRef(recentThreads);
  const state = useRef<Stream>(stream());
  const [view, setView] = useState({ owner: '', peer: '', messages: [] as InboxMessage[], loading: false, hasOlder: false });
  const publish = useCallback((s: Stream, loading?: boolean) => {
    if (!s.alive || state.current !== s) return;
    if (s.authoritative) cache.current.put(s.owner, s.peer, s.messages, s.older);
    setView(previous => ({ owner: s.owner, peer: s.peer, messages: s.messages,
      hasOlder: s.older, loading: loading ?? previous.loading }));
  }, []);
  const enqueue = useCallback((task: (s: Stream) => Promise<void>) => {
    const s = state.current;
    if (!s.alive) return Promise.resolve();
    s.tail = s.tail.then(async () => { if (s.alive) await task(s); }).catch(error => {
      if (s.alive) onError(error instanceof Error ? error.message : 'Unable to load conversation.');
    });
    return s.tail;
  }, [onError]);
  const refresh = useCallback(() => {
    clearTimeout(state.current.fallback);
    return enqueue(async s => {
      publish(s, true);
      try {
        const prefetched = !s.authoritative ? intentPrefetch.take(s.owner, s.peer) : undefined;
        const rows = await (prefetched ?? loadMessagePage(s.peer));
        if (!s.alive) return;
        // Replace the authoritative recent interval, retaining loaded older pages.
        const boundary = rows[0];
        const overlaps = rows.some(row => s.messages.some(existing => existing.id === row.id));
        const retained = s.loadedOlder && overlaps && rows.length === 40 && boundary
          ? s.messages.filter(row => row.createdAt < boundary.createdAt || (row.createdAt === boundary.createdAt && row.id < boundary.id)) : [];
        // Revalidate retained IDs after a reconnect: edits/deletions while
        // disconnected must not survive indefinitely in older loaded pages.
        const authoritativeOlder: InboxMessage[] = [];
        for (let i = 0; i < retained.length; i += 40) {
          authoritativeOlder.push(...await loadMessagePage(s.peer, undefined, retained.slice(i, i + 40).map(row => row.id)));
          if (!s.alive) return;
        }
        s.messages = mergeMessages(authoritativeOlder, rows); s.authoritative = true;
        if (!s.loadedOlder || !overlaps || rows.length < 40) { s.cursor = rows[0]; s.older = rows.length === 40; s.loadedOlder = false; }
      } catch (error) {
        // Failed authorization must not leave cached private content visible.
        if (s.alive) { s.messages = []; s.older = false; s.authoritative = false; cache.current.remove(s.peer); }
        throw error;
      } finally { publish(s, false); }
    });
  }, [enqueue, publish]);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === state.current.owner) return;
      const s = state.current;
      s.alive = false; clearTimeout(s.timer); clearTimeout(s.fallback);
      cache.current.reset(session?.user.id ?? '');
      setView({ owner: '', peer: '', messages: [], loading: false, hasOlder: false });
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    // Cache ownership follows Auth events, never a possibly stale component prop.
    intentPrefetch.cancel();
    if (!owner) { cache.current.clear(); intentPrefetch.reset(''); }
    const s = stream(owner, peer); state.current = s;
    const cached = cache.current.get(owner, peer);
    if (cached) { s.authoritative = true; s.messages = cached.messages; s.older = cached.hasOlder; s.cursor = s.messages[0]; }
    setView({ owner, peer, messages: s.messages, loading: s.alive, hasOlder: s.older });
    if (s.alive) {
      // Warm content is immediately usable; one post-join read closes the event
      // gap. A fallback also refreshes if Realtime cannot establish a channel.
      if (cached) s.fallback = setTimeout(() => { if (s.alive) void refresh(); }, 750);
      else void refresh();
    }
    return () => { intentPrefetch.cancel(); s.alive = false; s.pending.clear(); clearTimeout(s.timer); clearTimeout(s.fallback); };
  }, [owner, peer, refresh]);
  const setMessages = useCallback((update: SetStateAction<InboxMessage[]>) => {
    const s = state.current;
    if (!s.alive || s.owner !== owner || s.peer !== peer) return;
    s.messages = typeof update === 'function' ? update(s.messages) : update;
    publish(s);
  }, [owner, peer, publish]);
  const reconcile = useCallback((id: string, existingOnly = false) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    const s = state.current;
    if (!s.alive || (existingOnly && !s.messages.some(row => row.id === id))) return;
    s.pending.add(id);
    if (s.scheduled) return;
    s.scheduled = true;
    s.timer = setTimeout(() => {
      s.scheduled = false;
      if (!s.alive) return;
      const ids = [...s.pending]; s.pending.clear();
      void enqueue(async current => {
        if (current !== s) return;
        for (let i = 0; i < ids.length; i += 40) {
          const batch = ids.slice(i, i + 40);
          const rows = await loadMessagePage(s.peer, undefined, batch);
          if (!s.alive) return;
          s.messages = mergeMessages(s.messages, rows, batch.filter(id => !rows.some(row => row.id === id)));
          publish(s);
        }
      });
    }, 60);
  }, [enqueue, publish]);
  const older = useCallback(() => enqueue(async s => {
    if (!s.older || !s.cursor) return;
    publish(s, true);
    try {
      const rows = await loadMessagePage(s.peer, s.cursor);
      if (!s.alive) return;
      s.cursor = rows[0] ?? s.cursor; s.older = rows.length === 40; s.loadedOlder = true;
      s.messages = mergeMessages(s.messages, rows); publish(s);
    } finally { publish(s, false); }
  }), [enqueue, publish]);
  const prefetch = useCallback((target: string) => {
    if (target !== peer) intentPrefetch.intent(owner, target);
  }, [owner, peer]);
  const cancelPrefetch = useCallback(() => intentPrefetch.cancel(), []);
  const matches = view.owner === owner && view.peer === peer;
  return { prefetch, cancelPrefetch, messages: matches ? view.messages : [], setMessages,
    loading: !matches ? !!peer && !!owner : view.loading, hasOlder: matches && view.hasOlder, older, refresh, reconcile };
}
