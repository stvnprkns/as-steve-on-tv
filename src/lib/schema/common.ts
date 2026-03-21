import { z } from "zod";

export const idSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "IDs must be lowercase kebab-case.");

export const slugSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slugs must be lowercase kebab-case.");

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/));

export const seoFieldsSchema = z.object({
  seoTitle: z.string().min(10).max(70),
  seoDescription: z.string().min(20).max(170)
});

export const timestampFieldsSchema = z.object({
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const optionalImageSchema = z
  .object({
    src: z.string().min(1),
    alt: z.string().min(8),
    credit: z.string().min(2).optional()
  })
  .strict();

export const stringArraySchema = z.array(z.string().min(1));

