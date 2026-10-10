-- Screen rates, birth shares, and the predeclared lag scan.
-- Requires 0003_steve_studies.sql. Does not rewrite 0001, 0002, or 0003.
-- A selected lag cannot be stored. A reported birth numerator cannot be zero.

alter table study_metric add column if not exists metric_kind text;
alter table study_metric add column if not exists denominator_label text;
alter table study_metric add column if not exists cluster_unit text;
alter table study_metric add column if not exists cluster_count integer;
alter table study_metric add column if not exists bootstrap_replicates integer;
alter table study_metric add column if not exists seed text;

alter table study_metric drop constraint if exists study_metric_analysis_check;
alter table study_metric add constraint study_metric_analysis_check check (
  metric_kind is null
  or (
    metric_kind in (
      'new_introductions_per_1000',
      'named_credit_share_per_1000',
      'work_share_per_100'
    )
    and cluster_unit in ('work', 'series')
    and cluster_count is not null
    and cluster_count >= 0
    and bootstrap_replicates is not null
    and bootstrap_replicates > 0
    and seed is not null
    and denominator_label is not null
  )
);

create unique index if not exists study_metric_cell_idx
  on study_metric (study_id, metric_kind, decade, medium, variant_label);

create table if not exists birth_name_share (
  id text primary key,
  source_snapshot_id text not null references source_snapshot(id),
  birth_year integer not null check (birth_year >= 1880 and birth_year <= 2025),
  sex text not null check (sex in ('F', 'M', 'combined')),
  variant_label text not null,
  numerator integer,
  denominator integer,
  rate double precision,
  denominator_label text not null check (
    denominator_label in ('ssa_reported_same_sex_births', 'ssa_reported_births')
  ),
  observation_state text not null check (
    observation_state in ('reported', 'suppressed_or_absent', 'partial_suppression')
  ),
  calculation_version text not null,
  created_at timestamptz not null,
  check (denominator is null or denominator > 0),
  check (
    (
      observation_state = 'reported'
      and numerator is not null
      and numerator > 0
      and denominator is not null
      and rate is not null
    )
    or
    (
      observation_state in ('suppressed_or_absent', 'partial_suppression')
      and numerator is null
      and rate is null
    )
  )
);

create unique index if not exists birth_name_share_cell_idx
  on birth_name_share (source_snapshot_id, birth_year, sex, variant_label, calculation_version);

create table if not exists study_lag_scan (
  id text primary key,
  study_id text not null references study_population(id),
  lag_years integer not null check (lag_years >= 0 and lag_years <= 50),
  medium text not null check (medium in ('film', 'tv')),
  paired_decades integer not null check (paired_decades >= 0),
  correlation double precision,
  status text not null check (status in ('reported', 'insufficient_bins', 'undefined_correlation')),
  selected_lag integer check (selected_lag is null),
  calculation_version text not null,
  created_at timestamptz not null,
  check (
    (status = 'reported' and correlation is not null and paired_decades >= 3)
    or
    (status in ('insufficient_bins', 'undefined_correlation') and correlation is null)
  )
);

create unique index if not exists study_lag_scan_cell_idx
  on study_lag_scan (study_id, lag_years, medium, calculation_version);
