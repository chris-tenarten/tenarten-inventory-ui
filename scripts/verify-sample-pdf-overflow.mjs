import { writeFileSync } from 'node:fs';
import { assertTailMarkers,extractPdfText,outputDirectory } from './pdf-overflow-stress-utils.mjs';
import { renderSampleWorkOrder } from '../supabase/functions/generate-sample-pdf/index.ts';

const outputPath=`${outputDirectory}/sample-work-order-overflow-stress.pdf`;
const snapshot={projectName:'Project '+('identity '.repeat(28))+'SAMPLE-PROJECT-TAIL',requestedBy:'Requested '+('person '.repeat(24))+'SAMPLE-REQUESTED-TAIL',customerName:'Customer '+('identity '.repeat(24))+'SAMPLE-CUSTOMER-TAIL',requestedDate:'2026-09-10',colorPlateNumber:'CP-OVERFLOW',preparedBy:'Prepared '+('person '.repeat(20))+'SAMPLE-PREPARED-TAIL',sampleSize:'24 x 24',sampleQuantity:'4',jobNumber:'26-9999',approvedDate:'',finishRequested:'Finish '+('detail '.repeat(34))+'SAMPLE-FINISH-TAIL',notes:Array.from({length:24},(_,index)=>`SAMPLE-NOTE-${index+1} retained`).join('\n')+'\nSAMPLE-NOTES-TAIL',filler:'Filler '+('detail '.repeat(18))+'SAMPLE-FILLER-TAIL',sealer:'Sealer '+('detail '.repeat(18))+'SAMPLE-SEALER-TAIL',resinSupplier:'Supplier '+('detail '.repeat(18))+'SAMPLE-SUPPLIER-TAIL',resinColorNumber:'Color '+('detail '.repeat(18))+'SAMPLE-COLOR-TAIL',moreNotes:Array.from({length:105},(_,index)=>`SAMPLE-MORE-NOTE-${index+1} retained`).join('\n')+'\nSAMPLE-MORE-NOTES-TAIL',blendRows:Array.from({length:18},(_,index)=>({percentage:'5.5',color:`Blend color ${index+1} `+('description '.repeat(8))+(index===17?'SAMPLE-ROW-TAIL':''),size:'#1',materialType:'Marble Chip',quantity:'1',unit:'Bag',vendor:'Vendor '+('identity '.repeat(8))}))};
snapshot.render_context='working';
const bytes=await renderSampleWorkOrder(snapshot);
writeFileSync(outputPath,bytes);
const extracted=await extractPdfText(outputPath);
if(!extracted.text.includes('WORKING SAMPLE - NOT ISSUED'))throw new Error('Working Sample PDF status marker is missing.');
assertTailMarkers(extracted.text,['SAMPLE-PROJECT-TAIL','SAMPLE-REQUESTED-TAIL','SAMPLE-CUSTOMER-TAIL','SAMPLE-PREPARED-TAIL','SAMPLE-FINISH-TAIL','SAMPLE-NOTES-TAIL','SAMPLE-FILLER-TAIL','SAMPLE-SEALER-TAIL','SAMPLE-SUPPLIER-TAIL','SAMPLE-COLOR-TAIL','SAMPLE-ROW-TAIL','SAMPLE-MORE-NOTES-TAIL'],'Sample Work Order');
console.log(`Sample Work Order overflow stress verifier passed (${extracted.pages.length} pages).`);
