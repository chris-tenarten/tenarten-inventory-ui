export type ContactSnapshot = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_title: string;
  company_phone: string;
  company_email: string;
  mailing_address: string;
  notes: string;
};
export type ProjectContact = {
  customer_company_id: string | null;
  customer_contact_id: string | null;
  customer_contact_snapshot: ContactSnapshot | null;
};
export type Company = {
  id: string; name: string; phone: string; email: string;
  archived_at?: string | null; default_contact_id?: string | null;
  mailing_address: string; notes: string; updated_at: string;
};
export type Contact = {
  id: string; company_id: string; name: string; email: string;
  phone: string; title: string; notes: string; updated_at: string;
};
export type ContactChoice = { company: Company; contact: Contact | null };
export const emptySnapshot = (name = ''): ContactSnapshot => ({
  company_name: name, contact_name: '', contact_email: '', contact_phone: '',
  contact_title: '', company_phone: '', company_email: '', mailing_address: '', notes: '',
});
export function captureChoice({ company, contact }: ContactChoice): ProjectContact {
  return {
    customer_company_id: company.id, customer_contact_id: contact?.id ?? null,
    customer_contact_snapshot: {
      company_name: company.name, contact_name: contact?.name ?? '',
      contact_email: contact?.email ?? '', contact_phone: contact?.phone ?? '',
      contact_title: contact?.title ?? '', company_phone: company.phone,
      company_email: company.email, mailing_address: company.mailing_address,
      notes: [company.notes, contact?.notes].filter(Boolean).join('\n'),
    },
  };
}
export function unlinkedContact(): ProjectContact {
  return { customer_company_id: null, customer_contact_id: null, customer_contact_snapshot: null };
}
