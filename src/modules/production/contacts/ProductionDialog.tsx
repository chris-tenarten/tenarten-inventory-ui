'use client';

import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';

let scrollLocks = 0;
let originalOverflow = '';

export function useProductionDialogScrollLock() {
  useEffect(() => {
    if (scrollLocks++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (--scrollLocks === 0) document.body.style.overflow = originalOverflow;
    };
  }, []);
}

/** Native top-layer modality owns focus/inertness; nested dialogs never dismiss ancestors. */
export default function ProductionDialog({ children, label, labelledBy, onDismiss, className = '', returnFocusRef, fallbackFocusRef }: {
  children: ReactNode; label?: string; labelledBy?: string; onDismiss: () => void; className?: string;
  returnFocusRef?: RefObject<HTMLElement | null>; fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pointerStartedOnBackdrop = useRef(false);
  useProductionDialogScrollLock();
  useEffect(() => {
    const node = dialog.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const explicitOpener = returnFocusRef?.current;
    const fallback = fallbackFocusRef?.current;
    node.showModal();
    return () => {
      node.close();
      requestAnimationFrame(() => {
        if (node.isConnected && node.open) return; // React development effect replay.
        const target = [explicitOpener, fallback, opener]
          .find(element => element?.isConnected && !element.matches(':disabled'));
        target?.focus();
      });
    };
  }, [returnFocusRef, fallbackFocusRef]);
  function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  }
  return <dialog ref={dialog} aria-modal="true" aria-label={label} aria-labelledby={labelledBy}
    className={`m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto border border-slate-400 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm ${className}`}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const fields = [...event.currentTarget.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,summary,[tabindex]')]
        .filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = fields[0], last = fields.at(-1);
      if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !event.currentTarget.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    }}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onDismiss(); }}
    onMouseDown={event => { event.stopPropagation(); pointerStartedOnBackdrop.current = isBackdrop(event); }}
    onClick={event => { event.stopPropagation(); if (pointerStartedOnBackdrop.current && isBackdrop(event)) onDismiss(); pointerStartedOnBackdrop.current = false; }}>
    {children}
  </dialog>;
}
