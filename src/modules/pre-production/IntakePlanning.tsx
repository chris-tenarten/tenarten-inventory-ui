'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loadProductionJobs } from '@/modules/production/jobs';
import { productionJobsVisibleToRole } from '@/modules/production/fixture-visibility';
import type { ProductionJob } from '@/modules/production/types';
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
  const [records,setRecords]=useState<BidPlanning[]>([]);
  const [jobs,setJobs]=useState<ProductionJob[]>([]);
  const [phases,setPhases]=useState<PlanningPhase[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [loadedFor,setLoadedFor]=useState<{bids:Bid[];revision:number;role:string|undefined}|null>(null);
  const [error,setError]=useState(''),[revision,setRevision]=useState(0);
  const request=useRef<{bids: Bid[];revision:number;role: string | undefined;promise:Promise<[ProductionJob[],PlanningPhase[]]>}|null>(null);
  useEffect(()=>{let live=true;void loadBidPlanning().then(rows=>{if(live){setRecords(rows);setLoaded(true);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[bids,revision]);
  useEffect(()=>{
    if(mode==='intake')return;
    let live=true;
    if(!request.current||request.current.bids!==bids||request.current.revision!==revision||request.current.role!==auth.profile?.role){
      request.current={bids,revision,role:auth.profile?.role,promise:loadProductionJobs().then(async loadedJobs=>{
        const visible=productionJobsVisibleToRole(loadedJobs,auth.profile?.role);
        const loadedPhases=isPlanningEnabled(process.env.NEXT_PUBLIC_ENABLE_PLANNING)?await loadPlanningPhases(visible.map(j=>j.id)):[];
        return [visible,loadedPhases] as [ProductionJob[],PlanningPhase[]];
      })};
    }
    void request.current.promise.then(([nextJobs,nextPhases])=>{if(live){setJobs(nextJobs);setPhases(nextPhases);setLoadedFor({bids,revision,role:auth.profile?.role});}}).catch(e=>{request.current=null;if(live)setError(e.message);});
    return()=>{live=false;};
  },[mode,bids,revision,auth.profile?.role]);
  const productionLoaded=loadedFor?.bids===bids&&loadedFor.revision===revision&&loadedFor.role===auth.profile?.role;
  const all=useMemo(()=>normalizePlanning(bids,records,productionLoaded?jobs:[],productionLoaded?phases:[]),[bids,records,jobs,phases,productionLoaded]);
  const items=useMemo(()=>planningForMode(all,mode),[all,mode]);
  const refresh=async()=>{setError('');setRevision(v=>v+1);};
  return <div className="min-w-0">
    {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <IntakePlanningTimeline bids={bids} onSelectBid={onSelectBid} onChanged={onChanged} mode={mode} setMode={setMode} items={items} loaded={loaded} productionLoaded={productionLoaded} onRefresh={refresh}/>
  </div>;
}
