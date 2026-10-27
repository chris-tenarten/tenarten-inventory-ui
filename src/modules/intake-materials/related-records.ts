import {newScopeLine,type ScopeCapture,type ScopeLine,type SourceOption} from './contracts';

export function sourceKey(line:Pick<ScopeLine,'sourceKind'|'sourceId'>):string{
 return line.sourceId?`${line.sourceKind}:${line.sourceId}`:'';
}

export function selectionKeys(capture:ScopeCapture|undefined):string[]{
 return [...new Set((capture?.lines??[]).map(sourceKey).filter(Boolean))];
}

/** Change references without rewriting planning already retained for the same revision. */
export function governingLines(keys:string[],previous:ScopeCapture|undefined,options:SourceOption[]):ScopeLine[]{
 const lines:ScopeLine[]=[];
 for(const key of new Set(keys.filter(Boolean))){
  const retained=(previous?.lines??[]).map((line,index)=>({line,index})).filter(({line})=>sourceKey(line)===key);
  if(retained.length){
   for(const {line,index} of retained){
    const copy=structuredClone(line),nextIndex=lines.length;
    // Assessment keys are positional. Keep the reviewed identity/conversion when a
    // retained finish moves, without changing its evidence or the prior capture.
    if(index!==nextIndex)copy.mappings=Object.fromEntries(Object.entries(copy.mappings).map(([mappingKey,value])=>[
     mappingKey.startsWith(`${index}:`)?`${nextIndex}:${mappingKey.slice(String(index).length+1)}`:mappingKey,value,
    ]));
    lines.push(copy);
   }
   continue;
  }
  const option=options.find(candidate=>sourceKey({sourceKind:candidate.kind,sourceId:candidate.id})===key);
  if(!option)throw new Error('Governing revision is unavailable. Refresh related records before saving.');
  lines.push({...newScopeLine(),sourceKind:option.kind,sourceId:option.id,label:option.label});
 }
 return lines.length?lines:[newScopeLine()];
}

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text=(value:unknown)=>typeof value==='string'||typeof value==='number'?String(value).trim():'';

/** Captions and navigation come from the immutable source, never a live revision label. */
export function capturedRecord(source:Record<string,unknown>|undefined,line:ScopeLine):{label:string;sampleId:string|null}{
 const snapshot=source??{};
 const provenance=(snapshot._scope_provenance??{}) as Record<string,unknown>;
 const plate=text(snapshot.color_plate_number??snapshot.colorPlateNumber??snapshot.sample_name??snapshot.sampleName)||'Sample';
 const kind={issued:'Issued Sample',version:'Saved Sample',blend:'Issued Blend Sheet',historical:'Verified historical Sample'}[line.sourceKind];
 const revision=line.sourceKind==='version'&&text(provenance.version_number)?`v${text(provenance.version_number)}`:
  line.sourceKind==='issued'&&text(provenance.issue_number)?`issue ${text(provenance.issue_number)}`:
  line.sourceKind==='blend'&&text(provenance.revision)?`r${text(provenance.revision)}`:
  line.sourceKind==='historical'&&text(provenance.verified_at)?`verified ${text(provenance.verified_at)}`:'captured revision';
 const candidates=[provenance.sample_id,snapshot.id].map(text);
 const sampleId=candidates.find(id=>uuid.test(id)&&id!==line.sourceId)??null;
 const issuedAt=line.sourceKind==='blend'?text(provenance.issued_at||provenance.created_at):'';
 return {label:!line.sourceId?'Governing Sample / Blend revision unresolved':`${plate} · ${kind} · ${revision}${issuedAt?` · ${new Date(issuedAt).toLocaleString()}`:''}`,sampleId};
}
