/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Local QA imports the Deno Edge renderer through tsx.
import {mkdir,writeFile} from 'node:fs/promises';
import {renderSampleWorkOrder} from '../supabase/functions/generate-sample-pdf/index.ts';

const snapshot={requested_by:'Anthony Iorio',requested_date:'2026-09-01',project_name:'NorthPark Lobby Renovation',prepared_by:'Chris Ngo',customer_name:'Acme Architectural Surfaces',job_number:'',color_plate_number:'T26-123A',finish_requested:'Honed, low sheen',sample_size:'12 x 12 in.',sample_quantity:'3',notes:'Develop a warm neutral terrazzo blend for lobby review. Match the approved design palette while keeping aggregate distribution balanced.',filler:'18 oz Filler',sealer:'Betco Crete Rx',resin_supplier:'Terrazzo & Marble Supply',resin_color_number:'15 fl oz Warm Gray WG-42',approved_date:'',render_context:'working',more_notes:'Prepare three matching plates. Retain one control plate at Tenarten after customer review.',formulation_state:{basis:'weight_per_sf',calculationVersion:'sample-formulation-v3-historical-parity',materialDensity:'128',thicknessIn:'0.375',resinParts:'5',hardenerParts:'1',derived:{areaSf:1,effectiveWeightPerSf:4,availableChipMixOz:64}},blend_rows:[
 {percentage:'40',color:'Georgia White',size:'#1',material_type:'Marble',calculated_quantity:'25.6',quantity_provenance:'calculated',unit:'oz',vendor:'T&M Supply'},
 {percentage:'30',color:'Botticino',size:'#0',material_type:'Marble',calculated_quantity:'19.2',quantity_provenance:'calculated',unit:'oz',vendor:'T&M Supply'},
 {percentage:'20',color:'Mother of Pearl',size:'#1',material_type:'Shell',calculated_quantity:'12.8',quantity_provenance:'calculated',unit:'oz',vendor:'Klein & Co.'},
 {percentage:'5',color:'Black',size:'#0',material_type:'Marble',calculated_quantity:'3.2',quantity_provenance:'calculated',unit:'oz',vendor:'Arim'},
 {percentage:'5',color:'Verde Alto',size:'#2',material_type:'Marble',calculated_quantity:'3.2',quantity_provenance:'calculated',unit:'oz',vendor:'Arim'},
 {percentage:'',color:'Filler',size:'',material_type:'Filler',quantity:'18',quantity_provenance:'manual',unit:'oz',vendor:''},
 {percentage:'',color:'Resin',size:'',material_type:'Resin',quantity:'15',quantity_provenance:'manual',unit:'fl oz',vendor:''},
 {percentage:'',color:'Hardener',size:'',material_type:'Hardener',calculated_quantity:'3',quantity_provenance:'calculated',unit:'fl oz',vendor:''},
]};
await mkdir('output/pdf',{recursive:true});
await writeFile('output/pdf/sample-work-order-pp003-candidate.pdf',await renderSampleWorkOrder(snapshot));
await mkdir('tmp/pdfs/pp003-polish',{recursive:true});
await writeFile('tmp/pdfs/pp003-polish/sample-work-order-continuation.pdf',await renderSampleWorkOrder({...snapshot,blend_rows:Array.from({length:32},(_,index)=>({percentage:String((index%9)+1),color:`Representative long formulation material ${index+1}`,size:index%2?'#1':'Hand sorted',material_type:index%3?'Marble':'Recycled glass',quantity:String((index+1)/4),unit:index%4?'lb':'scoop',vendor:index%2?'Terrazzo & Marble Supply':'Local manual stock'}))}));
console.log('output/pdf/sample-work-order-pp003-candidate.pdf');
