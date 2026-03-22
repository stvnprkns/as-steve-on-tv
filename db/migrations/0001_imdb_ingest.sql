create table if not exists published_entry (
  id text primary key,
  slug text not null unique,
  display_name text not null,
  imdb_title_id text,
  imdb_name_id text,
  secondary_id text,
  verification_status text not null,
  derived_from_candidate_id text,
  last_verified_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists published_entry_slug_idx on published_entry (slug);
create index if not exists published_entry_imdb_title_idx on published_entry (imdb_title_id);
create index if not exists published_entry_imdb_name_idx on published_entry (imdb_name_id);

create table if not exists editorial_collection (
  id text primary key,
  slug text not null unique,
  title text not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists editorial_collection_slug_idx on editorial_collection (slug);

create table if not exists collection_membership (
  collection_id text not null references editorial_collection(id) on delete cascade,
  entry_id text not null references published_entry(id) on delete cascade,
  position integer not null,
  primary key (collection_id, entry_id)
);

create table if not exists source_title (
  id text primary key,
  provider text not null,
  provider_title_id text not null unique,
  imdb_title_id text,
  secondary_id text,
  title text not null,
  medium text not null,
  year_start integer not null,
  year_end integer,
  raw_payload_hash text not null,
  fetched_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists source_title_provider_id_idx on source_title (provider, provider_title_id);

create table if not exists source_person (
  id text primary key,
  provider text not null,
  provider_person_id text not null unique,
  imdb_name_id text,
  display_name text not null,
  raw_payload_hash text not null,
  fetched_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists source_person_provider_id_idx on source_person (provider, provider_person_id);

create table if not exists ingest_run (
  id text primary key,
  provider text not null,
  status text not null,
  records_scanned integer not null,
  candidates_created integer not null,
  notes text,
  started_at timestamptz not null,
  completed_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists candidate_entry (
  id text primary key,
  slug text not null unique,
  display_name text not null,
  canonical_name text not null,
  matched_name text not null,
  name_variant text not null,
  medium text not null,
  title_of_work text not null,
  actor_or_person text not null,
  year_start integer not null,
  year_end integer,
  match_confidence text not null,
  match_reason text not null,
  status text not null,
  imdb_title_id text,
  imdb_name_id text,
  secondary_id text,
  source_title_id text not null references source_title(id) on delete cascade,
  source_person_id text references source_person(id) on delete set null,
  linked_published_entry_id text references published_entry(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists candidate_entry_status_idx on candidate_entry (status);
create index if not exists candidate_entry_match_confidence_idx on candidate_entry (match_confidence);

create table if not exists evidence_link (
  id text primary key,
  candidate_entry_id text references candidate_entry(id) on delete cascade,
  published_entry_id text references published_entry(id) on delete cascade,
  label text not null,
  url text not null,
  created_at timestamptz not null
);
