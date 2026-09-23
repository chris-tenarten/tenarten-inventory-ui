import { supabase } from '@/lib/supabase';
import type { OperationalProfile } from './operational-profile-model';
export * from './operational-profile-model';
export async function loadOperationalProfiles(): Promise<OperationalProfile[]> {
  const rows: OperationalProfile[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('sample_operational_profiles').select('id,revision,name,sort_order,is_active,chip_density,dry_pool_rate,filler_rate,resin_rate,resin_parts,hardener_parts,description').order('sort_order').order('id').range(from, from + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []) as OperationalProfile[]);
    if ((data?.length ?? 0) < 500) return rows;
  }
}
export async function saveOperationalProfile(p: Omit<OperationalProfile, 'id' | 'revision' | 'sort_order'>, existing?: OperationalProfile) {
  const { error } = await supabase.rpc('save_sample_operational_profile', { p_id: existing?.id ?? null, p_expected_revision: existing?.revision ?? null, p_values: p });
  if (error) throw new Error(error.message);
}
export async function moveOperationalProfile(p: OperationalProfile, direction: -1 | 1) {
  const { error } = await supabase.rpc('move_sample_operational_profile', { p_id: p.id, p_expected_revision: p.revision, p_direction: direction });
  if (error) throw new Error(error.message);
}
