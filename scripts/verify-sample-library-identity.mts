import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankFormulationState} from '../src/modules/samples/formulation';
import {sampleFormulationPreview,sampleLibraryContext,sampleLibraryMetadata,sampleLibraryStatus,sampleLibraryTitle} from '../src/modules/samples/library-row';
import type {SampleBlendRow,SampleIssuedDocument,SampleRecord,SampleWorkingVersion} from '../src/modules/samples/types';

const material=(color='',size=''):SampleBlendRow=>({id:'row',percentage:'',color,size,materialType:'',quantity:'',unit:'lb',vendor:'',catalogSource:null,catalogItemId:null,catalogSnapshot:{},displayOrder:0,componentRole:'aggregate',calculationBasis:null,quantityProvenance:'manual',calculatedQuantity:''});
const version=(number:number):SampleWorkingVersion=>({id:`v${number}`,sampleId:'sample',versionNumber:number,versionNote:'',savedAt:'2026-09-17T10:00:00Z',savedByUserId:'user',savedByName:'Giovanni Coppola'});
const issued=(number:number):SampleIssuedDocument=>({id:`i${number}`,sampleId:'sample',issueNumber:number,issuedAt:'2026-09-17T10:00:00Z',issuedByUserId:'user',storagePath:'',snapshotHash:'',generationStatus:'generated',generatedAt:null,lastError:null});
const sample=(changes:Partial<SampleRecord>={}):SampleRecord=>({id:'sample',sampleName:'',bidId:'',jobId:'',requestedBy:'',requestedDate:'',projectName:'',preparedBy:'Giovanni Coppola',customerName:'',colorPlateNumber:'',finishRequested:'',sampleSize:'',sampleQuantity:'',notes:'',filler:'',sealer:'',resinSupplier:'',resinColorNumber:'',moreNotes:'',approvedDate:'',createdByUserId:'user',creatorName:'Giovanni Coppola',createdAt:'2026-09-16T10:00:00Z',updatedAt:'2026-09-17T10:00:00Z',jobNumber:'',formulation:blankFormulationState(),blendRows:[material()],workingVersions:[],issuedDocuments:[],...changes});

assert.equal(sampleLibraryTitle(sample()),'Untitled Sample');
assert.equal(sampleLibraryTitle(sample({sampleName:'Blue terrazzo trial'})),'Blue terrazzo trial');
assert.equal(sampleLibraryTitle(sample({projectName:'Sandy Ridge',colorPlateNumber:'T26-123A'})),'Sandy Ridge');
assert.equal(sampleLibraryTitle(sample({colorPlateNumber:'T26-123A'})),'T26-123A');
assert.equal(sampleLibraryContext(sample()),'');
assert.equal(sampleLibraryContext(sample({sampleName:'Lobby test',customerName:'ABC',projectName:'Sandy Ridge',colorPlateNumber:'T26-123A'})),'ABC · Sandy Ridge · T26-123A');
assert.equal(sampleFormulationPreview(sample()),'No materials added');
assert.equal(sampleFormulationPreview(sample({blendRows:[material('Alaska White','#1'),material('KCI HSF-2','')]})),'Alaska White #1 · KCI HSF-2 · 5:1 resin');
assert.equal(sampleLibraryStatus(sample({workingVersions:[version(1),version(2),version(3)]})),'Draft · 3 versions');
assert.equal(sampleLibraryStatus(sample({workingVersions:[version(1),version(2)],issuedDocuments:[issued(1)]})),'Issued · 2 versions');
assert.match(sampleLibraryMetadata(sample({workingVersions:[version(1),version(2),version(3)]}),'en-US'),/^Sep 17 · Giovanni Coppola · Draft · v3$/);

const queries=readFileSync(new URL('../src/modules/samples/queries.ts',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../src/modules/samples/SampleWorkspace.tsx',import.meta.url),'utf8');
assert.equal((queries.match(/rpc\('list_samples'/g)??[]).length,1,'Sample library must use one list RPC');
assert.doesNotMatch(workspace,/Customer not recorded|Unassigned Color Plate|0 issued/);
assert.match(workspace,/Sample Name/);

console.log('Sample Draft Library identity checks passed.');
