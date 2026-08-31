'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Hammer, ToolCase } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const toolboxMenuSections = [
  { label: 'Tools', items: [
    { href: '/proposals', label: 'Proposal Generator' },
    { href: '/purchasing', label: 'PO Generator' },
    { href: '/transmittals', label: 'Letter of Transmittal' },
  ] },
  { label: 'Resources', items: [{ href: '/catalog', label: 'Catalog' }] },
];

export default function ToolboxLauncher() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [isOpen]);

  return <div ref={rootRef} className="relative shrink-0">
    <button type="button" aria-label="Open Toolbox" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${isOpen ? 'border-slate-400 bg-slate-50 text-slate-950' : ''}`}>
      <ToolCase className="h-4 w-4" />
      Toolbox
    </button>
    {isOpen && <div className="absolute right-0 top-full z-50 mt-1 w-[min(19rem,calc(100vw-1.5rem))]">
      <div role="menu" className="border border-slate-300 bg-white py-1 shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
        {toolboxMenuSections.map((section, sectionIndex) => <div key={section.label} className={sectionIndex ? 'border-t border-slate-200 pt-1' : ''}>
          <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {section.label === 'Tools' ? <Hammer className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
            {section.label}
          </div>
          {section.items.map((item) => <Link key={item.href} role="menuitem" href={item.href} onClick={() => setIsOpen(false)} className={`block min-h-11 px-4 py-3 text-sm font-bold transition ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'bg-slate-100 text-slate-950' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'}`}>{item.label}</Link>)}
        </div>)}
      </div>
    </div>}
  </div>;
}
