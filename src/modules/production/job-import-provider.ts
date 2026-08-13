import { compositeExtractionProvider } from './providers/composite-extraction-provider';

export type ExtractionConfidence = 'high' | 'medium' | 'missing';
export type ExtractedJobField =
  | 'jobNumber' | 'jobName' | 'customer' | 'workOrderNumber' | 'plateNumber'
  | 'productType' | 'resin' | 'thickness' | 'pieces' | 'requestedDelivery' | 'location';

export type ExtractedJobMetadata = Record<ExtractedJobField, string> & {
  confidence: Record<ExtractedJobField, ExtractionConfidence>;
};

export interface JobMetadataExtractionProvider {
  extractJobMetadata(files: File[]): Promise<ExtractedJobMetadata>;
}

export const emptyExtractedJobMetadata = (): ExtractedJobMetadata => ({
  jobNumber: '', jobName: '', customer: '', workOrderNumber: '', plateNumber: '',
  productType: '', resin: '', thickness: '', pieces: '', requestedDelivery: '', location: '',
  confidence: {
    jobNumber: 'missing', jobName: 'missing', customer: 'missing', workOrderNumber: 'missing',
    plateNumber: 'missing', productType: 'missing', resin: 'missing', thickness: 'missing',
    pieces: 'missing', requestedDelivery: 'missing', location: 'missing',
  },
});

export const deterministicJobMetadataExtractionProvider: JobMetadataExtractionProvider = compositeExtractionProvider;
