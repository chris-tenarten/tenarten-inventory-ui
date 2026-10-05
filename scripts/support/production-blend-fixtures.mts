import {batchFirstProfile} from './sample-batch-first-fixture';
import {applyFormulationProfile,standardFormulationState} from '../../src/modules/samples/formulation';
import {newLocalSample} from '../../src/modules/samples/types';
const fixture=(name:string,plate:string,batches:number,chip:number,planned:number,size:number,percent:number[],materials:string[],vendor:string)=>{
 const state=applyFormulationProfile(standardFormulationState(),{...batchFirstProfile,batchChipTargetLb:String(chip)});
 const sample=newLocalSample({preparedBy:'Marcos',formulation:state});sample.sampleName=name;sample.projectName=name;sample.colorPlateNumber=plate;
 sample.blendRows=[...percent.map((p,i)=>({...sample.blendRows[0],id:`row-${i}`,percentage:String(p),color:materials[i],size:String(name==='Agawam'?i%2:1),vendor,catalogSource:'standard' as const,catalogItemId:`material-${i}`,catalogSnapshot:{package_context:{version:1,amount:'50',unit:'lb',container:'bag',catalog_source:'standard',catalog_item_id:`material-${i}`}}})),...sample.blendRows.slice(1)];
 return {name,snapshot:sample,inputs:{batchCount:batches,plannedQuantity:planned,blendSize:size}};
};
export const blendFixtures=[
 fixture('TAMU','T25-203-B',33,150,5000,1000,[10,30,20,20,20],['RC50 Clear','RC50 Clear','True Grey','True Grey','OSM (ENVIRO Flect)'],'ENVR'),
 fixture('Big Springs','T25-125-A',2,180,400,500,[5,5,15,70,5],['IT Yellow Verona','IT Yellow Verona','Texas Black','Texas Black','Verde Antique'],'CCQ'),
 fixture('Forest','T26-273-A',8,200,2000,1000,[20,40,40],['CC Rose','Red Cedar','Canadian Chocolate'],'KCI'),
 fixture('Agawam','T26-267-A',60,180,12000,1000,[17.5,17.5,2.5,2.5,15,15,10,10,5,5],['New Pure White','New Pure White','Persain Cream','Persain Cream','Georgia White','Georgia White','Canadian Blue Grey (Glacier Grey)','Canadian Blue Grey (Glacier Grey)','Raven Black','Raven Black'],'Arim'),
 fixture('Current MTT','MTT Review',1,180,200,1000,[40,30,20,5,5],['Blanco #1','Blanco #2','MOP','True Grey #1','True Grey #2'],'T&M')
];

// Historical acceptance captures reproduce printed Production evidence, not current managed defaults.
for(const [i,f] of blendFixtures.entries()){
 f.snapshot.jobNumber=['25-0317','25-1205','25-1004','26-0529',''][i];
 f.snapshot.formulation.profile!.name=['SW — historical Production 5:1','KEY','KEY','Key Resin','MTT'][i];
 const sizes=i===0?['#00','#0','#0','#1','#1']:i===1?['#0','#1','#0','#1','#0']:null;
 f.snapshot.blendRows.forEach((r,j)=>{if(r.componentRole==='aggregate'){if(sizes)r.size=sizes[j];if(i===0&&[2,3].includes(j))r.vendor='CCQ';}else if(r.componentRole==='filler')r.color='ATF-20';else if(r.componentRole==='resin')r.color=['7044 AMAZING GRAY','Big Springs Brown B','Granite Brown 07022026','Café Au Lait #KR-300-450','MTT Resin'][i];});
}
