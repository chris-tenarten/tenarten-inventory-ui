import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankFormulationState} from '../src/modules/samples/formulation';
import {formatSampleError,translateSampleError,validateSampleForOutput} from '../src/modules/samples/sample-errors';
import type {SampleBlendRow,SampleRecord} from '../src/modules/samples/types';

const row=(changes:Partial<SampleBlendRow>={}):SampleBlendRow=>({id:'row-1',percentage:'100',color:'White',size:'#1',materialType:'Chip',quantity:'',unit:'lb',vendor:'',catalogSource:null,catalogItemId:null,catalogSnapshot:{},displayOrder:0,componentRole:'aggregate',calculationBasis:'target_total',quantityProvenance:'calculated',calculatedQuantity:'',...changes});
const sample=(changes:Partial<SampleRecord>={}):SampleRecord=>({id:'sample-1',sampleName:'',bidId:'',jobId:'',requestedBy:'',requestedDate:'',projectName:'',preparedBy:'',customerName:'',colorPlateNumber:'',finishRequested:'',sampleSize:'',sampleQuantity:'',notes:'',filler:'',sealer:'',resinSupplier:'',resinColorNumber:'',moreNotes:'',approvedDate:'',createdByUserId:'user-1',creatorName:'User',createdAt:'',updatedAt:'',jobNumber:'',formulation:{...blankFormulationState(),totalWeight:'10'},blendRows:[row()],workingVersions:[],issuedDocuments:[],...changes});

assert.equal(translateSampleError({code:'42501',message:'denied'},'formal-issue').kind,'permission');
assert.match(formatSampleError(translateSampleError({code:'42501',message:'denied'},'formal-issue')),/No issued Sample Work Order was created/);
assert.equal(translateSampleError({code:'409',message:'stale'},'save-draft').kind,'conflict');
assert.equal(translateSampleError({code:'P0002',message:'missing'},'restore-version').kind,'not-found');
assert.equal(translateSampleError({code:'55000',message:'immutable'},'delete-draft').kind,'immutable');
assert.equal(translateSampleError(new TypeError('fetch failed'),'working-pdf').kind,'network');
assert.equal(translateSampleError(new Error('render failed'),'working-pdf').kind,'pdf-generation');
assert.equal(translateSampleError(new Error('bad material'),'catalog').kind,'catalog-invalid');
assert.equal(translateSampleError(new Error('unexpected'),'duplicate').kind,'unknown');
assert.match(formatSampleError(translateSampleError(new Error('Prepared By is required'),'formal-issue')),/Prepared By is required/);
assert.match(formatSampleError(translateSampleError(new Error('invalid color plate'),'save-draft')),/TYY-NNNL/);

assert.equal(validateSampleForOutput(sample()),null,'standalone Samples must not require Project or Customer');
let readiness=validateSampleForOutput(sample(),'formal-issue');
assert.match(readiness?.message??'',/Prepared By is required/);
readiness=validateSampleForOutput(sample({blendRows:[row({percentage:'95'})]}));
assert.equal(readiness?.kind,'calculation-incomplete');assert.match(readiness?.message??'',/95%/);
readiness=validateSampleForOutput(sample({formulation:blankFormulationState()}));
assert.match(readiness?.message??'',/Total Weight/);
readiness=validateSampleForOutput(sample({formulation:{...blankFormulationState(),basis:'weight_per_sf'}}));
assert.match(readiness?.message??'',/Production Pour Width and Length, Material Density, and Thickness/);
readiness=validateSampleForOutput(sample({blendRows:[row({componentRole:'hardener',calculationBasis:null,quantityProvenance:'calculated'})]}));
assert.match(readiness?.message??'',/Resin quantity/);
readiness=validateSampleForOutput(sample({preparedBy:'Gio',formulation:{...blankFormulationState(),totalWeight:'10',resinParts:'3'}}),'formal-issue');
assert.equal(readiness?.diagnostic.operation,'formal-issue');assert.match(readiness?.message??'',/valid Resin : Hardener ratio/);

const workspace=readFileSync(new URL('../src/modules/samples/SampleWorkspace.tsx',import.meta.url),'utf8');
const versions=readFileSync(new URL('../src/modules/samples/SampleVersionHistory.tsx',import.meta.url),'utf8');
assert.match(workspace,/Sample not issued — Draft could not be saved/);
assert.match(workspace,/Sample issued, but its PDF could not be generated\. The issued snapshot is safe/);
assert.ok(workspace.indexOf("documentId=await issueSample")<workspace.indexOf("url=await generateSamplePdf(documentId)"),'issuance must precede issued PDF generation');
assert.match(versions,/Draft saved, but Working PDF could not be generated\. Your Sample changes were saved/);
assert.ok(versions.indexOf('await saveSample(sample)')<versions.indexOf('await generateWorkingSamplePdf'),'current Working PDF must save before generation');

console.log('Sample actionable error handling checks passed.');
