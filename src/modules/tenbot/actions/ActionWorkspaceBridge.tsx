'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useSyncExternalStore,type ReactNode} from 'react';
import {useAuth} from '@/lib/auth';
import {supabase} from '@/lib/supabase';
import {ActionReviewCard} from './ActionReviewCard';
import {parseActionCard,parseActionStatus,isActionUuid,type ActionCard} from './contract';
import {createTrustedActionAdapter,unavailableActionAdapter,type ActionAdapter} from './adapter';
import {createActionPresentationFixture} from './presentation-fixture';
import {OPEN_TENBOT_WORKSPACE_EVENT} from '../events';
import type {ActionSessionSnapshot} from '@/lib/auth-action-session';

/** Host publication seam; this is not an ask/history response extension. */
export type ActionPublication={ownerId:string;accessKey:string;sessionKey:string;cards:readonly ActionCard[];adapter:ActionAdapter};
const ActionPublicationContext=createContext<ActionPublication|null>(null);
export function ActionWorkspaceProvider({publication,children}:{publication:ActionPublication|null;children:ReactNode}){
 return <ActionPublicationContext.Provider value={publication}>{children}</ActionPublicationContext.Provider>;
}

const subscribe=(notify:()=>void)=>{window.addEventListener('popstate',notify);return()=>window.removeEventListener('popstate',notify);};
const previewCase=()=>{
 if(process.env.NODE_ENV!=='development'||window.location.hostname!=='localhost')return '';
 const query=new URLSearchParams(window.location.search);
 return query.get('tenbotActionsPreview')==='1'?(query.get('tenbotActionCase')||'proposal'):'';
};
const noPreview=()=>'';
export const ACTION_CORRECTION_EVENT='tenops:tenbot-action-correction';
export function configuredActionEndpoint():string|null{
 if(process.env.NEXT_PUBLIC_TENBOT_ACTIONS_ENABLED!=='true'||typeof window==='undefined')return null;
 try{
  const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'');
  if(['https://tendev.pages.dev','https://tenops.pages.dev'].includes(window.location.origin)&&project.protocol==='https:')return new URL('/functions/v1/tenbot',project).href;
  const local=new URL(process.env.NEXT_PUBLIC_TENBOT_REVIEW_URL||'');
  if(window.location.hostname==='localhost'&&['localhost','127.0.0.1','[::1]'].includes(project.hostname)&&local.origin===project.origin&&local.protocol==='http:'&&local.pathname==='/functions/v1/tenbot'&&!local.search&&!local.hash)return local.href;
 }catch{/* Default-off on invalid or cross-environment configuration. */}
 return null;
}

/** Decode only an opaque lifecycle discriminator. Auth remains the authority. */
export function actionSessionKey(token:string|undefined):string{
 if(!token)return '';
 try{const value=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return isActionUuid(value.session_id)?value.session_id:'';}catch{return '';}
}

/** Outside the gated header: a same-owner Auth handoff can retain injected
 * references while access is reverified. No credentials/responses are retained. */
export function ActionWorkspaceBridge({children}:{children:ReactNode}){
 const auth=useAuth();
 const inherited=useContext(ActionPublicationContext);
 const scenario=useSyncExternalStore(subscribe,previewCase,noPreview);
 const owner=auth.user?.id||'';
 const reopen=useRef<{ownerId:string;sessionKey:string}|null>(null);
 const fixture=useMemo(()=>scenario&&owner?createActionPresentationFixture(scenario):null,[scenario,owner]);
 const sessionKey=actionSessionKey(auth.session?.access_token);
 const {actionSessionSnapshot,installActionSession}=auth;
 const installSession=useCallback(async(session:{access_token:string;refresh_token:string},expected:ActionSessionSnapshot)=>{
  const wasOpen=Boolean(document.querySelector('[data-tenbot-global-overlay]:not([hidden])'));
  if(wasOpen)reopen.current={ownerId:expected.ownerId,sessionKey:actionSessionKey(session.access_token)};
  try{await installActionSession(session,expected);}catch(error){reopen.current=null;throw error;}
 },[installActionSession]);
 const liveAdapter=useMemo(()=>{
  const endpoint=configuredActionEndpoint();if(!endpoint||!owner)return unavailableActionAdapter;
  // The factory only captures session callbacks; it never calls them in render.
  // eslint-disable-next-line react-hooks/refs
  return createTrustedActionAdapter({enabled:true,functionUrl:endpoint,anonKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,session:{
   async read(){const {data,error}=await supabase.auth.getSession();const expected=actionSessionSnapshot();return !error&&expected&&data.session?.access_token===expected.accessToken?expected:null;},
   async verifyUser(token){const {data,error}=await supabase.auth.getUser(token);return !error&&data.user?{id:data.user.id}:null;},
   installSession,
  }});
 },[owner,actionSessionSnapshot,installSession]);
 useEffect(()=>{
  const pending=reopen.current;if(!pending)return;
  if(owner!==pending.ownerId){reopen.current=null;return;}
  if(!auth.accessAllowed)return;
  reopen.current=null;
  if(sessionKey!==pending.sessionKey)return;
  const frame=requestAnimationFrame(()=>window.dispatchEvent(new Event(OPEN_TENBOT_WORKSPACE_EVENT)));
  return()=>cancelAnimationFrame(frame);
 },[owner,auth.accessAllowed,sessionKey]);
 const publication=inherited??(fixture&&auth.accessAllowed&&auth.profile?.userId===owner?{ownerId:owner,accessKey:JSON.stringify(auth.profile),sessionKey:sessionKey||'synthetic-session',cards:fixture.cards,adapter:fixture.adapter}:auth.accessAllowed&&sessionKey&&liveAdapter.availability==='connected'?{ownerId:owner,accessKey:JSON.stringify(auth.profile),sessionKey,cards:[],adapter:liveAdapter}:null);
 return <ActionWorkspaceProvider publication={publication}>{!fixture&&!inherited&&liveAdapter.availability==='connected'&&typeof window!=='undefined'&&window.location.hostname==='localhost'?<div role="note" data-tenbot-isolated-review className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950">Isolated TenDev review · Synthetic records with real account confirmation · Scripted conversation transport, no model inference</div>:null}{children}</ActionWorkspaceProvider>;
}

export function ActionWorkspaceSlot({onRequestCorrection}:{onRequestCorrection?():void}){
 const auth=useAuth(),publication=useContext(ActionPublicationContext);
 const cards=useMemo(()=>{try{return publication?.cards.map(parseActionCard)??[];}catch{return null;}},[publication?.cards]);
 if(!publication||!auth.ready||!auth.isAuthenticated||!auth.accessAllowed||auth.requiresPasswordSetup||auth.user?.id!==auth.profile?.userId||!auth.can('readOperationalData'))return null;
 const owner=auth.user?.id||'',access=JSON.stringify(auth.profile);
 const session=actionSessionKey(auth.session?.access_token)||(publication.adapter.availability==='preview'?'synthetic-session':'');
 if(!session||publication.ownerId!==owner||publication.accessKey!==access||publication.sessionKey!==session)return null;
 if(!cards)return <p role="alert" className="text-xs text-red-800">The reviewed actions could not be verified. Refresh their status before continuing.</p>;
 return <div className="space-y-3" data-tenbot-action-workspace>
  {publication.adapter.availability==='preview'?<p role="note" className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">Synthetic interaction preview. No account authentication or business write occurs. Use synthetic test text here; do not enter your real password.</p>:null}
  {cards.map(card=><ActionReviewCard key={`${owner}:${access}:${session}:${card.reference.id}:${card.reference.revision}:${card.reference.hash}:${card.reference.expiresAt}`} card={card} adapter={publication.adapter} ownerKey={`${owner}:${access}`} sessionKey={session} onRequestCorrection={onRequestCorrection}/>)}
 </div>;
}

/** Optional additive history field observed in the concurrent backend work.
 * Caller renders only inside its already reauthorized persistent answer. */
export function ConversationActionReviews({statuses}:{statuses:unknown}){
 const auth=useAuth(),publication=useContext(ActionPublicationContext);
 const parsed=useMemo(()=>{try{return Array.isArray(statuses)&&statuses.length<=1?statuses.map(value=>parseActionStatus(value)):null;}catch{return null;}},[statuses]);
 if(!auth.ready||!auth.accessAllowed||auth.requiresPasswordSetup||!auth.user||auth.user.id!==auth.profile?.userId||!auth.can('readOperationalData'))return null;
 if(!parsed)return <p className="text-xs text-slate-600">The saved action review is unavailable. Ask TenBot for its current status.</p>;
 const owner=auth.user.id,access=JSON.stringify(auth.profile),session=actionSessionKey(auth.session?.access_token);
 const adapter=publication?.ownerId===owner&&publication.accessKey===access&&publication.sessionKey===session?publication.adapter:unavailableActionAdapter;
 return <div className="space-y-3">{parsed.map(status=><ActionReviewCard key={`${owner}:${access}:${session}:${status.card.reference.id}:${status.card.reference.revision}:${status.card.reference.hash}`} card={status.card} publishedStatus={status} adapter={adapter} ownerKey={`${owner}:${access}`} sessionKey={session} onRequestCorrection={()=>window.dispatchEvent(new CustomEvent(ACTION_CORRECTION_EVENT,{detail:status.card.reference}))}/>)}</div>;
}
