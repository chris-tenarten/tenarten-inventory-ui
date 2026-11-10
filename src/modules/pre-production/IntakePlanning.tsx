'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loadProductionScheduleJobs, type ProductionScheduleJob } from '@/modules/production/jobs';
import { productionJobsVisibleToRole } from '@/modules/production/fixture-visibility';
import { loadPlanningPhases } from '@/modules/planning/data';
import type { PlanningPhase } from '@/modules/planning/types';
import { isPlanningEnabled } from '@/modules/planning/timeline-model.mjs';
import type { Bid } from './types';
import type { BidPlanning } from './planning';
import { loadBidPlanning } from './planning-data';
import { normalizePlanning, planningForMode, type PlanningMode } from './planning-model';
import IntakePlanningTimeline from './IntakePlanningTimeline';

export default function IntakePlanning({ bids, onSelectBid, onChanged }: { bids: Bid[]; onSelectBid(bid: Bid): void; onChanged(): Promise<unknown> }) {
  const auth=useAuth();
  const [mode,setMode]=useState<PlanningMode>('intake');
  const [revision,setRevision]=useState(0);
  const [intakeResult,setIntakeResult]=useState<{bids:Bid[];revision:number;records:BidPlanning[];error:string}|null>(null);
  const [productionResult,setProductionResult]=useState<{bids:Bid[];revision:number;role:string|undefined;jobs:ProductionScheduleJob[];phases:PlanningPhase[];error:string}|null>(null);
  const request=useRef<{bids: Bid[];revision:number;role: string | undefined;promise:Promise<[ProductionScheduleJob[],PlanningPhase[]]>}|null>(null);
  useEffect(()=>{
    let live=true;
    void loadBidPlanning().then(records=>{if(live)setIntakeResult({bids,revision,records,error:''});}).catch(e=>{if(live)setIntakeResult({bids,revision,records:[],error:e instanceof Error?e.message:'Unable to load projected windows.'});});
    return()=>{live=false;};
  },[bids,revision]);
  useEffect(()=>{
    if(mode==='intake')return;
    let live=true;
    if(!request.current||request.current.bids!==bids||request.current.revision!==revision||request.current.role!==auth.profile?.role){
      request.current={bids,revision,role:auth.profile?.role,promise:loadProductionScheduleJobs().then(async loadedJobs=>{
        const visible=productionJobsVisibleToRole(loadedJobs,auth.profile?.role);
        const loadedPhases=isPlanningEnabled(process.env.NEXT_PUBLIC_ENABLE_PLANNING)?await loadPlanningPhases(visible.map(j=>j.id)):[];
        return [visible,loadedPhases] as [ProductionScheduleJob[],PlanningPhase[]];
      })};
    }
    const pending=request.current;
    void pending.promise.then(([jobs,phases])=>{if(live)setProductionResult({bids,revision,role:auth.profile?.role,jobs,phases,error:''});}).catch(e=>{if(request.current===pending)request.current=null;if(live)setProductionResult({bids,revision,role:auth.profile?.role,jobs:[],phases:[],error:e instanceof Error?e.message:'Unable to load Production planning.'});});
    return()=>{live=false;};
  },[mode,bids,revision,auth.profile?.role]);
  const intakeCurrent=intakeResult?.bids===bids&&intakeResult.revision===revision;
  const productionCurrent=productionResult?.bids===bids&&productionResult.revision===revision&&productionResult.role===auth.profile?.role;
  const intakeError=intakeCurrent?intakeResult.error:'';
  const productionError=productionCurrent?productionResult.error:'';
  const loaded=intakeCurrent&&!intakeError,productionLoaded=productionCurrent&&!productionError;
  const all=useMemo(()=>normalizePlanning(loaded?bids:[],loaded?intakeResult.records:[],productionLoaded?productionResult.jobs:[],productionLoaded?productionResult.phases:[]),[bids,intakeResult,productionResult,loaded,productionLoaded]);
  const items=useMemo(()=>planningForMode(all,mode),[all,mode]);
  const refresh=async()=>{setRevision(v=>v+1);};
  return <div className="min-w-0">
    {intakeError&&mode!=='production'&&<p role="alert" className="mt-2 text-sm text-red-700">Projected windows could not be loaded: {intakeError} Use Refresh planning to retry.</p>}
    {productionError&&mode!=='intake'&&<p role="alert" className="mt-2 text-sm text-red-700">Production planning could not be loaded: {productionError} Use Refresh planning to retry.</p>}
    <IntakePlanningTimeline bids={bids} onSelectBid={onSelectBid} onChanged={onChanged} mode={mode} setMode={setMode} items={items} loaded={loaded} productionLoaded={productionLoaded} loading={!intakeCurrent} productionLoading={!productionCurrent} onRefresh={refresh}/>
  </div>;
}
