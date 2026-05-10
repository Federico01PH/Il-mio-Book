-- =====================================================================
-- Schema iniziale Portfolio Fotografico
-- Esegui questo file nel SQL Editor di Supabase (una sola volta).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Richieste di accesso al sito
-- request_token: token usato nei link admin di approvazione/rifiuto
-- session_token: generato all'approvazione, usato dal cookie utente
-- ---------------------------------------------------------------------
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  request_token text unique not null,
  session_token text unique,
  session_expires_at timestamptz,
  ip_address text,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Aggiunge ip_address se la tabella esiste già senza quella colonna
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='access_requests' and column_name='ip_address'
  ) then
    alter table access_requests add column ip_address text;
  end if;
end $$;

create index if not exists access_requests_request_token_idx on access_requests(request_token);
create index if not exists access_requests_session_token_idx on access_requests(session_token);
create index if not exists access_requests_status_idx on access_requests(status);

-- ---------------------------------------------------------------------
-- Cartelle (collezioni) e foto
-- storage_path: percorso dentro il bucket "photos" (pubblico)
-- hi_res_storage_path: percorso dentro il bucket "hi-res" (privato)
-- ---------------------------------------------------------------------
create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  cover_storage_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists folders_sort_idx on folders(sort_order);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders(id) on delete cascade,
  storage_path text not null,
  caption text,
  hi_res_storage_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists photos_folder_idx on photos(folder_id);
create index if not exists photos_sort_idx on photos(sort_order);

-- ---------------------------------------------------------------------
-- Richieste alta risoluzione
-- ---------------------------------------------------------------------
create table if not exists hi_res_requests (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  email text not null,
  message text,
  status text not null default 'pending' check (status in ('pending','sent','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists hi_res_requests_status_idx on hi_res_requests(status);

-- ---------------------------------------------------------------------
-- Impostazioni del sito (bio, link social, ecc.)
-- ---------------------------------------------------------------------
create table if not exists site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

insert into site_settings (key, value) values
  ('site_name', 'Portfolio'),
  ('bio_name', 'Federico Azzarito'),
  ('bio_title', 'Fotografo'),
  ('bio_text', 'Lavoro con luce naturale e progetti editoriali. Questo spazio è pensato per una selezione ristretta di clienti, galleristi e appassionati.'),
  ('bio_avatar_path', ''),
  ('whatsapp_url', 'https://whatsapp.com/channel/0029Vb7Mv0sLNSa7YKQ6Rp1D'),
  ('telegram_url', 'https://t.me/+rAqV5qdADV04OTk0'),
  ('instagram_url', '')
on conflict (key) do nothing;

-- =====================================================================
-- Row Level Security
-- Tutto il traffico applicativo passa dal service_role (server side),
-- quindi disabilitiamo l'accesso anonimo lato API.
-- =====================================================================
alter table access_requests enable row level security;
alter table folders enable row level security;
alter table photos enable row level security;
alter table hi_res_requests enable row level security;
alter table site_settings enable row level security;

-- Nessuna policy per anon -> tutto bloccato.
-- Il service_role bypassa la RLS by design, quindi le route API
-- continuano a funzionare normalmente.

-- =====================================================================
-- Storage buckets
-- Vanno creati anche dalla dashboard, ma queste righe sono idempotenti.
-- =====================================================================
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('hi-res', 'hi-res', false)
on conflict (id) do nothing;

-- Policy: lettura pubblica del bucket "photos" (per le anteprime)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='photos_public_read'
  ) then
    create policy photos_public_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'photos');
  end if;
end $$;

-- Il bucket "hi-res" rimane privato: solo il service_role (server) vi accede.
