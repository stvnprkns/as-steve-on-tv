-- Study population, SSA birth counts, and feasibility bookkeeping.
-- Requires 0002_data_provenance.sql for source_snapshot.
-- Does not rewrite 0001 or 0002, and does not store a Steve introduction rate.

create table if not exists study_population (
  id text primary key,
  specification jsonb not null,
  medium text not null check (medium in ('film_and_tv')),
  coverage_start integer not null check (coverage_start = 1960),
  coverage_end integer not null check (coverage_end = 2025),
  eligibility_policy text not null,
  sampling_method text not null,
  source_snapshot_id text references source_snapshot(id),
  version text not null,
  approved_status text not null check (approved_status in ('draft', 'approved')),
  created_at timestamptz not null
);

create table if not exists study_title_selection (
  id text primary key,
  study_id text not null references study_population(id),
  work_key text not null,
  provider text not null,
  provider_id text not null,
  included boolean not null,
  reason text not null,
  sampling_stratum text not null,
  decade integer not null,
  medium text not null check (medium in ('film', 'tv')),
  inclusion_probability numeric(12, 8) not null check (inclusion_probability >= 0 and inclusion_probability <= 1),
  weight numeric(16, 8) check (weight is null or weight > 0),
  metadata_coverage jsonb not null,
  created_at timestamptz not null,
  unique (study_id, provider, provider_id)
);

create index if not exists study_title_selection_study_idx on study_title_selection (study_id, included);

create table if not exists study_character_credit (
  id text primary key,
  study_id text not null references study_population(id),
  provider text not null,
  work_provider_id text not null,
  decade integer not null,
  medium text not null check (medium in ('film', 'tv')),
  credited_name text not null,
  normalized_name text not null,
  given_name_token text,
  variant_label text not null,
  eligible boolean not null,
  exclusion_reason text,
  performer_id text not null,
  performer_name text,
  identity_key text not null,
  episode_ids jsonb not null default '[]'::jsonb,
  source_snapshot_id text references source_snapshot(id),
  public_candidate boolean not null default false check (public_candidate = false),
  created_at timestamptz not null,
  check (
    (eligible = true and exclusion_reason is null)
    or
    (eligible = false and exclusion_reason is not null)
  ),
  unique (study_id, provider, work_provider_id, performer_id, normalized_name)
);

create index if not exists study_character_credit_study_idx on study_character_credit (study_id, variant_label);
create index if not exists study_character_credit_snapshot_idx on study_character_credit (source_snapshot_id);

create table if not exists study_introduction (
  id text primary key,
  study_id text not null references study_population(id),
  identity_key text not null,
  credit_id text not null references study_character_credit(id),
  first_appearance_year integer not null check (first_appearance_year between 1960 and 2025),
  medium text not null check (medium in ('film', 'tv')),
  eligible boolean not null check (eligible),
  provenance text not null check (provenance in ('film_release_year_proxy', 'earliest_verified_episode_year')),
  created_at timestamptz not null,
  unique (study_id, identity_key)
);

create index if not exists study_introduction_credit_idx on study_introduction (credit_id);

create table if not exists birth_name_count (
  id text primary key,
  name text not null,
  sex text not null check (sex in ('F', 'M')),
  birth_year integer not null check (birth_year between 1880 and 2100),
  count integer,
  observation_state text not null check (observation_state in ('reported', 'suppressed_or_absent')),
  source_snapshot_id text not null references source_snapshot(id),
  check (
    (observation_state = 'reported' and count >= 5)
    or
    (observation_state = 'suppressed_or_absent' and count is null)
  )
);

create unique index if not exists birth_name_count_identity_idx
  on birth_name_count (source_snapshot_id, lower(name), sex, birth_year);

create index if not exists birth_name_count_year_idx on birth_name_count (source_snapshot_id, birth_year);

-- Rate rows belong to phase 4. A rate cannot be stored without both a numerator and a denominator.
create table if not exists study_metric (
  id text primary key,
  study_id text not null references study_population(id),
  decade integer not null,
  medium text not null check (medium in ('film', 'tv')),
  variant_label text not null,
  numerator integer,
  denominator integer,
  rate double precision,
  uncertainty_low double precision,
  uncertainty_high double precision,
  completeness_flags jsonb not null default '[]'::jsonb,
  calculation_version text not null,
  created_at timestamptz not null,
  check (
    (rate is null and numerator is null and denominator is null)
    or
    (numerator is not null and denominator is not null and denominator > 0 and rate is not null)
  )
);

create index if not exists study_metric_study_idx on study_metric (study_id, decade, medium);

create table if not exists study_exclusion_log (
  id text primary key,
  study_id text not null references study_population(id),
  record_id text not null,
  reason text not null,
  rule text not null,
  decade integer,
  medium text,
  created_at timestamptz not null
);

create index if not exists study_exclusion_log_study_idx on study_exclusion_log (study_id, reason);
