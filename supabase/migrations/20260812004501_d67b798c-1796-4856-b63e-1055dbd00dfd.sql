create extension if not exists vector;

create table if not exists public.bot_knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'digest',
  bucket text not null default 'biblioteca',
  storage_path text,
  status text not null default 'pending',
  error_message text,
  chunk_count integer not null default 0,
  indexed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.bot_knowledge_docs to authenticated;
grant all on public.bot_knowledge_docs to service_role;
alter table public.bot_knowledge_docs enable row level security;
create policy "bot_knowledge_docs_auth_all" on public.bot_knowledge_docs
  for all to authenticated using (true) with check (true);

create table if not exists public.bot_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references public.bot_knowledge_docs(id) on delete cascade,
  source_type text not null default 'digest',
  title text,
  page integer,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(3072),
  model_version text not null default 'google/gemini-embedding-001',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.bot_knowledge_chunks to authenticated;
grant all on public.bot_knowledge_chunks to service_role;
alter table public.bot_knowledge_chunks enable row level security;
create policy "bot_knowledge_chunks_auth_all" on public.bot_knowledge_chunks
  for all to authenticated using (true) with check (true);

create index if not exists bot_knowledge_chunks_doc_idx on public.bot_knowledge_chunks(doc_id);
create index if not exists bot_knowledge_chunks_embedding_idx
  on public.bot_knowledge_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create or replace function public.match_bot_knowledge(
  query_embedding vector(3072),
  match_count int default 6,
  filter_source text default null
)
returns table (id uuid, source_type text, title text, page int, content text, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.source_type, c.title, c.page, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.bot_knowledge_chunks c
  where c.embedding is not null
    and (filter_source is null or c.source_type = filter_source)
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

create table if not exists public.bot_lead_profiles (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid unique references public.whatsapp_conversations(id) on delete cascade,
  wa_phone text not null,
  business_phone_number_id text,
  contact_id uuid,
  company_id uuid,
  lead_id uuid,
  conversation_stage text not null default 'information',
  intent text,
  cliente_nombre text,
  empresa_nombre text,
  tipo_cliente text,
  municipio text,
  cotizacion_solicitada boolean not null default false,
  productos_solicitados jsonb not null default '[]'::jsonb,
  vehiculos jsonb not null default '[]'::jsonb,
  contexto_negocio jsonb not null default '{}'::jsonb,
  recomendaciones jsonb not null default '[]'::jsonb,
  resumen text,
  notas_comerciales text,
  zone text,
  assigned_salesperson uuid,
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.bot_lead_profiles to authenticated;
grant all on public.bot_lead_profiles to service_role;
alter table public.bot_lead_profiles enable row level security;
create policy "bot_lead_profiles_auth_all" on public.bot_lead_profiles
  for all to authenticated using (true) with check (true);

create index if not exists bot_lead_profiles_phone_idx on public.bot_lead_profiles(wa_phone);

drop trigger if exists set_bot_knowledge_docs_updated_at on public.bot_knowledge_docs;
create trigger set_bot_knowledge_docs_updated_at
  before update on public.bot_knowledge_docs
  for each row execute function public.update_updated_at_column();

drop trigger if exists set_bot_lead_profiles_updated_at on public.bot_lead_profiles;
create trigger set_bot_lead_profiles_updated_at
  before update on public.bot_lead_profiles
  for each row execute function public.update_updated_at_column();

alter table public.whatsapp_accounts
  add column if not exists ai_advisor_enabled boolean not null default false;