export const MAX_ESTIMATED_MINUTES=10080;

export function normalizeEstimatedMinutes(value:unknown):number|null{
  const minutes=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):Number.NaN;
  return Number.isInteger(minutes)&&minutes>=1&&minutes<=MAX_ESTIMATED_MINUTES?minutes:null;
}

export function formatEstimatedMinutes(value:unknown):string|null{
  const minutes=normalizeEstimatedMinutes(value);
  if(minutes===null)return null;
  const hours=Math.floor(minutes/60);
  const remainder=minutes%60;
  return [hours?`${hours}h`:'',remainder?`${remainder}m`:''].filter(Boolean).join(' ');
}
