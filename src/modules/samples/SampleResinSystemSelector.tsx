"use client";

import { BusinessSelect, BusinessButton } from '@/components/BusinessWriteControls';

import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {applyOperationalProfile,loadOperationalProfiles,missingProfileInputs,operationalProfileLabel,type OperationalProfile} from './operational-profiles';
import {BATCH_FIRST_VERSION,SAMPLE_FORMULATION_CALCULATION_VERSION,calculateSampleFormulation,type SampleFormulationState} from './formulation';
import type {SampleBlendRow} from './types';
const OperationalProfileManager=dynamic(()=>import('./OperationalProfileManager'));
const label='block text-xs font-bold text-slate-700';
const input='mt-1 min-h-11 w-full border border-slate-300 bg-white px-3 text-base';
const hint='mt-1 block text-xs font-normal text-slate-500';
const inches=(value:string)=>Number(value)===.375?'3/8″':`${value}″`;
export default function SampleResinSystemSelector({state,rows,onChange}:{state:SampleFormulationState;rows:SampleBlendRow[];onChange:(state:SampleFormulationState)=>void}) {
 const isV4=state.calculationVersion===SAMPLE_FORMULATION_CALCULATION_VERSION;
 const isBatchFirst=state.calculationVersion===BATCH_FIRST_VERSION;
  const auth = useAuth();
  const canManageProfiles = Boolean(auth.profile?.isActive && ['admin', 'developer'].includes(auth.profile.role));
  const [profiles, setProfiles] = useState<OperationalProfile[]>([]);
  const [profilesError, setProfilesError] = useState('');
  const [manageProfiles, setManageProfiles] = useState(false);
  const [pendingProfileId, setPendingProfileId] = useState('');
  const refreshProfiles = async () => { setProfiles(await loadOperationalProfiles()); setProfilesError(''); };
  useEffect(() => { let live = true; void loadOperationalProfiles().then(rows => { if (live) setProfiles(rows); }).catch(error => { if (live) setProfilesError(error.message); }); return () => { live = false; }; }, []);
  const pendingProfile = profiles.find(p => p.id === pendingProfileId);
  function chooseProfile(profile: OperationalProfile) {
    setPendingProfileId(profile.id);
  }
  function confirmProfile(profile: OperationalProfile) {
    if (missingProfileInputs(profile).length) return;
    onChange(applyOperationalProfile(state, profile)); setPendingProfileId('');
  }
 return <div className="mb-4" data-testid="primary-resin-system">            {(isV4 || isBatchFirst) && <label className={`${label} sm:col-span-2`}>
              Resin System
              <BusinessSelect aria-label="Resin System" value={pendingProfileId || (state.profile ? `${state.profile.id}:${state.profile.version}` : '')} onChange={event => { const profile = profiles.find(p => `${`operational:${p.id}`}:${p.revision}` === event.target.value); if (profile) chooseProfile(profile); }} className={input}>
                {state.profile && <option value={`${state.profile.id}:${state.profile.version}`}>{profiles.some(p=>`operational:${p.id}`===state.profile?.id && p.revision===state.profile?.version && p.is_active) ? '' : 'Captured: '}{state.profile.name}</option>}
                {!state.profile && <option value="">Choose profile</option>}
                {pendingProfile && <option value={pendingProfile.id}>{operationalProfileLabel(pendingProfile)} — not applied</option>}
                {profiles.filter(p => p.is_active && `${`operational:${p.id}`}:${p.revision}` !== `${state.profile?.id}:${state.profile?.version}`).map(p => <option key={p.id} value={`${`operational:${p.id}`}:${p.revision}`}>{operationalProfileLabel(p)}{missingProfileInputs(p).length ? ' · Incomplete' : ''}</option>)}
              </BusinessSelect>
              <span className={hint}>Captured with this Sample. Changing supplier alone does not change the profile.</span>
              {profilesError && <span role="alert" className="block text-xs text-red-700">{profilesError}</span>}
              {pendingProfile && <span role="status" className="mt-2 block border border-amber-300 p-2 text-xs">{operationalProfileLabel(pendingProfile)} has not been applied. {missingProfileInputs(pendingProfile).length ? `Missing: ${missingProfileInputs(pendingProfile).join(', ')}. Current Draft calculations remain on the captured profile.` : isBatchFirst ? 'Review this profile before applying. Shop overrides reset to this profile’s preparation quantities.' : 'Review this profile before applying. Existing manual overrides remain unchanged.'}<span className="mt-2 block">Revision {pendingProfile.revision} · Batch chip target {pendingProfile.batch_chip_target_lb ?? "not configured"} lb · Batch reference thickness {pendingProfile.batch_reference_thickness_in == null ? "not configured" : inches(String(pendingProfile.batch_reference_thickness_in))} · Density {pendingProfile.chip_density ?? "—"} lb/CFT · {pendingProfile.batch_contract ? `Canonical Batch filler ${pendingProfile.batch_contract.components.filler?.exact ?? "unresolved"} lb · Part A ${pendingProfile.batch_contract.components.resin?.exact ?? "unresolved"} US gal.` : `Filler rate ${pendingProfile.filler_rate ?? "—"} oz/CFT · Resin rate ${pendingProfile.resin_rate ?? "—"} fl oz/CFT.`} Working quantities after applying: {(() => { if(missingProfileInputs(pendingProfile).length) return "unavailable"; const next=calculateSampleFormulation(applyOperationalProfile(state,pendingProfile),rows); return `${next.availableChipMixOz} oz chips / ${next.effectiveFillerOz} oz filler / ${next.effectiveResinFlOz} fl oz resin / ${next.rows[rows.findIndex(r=>r.componentRole==='hardener')]?.effectiveQuantity ?? "—"} fl oz hardener`; })()}</span><BusinessButton type="button" disabled={missingProfileInputs(pendingProfile).length > 0} onClick={() => confirmProfile(pendingProfile)} className="m-1 min-h-9 border px-2 disabled:opacity-50">Apply configured profile</BusinessButton><button type="button" onClick={() => setPendingProfileId('')} className="m-1 underline">Cancel selection</button></span>}
              {canManageProfiles && <BusinessButton type="button" onClick={() => setManageProfiles(true)} className="mt-2 min-h-10 border px-3 text-xs">Configure profiles</BusinessButton>}
            </label>}
{manageProfiles && canManageProfiles && <OperationalProfileManager profiles={profiles} onChanged={refreshProfiles} onClose={()=>setManageProfiles(false)}/>}</div>;
}
