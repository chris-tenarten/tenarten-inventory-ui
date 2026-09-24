import { supabase } from '@/lib/supabase';
export type TrainingWorkflow = { owner_user_id: string; bid_id: string; job_id: string | null };
export type IntakeTraining = { eligible: boolean; workflows: TrainingWorkflow[]; available: boolean };
export const unavailableTraining: IntakeTraining = { eligible: false, workflows: [], available: false };
export async function loadIntakeTraining(): Promise<IntakeTraining> {
  const [grant, workflows] = await Promise.all([
    supabase.rpc('has_intake_training_access'),
    supabase.from('intake_training_workflows').select('owner_user_id,bid_id,job_id'),
  ]);
  if (grant.error || workflows.error) {
    // The local client can be reviewed before the separately authorized migration.
    // Never infer an entitlement from role, name, or a failed metadata request.
    return unavailableTraining;
  }
  return { eligible: grant.data === true, workflows: (workflows.data ?? []) as TrainingWorkflow[], available: true };
}
export async function createPersonalTestBid(): Promise<string> {
  const { data, error } = await supabase.rpc('create_personal_test_bid');
  if (error) throw error;
  return String(data);
}
export async function resetPersonalTestWorkflow(bidId: string, target: 'bid' | 'job', confirmation: string): Promise<void> {
  const { error } = await supabase.rpc('reset_personal_test_workflow', { p_bid_id: bidId, p_target: target, p_confirmation: confirmation });
  if (error) throw error;
}
