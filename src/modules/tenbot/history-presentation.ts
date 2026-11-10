/** Presentation only: never infer authorization from an old answer's prose. */
type PreviousTurn={error?:string;historyPending?:{expiresAt?:string};answer?:{history?:{persistent?:boolean;state:'verified'|'redacted';reason?:'expired'|'access-or-evidence-changed'|'temporarily-unavailable'}}|null};
export function previousAnswerNotice(turn:PreviousTurn){
 if(turn.historyPending||turn.answer?.history?.reason==='temporarily-unavailable')return {kind:'retry' as const,message:'Previous answers need an access check.',retry:true};
 if(turn.answer?.history?.state==='verified')return null;
 if(turn.error?.startsWith('Live Job facts')||turn.answer?.history?.state==='redacted'&&turn.answer.history.reason==='expired'&&!turn.answer.history.persistent)return {kind:'legacy' as const,message:'This older live answer was not retained.',retry:false};
 if(turn.answer?.history?.state==='redacted')return {kind:'restricted' as const,message:'A previous answer is unavailable with your current access or sources.',retry:false};
 if(turn.error?.startsWith('Previous operational'))return {kind:'unavailable' as const,message:'A previous operational answer is unavailable.',retry:false};
 return null;
}
