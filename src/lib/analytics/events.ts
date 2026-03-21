export const analyticsEvents = [
  "page_view",
  "search_submitted",
  "search_result_clicked",
  "browse_facet_applied",
  "related_entry_clicked",
  "collection_opened",
  "submission_started",
  "submission_completed"
] as const;

export type AnalyticsEventName = (typeof analyticsEvents)[number];

