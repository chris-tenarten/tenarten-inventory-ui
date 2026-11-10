'use client';

import { Check, Clock3, ChevronDown, ChevronLeft, ChevronRight, ListTodo, Pause, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { useCalendarTasks } from '@/modules/my-work/use-calendar-tasks';
import type { WorkTask } from '@/modules/my-work/types';
import { normalizeWorkloadContents, workloadDayItems, workloadTasks, workloadTaskState, type WorkloadContents } from '../monthly-workload-tasks';
import { normalizeWorkloadDensity, workloadLaneCapacity, WORKLOAD_BAR_TOP as BAR_TOP, WORKLOAD_LANE_STEP as LANE_STEP, type WorkloadDensity } from '../monthly-workload-density';
import ProductionDialog from '../contacts/ProductionDialog';
import { formatScheduleDate, parseScheduleDate } from '../schedule';
import { productionStatusCalendarStyle, productionStatusVisualByValue } from '../status-visuals';
import { normalizeWorkloadView, workloadMonth, type WorkloadView } from '../monthly-workload';
import { ACTIVE_PRODUCTION_STATUSES } from '../../../../supabase/functions/_shared/production-job-facts.mjs';
import type { ProductionJob } from '../types';
import './monthly-workload.css';

const MyWorkTaskInspector=dynamic(()=>import('@/modules/my-work/MyWorkTaskInspector'),{ssr:false});

const EXPANDED_KEY = 'tenops.production.monthlyWorkloadExpanded';
const VIEW_KEY = 'tenops.production.monthlyWorkloadView';
const PREFERENCE_EVENT = 'tenops:monthly-workload-preference';
function readExpandedPreference(key: string) {
  if (!key) return true;
  try { return window.localStorage.getItem(key) !== 'false'; } catch { return true; }
}
function readViewPreference() {
  try { return normalizeWorkloadView(window.localStorage.getItem(VIEW_KEY)); } catch { return 'active' as const; }
}
function subscribeToPreference(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(PREFERENCE_EVENT, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(PREFERENCE_EVENT, notify);
  };
}

export default function MonthlyWorkload({ jobs, loading, error, onSelectJob }: {
  jobs: ProductionJob[];
  loading: boolean;
  error?: string;
  onSelectJob: (job: ProductionJob, opener: HTMLElement | null) => void;
}) {
  const { language, tr } = useLanguage();
  const auth = useAuth();
  const userId = auth.accessAllowed && auth.profile?.isActive ? auth.profile.userId : '';
  const contentsKey = `tenops.production.monthlyWorkloadContents:${userId}`;
  const savedContents = useSyncExternalStore(subscribeToPreference, () => {
    try { return userId ? normalizeWorkloadContents(window.localStorage.getItem(contentsKey)) : 'jobs'; } catch { return 'jobs'; }
  }, () => 'jobs' as const);
  const [fallbackContents, setFallbackContents] = useState<{ userId: string; value: WorkloadContents } | null>(null);
  const contents = fallbackContents?.userId === userId ? fallbackContents.value : savedContents;
  const densityKey = `tenops.production.monthlyWorkloadDensity:${userId}`;
  const savedDensity = useSyncExternalStore(subscribeToPreference, () => {
    try { return userId ? normalizeWorkloadDensity(window.localStorage.getItem(densityKey)) : 'default'; } catch { return 'default'; }
  }, () => 'default' as const);
  const [fallbackDensity, setFallbackDensity] = useState<{ userId: string; value: WorkloadDensity } | null>(null);
  const density = fallbackDensity?.userId === userId ? fallbackDensity.value : savedDensity;
  const showJobs = contents !== 'tasks';
  const showTasks = contents !== 'jobs';
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  // The legacy browser-wide key has no owner; only employee-scoped choices apply.
  const expandedKey = userId && auth.user?.id === userId ? `${EXPANDED_KEY}:${userId}` : '';
  const savedExpanded = useSyncExternalStore(subscribeToPreference, () => readExpandedPreference(expandedKey), () => true);
  const [fallbackExpanded, setFallbackExpanded] = useState<{ key: string; value: boolean } | null>(null);
  const expanded = fallbackExpanded?.key === expandedKey ? fallbackExpanded.value : savedExpanded;
  const savedView = useSyncExternalStore(subscribeToPreference, readViewPreference, () => 'active' as const);
  const [fallbackView, setFallbackView] = useState<WorkloadView | null>(null);
  const view = fallbackView ?? savedView;
  const [visibleLanes, setVisibleLanes] = useState(1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const weeksRef = useRef<HTMLDivElement>(null);
  const overflowOpenerRef = useRef<HTMLElement | null>(null);
  const taskOpenerRef=useRef<HTMLElement|null>(null);
  const calendarFocusRef=useRef<HTMLButtonElement|null>(null);
  const taskScrollRef=useRef({x:0,y:0});
  const [taskSelection,setTaskSelection]=useState<{id:string;userId:string}|null>(null);
  if(taskSelection&&taskSelection.userId!==userId)setTaskSelection(null);
  const taskData = useCalendarTasks(expanded && showTasks, userId);
  const selectedTask=taskSelection?.userId===userId?taskData.tasks.find(task=>task.id===taskSelection.id):undefined;
  const calendar = useMemo(() => workloadMonth(month, showJobs ? jobs : [], view), [month, jobs, view, showJobs]);
  const calendarTasks = useMemo(() => workloadTasks(taskData.tasks, userId, calendar.start, calendar.end), [taskData.tasks, userId, calendar.start, calendar.end]);
  const taskBand = contents === 'both' && calendarTasks.dated.length > 0;
  const locale = language === 'es' ? 'es-US' : 'en-US';
  const today = formatScheduleDate(new Date());
  const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const longDate = (value: string) => parseScheduleDate(value).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const selectedWeek = selectedDay ? calendar.weeks.find(week => week.days.includes(selectedDay)) : undefined;
  const selectedItems = selectedWeek && selectedDay
    ? workloadDayItems(selectedWeek.segments, selectedWeek.days.indexOf(selectedDay), calendarTasks.dated, selectedDay, visibleLanes, taskBand ? 1 : undefined) : null;
  const busy = (showJobs && loading) || (showTasks && taskData.loading);
  const failed = (showJobs && Boolean(error)) || (showTasks && taskData.error);
  const empty = calendar.scheduled.length === 0 && calendarTasks.dated.length === 0;
  const loadingMessage = contents === 'jobs' ? tr('Loading schedules…', 'Cargando programación…') : tr('Loading commitments…', 'Cargando compromisos…');
  const errorMessage = contents === 'jobs' ? tr('Production schedules could not be loaded.', 'No se pudo cargar la programación de producción.') : tr('Some commitments could not be loaded.', 'No se pudieron cargar algunos compromisos.');
  const emptyMessage = contents === 'jobs' ? tr('No saved schedules match this view this month.', 'No hay programación guardada para esta vista este mes.') : tr('No dated commitments match this view this month.', 'No hay compromisos con fecha para esta vista este mes.');
  function taskStateLabel(task: WorkTask) {
    const state = workloadTaskState(task);
    return state === 'completed' ? tr('Completed', 'Completada') : state === 'overdue' ? tr('Overdue', 'Vencida') : state === 'today' ? tr('Due today', 'Vence hoy') : tr('Task', 'Tarea');
  }
  function taskTitle(task: WorkTask) {
    return `${task.title} · ${taskStateLabel(task)} · ${longDate(task.dueDate)}${task.visibility === 'shared' ? ` · ${tr('Shared', 'Compartida')} · ${task.assigneeName}` : ''}`;
  }

  useEffect(() => {
    const node = weeksRef.current;
    if (!node || !expanded) return;
    const observer = new ResizeObserver(([entry]) => {
      // The date and overflow control share the top line; bars occupy the remaining rows.
      const rowHeight = entry.contentRect.height / calendar.weeks.length;
      setVisibleLanes(workloadLaneCapacity(rowHeight - (taskBand ? 30 : 0)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, calendar.weeks.length, taskBand]);

  function selectTask(task:WorkTask,opener:HTMLElement|null){
    taskOpenerRef.current=opener;taskScrollRef.current={x:window.scrollX,y:window.scrollY};
    setSelectedDay(null);setTaskSelection({id:task.id,userId});
  }
  const closeTask=useCallback(()=>{
    setTaskSelection(null);const position=taskScrollRef.current;
    requestAnimationFrame(()=>window.scrollTo(position.x,position.y));
  },[]);
  useEffect(()=>{
    if(taskSelection&&!selectedTask&&!taskData.loading&&taskSelection.userId===userId){
      const position=taskScrollRef.current;
      const frame=requestAnimationFrame(()=>window.scrollTo(position.x,position.y));
      return()=>cancelAnimationFrame(frame);
    }
  },[taskSelection,selectedTask,taskData.loading,userId]);
  function navigate(delta: number) {
    setSelectedDay(null);
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return <section aria-label={tr('Monthly Workload', 'Carga mensual')} aria-describedby={expanded ? 'monthly-workload-status-explanation' : undefined} data-monthly-workload data-workload-density={density} data-workload-lanes={visibleLanes} data-workload-task-band={taskBand} className="mb-3 min-w-0 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1 sm:px-3">
      <button ref={calendarFocusRef} type="button" aria-expanded={expanded} aria-controls="monthly-workload-calendar" disabled={!expandedKey} onClick={() => {
        if (!expandedKey) return;
        const next = !expanded;
        try {
          window.localStorage.setItem(expandedKey, String(next));
          setFallbackExpanded(null);
          window.dispatchEvent(new Event(PREFERENCE_EVENT));
        } catch { setFallbackExpanded({ key: expandedKey, value: next }); }
      }} className="flex min-h-8 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600">
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        {tr('Monthly Workload', 'Carga mensual')}
      </button>
      {expanded && <div role="group" aria-label={tr('Calendar contents', 'Contenido del calendario')} className="monthly-workload-contents">
        {([['jobs', tr('Jobs', 'Trabajos')], ['tasks', tr('My Tasks', 'Mis tareas')], ['both', tr('Both', 'Ambos')]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={contents === value} onClick={() => {
          setSelectedDay(null);
          try { window.localStorage.setItem(contentsKey, value); window.dispatchEvent(new Event(PREFERENCE_EVENT)); }
          catch { setFallbackContents({ userId, value }); }
        }}>{label}</button>)}
      </div>}
      {expanded && showJobs && <select aria-label={tr('Monthly Workload view', 'Vista de carga mensual')} value={view}
        title={`${tr('Active', 'Activos')}: ${ACTIVE_PRODUCTION_STATUSES.map(status => productionStatusVisualByValue[status as ProductionJob['production_status']].label).join(', ')}`}
        onChange={event => {
          const next = normalizeWorkloadView(event.target.value);
          setSelectedDay(null);
          try {
            window.localStorage.setItem(VIEW_KEY, next);
            window.dispatchEvent(new Event(PREFERENCE_EVENT));
          } catch { setFallbackView(next); }
        }} className="h-7 min-w-0 max-w-40 rounded-sm border border-slate-300 bg-white px-1.5 text-[10px] font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        <option value="active">{tr('Active', 'Activos')}</option>
        <option value="on_deck">{tr('On Deck', 'Próximo')}</option>
        <option value="all_scheduled">{tr('All Scheduled', 'Todos programados')}</option>
      </select>}
      {expanded && <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
        {tr('Density', 'Densidad')}
        <select aria-label={tr('Calendar density', 'Densidad del calendario')} value={density} onChange={event => {
          const next = normalizeWorkloadDensity(event.target.value);
          try {
            window.localStorage.setItem(densityKey, next);
            setFallbackDensity(null);
            window.dispatchEvent(new Event(PREFERENCE_EVENT));
          } catch { setFallbackDensity({ userId, value: next }); }
        }} className="h-7 min-w-0 max-w-28 rounded-sm border border-slate-300 bg-white px-1.5 text-[10px] font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
          <option value="compact">{tr('Compact', 'Compacta')}</option>
          <option value="default">{tr('Default', 'Normal')}</option>
          <option value="expanded">{tr('Expanded', 'Amplia')}</option>
        </select>
      </label>}
      {expanded && <div className="flex min-w-0 flex-1 basis-full items-center justify-end gap-1 sm:basis-auto sm:gap-2">
        <h2 aria-live="polite" className="monthly-workload-month-label mr-auto capitalize sm:mr-2">{monthLabel}</h2>
        <button type="button" onClick={() => navigate(-1)} aria-label={tr('Previous month', 'Mes anterior')} className="monthly-workload-nav"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
        <button type="button" onClick={() => { setSelectedDay(null); const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }} className="monthly-workload-nav px-2 text-[10px] font-semibold">{tr('Today', 'Hoy')}</button>
        <button type="button" onClick={() => navigate(1)} aria-label={tr('Next month', 'Mes siguiente')} className="monthly-workload-nav"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
      </div>}
    </div>
    {expanded && <div id="monthly-workload-calendar" className="monthly-workload-calendar relative flex flex-col border-t border-slate-200" aria-busy={busy}>
      <p id="monthly-workload-status-explanation" className="sr-only">{tr('Saved Production schedules. Bars use the shared Production status colors, with each Job’s current recorded status included in its accessible label and full-day list. The pause mark identifies On Hold. Open a Job bar to view its existing Production Inspector. Jobs without both valid planned dates are not placed. Search and filters below apply to the Pipeline views. My Tasks includes your private tasks and tasks shared with or by you, on their saved due dates. Check marks and struck labels mean completed; overdue tasks are marked separately. Tasks without due dates remain in My Work. Open a task to view its existing My Work details. In Both, Jobs and tasks have independent visible rows; the daily list includes every Job and task.', 'Programación guardada de producción. Las barras usan los colores compartidos de estado de producción; el estado registrado de cada trabajo aparece en su etiqueta accesible y en la lista del día. El símbolo de pausa identifica En pausa. Abra una barra para ver el inspector de producción. No se colocan trabajos sin ambas fechas planificadas válidas. La búsqueda y los filtros se aplican a las vistas del flujo. Mis tareas incluye sus tareas privadas y compartidas en sus fechas de vencimiento. Una marca y texto tachado indican tareas completadas. Las tareas sin fecha permanecen en Mi trabajo. Abra una tarea para ver sus detalles. En Ambos, los trabajos y tareas tienen filas visibles independientes; la lista diaria incluye todos los trabajos y tareas.')}</p>
      <div className="monthly-workload-weekdays grid shrink-0 grid-cols-7 text-center uppercase">
        {Array.from({ length: 7 }, (_, day) => <div key={day} className="py-1">{new Date(2026, 10, 1 + day).toLocaleDateString(locale, { weekday: 'short' })}</div>)}
      </div>
      <div ref={weeksRef} className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${calendar.weeks.length}, minmax(0, 1fr))` }}>
        {calendar.weeks.map(week => <div key={week.days[0]} className="monthly-workload-week relative min-h-0" data-workload-week>
          {taskBand && <div aria-hidden="true" className="monthly-workload-job-space" />}
          <div className="absolute inset-0 grid grid-cols-7">
            {week.days.map((date, column) => {
              const inMonth = date >= calendar.start && date <= calendar.end;
              const { hidden } = workloadDayItems(week.segments, column, calendarTasks.dated, date, visibleLanes, taskBand ? 1 : undefined);
              return <div key={date} data-workload-date={date} data-outside-month={!inMonth} data-weekend={column === 0 || column === 6} className={`monthly-workload-day relative min-w-0 ${date === today ? 'monthly-workload-today' : ''}`}>
                <time dateTime={date} aria-current={date === today ? 'date' : undefined} className="monthly-workload-day-number inline-flex items-center justify-center tabular-nums">{Number(date.slice(-2))}</time>
                {hidden > 0 && <button type="button" onClick={event => { overflowOpenerRef.current = event.currentTarget; setSelectedDay(date); }} aria-label={`${contents === 'jobs' ? tr('Show all Jobs for', 'Ver todos los trabajos del') : tr('Show all commitments for', 'Ver todos los compromisos del')} ${longDate(date)} (${hidden} ${tr('more', 'más')})`} className="absolute right-0.5 top-0.5 max-w-[calc(100%-24px)] truncate rounded-sm text-right text-[9px] font-semibold leading-[18px] text-blue-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 sm:text-[10px]">+{hidden}<span className="hidden sm:inline"> {tr('more', 'más')}</span></button>}
              </div>;
            })}
          </div>
          {week.segments.filter(segment => segment.lane < visibleLanes).map(segment => {
            const visual = productionStatusVisualByValue[segment.job.production_status];
            const title = `${segment.job.job_number ? segment.job.job_number + ' · ' : ''}${segment.job.name} · ${visual.label} · ${longDate(segment.job.planned_start!)} – ${longDate(segment.job.planned_end!)}`;
            return <button type="button" key={segment.job.id} data-workload-job={segment.job.id} data-workload-status={visual.value} data-production-status-variant="calendar" data-workload-lane={segment.lane} data-continues-before={segment.continuesBefore} data-continues-after={segment.continuesAfter} aria-label={title} title={title} onClick={event => onSelectJob(segment.job, event.currentTarget)}
              className={`monthly-workload-bar absolute min-w-0 truncate text-left ${visual.className}`}
              style={{ ...productionStatusCalendarStyle(visual), top: BAR_TOP + segment.lane * LANE_STEP, left: `calc(${segment.startColumn * 100 / 7}% + 2px)`, width: `calc(${(segment.endColumn - segment.startColumn + 1) * 100 / 7}% - 4px)` }}>
              <span className="monthly-workload-label">{visual.value === 'on_hold' && <Pause aria-hidden="true" className="monthly-workload-pause" />}{segment.job.name}</span>
            </button>;
          })}
          {week.days.flatMap((date, column) => workloadDayItems(week.segments, column, calendarTasks.dated, date, visibleLanes, taskBand ? 1 : undefined).shownTasks.map(({ task, lane }) => <button type="button" key={task.id} onClick={event=>selectTask(task,event.currentTarget)} data-workload-task={task.id} data-task-state={workloadTaskState(task)} aria-label={taskTitle(task)} title={taskTitle(task)} className="monthly-workload-task absolute min-w-0"
            style={{ ...(taskBand ? { bottom: 4 } : { top: BAR_TOP + lane * LANE_STEP }), left: `calc(${column * 100 / 7}% + 3px)`, width: `calc(${100 / 7}% - 6px)` }}>
            {task.completedAt ? <Check aria-hidden="true" /> : <span className="monthly-workload-task-icon">{workloadTaskState(task) === 'overdue' ? <Clock3 aria-hidden="true" /> : <ListTodo aria-hidden="true" />}</span>}<span>{task.title}</span>
          </button>))}
        </div>)}
      </div>
      {(busy || empty) && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><p role={failed ? 'alert' : 'status'} className="mx-3 rounded-sm border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-600 shadow-sm">{busy ? loadingMessage : failed ? errorMessage : emptyMessage}</p></div>}

    </div>}
    {expanded && showJobs && error && !empty && <p role="alert" className="monthly-workload-task-summary">{tr('Production schedules could not be loaded.', 'No se pudo cargar la programación de producción.')}</p>}
    {expanded && showTasks && <div className="monthly-workload-task-summary" aria-live="polite">
      {taskData.error && <span role="alert">{tr('My Tasks could not be loaded. Reopen the calendar to retry.', 'No se pudieron cargar mis tareas. Vuelva a abrir el calendario para reintentar.')} </span>}
      <Link href="/my-work">{calendarTasks.undated > 0 ? `${calendarTasks.undated} ${tr('tasks without due dates · View My Work', 'tareas sin fecha · Ver Mi trabajo')}` : tr('Open My Work', 'Abrir Mi trabajo')}</Link>
    </div>}
    {selectedDay && <ProductionDialog label={`${contents === 'jobs' ? tr('Jobs for', 'Trabajos del') : tr('Commitments for', 'Compromisos del')} ${longDate(selectedDay)}`} onDismiss={() => setSelectedDay(null)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-3"><h3 className="text-sm font-bold">{longDate(selectedDay)}</h3><button type="button" aria-label={tr('Close daily list', 'Cerrar lista del día')} onClick={() => setSelectedDay(null)} className="monthly-workload-nav"><X aria-hidden="true" className="h-4 w-4" /></button></div>
      <div className="divide-y divide-slate-200">{selectedItems?.jobs.map(({ job }) => {
        const visual = productionStatusVisualByValue[job.production_status];
        return <button type="button" key={job.id} onClick={() => { setSelectedDay(null); onSelectJob(job, overflowOpenerRef.current); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">
          <span aria-hidden="true" data-workload-status={visual.value} className={`monthly-workload-swatch h-3 w-5 shrink-0 ${visual.className}`} style={visual.pattern ? { backgroundImage: visual.pattern } : undefined} />
          <span className="min-w-0"><span className="block break-words text-xs font-semibold">{job.job_number ? `${job.job_number} · ` : ''}{job.name}</span><span className="mt-0.5 block text-[10px] text-slate-500">{visual.label} · {longDate(job.planned_start!)} – {longDate(job.planned_end!)}</span></span>
        </button>;
      })}
      {selectedItems?.tasks.map(task => <button type="button" key={task.id} onClick={()=>selectTask(task,overflowOpenerRef.current)} data-workload-overflow-task={task.id} className="monthly-workload-task-row flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600" data-task-state={workloadTaskState(task)}>
        {task.completedAt ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : <ListTodo aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <span className="min-w-0"><span className="monthly-workload-task-title block break-words text-xs font-semibold">{task.title}</span><span className="mt-0.5 block text-[10px]">{taskStateLabel(task)} · {longDate(task.dueDate)}{task.visibility === 'shared' ? ` · ${tr('Shared', 'Compartida')} · ${task.assigneeName}` : ''}</span></span>
      </button>)}</div>
    </ProductionDialog>}
    {selectedTask&&<MyWorkTaskInspector key={`${userId}:${selectedTask.id}`} task={selectedTask} groups={taskData.groups} onDismiss={closeTask} onChanged={taskData.refresh} returnFocusRef={taskOpenerRef} fallbackFocusRef={calendarFocusRef}/>}
  </section>;
}
