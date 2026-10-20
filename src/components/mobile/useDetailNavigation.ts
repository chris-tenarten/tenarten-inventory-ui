'use client';
import { useCallback, useEffect, useRef } from 'react';

/** A same-route history entry keeps Back inside a detail surface. No draft or domain state lives here. */
export function useDetailNavigation(allowClose: () => boolean, onClose: () => void) {
  const latest = useRef({allowClose, onClose});
  useEffect(() => { latest.current = {allowClose, onClose}; });
  const token = useRef<string | null>(null);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 767px), (max-width: 1023px) and (pointer: coarse)').matches) return;
    const id = crypto.randomUUID();
    token.current = id;
    const prior = history.state;
    const viewport = window.visualViewport;
    const measure = () => {
      document.documentElement.style.setProperty('--tenops-detail-height', `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--tenops-detail-top', `${viewport?.offsetTop ?? 0}px`);
    };
    measure();
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    history.pushState({...prior, tenopsDetail: id}, '', location.href);
    const pop = () => {
      if (history.state?.tenopsDetail === id) return;
      if (!latest.current.allowClose()) { history.forward(); return; }
      token.current = null;
      latest.current.onClose();
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || link.target === '_blank' || link.hasAttribute('download') || link.getAttribute('href')?.startsWith('#')) return;
      if (!latest.current.allowClose()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const leave = (event: Event) => { if (!latest.current.allowClose()) event.preventDefault(); };
    window.addEventListener('tenops:detail-leave', leave);
    window.addEventListener('popstate', pop);
    document.addEventListener('click', navigate, true);
    return () => {
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      document.documentElement.style.removeProperty('--tenops-detail-height');
      document.documentElement.style.removeProperty('--tenops-detail-top');
      window.removeEventListener('tenops:detail-leave', leave);
      window.removeEventListener('popstate', pop);
      document.removeEventListener('click', navigate, true);
      if (history.state?.tenopsDetail === id) history.replaceState(prior, '', location.href);
      token.current = null;
    };
  }, []);
  return useCallback(() => {
    if (token.current && history.state?.tenopsDetail === token.current) history.back();
    else if (latest.current.allowClose()) latest.current.onClose();
  }, []);
}
