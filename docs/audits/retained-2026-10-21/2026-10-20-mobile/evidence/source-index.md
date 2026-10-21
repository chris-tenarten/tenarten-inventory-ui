# Responsive source index

Canonical da21615. Selected lexical evidence; absence from this index is not proof of absence.

## src/app/client-layout-shell.tsx (558 lines)

215:         <span className="hidden sm:inline">{label}</span>
220:       <div className={`absolute left-0 top-full z-50 min-w-[280px] pt-1 transition-all duration-150 ${isOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
271:       <span className="hidden sm:inline">{t('nav.myWork')}</span>
522:       <main className="min-h-[calc(100vh-65px)] bg-[#eef1f4] text-slate-950">
529:           <div data-login-gate-body className="flex min-h-[calc(100vh-65px)] items-center justify-center px-3 py-4 sm:px-5 sm:py-10">
## src/app/globals.css (1642 lines)

40: [data-shell-below-header] {
47: html:has([data-shell-below-header]),
48: body:has([data-shell-below-header]) {
59:   height: max(6rem, env(safe-area-inset-top, 0px));
136:   width: max(10.5rem, min(clamp(19rem, 51.25vw, 34.5rem), calc(100dvh - 11rem)));
185:   min-height: 100vh;
186:   min-height: 100dvh;
187:   padding-top: env(safe-area-inset-top);
188:   padding-right: env(safe-area-inset-right);
189:   padding-bottom: env(safe-area-inset-bottom);
190:   padding-left: env(safe-area-inset-left);
376:   min-height: 100vh;
644: html[data-appearance="dark"] [role="dialog"] {
1254:     padding-top: env(safe-area-inset-top, 0px);
1494:     max-height: calc(100dvh - 3.75rem);
1606:     padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
## src/modules/production/components/ProductionJobInspector.tsx (1524 lines)

761:       data-shell-below-header
762:       className="fixed inset-0 z-[80] bg-slate-950/30"
769:         role="dialog"
865:           className="mx-4 mt-2.5 flex shrink-0 overflow-x-auto border-b border-slate-300"
## src/modules/production/components/ProductionQueue.tsx (174 lines)

## src/modules/production/components/ProductionGantt.tsx (1452 lines)

1018:         <div data-gantt-legend className="hidden min-w-0 items-center gap-3 overflow-x-auto border-t border-slate-200 px-2 py-1 text-[8px] md:flex" aria-label="Timeline legend">
1057:         className={`relative max-h-[calc(100dvh-9rem)] overflow-auto ${canvasPan ? 'cursor-grabbing select-none' : spacePressed ? 'cursor-grab' : ''}`}
1337:                       return <svg key={`${blocker.id}-${blocked.id}`} data-planning-connector-state={issue ? 'issue' : highlighted ? 'highlighted' : 'normal'} aria-hidden={issue ? undefined : true} className={`pointer-events-none absolute left-0 overflow-visible ${issueIsOpen ? 'z-40' : 'z-[4]'}`} width={timelineWidth} height={svgHeight} style={{ top: svgTop }}><defs><marker id={markerId} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto" overflow="visible"><path d="M0,0 L8,4 L0,8 Z" fill={connectorColor} /></marker></defs><path d={path} fill="none" stroke={connectorColor} strokeWidth={highlighted || issue ? 2.5 : 1.5} markerEnd={`
1359:                         {phaseIssues.length > 0 && <div data-planning-warning-popover className="absolute top-1/2 z-40 -translate-y-1/2" style={{ left: handleWidth + 2 }}><button type="button" data-timeline-interactive="true" aria-expanded={phaseIssuePopoverOpen} aria-label={`${phaseSeverity === 'error' ? 'Scheduling errors' : 'Scheduling warnings'} for ${phase.title}`} title={phaseIssues.map((issue) => issue.message).join('\n')} onClick={(event) => { event.stopPropagation(); focusPhaseWarnings(phase.id, phaseIssues); }} className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/95 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-700 ${phaseSeverity === 'error' ?
## src/modules/my-work/MyWorkPage.tsx (444 lines)

395:     <div className="mt-2 flex max-w-full flex-nowrap overflow-x-auto border-b border-slate-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="My Work views">{([['today','Today'],['all','All Tasks'],['private','My Tasks'],['shared','Shared Tasks']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={(event) => {setView(value);event.currentTarget.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}} className={`flex h-11 shrink-0 items-center justify-center gap-2 border-b-2 px-3 text-sm font-medium sm:px-4 ${view === value ? "border-blue-800 text-blue-900" : "border-transparent
426:     {groupsOpen&&<div data-shell-below-header className="fixed inset-0 z-[85] flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-labelledby="task-groups-title" onMouseDown={(event)=>{if(event.target===event.currentTarget)setGroupsOpen(false);}}><div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Personal organization</div><h2 id="task-groups-title" className="mt-1 text-xl font-semibold">Task Groups</h2></div><button type="button" onClick={()=>setGroupsOpen(false)} aria-labe
427:     {selectedTask && detail && <div data-shell-below-header className="fixed inset-0 z-[80] flex justify-end bg-slate-950/35" role="dialog" aria-modal="true" aria-labelledby="my-work-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}><div className="flex h-full w-full max-w-xl flex-col border-l border-slate-300 bg-white shadow-[-12px_0_30px_rgba(15,23,42,.18)]">
## src/modules/my-work/InboxDialog.tsx (156 lines)

5: import { createPortal } from "react-dom";
123:   return createPortal(<div data-global-message-sidebar={sidepane?"":undefined} data-expanded={sidepane?"true":undefined} className={`fixed inset-0 z-[120] flex bg-slate-950/45 p-0 ${sidepane?"items-stretch justify-start":"items-center justify-center sm:p-4"}`} onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}>
124:     <section role="dialog" aria-modal="true" aria-labelledby="my-work-inbox-title" className={`flex w-full flex-col overflow-hidden border-slate-300 bg-white shadow-2xl ${sidepane?"h-full border-r md:max-w-5xl xl:max-w-[min(72rem,72vw)]":"h-[100dvh] pt-[env(safe-area-inset-top)] sm:h-[min(780px,calc(100dvh-2rem))] sm:max-w-5xl sm:rounded-lg sm:border sm:pt-0"}`}>
144:             {selected?.isSystem?<div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-medium text-slate-500">TenOps system messages are read-only.</div>:<div {...attachmentQueue.events} data-messaging-composer className={`shrink-0 border-t border-slate-200 px-3 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] ${attachmentQueue.dragging?"bg-blue-50 ring-2 ring-inset ring-blue-500":"bg-white"}`}>
## src/modules/samples/SampleWorkspace.tsx (1576 lines)

3: const ColorPlateLabelEditor = dynamic(() => import("./ColorPlateLabelEditor"), { ssr: false });
664:     <main className="min-h-[calc(100vh-73px)] bg-[#eef1f4] px-3 py-5 text-slate-950 sm:px-5">
1530:           role="dialog"
1533:           className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
## src/modules/manpower/ManpowerWorkspace.tsx (1238 lines)

248:       <div className="min-w-[180px]">
263:     <div className="flex min-w-[180px] gap-1">
350:     return <div className="flex min-w-[260px] items-center gap-1"><span title="Preserved label from an imported or unlinked labor entry." className="shrink-0 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Imported Label</span><span className="min-w-0 flex-1 truncate text-sm text-slate-900">{temporaryLabel}</span></div>;
353:     return <div className="flex min-w-[260px] items-center gap-1" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setChangingSavedTemporary(false); }}><BusinessSelect autoFocus defaultValue="" onChange={(event) => { const next = event.target.value; if (!next) return; setChangingSavedTemporary(false); onChange(next, next === UNLISTED_WORK_TARGET ? '' : temporaryLabel); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setChangingSavedTemporary(false); } }} className={`${controlClass} min-w-0 flex-1`}><option value="">Choose Production job</option><option value={UNLISTED_WORK_TARGET}>+ Replace imported label</option>{ta
357:     return <div className="flex min-w-[260px] items-center gap-1" onBlur={(event) => { if (savedTemporaryLabel && !event.currentTarget.contains(event.relatedTarget as Node | null)) { event.stopPropagation(); cancelTemporaryEdit(); } }}><span className="shrink-0 rounded bg-slate-100 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">Imported Label</span><BusinessInput autoFocus value={temporaryLabel} onChange={(event) => onChange(UNLISTED_WORK_TARGET, event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTemporaryEdit(); } }} placeholder="Enter imported or unlinked label" className={`${controlClass} bg-slate-50`} /><butt
359:   return <BusinessSelect value={value} onChange={(event) => onChange(event.target.value, '')} className={`${controlClass} min-w-[260px]`}>
388:       <td className="border-r border-slate-300 p-1"><BusinessSelect aria-label="Product Category" value={draft.productCategoryId} onFocus={() => void refresh().catch(() => {})} onChange={(e) => set('productCategoryId', e.target.value)} className={`${inputClass} min-w-[180px]`}><option value="" disabled={!allowUncategorized}>{allowUncategorized ? 'Uncategorized' : 'Select Product Category'}</option>{categories.filter((category) => category.is_active || category.id === draft.productCategoryId).map((category) => <option key={category.id} value={category.id} disabled={!category.is_active}>{category.display_name}{category.is_active ? '' : ' · Inactive'}</option>)}</BusinessSelect></td>
392:         {jobControl ?? (jobReadOnly ? <div className="min-w-[220px] px-2 text-xs text-slate-600">{targets.find((target) => target.value === draft.workTarget)?.label ?? (draft.unlistedLabel || 'Unlinked')}</div> : <WorkIdentityControl value={draft.workTarget} temporaryLabel={draft.unlistedLabel} savedTemporaryLabel={savedTemporaryLabel} targets={targets} onChange={(workTarget, unlistedLabel) => setDraft({ ...draft, workTarget, unlistedLabel })} />)}
397:       <td className="p-1"><div className="flex min-w-[220px] items-center gap-2"><BusinessInput value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes" className={inputClass} />{actions}</div></td>
661:     window.history.pushState(null, '', `${url.pathname}${url.search}`);
772:     window.addEventListener('popstate', syncJobFilter);
773:     return () => window.removeEventListener('popstate', syncJobFilter);
1189:           const newEntryJobCell = <div className="min-w-[220px] px-2 text-xs font-semibold text-slate-700">{targets.find((target) => target.value === draft.workTarget)?.label ?? (draft.unlistedLabel || 'Choose a work target')}</div>;
1190:           const temporaryGroupJobCell = <BusinessInput key={`${group.key}:${previousJobName}`} disabled={identityFiltered} defaultValue={previousJobName} aria-label={`Job name for ${group.label}`} onBlur={(event) => { if (event.target.value.trim() !== previousJobName) void renameUnlinkedGroup(group.key, identityEntries, event.target.value); }} className="h-8 min-w-[220px] w-full border border-slate-300 bg-white px-2 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-200" />;
1230:               {!isCollapsed && <div className="overflow-x-auto"><table className="w-full min-w-[1480px] border-collapse"><thead><tr><th className={`${headerClass} w-12 text-center`}>Select</th><th className={headerClass}>Work Date</th><th className={headerClass}>Product Category</th><th className={headerClass}>Worker</th><th className={headerClass}>Task</th><th className={headerClass}>Job</th><th className={headerClass}>AM Hours</th><th className={headerClass}>PM Hours</th><th className={headerClass}>Total</th><th className={headerClass}>Notes</th></tr></thead><tbody>{addingToGroupId === group.key && group.group && <tr className="border-b-2 border-blue-500 bg-blue-50 align-top"><td className
## src/modules/purchasing/PurchaseOrderEditor.tsx (1574 lines)

1025:     <div data-shell-below-header className="fixed inset-x-0 bottom-0 z-[90] overflow-y-auto bg-slate-950/40 p-2">
## src/components/AccountNotifications.tsx (376 lines)

5: import { createPortal } from "react-dom";
290:   const overlays = typeof document === "undefined" ? null : createPortal(<>
291:     {spotlight || arrivalItem ? <div data-notification-onboarding-scrim className="fixed inset-0 z-50 bg-slate-950/35" aria-hidden="true" /> : null}
292:     {open ? <div role="dialog" aria-label="Notifications" className="fixed right-3 top-[max(4rem,env(safe-area-inset-top))] z-[80] flex max-h-[calc(100dvh-max(5rem,env(safe-area-inset-top)))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden border border-slate-300 bg-white p-2 text-left shadow-xl">
339:     {welcomeOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setWelcomeOpen(false); }}>
340:       <section role="dialog" aria-modal="true" aria-labelledby="welcome-tenops-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden border border-slate-300 bg-white shadow-2xl">
## src/components/documents/DocumentViewer.tsx (106 lines)

90:   return <div data-shell-below-header className="fixed inset-x-0 bottom-0 z-[140] flex flex-col bg-slate-950/80" role="dialog" aria-modal="true" aria-label={title}>
## src/modules/pre-production/BidWorkspace.tsx (140 lines)

32: const IntakePlanning = dynamic(() => import('./IntakePlanning'), { loading: () => <p className="py-6 text-sm">Loading Intake Planning…</p> });
33: const BidPlanningCard = dynamic(() => import('./BidPlanningCard'));
89:  return <main data-selected-bid-id={selectedId||undefined} className="min-h-[calc(100vh-73px)] min-w-0 bg-[#eef1f4] text-slate-950"><div className="mx-auto min-w-0 w-full max-w-[1800px] overflow-x-clip px-2 py-5 sm:px-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Pre-Production</div><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-bold">Bids</h1><EarlyAccessBadge/></div><p className="mt-1 text-sm text-slate-600">Commercial pursuits before Production handoff.</p></div><BusinessButton type="button" disabled={!canManage} onClick={()=>setCreating(true)} 
93:  <div role="tablist" aria-label="Bid filters" className="mt-5 flex overflow-x-auto border-b border-slate-300">{([['active','Active'],['won','Won'],['lost','Lost'],['all','All']] as const).map(([value,text])=><button key={value} role="tab" aria-selected={filter===value} type="button" onClick={()=>setFilter(value)} className={`min-h-10 min-w-max border-b-2 px-4 text-xs font-bold uppercase tracking-[0.05em] ${filter===value?'border-slate-900 bg-slate-100/70 text-slate-950':'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}>{text}</button>)}</div>
95:  {creating&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="new-bid-title" className="w-full border border-slate-300 bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-sm"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Pre-Production</div><h2 id="new-bid-title" className="mt-1 text-xl font-bold">New Bid</h2></div><button type="button" aria-label="Close" onClick={()=>setCreating(false)} className="flex h-9 w-9 items-center justify-center border border-slate-300 text-slate-600 hover:bg-slate
96:  {draft&&<div data-shell-below-header onMouseDown={event=>{if(event.target===event.currentTarget)requestClose();}} className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
97:   <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="bid-workspace-title" className="ml-auto flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl sm:max-w-3xl">
99:    <div role="tablist" aria-label="Bid workspace sections" className="mx-4 flex shrink-0 overflow-x-auto border-b border-slate-300 sm:mx-5">{([['overview','Overview'],['updates','Updates'],['files',`Files${files.length?` (${files.length})`:''}`]] as const).map(([value,text])=><button key={value} type="button" role="tab" id={`bid-workspace-tab-${value}`} aria-selected={activeWorkspaceTab===value} aria-controls={`bid-workspace-${value}`} onClick={()=>void selectWorkspaceTab(value)} className={`min-h-8 min-w-max flex-1 whitespace-nowrap border-b-2 px-2 py-1 text-[11px] font-bold focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${activeWorkspaceTab===v
## src/app/manifest.ts (36 lines)

## src/app/layout.tsx (89 lines)

## src/lib/supabase.ts (12 lines)
