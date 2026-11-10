import { supabase } from '@/lib/supabase';
import type { Company, Contact, ContactChoice } from './model';
export const CONTACT_PAGE_SIZE = 20;
export async function searchContactChoices(search: string, offset = 0): Promise<ContactChoice[]> {
  const { data, error } = await supabase.rpc('search_production_contacts', { p_search: search, p_offset: offset });
  if (error) throw error;
  return data as ContactChoice[];
}
export async function getContactChoice(companyId: string, contactId: string | null): Promise<ContactChoice> {
  const { data, error } = await supabase.rpc('get_production_contact', { p_company_id: companyId, p_contact_id: contactId });
  if (error) throw error;
  return data as ContactChoice;
}
export async function saveContactChoice(company: Partial<Company>, contact: Partial<Contact> | null): Promise<ContactChoice> {
  const { data, error } = await supabase.rpc('save_production_contact', { p_company: company, p_contact: contact });
  if (error) throw error;
  return data as ContactChoice;
}

export async function searchCustomers(search: string, offset = 0): Promise<ContactChoice[]> {
  // Same RLS-protected directory, paged without the legacy RPC's 10,000-offset ceiling.
  const prefix = search.trim().replace(/[\\%_]/g, '\\$&');
  const { data, error } = await supabase.from('production_companies')
    .select('*,contact:production_contacts!production_company_default_contact_fk(*)')
    .is('archived_at', null).ilike('name', `${prefix}%`)
    .order('name').order('id').range(offset, offset + CONTACT_PAGE_SIZE);
  if (error) throw error;
  return (data ?? []).map(({ contact, ...company }) => ({ company, contact: contact ?? null })) as ContactChoice[];
}

export async function getCustomer(companyId: string): Promise<ContactChoice> {
  const { data, error } = await supabase.rpc('get_production_customer', { p_company_id: companyId });
  if (error) throw error;
  return data as ContactChoice;
}
export async function listCompanyContacts(companyId: string, offset = 0): Promise<Contact[]> {
  const { data, error } = await supabase.from('production_contacts').select('*')
    .eq('company_id', companyId).order('name').order('id').range(offset, offset + CONTACT_PAGE_SIZE);
  if (error) throw error;
  return data as Contact[];
}

export async function saveCustomer(company: Partial<Company>, contact: Partial<Contact> | null): Promise<ContactChoice> {
  const { data, error } = await supabase.rpc('save_production_customer', { p_company: company, p_contact: contact });
  if (error) throw error;
  return data as ContactChoice;
}
export async function archiveCustomer(company: Company): Promise<void> {
  const { error } = await supabase.rpc('archive_production_customer', { p_company_id: company.id, p_expected_updated_at: company.updated_at });
  if (error) throw error;
}
