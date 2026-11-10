/** Presentation only: trim insignificant decimal zeros without numeric conversion/rounding. */
export function displayRatioPart(value) {
 const text=String(value??'').trim();
 return /^\d+\.\d+$/.test(text)?text.replace(/0+$/,'').replace(/\.$/,''):text;
}
export function displayRatio(resin,hardener){return `${displayRatioPart(resin)}:${displayRatioPart(hardener)}`;}
export function displayProfileRatio(value){
 return String(value??'').replace(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/g,(_,a,b)=>displayRatio(a,b));
}
