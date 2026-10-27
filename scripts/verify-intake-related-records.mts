import assert from 'node:assert/strict';
import {newScopeLine,type ScopeCapture,type SourceOption} from '../src/modules/intake-materials/contracts';
import {capturedRecord,governingLines,selectionKeys,sourceKey} from '../src/modules/intake-materials/related-records';

const sampleId='00000000-0000-4000-8000-000000000001';
const versionId='00000000-0000-4000-8000-000000000002';
const blendId='00000000-0000-4000-8000-000000000003';
const retained={...newScopeLine(),label:'Finish A',sourceKind:'version' as const,sourceId:versionId,quantity:'150',unit:'pieces',productionBatches:'3',plannedQuantity:'600',assumptions:'Reviewed manufacturing evidence',mappings:{'0:aggregate:0':{vendor:'Supplier',color:'White',size:'#1',category:'chip',unit:'Bags',factor:'50',evidence:'Exact package checked',leadTimeDays:'14',supplier:'Supplier'}}};
const secondFinish={...structuredClone(retained),label:'Finish B',quantity:'25',mappings:{'1:aggregate:0':structuredClone(retained.mappings['0:aggregate:0'])}};
const previous={id:'capture',lines:[retained,secondFinish],sources:[{id:sampleId,_scope_provenance:{sample_id:sampleId,version_number:1}}]} as unknown as ScopeCapture;
const options:SourceOption[]=[{kind:'version',id:versionId,label:'Live Sample label · saved v1'},{kind:'blend',id:blendId,label:'T26-497-A · issued Blend'}];
const before=JSON.stringify({previous,options});

assert.equal(sourceKey(retained),`version:${versionId}`);
assert.equal(sourceKey(newScopeLine()),'');
assert.deepEqual(selectionKeys(previous),[`version:${versionId}`]);
assert.deepEqual(selectionKeys(undefined),[]);
// Selecting a revision once preserves every existing finish using it, including all hidden provenance.
assert.deepEqual(governingLines([`version:${versionId}`,`version:${versionId}`],previous,options),[retained,secondFinish]);
assert.deepEqual(governingLines([`version:${versionId}`],previous,[]),[retained,secondFinish]);
const cloned=governingLines([`version:${versionId}`],previous,options);
cloned[0].mappings['0:aggregate:0'].evidence='Edited copy';
assert.equal(previous.lines[0].mappings['0:aggregate:0'].evidence,'Exact package checked');
// A replacement reference receives no quantity, conversion, override or evidence from its predecessor.
assert.deepEqual(governingLines([`blend:${blendId}`],previous,options),[{...newScopeLine(),sourceKind:'blend',sourceId:blendId,label:options[1].label}]);
const other={...structuredClone(secondFinish),sourceKind:'blend' as const,sourceId:blendId};
const ordered={...previous,lines:[retained,other]};
const orderedBefore=JSON.stringify(ordered);
const moved=governingLines([`blend:${blendId}`],ordered,options)[0];
assert.deepEqual(moved,{...other,mappings:{'0:aggregate:0':other.mappings['1:aggregate:0']}});
assert.equal(moved.mappings['0:aggregate:0'].factor,'50');
assert.equal(moved.mappings['0:aggregate:0'].evidence,'Exact package checked');
assert.equal(Object.hasOwn(moved.mappings,'1:aggregate:0'),false);
const reordered=governingLines([`blend:${blendId}`,`version:${versionId}`],ordered,options);
assert.equal(reordered[0].mappings['0:aggregate:0'].evidence,'Exact package checked');
assert.equal(reordered[1].mappings['1:aggregate:0'].evidence,'Exact package checked');
assert.equal(JSON.stringify(ordered),orderedBefore);
assert.deepEqual(governingLines([],previous,options),[newScopeLine()]);
assert.deepEqual(governingLines([''],undefined,[]),[newScopeLine()]);
assert.throws(()=>governingLines(['version:missing'],previous,options),/Governing revision is unavailable/);

const source={id:sampleId,color_plate_number:'T26-497-A',_scope_provenance:{sample_id:sampleId,version_number:1}};
assert.deepEqual(capturedRecord(source,retained),{label:'T26-497-A · Saved Sample · v1',sampleId});
assert.deepEqual(capturedRecord({id:sampleId,colorPlateNumber:'T26-497-A',_scope_provenance:{revision:2}},{...retained,sourceKind:'blend',sourceId:blendId}),{label:'T26-497-A · Issued Blend Sheet · r2',sampleId});
assert.equal(capturedRecord({id:sampleId,_scope_provenance:{sample_id:'not-a-uuid',issue_number:2}},{...retained,sourceKind:'issued'}).sampleId,sampleId);
assert.equal(capturedRecord({id:versionId},retained).sampleId,null);
assert.equal(capturedRecord({_scope_provenance:{sample_id:versionId}},retained).sampleId,null);
assert.equal(capturedRecord(undefined,retained).sampleId,null);
assert.equal(capturedRecord(undefined,retained).label,'Sample · Saved Sample · captured revision');
assert.equal(capturedRecord(undefined,newScopeLine()).label,'Governing Sample / Blend revision unresolved');
assert.equal(capturedRecord({color_plate_number:'Legacy',_scope_provenance:{verified_at:'2026-10-27T12:00:00Z'}},{...retained,sourceKind:'historical'}).label,'Legacy · Verified historical Sample · verified 2026-10-27T12:00:00Z');
assert.equal(JSON.stringify({previous,options}),before);
console.log('Passed: exact governing revisions, retained planning provenance and repeated finishes, replacement reset, unresolved fallback, immutable captions, safe Sample navigation and no mutation.');
