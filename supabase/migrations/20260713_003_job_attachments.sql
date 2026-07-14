begin;

create table if not exists public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  document_type text not null default 'other',
  uploaded_by text,
  created_at timestamptz not null default now(),

  constraint job_attachments_file_name_not_blank check (length(trim(file_name)) > 0),
  constraint job_attachments_storage_path_not_blank check (length(trim(storage_path)) > 0),
  constraint job_attachments_size_nonnegative check (size_bytes is null or size_bytes >= 0),
  constraint job_attachments_document_type_check check (
    document_type in (
      'estimate',
      'work_order',
      'blend_sheet',
      'shop_drawing',
      'cut_ticket',
      'color_plate',
      'sample_approval',
      'purchase_order',
      'photo',
      'other'
    )
  )
);

create index if not exists job_attachments_job_created_idx
  on public.job_attachments (job_id, created_at desc);

alter table public.job_attachments enable row level security;

drop policy if exists "Allow anon read job attachments" on public.job_attachments;
drop policy if exists "Allow anon insert job attachments" on public.job_attachments;
drop policy if exists "Allow anon delete job attachments" on public.job_attachments;

create policy "Allow anon read job attachments"
  on public.job_attachments for select to anon using (true);

create policy "Allow anon insert job attachments"
  on public.job_attachments for insert to anon with check (true);

create policy "Allow anon delete job attachments"
  on public.job_attachments for delete to anon using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('job-attachments', 'job-attachments', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Allow anon read job attachment objects" on storage.objects;
drop policy if exists "Allow anon upload job attachment objects" on storage.objects;
drop policy if exists "Allow anon delete job attachment objects" on storage.objects;

create policy "Allow anon read job attachment objects"
  on storage.objects for select to anon
  using (bucket_id = 'job-attachments');

create policy "Allow anon upload job attachment objects"
  on storage.objects for insert to anon
  with check (bucket_id = 'job-attachments');

create policy "Allow anon delete job attachment objects"
  on storage.objects for delete to anon
  using (bucket_id = 'job-attachments');

commit;
