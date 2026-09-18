import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Papa from 'papaparse';
import {calculateSampleFormulation,SAMPLE_FORMULATION_PROFILES,standardFormulationState} from '../src/modules/samples/formulation';

type Row=Record<string,string>;
const source=process.env.SAMPLE_V4_CORPUS??'/tmp/tenops-sample-v4-contract/v4-equation-validation.csv';
const parsed=Papa.parse<Row>(readFileSync(source,'utf8'),{header:true,skipEmptyLines:true});
if(parsed.errors.length)throw new Error(parsed.errors.map(error=>error.message).join('\n'));
let supported=0,excluded=0;
const excludedFormulas:string[]=[];
for(const fixture of parsed.data){
 if(fixture.result==='EXCLUDED'){excluded++;excludedFormulas.push(fixture.formula);continue;}
 const profileId=fixture.assigned_profile.split(':')[0];
 const profile=SAMPLE_FORMULATION_PROFILES.find(candidate=>candidate.id===profileId);
 assert(profile,`${fixture.formula} profile exists`);
 const volume=Number(fixture.volume_cft);
 const area=volume/(.375/12);
 const width=area*12;
 const effectiveDensity=Number(fixture.recorded_chip_oz)/16/volume;
 const state={...standardFormulationState(),width:String(width),length:'12',thicknessIn:'0.375',materialDensity:String(effectiveDensity),chipDensityProvenance:fixture.assigned_profile.endsWith(':filler-override')?'increased_filler_adjustment' as const:'profile_default' as const,profile:{...profile},resinParts:profile.resinParts,hardenerParts:profile.hardenerParts};
 const rows=[
  {percentage:'100',quantity:'',unit:'oz',componentRole:'aggregate' as const,calculationBasis:'target_total' as const,quantityProvenance:'calculated' as const},
  {percentage:'',quantity:fixture.recorded_filler_oz,unit:'oz',componentRole:'filler' as const,calculationBasis:null,quantityProvenance:'manual' as const},
  {percentage:'',quantity:fixture.recorded_resin_fl_oz,unit:'fl oz',componentRole:'resin' as const,calculationBasis:null,quantityProvenance:'manual' as const},
  {percentage:'',quantity:'',unit:'fl oz',componentRole:'hardener' as const,calculationBasis:null,quantityProvenance:'calculated' as const},
 ];
 const result=calculateSampleFormulation(state,rows);
 const tolerance=.011;
 assert(Math.abs(Number(result.availableChipMixOz)-Number(fixture.recorded_chip_oz))<=tolerance,`${fixture.formula} Chip Mix`);
 assert(Math.abs(Number(result.effectiveResinFlOz)-Number(fixture.recorded_resin_fl_oz))<=tolerance,`${fixture.formula} Resin`);
 assert(Math.abs(Number(result.rows[3].effectiveQuantity)-Number(fixture.recorded_hardener_fl_oz))<=tolerance,`${fixture.formula} Hardener`);
 supported++;
}
assert.equal(supported,58);assert.equal(excluded,5);
assert.deepEqual(excludedFormulas,['T26-264-A','T26-230-A (MTT 88099)','T26-226-A','T26-225-B','T26-225-A']);
console.log(`Sample V4 corpus regression passed: ${supported} supported, ${excluded} deliberately excluded.`);
