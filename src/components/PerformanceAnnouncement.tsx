'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BRANDING } from '@/lib/dev-branding.mjs';
import { PERFORMANCE_ACTIVATED_AT, PERFORMANCE_RELEASE, ANNOUNCEMENT_DURATION, announcementWindow, localAnnouncementPreview } from '@/lib/performance-announcement.mjs';
import styles from './PerformanceAnnouncement.module.css';

export default function PerformanceAnnouncement() {
  const [visible, setVisible] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 12 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const dismissKey = useRef('');

  useEffect(() => {
    if (BRANDING.showDeveloperArtwork) return;
    const preview = localAnnouncementPreview(location.hostname, location.search);
    const prefix = `tenops.announcement.${PERFORMANCE_RELEASE}${preview ? '.preview' : ''}`;
    dismissKey.current = `${prefix}.dismissed`;
    let dismissed = false;
    try { dismissed = localStorage.getItem(dismissKey.current) === '1'; } catch { /* Optional browser preference. */ }
    const update = () => {
      const active = !dismissed && (preview ? preview.visible : announcementWindow(PERFORMANCE_ACTIVATED_AT, Date.now()));
      setVisible(active);
      if (!active) setOpen(false);
      if (active) {
        try {
          const key = `${prefix}.entered`;
          setAnimate(sessionStorage.getItem(key) !== '1');
          sessionStorage.setItem(key, '1');
        } catch { setAnimate(false); }
      }
    };
    update();
    const onStorage = (event: StorageEvent) => { if (event.key === dismissKey.current || event.key === null) { try { dismissed = localStorage.getItem(dismissKey.current) === '1'; } catch { /* Keep current page preference. */ } update(); } };
    window.addEventListener('storage', onStorage);
    // Only an approved real activation runs a clock. Preview time is frozen.
    const start = PERFORMANCE_ACTIVATED_AT ? Date.parse(PERFORMANCE_ACTIVATED_AT) : NaN;
    let timer: number | undefined;
    const schedule = () => {
      const now = Date.now();
      const remaining = (now < start ? start : start + ANNOUNCEMENT_DURATION) - now;
      if (!preview && Number.isFinite(remaining) && remaining > 0) timer = window.setTimeout(() => { update(); schedule(); }, Math.min(remaining, 2147483647));
    };
    schedule();
    return () => { window.removeEventListener('storage', onStorage); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!open) return;
    popover.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = () => { setOpen(false); trigger.current?.focus(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    const outside = (event: PointerEvent) => { if (!popover.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); };
  }, [open]);

  if (!visible) return null;
  return <div className={styles.root} data-performance-announcement>
    <button ref={trigger} type="button" className={`${styles.trigger} ${animate ? styles.enter : ''}`} aria-label="What's New in TenOps" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'tenops-whats-new' : undefined} onClick={() => {
      const rect = trigger.current!.getBoundingClientRect();
      const headerBottom = trigger.current!.closest('header')?.getBoundingClientRect().bottom ?? rect.bottom;
      setPosition({ top: Math.max(rect.bottom, headerBottom) + 4, left: Math.max(12, Math.min(rect.left, window.innerWidth - 316)) });
      setOpen(!open);
    }}><svg className={styles.bolt} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m13 2-10 12h9l-1 8 10-12h-9l1-8Z" /></svg><span className={styles.label}>UPDATE</span></button>
    {open && createPortal(<div ref={popover} id="tenops-whats-new" role="dialog" aria-labelledby="tenops-whats-new-title" className={styles.popover} style={position}>
      <div className={styles.heading}><h2 id="tenops-whats-new-title">What&apos;s New in TenOps</h2><button type="button" className={styles.close} aria-label="Close What's New" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></div>
      <div className={styles.item}><h3>PERFORMANCE</h3><p>Production and Manpower Reporting now load operational data more efficiently.</p></div>
      <div className={styles.item}><h3>SAMPLE GENERATOR</h3><p>Simplified Sample preparation with practical quantity scaling and easy manual adjustments.</p></div>
      <div className={styles.item}><h3>COLOR PLATE LABELS</h3><p>Generate and print Color Plate labels directly from TenOps.</p></div>
      <button type="button" className={styles.dismiss} onClick={() => { try { localStorage.setItem(dismissKey.current, '1'); } catch { /* Dismiss for this page when storage is blocked. */ } setOpen(false); setVisible(false); }}>Dismiss announcement</button>
    </div>, document.body)}
  </div>;
}
