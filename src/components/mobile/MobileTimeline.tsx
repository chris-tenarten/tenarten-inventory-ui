'use client';
import { useEffect, useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { formatScheduleDate } from '@/modules/production/schedule';
import { dayDistance, shiftedDate } from '@/modules/pre-production/planning-viewport';
import { productionStatusVisuals } from '@/modules/production/status-visuals';
import { useDetailNavigation } from './useDetailNavigation';
import './mobile-timeline.css';
export type MobileTimelineRow = {
  key: string; title: string; reference: string; status: string;
  start: string | null; end: string | null; projected?: boolean; staged?: boolean;
  visual?: {className: string; pattern?: string};
  markers: {id: string; title: string; start: string; end: string; visual?: CSSProperties; className?: string; meaning: string}[];
  open(): void;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
function Surface({rows, title, onClose}: {rows: MobileTimelineRow[]; title: string; onClose(): void}) {
  const afterClose = useRef<(() => void) | null>(null);
  const close = useDetailNavigation(() => true, () => { onClose(); if (afterClose.current) window.setTimeout(afterClose.current, 0); });
  const [today] = useState(() => formatScheduleDate(new Date()));
  const [camera, setCamera] = useState({start: -3, scale: 28, y: 0});
  const [selected, setSelected] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [size, setSize] = useState({width: 320, height: 400});
  const map = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const points = useRef(new Map<number, {x: number; y: number}>());
  const gesture = useRef<{x: number; y: number; distance: number; camera: typeof camera; moved: boolean; target: string | null} | null>(null);
  const current = useRef(camera);
  useEffect(() => { current.current = camera; }, [camera]);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (hold.current) clearTimeout(hold.current); prior?.focus(); };
  }, []);
  useEffect(() => {
    const el = map.current;
    if (!el) return;
    const measure = () => setSize({width:el.clientWidth,height:el.clientHeight});
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [keyOpen]);
  const rail = size.width < 360 ? 88 : 108, rowHeight = 94;
  const update = (next: typeof camera) => setCamera({...next, start: clamp(next.start, -3650, 3650), scale: clamp(next.scale, 4, 80), y: clamp(next.y, 0, Math.max(0, rows.length * rowHeight - size.height + 36))});
  function baseline(target: string | null = null) {
    const p = [...points.current.values()];
    if (!p.length) { gesture.current = null; return; }
    gesture.current = {x: p.reduce((n,p) => n+p.x,0)/p.length, y: p.reduce((n,p) => n+p.y,0)/p.length, distance: p.length > 1 ? Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y) : 0, camera: current.current, moved: p.length > 1, target};
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < 12 || event.clientX > window.innerWidth - 12) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    points.current.set(event.pointerId, {x: event.clientX-rect.left-rail, y: event.clientY-rect.top});
    const target = (event.target as Element).closest<HTMLElement>('[data-mobile-row]')?.dataset.mobileRow ?? null;
    baseline(target);
    if (hold.current) clearTimeout(hold.current);
    if (points.current.size === 1 && target) hold.current = setTimeout(() => { if (!gesture.current?.moved) setSelected(target); },500);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!points.current.has(event.pointerId) || !gesture.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    points.current.set(event.pointerId, {x: event.clientX-rect.left-rail, y: event.clientY-rect.top});
    const p = [...points.current.values()], g = gesture.current;
    const x = p.reduce((n,p) => n+p.x,0)/p.length, y = p.reduce((n,p) => n+p.y,0)/p.length;
    if (Math.hypot(x-g.x,y-g.y) > 8) g.moved = true;
    if (!g.moved) return;
    if (hold.current) clearTimeout(hold.current);
    const scale = p.length > 1 && g.distance ? clamp(g.camera.scale*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/g.distance,4,80) : g.camera.scale;
    update({start: g.camera.start+g.x/g.camera.scale-x/scale, scale, y: g.camera.y-(y-g.y)});
  }
  function up(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    if (!points.current.has(event.pointerId)) return;
    const g = gesture.current;
    if (hold.current) clearTimeout(hold.current);
    if (!cancelled && points.current.size === 1 && g && !g.moved && g.target) setSelected(g.target);
    points.current.delete(event.pointerId);
    baseline();
    if (gesture.current) gesture.current.moved = true;
  }
  const row = rows.find(r => r.key === selected);
  const zoom = (factor: number) => { const center = (size.width-rail)/2; const scale = clamp(camera.scale*factor,4,80); update({...camera, scale, start: camera.start+center/camera.scale-center/scale}); };
  const first = Math.max(0,Math.floor(camera.y/rowHeight)), last = Math.min(rows.length,Math.ceil((camera.y+size.height)/rowHeight));
  const step = camera.scale >= 24 ? 1 : camera.scale >= 10 ? 7 : 28;
  return createPortal(<section ref={root} className="mobile-timeline" role="dialog" aria-modal="true" aria-label={`${title} full-screen Timeline`} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); if (keyOpen) setKeyOpen(false); else close(); }
    if (event.key === 'Tab') { const controls = [...root.current!.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')]; if(event.shiftKey && document.activeElement === controls[0]) {event.preventDefault(); controls.at(-1)?.focus();} else if(!event.shiftKey && document.activeElement === controls.at(-1)) {event.preventDefault();controls[0]?.focus();} }
  }}>
    <header><button onClick={close}>Exit</button><strong>{title}</strong><button aria-expanded={keyOpen} onClick={() => setKeyOpen(v => !v)}>Key</button></header>
    <div className="mt-controls"><button onClick={() => update({...camera,start:-3})}>Today</button><button aria-label="Zoom out" onClick={() => zoom(1/1.5)}>−</button><span>{camera.scale >= 24 ? 'Days' : camera.scale >= 10 ? 'Weeks' : 'Months'}</span><button aria-label="Zoom in" onClick={() => zoom(1.5)}>+</button></div>
    {keyOpen ? <div className="mt-key"><p>Pan in any direction. Pinch to change the date scale. Tap a row to select. Gestures never change schedule dates.</p><p>Projected Bid windows reserve no capacity. Production references in Bids remain view only. Amber outlines mark staged schedules; saving and approval stay in Production.</p>{productionStatusVisuals.map(v => <p key={v.value}><i className={v.className} style={{backgroundImage:v.pattern}}/>{v.label}</p>)}<p>Colored strips: planning phases. Black/white hatch: pause. Violet marker: requested delivery, only when no complete Production schedule exists. Open details for full indicator meaning and editing controls.</p><button onClick={() => setKeyOpen(false)}>Back to Timeline</button></div> : <>
    <div ref={map} className="mt-map" onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e)} onPointerCancel={e => up(e,true)} onLostPointerCapture={e => up(e,true)}>
      <div className="mt-ruler" style={{left:rail}}>{Array.from({length:Math.ceil((size.width-rail)/camera.scale/step)+2},(_,i) => {const day=Math.floor(camera.start/step)*step+i*step;return <span key={day} style={{left:(day-camera.start)*camera.scale}}>{shiftedDate(today,day).slice(5)}</span>;})}</div>
      <div className="mt-names" style={{width:rail}}>Record</div>
      {rows.slice(first,last).map((r,i) => <div key={r.key} data-mobile-row={r.key} className={`mt-row ${r.key===selected?'mt-selected':''}`} style={{top:36+(first+i)*rowHeight-camera.y,height:rowHeight}}>
        <button className="mt-identity" style={{width:rail}} onClick={e => {if(e.detail===0)setSelected(r.key);}} aria-label={`Select ${r.title}`}><b>{r.reference}</b><span>{r.title}</span><small>{r.projected?'Projected Bid':r.status}</small></button>
        <div className="mt-chart" style={{left:rail}}>
          {r.start && r.end ? <div data-mobile-schedule-bar className={`mt-bar ${r.projected?'mt-projected':r.visual?.className??''} ${r.staged?'mt-staged':''}`} style={{left:(dayDistance(today,r.start)-camera.start)*camera.scale,width:(dayDistance(r.start,r.end)+1)*camera.scale,backgroundImage:r.visual?.pattern}}><span>{r.title}</span></div> : <span className="mt-undated">No complete dates</span>}
          {r.markers.map(m => <div className={`mt-marker ${m.className??''}`} key={m.id} title={`${m.title} · ${m.meaning}`} style={{...m.visual,left:(dayDistance(today,m.start)-camera.start)*camera.scale,width:Math.max(3,(dayDistance(m.start,m.end)+1)*camera.scale)}}><span>{m.title}</span></div>)}
          <div className="mt-today" style={{left:-camera.start*camera.scale}}/>
        </div>
      </div>)}
      {!rows.length && <p className="mt-empty">No records match the current module filters.</p>}
    </div>
    {row && <section className="mt-selection" aria-label="Selected Timeline record"><div><strong>{row.reference} · {row.title}</strong><button aria-label="Clear selection" onClick={() => setSelected(null)}>×</button></div><p>{row.status}{row.projected?' · Projected only · No capacity reserved':''}{row.staged?' · Staged':''} · {row.start??'No start'} → {row.end??'No end'}</p>{row.markers.length > 0 && <details><summary>Planning &amp; milestones ({row.markers.length})</summary>{row.markers.map(m => <p key={m.id}><b>{m.title}</b> · {m.start} → {m.end}<br/>{m.meaning}</p>)}</details>}<div><button onClick={() => { const index=rows.findIndex(r=>r.key===row.key);update({...camera,start:row.start?dayDistance(today,row.start)-1:camera.start,y:index*rowHeight}); }}>Locate</button><button onClick={() => { afterClose.current = row.open; close(); }}>Open details</button></div></section>}
    </>}
  </section>,document.body);
}
export default function MobileTimeline({rows,title}: {rows: () => MobileTimelineRow[]; title: string}) {
  const [open,setOpen] = useState(false);
  return <><button className="mobile-timeline-launch" onClick={() => setOpen(true)}>Open full-screen Timeline</button>{open && <Surface rows={rows()} title={title} onClose={() => setOpen(false)}/>}</>;
}
