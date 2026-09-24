import { supabase } from '@/lib/supabase';
import type { BidPlanning } from './planning';

const columns = 'id,updated_at,projected_production_start,projected_production_end,projected_window_updated_by,projected_window_updated_at,production_job_id,converted_at,converted_by_user_id';
export async function loadBidPlanning(id?: string): Promise<BidPlanning[]> {
  const rows: BidPlanning[] = [];
  for (let from = 0; ; ) {
    let query = supabase.from('bids').select(columns, { count: 'exact' }).order('id').range(from, from + 499);
    if (id) query = query.eq('id', id);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as BidPlanning[];
    rows.push(...page);
    if (count !== null ? rows.length >= count : page.length < 500) return rows;
    if (!page.length) throw new Error('Intake planning data is incomplete. Refresh to try again.');
    from += page.length;
  }
}
export async function saveBidProjectedWindow(record: BidPlanning, start: string, end: string) {
  const { error } = await supabase.rpc('set_bid_projected_window', {
    p_bid_id: record.id, p_start: start || null, p_end: end || null, p_expected_updated_at: record.updated_at,
  });
  if (error) throw new Error(error.message);
}
export async function convertBidToProduction(record: BidPlanning, choice: 'carry' | 'new' | 'unscheduled', start: string, end: string, jobNumber: string) {
  const { data, error } = await supabase.rpc('convert_bid_to_production', {
    p_bid_id: record.id, p_expected_updated_at: record.updated_at, p_window_choice: choice,
    p_start: choice === 'new' ? start || null : null, p_end: choice === 'new' ? end || null : null,
    p_job_number: jobNumber.trim() || null,
  });
  if (error) throw new Error(error.message);
  return String(data);
}
