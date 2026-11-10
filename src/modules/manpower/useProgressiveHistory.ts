'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateManpowerEntries, loadManpowerEntryCount, loadManpowerGroupFacts } from './manpower';
import { nextHistoryBatch, orderHistoryGroups, UNGROUPED_HISTORY_KEY } from './progressive-history';
import type { ManpowerEntry, ManpowerReference, ManpowerReportingGroup } from './types';

function yieldToOperator(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const clear = () => { clearTimeout(timer); document.removeEventListener('visibilitychange', schedule); signal.removeEventListener('abort', abort); };
    const abort = () => { clear(); reject(new DOMException('Aborted', 'AbortError')); };
    const schedule = () => { clearTimeout(timer); if (!document.hidden) timer = setTimeout(() => { clear(); resolve(); }, 32); };
    document.addEventListener('visibilitychange', schedule); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else schedule();
  });
}
export function useProgressiveHistory({ revision, enabled, priority, workers, tasks, groups, publish, entryCount, isCurrent }: {
  revision: number; enabled: boolean; priority: Set<string>; workers: ManpowerReference[]; tasks: ManpowerReference[]; groups: ManpowerReportingGroup[];
  publish(entries: ManpowerEntry[]): void; entryCount(): number; isCurrent(revision: number): boolean;
}) {
  const context = useRef({ priority, workers, tasks, groups });
  useLayoutEffect(() => { context.current = { priority, workers, tasks, groups }; }, [priority, workers, tasks, groups]);
  const complete = useRef(new Set<string>()), ordered = useRef<string[]>([]), initialized = useRef(-1);
  const [keys, setKeys] = useState<Set<string>>(() => new Set()), [order, setOrder] = useState<string[]>([]);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [retryToken, setRetryToken] = useState(0);
  useEffect(() => {
    const request = new AbortController(); let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active || !isCurrent(revision)) return;
      if (initialized.current !== revision) {
        initialized.current = revision; complete.current = new Set(); ordered.current = [];
        setKeys(new Set()); setOrder([]); setReady(false); setError('');
      }
      if (!enabled) { setLoading(false); return; }
      if (!ordered.current.length) ordered.current = [...orderHistoryGroups(context.current.groups), UNGROUPED_HISTORY_KEY];
      setLoading(true); setError('');
      while (active) {
        const batch = nextHistoryBatch(ordered.current, context.current.priority, complete.current);
        if (!batch.length) break;
        await yieldToOperator(request.signal);
        const facts = await loadManpowerGroupFacts(batch, request.signal);
        if (!active || !isCurrent(revision)) return;
        const refs = context.current;
        publish(hydrateManpowerEntries(facts, refs.workers, refs.tasks, refs.groups));
        batch.forEach(key => complete.current.add(key));
        setKeys(new Set(complete.current)); setOrder(current => [...current, ...batch.filter(key => !current.includes(key))]);
      }
      const count = await loadManpowerEntryCount(request.signal);
      if (!active || !isCurrent(revision)) return;
      if (count !== entryCount()) throw new Error('History changed or some reporting groups are unavailable. Refresh reporting to reconcile complete history.');
      setReady(true);
    })().catch(caught => { if (active && isCurrent(revision)) setError(caught instanceof Error ? caught.message : 'Unable to load older reporting groups.'); })
      .finally(() => { if (active && isCurrent(revision)) setLoading(false); });
    return () => { active = false; request.abort(); };
  }, [revision, enabled, retryToken, publish, entryCount, isCurrent]);
  const register = useCallback((key: string) => {
    complete.current.add(key); setKeys(new Set(complete.current));
    setOrder(current => current.includes(key) ? current : [key, ...current]);
  }, []);
  return { keys, order, ready, loading, error, retry: () => setRetryToken(value => value + 1), register };
}
