-- BAMBUZA SIGN · Supabase schema v1
-- Run in Supabase SQL Editor. All business records are private to the admin.
-- Public signing links will be handled by a server-side Edge Function; never expose service_role in the browser.

create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  title text not null,
  project_name text,
  agreement_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft','sent','partially_signed','completed','void')),
  total_share numeric(6,2) not null default 100 check (total_share = 100),
  content jsonb not null default '{}'::jsonb,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  full_name text not null,
  email text,
  identification text,
  role text not null default 'Compositor',
  share numeric(6,2) not null check (share >= 0 and share <= 100),
  signing_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.signing_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  viewed_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_email text,
  consent_text text,
  signature_path text,
  created_at timestamptz not null default now(),
  unique(document_id, participant_id)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  signing_request_id uuid references public.signing_requests(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_owner_created_idx on public.documents(owner_id, created_at desc);
create index if not exists participants_document_idx on public.participants(document_id);
create index if not exists signing_requests_document_idx on public.signing_requests(document_id);
create index if not exists audit_events_document_idx on public.audit_events(document_id, created_at);

alter table public.documents enable row level security;
alter table public.participants enable row level security;
alter table public.signing_requests enable row level security;
alter table public.audit_events enable row level security;

-- Only the designated Bambuza administrator can access records through the browser.
drop policy if exists "Bambuza admin manages documents" on public.documents;
create policy "Bambuza admin manages documents" on public.documents
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com');

drop policy if exists "Bambuza admin manages participants" on public.participants;
create policy "Bambuza admin manages participants" on public.participants
  for all to authenticated
  using (exists (
    select 1 from public.documents d where d.id = participants.document_id
      and d.owner_id = auth.uid()
      and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com'
  ))
  with check (exists (
    select 1 from public.documents d where d.id = participants.document_id
      and d.owner_id = auth.uid()
      and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com'
  ));

drop policy if exists "Bambuza admin reads signing requests" on public.signing_requests;
create policy "Bambuza admin reads signing requests" on public.signing_requests
  for select to authenticated
  using (exists (
    select 1 from public.documents d where d.id = signing_requests.document_id
      and d.owner_id = auth.uid()
      and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com'
  ));

drop policy if exists "Bambuza admin reads audit events" on public.audit_events;
create policy "Bambuza admin reads audit events" on public.audit_events
  for select to authenticated
  using (exists (
    select 1 from public.documents d where d.id = audit_events.document_id
      and d.owner_id = auth.uid()
      and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com'
  ));

-- Private bucket for final PDFs and signature evidence.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bambuza-private', 'bambuza-private', false, 10485760, array['application/pdf','image/png'])
on conflict (id) do nothing;

drop policy if exists "Bambuza admin reads private files" on storage.objects;
create policy "Bambuza admin reads private files" on storage.objects
  for select to authenticated
  using (bucket_id = 'bambuza-private' and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com');

drop policy if exists "Bambuza admin uploads private files" on storage.objects;
create policy "Bambuza admin uploads private files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bambuza-private' and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com');

drop policy if exists "Bambuza admin updates private files" on storage.objects;
create policy "Bambuza admin updates private files" on storage.objects
  for update to authenticated
  using (bucket_id = 'bambuza-private' and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com')
  with check (bucket_id = 'bambuza-private' and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com');

drop policy if exists "Bambuza admin deletes private files" on storage.objects;
create policy "Bambuza admin deletes private files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bambuza-private' and (auth.jwt() ->> 'email') = 'bambuzarecords@gmail.com');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();
