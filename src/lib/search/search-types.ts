import { z } from "zod";

import type { Medium, NameVariant } from "@/src/lib/schema/taxonomy";
import { mediumSchema, nameVariantSchema } from "@/src/lib/schema/taxonomy";

export type SearchDocumentKind = "entry" | "collection";

export const searchDocumentSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["entry", "collection"]),
    slug: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string(),
    description: z.string(),
    medium: mediumSchema.optional(),
    nameVariant: nameVariantSchema.optional(),
    tags: z.array(z.string()),
    searchText: z.string(),
    keywords: z.array(z.string()),
    href: z.string().min(1)
  })
  .strict();

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
