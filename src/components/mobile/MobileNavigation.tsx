'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Factory, ListTodo, Menu, X } from 'lucide-react';
import { useDetailNavigation } from './useDetailNavigation';
// Reuse module-owned unload guards for SPA links; never infer whether a business form is dirty.
export function guardMobileNavigation(event: React.MouseEvent) {
  if (!window.matchMedia('(max-width:767px), (max-width:1023px) and (pointer:coarse)').matches || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!link || link.target === '_blank' || link.hasAttribute('download') || link.origin !== location.origin || (link.pathname === location.pathname && link.search === location.search && link.hash)) return;
  if (document.querySelector('[data-mobile-detail]')) return;
  if (!window.dispatchEvent(new Event('tenops:mobile-navigation', {cancelable:true}))) {event.preventDefault();event.stopPropagation();return;}
  const probe = new Event('beforeunload', {cancelable:true});
  if (!window.dispatchEvent(probe) && !window.confirm('Leave this page and discard unsaved changes?')) {event.preventDefault();event.stopPropagation();}
}
type Destination = {href: string; label: string};
function More({items, onClose}: {items: Destination[]; onClose(): void}) {
  const router = useRouter();
  const pendingHref = useRef<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const close = useDetailNavigation(() => true, () => { onClose(); if (pendingHref.current) router.push(pendingHref.current); });
  useEffect(() => { const opener = document.activeElement as HTMLElement | null; root.current?.querySelector('button')?.focus(); return () => opener?.focus(); }, []);
  return <section ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...root.current!.querySelectorAll<HTMLElement>('button,a[href]')];
    if (event.shiftKey && document.activeElement === controls[0]) {event.preventDefault();controls.at(-1)?.focus();}
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) {event.preventDefault();controls[0]?.focus();}
  }} className="mobile-more" role="dialog" aria-modal="true" aria-label="More destinations">
    <header><strong>More</strong><button onClick={close} aria-label="Close More"><X size={20}/></button></header>
    <div>{items.map(item => <Link href={item.href} key={item.href} onClick={event => { if (event.defaultPrevented) return; event.preventDefault(); pendingHref.current = item.href; close(); }}>{item.label}</Link>)}</div>
  </section>;
}
export default function MobileNavigation({items}: {items: Destination[]}) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const jobs = path === '/' || path.startsWith('/production');
  const work = path.startsWith('/my-work');
  return <>
    <nav data-mobile-navigation aria-label="Mobile navigation">
      <Link href="/" aria-current={jobs && !more ? 'page' : undefined}><Factory size={20}/>Jobs</Link>
      <Link href="/my-work" aria-current={work && !more ? 'page' : undefined}><ListTodo size={20}/>My Work</Link>
      <span aria-hidden="true"/>{/* The existing persistent Messaging instance occupies this slot. */}
      <button aria-expanded={more} aria-current={more || (!jobs && !work) ? 'page' : undefined} onClick={() => setMore(v => !v)}><Menu size={20}/>More</button>
    </nav>
    {more && <More items={items} onClose={() => setMore(false)}/>}
  </>;
}
