/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Local QA imports the Deno Edge renderer through tsx.
import {mkdir,writeFile} from 'node:fs/promises';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';

const snapshot={requested_by:'Anthony Iorio',requested_date:'2026-09-01',project_name:'NorthPark Lobby Renovation',prepared_by:'Chris Ngo',customer_name:'Acme Architectural Surfaces',job_number:'',color_plate_number:'T26-123A',finish_requested:'Honed, low sheen',sample_size:'12 x 12 in.',sample_quantity:'3',notes:'Develop a warm neutral terrazzo blend for lobby review. Match the approved design palette while keeping aggregate distribution balanced.',filler:'Calcium carbonate',sealer:'Betco Crete Rx',resin_supplier:'Terrazzo & Marble Supply',resin_color_number:'Warm Gray WG-42',approved_date:'',issue_number:1,more_notes:'Prepare three matching plates. Retain one control plate at Tenarten after customer review.',blend_rows:[
 {percentage:'24',color:'Georgia White',size:'#1',material_type:'Marble',quantity:'6',unit:'lb',vendor:'T&M Supply'},
 {percentage:'18',color:'Botticino',size:'#0',material_type:'Marble',quantity:'4.5',unit:'lb',vendor:'T&M Supply'},
 {percentage:'14',color:'Mother of Pearl',size:'#1',material_type:'Shell',quantity:'3.5',unit:'lb',vendor:'Klein & Co.'},
 {percentage:'12',color:'Black',size:'#0',material_type:'Marble',quantity:'3',unit:'lb',vendor:'Arim'},
 {percentage:'10',color:'Verde Alto',size:'#2',material_type:'Marble',quantity:'2.5',unit:'lb',vendor:'Arim'},
 {percentage:'8',color:'Clear Glass',size:'#1',material_type:'Glass',quantity:'2',unit:'lb',vendor:'T&M Supply'},
 {percentage:'6',color:'Amber Glass',size:'#0',material_type:'Glass',quantity:'1.5',unit:'lb',vendor:'T&M Supply'},
 {percentage:'8',color:'Custom Recycled Cobalt Glass Blend',size:'Hand sorted',material_type:'Recycled glass',quantity:'.5',unit:'scoop',vendor:'Local manual stock'},
]};
await mkdir('output/pdf',{recursive:true});
await writeFile('output/pdf/sample-work-order-pp003-candidate.pdf',await renderSampleWorkOrder(snapshot));
await mkdir('tmp/pdfs/pp003-polish',{recursive:true});
await writeFile('tmp/pdfs/pp003-polish/sample-work-order-continuation.pdf',await renderSampleWorkOrder({...snapshot,blend_rows:Array.from({length:32},(_,index)=>({percentage:String((index%9)+1),color:`Representative long formulation material ${index+1}`,size:index%2?'#1':'Hand sorted',material_type:index%3?'Marble':'Recycled glass',quantity:String((index+1)/4),unit:index%4?'lb':'scoop',vendor:index%2?'Terrazzo & Marble Supply':'Local manual stock'}))}));
console.log('output/pdf/sample-work-order-pp003-candidate.pdf');
