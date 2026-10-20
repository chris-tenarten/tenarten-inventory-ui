'use client';
import {useEffect} from 'react';
/** Bridges existing module draft state to the mobile shell; owns no draft or persistence. */
export function useMobileNavigationGuard(dirty: boolean, busy = false) {
  useEffect(() => {
    const mobile = () => window.matchMedia('(max-width:767px), (max-width:1023px) and (pointer:coarse)').matches;
    const unload = (event: BeforeUnloadEvent) => { if (mobile() && (dirty || busy)) {event.preventDefault();event.returnValue='';} };
    const block = (event: Event) => { if (mobile() && busy) event.preventDefault(); };
    window.addEventListener('beforeunload',unload);
    window.addEventListener('tenops:mobile-navigation',block);
    return () => {window.removeEventListener('beforeunload',unload);window.removeEventListener('tenops:mobile-navigation',block);};
  },[dirty,busy]);
}
