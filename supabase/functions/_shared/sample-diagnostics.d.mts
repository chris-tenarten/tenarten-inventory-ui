export type GenerationDiagnostic={code:string;stage:string;field:string;expected:string;actual:string;source:string;correlationId:string;explanation:string;observations:Record<string,unknown>;payloadContract:string};
export function generationDiagnostic(error:unknown,stage:string,context?:{state?:unknown;draftState?:unknown;source?:string;correlationId?:string}):GenerationDiagnostic;
export function diagnosticResponse(user:unknown,error:unknown,stage:string,context?:Record<string,unknown>):Promise<{diagnostic?:GenerationDiagnostic}>;
export function readGenerationDiagnostic(value:unknown):GenerationDiagnostic|null;
