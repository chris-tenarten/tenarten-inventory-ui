export const MAX_ESTIMATED_MINUTES=10080;
export const WORKDAY_MINUTES=480;
export type EstimateUnit='minutes'|'hours'|'days';

const unitMinutes:Record<EstimateUnit,number>={minutes:1,hours:60,days:WORKDAY_MINUTES};

export function normalizeEstimatedMinutes(value:unknown):number|null{
  const minutes=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):Number.NaN;
  return Number.isInteger(minutes)&&minutes>=1&&minutes<=MAX_ESTIMATED_MINUTES?minutes:null;
}

export function formatEstimatedMinutes(value:unknown):string|null{
  const minutes=normalizeEstimatedMinutes(value);
  if(minutes===null)return null;
  const days=Math.floor(minutes/WORKDAY_MINUTES);
  const afterDays=minutes%WORKDAY_MINUTES;
  const hours=Math.floor(afterDays/60);
  const remainder=afterDays%60;
  return [days?`${days}d`:'',hours?`${hours}h`:'',remainder?`${remainder}m`:''].filter(Boolean).join(' ');
}

export function estimateInputToMinutes(value:unknown,unit:EstimateUnit):number|null{
  const amount=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):Number.NaN;
  if(!Number.isFinite(amount)||amount<=0)return null;
  if(unit==='minutes'&&!Number.isInteger(amount))return null;
  const rawMinutes=amount*unitMinutes[unit];
  const roundedMinutes=Math.round(rawMinutes);
  if(Math.abs(rawMinutes-roundedMinutes)>1e-9)return null;
  return normalizeEstimatedMinutes(roundedMinutes);
}

export function estimatedMinutesToInput(value:unknown,unit:EstimateUnit):number|null{
  const minutes=normalizeEstimatedMinutes(value);
  if(minutes===null)return null;
  return Number((minutes/unitMinutes[unit]).toFixed(6));
}
