-- Additive provenance, identity, and evidence tables.
-- Does not rewrite 0001_imdb_ingest.sql or published slugs.

create table if not exists source_snapshot (
  id text primary key,
  source_name text not null,
  version_label text,
  retrieved_at timestamptz not null,
  content_sha256 text,
  source_url text,
  license_classification text not null,
  imported_row_counts jsonb not null default '{}'::jsonb,
  script_version text,
  payload jsonb not null,
  created_at timestamptz not null
);

create table if not exists work_identity (
  id text primary key,
  work_type text not null,
  title text not null,
  release_year integer,
  first_air_date date,
  region text,
  language text,
  provenance text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists work_external_ref (
  work_id text not null references work_identity(id) on delete cascade,
  provider text not null,
  provider_id text not null,
  primary key (provider, provider_id)
);

create index if not exists work_external_ref_work_idx on work_external_ref (work_id);

create table if not exists character_identity (
  id text primary key,
  credited_name text not null,
  canonical_name text not null,
  normalized_name text not null,
  name_variant text,
  representation text not null,
  merge_status text not null default 'unmerged',
  merged_into_id text references character_identity(id),
  origin_performer_id text,
  origin_work_id text,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists character_identity_normalized_name_idx on character_identity (normalized_name);

create table if not exists character_appearance (
  id text primary key,
  work_id text not null references work_identity(id) on delete cascade,
  character_id text not null references character_identity(id) on delete cascade,
  performer_provider_id text,
  performer_name text,
  credited_text text not null,
  source_id text,
  appearance_date date,
  named_credit boolean not null,
  evidence_strength text not null,
  review_state text not null,
  dedupe_key text not null unique,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists character_appearance_character_idx on character_appearance (character_id);
create index if not exists character_appearance_work_idx on character_appearance (work_id);

create table if not exists source_evidence (
  id text primary key,
  candidate_id text,
  published_entry_id text references published_entry(id) on delete set null,
  character_id text references character_identity(id) on delete set null,
  appearance_id text references character_appearance(id) on delete set null,
  provider text not null,
  reference text not null,
  assertion text not null,
  locator text,
  evidence_type text not null,
  review_status text not null,
  captured_at timestamptz not null,
  reviewed_at timestamptz,
  display_allowed boolean not null default false,
  link_allowed boolean not null default false,
  payload jsonb not null,
  created_at timestamptz not null
);

create index if not exists source_evidence_candidate_idx on source_evidence (candidate_id);
create index if not exists source_evidence_published_idx on source_evidence (published_entry_id);

create table if not exists review_action (
  id text primary key,
  action text not null check (action in ('create', 'verify', 'reject', 'merge', 'split', 'correct', 'restore')),
  moderator text not null,
  reason text not null,
  target_type text not null,
  target_id text not null,
  before_payload jsonb,
  after_payload jsonb,
  created_at timestamptz not null
);

create index if not exists review_action_target_idx on review_action (target_type, target_id);

create or replace function review_action_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'review_action is immutable';
end;
$$;

drop trigger if exists review_action_immutable_trigger on review_action;
create trigger review_action_immutable_trigger
before update or delete on review_action
for each row execute procedure review_action_immutable();
