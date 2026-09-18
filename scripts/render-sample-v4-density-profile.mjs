import {readFileSync} from 'node:fs';
import {createEdgeHarness,fileImport,repoRoot,outputDirectory} from './pdf-overflow-stress-utils.mjs';

const outputPath=`${outputDirectory}/sample-work-order-v4-density-profile-candidate.pdf`;
const snapshot={
  render_context:'working',project_name:'Historical parity validation',customer_name:'Tenarten QA',prepared_by:'QA',requested_date:'2026-09-18',
  color_plate_number:'T26-V4QA',finish_requested:'200 Grit',sample_size:'6 x 6',sample_quantity:'4',filler:'ATF-20',sealer:'TerraGlaze',resin_supplier:'Key Resin',resin_color_number:'001 White',
  formulation_state:{basis:'weight_per_sf',calculationVersion:'sample-formulation-v4-density-profile',materialDensity:'120',thicknessIn:'.375',profile:{name:'Tenarten Epoxy Standard 200 / 5:1'},resinParts:'5',hardenerParts:'1',derived:{areaSf:1,productionVolumeCft:.03125,effectiveChipDensityLbCft:120,effectiveWeightPerSf:3.75,dryPoolOz:82,actualDryTotalOz:82,dryPoolVarianceOz:0,effectiveFillerOz:22,effectiveResinFlOz:15,availableChipMixOz:60}},
  blend_rows:[
    {percentage:40,color:'Blanco Mexicano',size:'#1',material_type:'Marble',vendor:'KCI',component_role:'aggregate',quantity_provenance:'calculated',calculated_quantity:24,unit:'oz'},
    {percentage:30,color:'Blanco Mexicano',size:'#2',material_type:'Marble',vendor:'KCI',component_role:'aggregate',quantity_provenance:'calculated',calculated_quantity:18,unit:'oz'},
    {percentage:20,color:'MOP',size:'#1',material_type:'Shell',vendor:'KCI',component_role:'aggregate',quantity_provenance:'calculated',calculated_quantity:12,unit:'oz'},
    {percentage:5,color:'True Grey',size:'#1',material_type:'Marble',vendor:'KCI',component_role:'aggregate',quantity_provenance:'calculated',calculated_quantity:3,unit:'oz'},
    {percentage:5,color:'True Grey',size:'#2',material_type:'Marble',vendor:'KCI',component_role:'aggregate',quantity_provenance:'calculated',calculated_quantity:3,unit:'oz'},
    {color:'ATF-20',material_type:'Filler',component_role:'filler',quantity_provenance:'manual',quantity:22,unit:'oz'},
    {color:'001 White',material_type:'Resin',component_role:'resin',quantity_provenance:'manual',quantity:15,unit:'fl oz'},
    {color:'Hardener',component_role:'hardener',quantity_provenance:'calculated',calculated_quantity:3,unit:'fl oz'},
  ],
};
createEdgeHarness({
  name:'sample-v4-density-profile',
  sourcePath:`${repoRoot}/supabase/functions/generate-sample-pdf/index.ts`,
  startMarker:'const allowedOrigins',endMarker:'if (typeof Deno !== "undefined")',
  fixture:snapshot,
  imports:`import {writeFileSync} from 'node:fs';import {PDFDocument,StandardFonts,rgb} from ${fileImport(`${repoRoot}/node_modules/pdf-lib/es/index.js`)};import {buildSamplePdfModel,paginateSampleRows,SAMPLE_PDF_VERSION,sampleRowHeight,wrapSampleText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/sample-work-order-pdf-model.mjs`)};import {normalizePdfText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/pdf-text.mjs`)};import {chunkPdfLines,wrapMeasuredPdfText} from ${fileImport(`${repoRoot}/supabase/functions/_shared/pdf-layout.mjs`)};`,
  invocation:`void(async()=>{const bytes=await renderSampleWorkOrder(fixture);writeFileSync(${JSON.stringify(outputPath)},bytes);})();`,
});
const bytes=readFileSync(outputPath);
if(!bytes.length)throw new Error('Candidate PDF was empty');
console.log(outputPath);
