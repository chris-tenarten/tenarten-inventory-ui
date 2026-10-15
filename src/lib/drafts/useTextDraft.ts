'use client';
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { TextDraft } from './textDraft';
export function useTextDraft(owner: string, workflow: string, record: string, open = true) {
  const draft = useMemo(() => new TextDraft(owner, workflow, record), [owner, workflow, record]);
  const [, render] = useReducer(n => n + 1, 0);
  const setText = useCallback((text: string) => { draft.set(text); render(); }, [draft]);
  useEffect(() => {
    const timer = setTimeout(() => draft.flush(), 400);
    return () => clearTimeout(timer);
  }, [draft, draft.text]);
  useEffect(() => {
    const flush = () => draft.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => { flush(); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); };
  }, [draft]);
  useEffect(() => { if (!open) draft.flush(); }, [draft, open]);
  useEffect(() => {
    const completed = (event: Event) => {
      const detail = (event as CustomEvent<{key:string;record:string;revision:string}>).detail;
      if (detail.key === draft.key && detail.record === draft.record && draft.clearSent(detail.revision)) render();
    };
    window.addEventListener('tenops:text-draft-sent', completed);
    return () => window.removeEventListener('tenops:text-draft-sent', completed);
  }, [draft]);
  const captureSend = useCallback(() => {
    const revision = draft.snapshot();
    draft.flush();
    return () => {
      if (draft.clearSent(revision)) render();
      window.dispatchEvent(new CustomEvent('tenops:text-draft-sent', {detail:{key:draft.key,record:draft.record,revision}}));
    };
  }, [draft]);
  return { text: draft.text, setText, captureSend };
}
