// Only the unmodified renderer reference uses these shims. No real identity, grants or API.
export const useAuth=()=>({profile:{isActive:true,role:'guest',readOnly:true},can:()=>false});
export const useAccountPreferences=()=>({accountScoped:false,preferences:{},setPreference:async()=>{throw Error('No account writes in reference')}});
export const saveBidProjectedWindow=async()=>{throw Error('Reference is read-only; no backend exists')};
export const openProductionJob=(id)=>{window.dispatchEvent(new CustomEvent('reference-selected',{detail:id}))};
