/** Only punctuation/case of an unambiguous conventional identifier is normalized. */
export function preferredColorPlate(value:string){
 const trimmed=value.trim();
 const match=/^T(\d{2})-(\d{3,})-?([A-Z])$/i.exec(trimmed);
 return match?`T${match[1]}-${match[2]}-${match[3].toUpperCase()}`:trimmed;
}
export function colorPlateWarning(value:string){
 return value.trim()&&!/^T\d{2}-\d{3,}-?[A-Z]$/i.test(value.trim())
  ? 'This differs from the usual Color Plate format. Check the identifier; it can be saved as entered.' : '';
}
export function colorPlateConflict<T extends {id:string;colorPlateNumber:string}>(records:T[],id:string,value:string){
 const key=preferredColorPlate(value).toUpperCase();
 return key?records.find(r=>r.id!==id&&preferredColorPlate(r.colorPlateNumber).toUpperCase()===key):undefined;
}
