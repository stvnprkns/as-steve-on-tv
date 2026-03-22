import {
  candidateEntrySchema,
  collectionSchema,
  ingestRunSchema,
  sourcePersonRecordSchema,
  sourceTitleRecordSchema,
  steveEntrySchema,
  type CandidateEntry,
  type Collection,
  type IngestRun,
  type SourcePersonRecord,
  type SourceTitleRecord,
  type SteveEntry
} from "@/src/lib/schema";
import { pgQuery } from "@/src/lib/db/pg";

function parsePayload<T>(schema: { parse(value: unknown): T }, payload: unknown) {
  return schema.parse(payload);
}

export async function listEntriesFromPostgres(): Promise<SteveEntry[]> {
  const result = await pgQuery<{ payload: unknown }>(
    "select payload from published_entry order by lower(display_name) asc"
  );

  return result.rows.map((row) => parsePayload(steveEntrySchema, row.payload));
}

export async function listCollectionsFromPostgres(): Promise<Collection[]> {
  const result = await pgQuery<{ payload: unknown }>(
    "select payload from editorial_collection order by lower(title) asc"
  );

  return result.rows.map((row) => parsePayload(collectionSchema, row.payload));
}

export async function listCandidatesFromPostgres(): Promise<CandidateEntry[]> {
  const result = await pgQuery<{ payload: unknown }>(
    "select payload from candidate_entry order by updated_at desc, display_name asc"
  );

  return result.rows.map((row) => parsePayload(candidateEntrySchema, row.payload));
}

export async function listIngestRunsFromPostgres(): Promise<IngestRun[]> {
  const result = await pgQuery<{ payload: unknown }>(
    "select payload from ingest_run order by started_at desc"
  );

  return result.rows.map((row) => parsePayload(ingestRunSchema, row.payload));
}

export async function syncSourceTitlesToPostgres(records: SourceTitleRecord[]) {
  for (const record of records) {
    const payload = sourceTitleRecordSchema.parse(record);
    await pgQuery(
      `
        insert into source_title (
          id,
          provider,
          provider_title_id,
          imdb_title_id,
          secondary_id,
          title,
          medium,
          year_start,
          year_end,
          raw_payload_hash,
          fetched_at,
          payload,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
        on conflict (id) do update set
          provider = excluded.provider,
          provider_title_id = excluded.provider_title_id,
          imdb_title_id = excluded.imdb_title_id,
          secondary_id = excluded.secondary_id,
          title = excluded.title,
          medium = excluded.medium,
          year_start = excluded.year_start,
          year_end = excluded.year_end,
          raw_payload_hash = excluded.raw_payload_hash,
          fetched_at = excluded.fetched_at,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      [
        payload.id,
        payload.provider,
        payload.providerTitleId,
        payload.imdbTitleId ?? null,
        payload.secondaryId ?? null,
        payload.title,
        payload.medium,
        payload.yearStart,
        payload.yearEnd ?? null,
        payload.rawPayloadHash,
        payload.fetchedAt,
        JSON.stringify(payload),
        payload.createdAt,
        payload.updatedAt
      ]
    );
  }
}

export async function syncSourcePeopleToPostgres(records: SourcePersonRecord[]) {
  for (const record of records) {
    const payload = sourcePersonRecordSchema.parse(record);
    await pgQuery(
      `
        insert into source_person (
          id,
          provider,
          provider_person_id,
          imdb_name_id,
          display_name,
          raw_payload_hash,
          fetched_at,
          payload,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        on conflict (id) do update set
          provider = excluded.provider,
          provider_person_id = excluded.provider_person_id,
          imdb_name_id = excluded.imdb_name_id,
          display_name = excluded.display_name,
          raw_payload_hash = excluded.raw_payload_hash,
          fetched_at = excluded.fetched_at,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      [
        payload.id,
        payload.provider,
        payload.providerPersonId,
        payload.imdbNameId ?? null,
        payload.displayName,
        payload.rawPayloadHash,
        payload.fetchedAt,
        JSON.stringify(payload),
        payload.createdAt,
        payload.updatedAt
      ]
    );
  }
}

export async function syncCandidatesToPostgres(records: CandidateEntry[]) {
  for (const record of records) {
    const payload = candidateEntrySchema.parse(record);
    await pgQuery(
      `
        insert into candidate_entry (
          id,
          slug,
          display_name,
          canonical_name,
          matched_name,
          name_variant,
          medium,
          title_of_work,
          actor_or_person,
          year_start,
          year_end,
          match_confidence,
          match_reason,
          status,
          imdb_title_id,
          imdb_name_id,
          secondary_id,
          source_title_id,
          source_person_id,
          linked_published_entry_id,
          payload,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23
        )
        on conflict (id) do update set
          slug = excluded.slug,
          display_name = excluded.display_name,
          canonical_name = excluded.canonical_name,
          matched_name = excluded.matched_name,
          name_variant = excluded.name_variant,
          medium = excluded.medium,
          title_of_work = excluded.title_of_work,
          actor_or_person = excluded.actor_or_person,
          year_start = excluded.year_start,
          year_end = excluded.year_end,
          match_confidence = excluded.match_confidence,
          match_reason = excluded.match_reason,
          status = excluded.status,
          imdb_title_id = excluded.imdb_title_id,
          imdb_name_id = excluded.imdb_name_id,
          secondary_id = excluded.secondary_id,
          source_title_id = excluded.source_title_id,
          source_person_id = excluded.source_person_id,
          linked_published_entry_id = excluded.linked_published_entry_id,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      [
        payload.id,
        payload.slug,
        payload.displayName,
        payload.canonicalName,
        payload.matchedName,
        payload.nameVariant,
        payload.medium,
        payload.titleOfWork,
        payload.actorOrPerson,
        payload.yearStart,
        payload.yearEnd ?? null,
        payload.matchConfidence,
        payload.matchReason,
        payload.status,
        payload.imdbTitleId ?? null,
        payload.imdbNameId ?? null,
        payload.secondaryId ?? null,
        payload.sourceTitleId,
        payload.sourcePersonId ?? null,
        payload.linkedPublishedEntryId,
        JSON.stringify(payload),
        payload.createdAt,
        payload.updatedAt
      ]
    );
  }
}

export async function syncIngestRunToPostgres(run: IngestRun) {
  const payload = ingestRunSchema.parse(run);
  await pgQuery(
    `
      insert into ingest_run (
        id,
        provider,
        status,
        records_scanned,
        candidates_created,
        notes,
        started_at,
        completed_at,
        payload,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
      on conflict (id) do update set
        provider = excluded.provider,
        status = excluded.status,
        records_scanned = excluded.records_scanned,
        candidates_created = excluded.candidates_created,
        notes = excluded.notes,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
    [
      payload.id,
      payload.provider,
      payload.status,
      payload.recordsScanned,
      payload.candidatesCreated,
      payload.notes ?? null,
      payload.startedAt,
      payload.completedAt ?? null,
      JSON.stringify(payload),
      payload.createdAt,
      payload.updatedAt
    ]
  );
}

export async function syncEntriesToPostgres(entries: SteveEntry[]) {
  for (const entry of entries) {
    const payload = steveEntrySchema.parse(entry);
    await pgQuery(
      `
        insert into published_entry (
          id,
          slug,
          display_name,
          imdb_title_id,
          imdb_name_id,
          secondary_id,
          verification_status,
          derived_from_candidate_id,
          last_verified_at,
          payload,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
        on conflict (id) do update set
          slug = excluded.slug,
          display_name = excluded.display_name,
          imdb_title_id = excluded.imdb_title_id,
          imdb_name_id = excluded.imdb_name_id,
          secondary_id = excluded.secondary_id,
          verification_status = excluded.verification_status,
          derived_from_candidate_id = excluded.derived_from_candidate_id,
          last_verified_at = excluded.last_verified_at,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      [
        payload.id,
        payload.slug,
        payload.displayName,
        payload.externalRefs?.imdbTitleId ?? null,
        payload.externalRefs?.imdbNameId ?? null,
        payload.externalRefs?.secondaryId ?? null,
        payload.verificationStatus,
        payload.derivedFromCandidateId ?? null,
        payload.lastVerifiedAt ?? null,
        JSON.stringify(payload),
        payload.createdAt,
        payload.updatedAt
      ]
    );
  }
}

export async function syncCollectionsToPostgres(collections: Collection[]) {
  for (const collection of collections) {
    const payload = collectionSchema.parse(collection);

    await pgQuery(
      `
        insert into editorial_collection (
          id,
          slug,
          title,
          status,
          payload,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5::jsonb, $6, $7)
        on conflict (id) do update set
          slug = excluded.slug,
          title = excluded.title,
          status = excluded.status,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      [payload.id, payload.slug, payload.title, payload.status, JSON.stringify(payload), payload.createdAt, payload.updatedAt]
    );

    await pgQuery("delete from collection_membership where collection_id = $1", [payload.id]);

    for (const [position, entryId] of payload.entryIds.entries()) {
      await pgQuery(
        `
          insert into collection_membership (collection_id, entry_id, position)
          values ($1, $2, $3)
          on conflict (collection_id, entry_id) do update set
            position = excluded.position
        `,
        [payload.id, entryId, position]
      );
    }
  }
}

export async function acceptCandidate(id: string, publishedEntry: SteveEntry) {
  const payload = steveEntrySchema.parse({
    ...publishedEntry,
    derivedFromCandidateId: id,
    lastVerifiedAt: publishedEntry.lastVerifiedAt ?? new Date().toISOString()
  });

  await syncEntriesToPostgres([payload]);
  await pgQuery(
    `
      update candidate_entry
      set
        status = 'accepted',
        linked_published_entry_id = $2,
        updated_at = $3,
        payload = jsonb_set(payload, '{linkedPublishedEntryId}', to_jsonb($2::text), true)
      where id = $1
    `,
    [id, payload.id, new Date().toISOString()]
  );
}
