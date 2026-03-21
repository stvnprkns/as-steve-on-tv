import type { Medium, NameVariant } from "@/src/lib/schema";

export type SearchDocumentKind = "entry" | "collection";

export type SearchDocument = {
  id: string;
  kind: SearchDocumentKind;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  medium?: Medium;
  nameVariant?: NameVariant;
  tags: string[];
  searchText: string;
  keywords: string[];
  href: string;
};
