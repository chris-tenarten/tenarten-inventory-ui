import { supabase } from '@/lib/supabase';
import { createColorPlateLabel } from './color-plate-label';
import type { ColorPlateLabelFields } from './color-plate-label-fields';

// Checks the current account grant AND the caller's existing Sample SELECT/RLS access.
// Missing migration/RPC support, revocation and network failures all fail closed.
export async function requireColorPlateLabelAccess(sampleId: string) {
  const { data, error } = await supabase.rpc('authorize_sample_color_plate_label', { p_sample_id: sampleId || null });
  if (error || data !== true) throw new Error('Color Plate Label access could not be confirmed. Refresh the Sample or contact an Admin.');
}

export async function generateAuthorizedColorPlateLabel(fields: ColorPlateLabelFields, draft: boolean, sampleId: string) {
  await requireColorPlateLabelAccess(sampleId);
  return createColorPlateLabel(fields, draft);
}
