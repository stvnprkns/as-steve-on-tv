import { z } from "zod";

import { idSchema, isoDateTimeSchema } from "@/src/lib/schema/common";
import {
  mediumSchema,
  moderationStatusSchema,
  nameVariantSchema,
  submissionTypeSchema
} from "@/src/lib/schema/taxonomy";

export const submissionSchema = z
  .object({
    id: idSchema,
    submissionType: submissionTypeSchema,
    proposedName: z.string().min(2).max(120),
    proposedVariant: nameVariantSchema,
    proposedMedium: mediumSchema,
    titleOfWork: z.string().min(1).max(160),
    evidenceUrl: z.string().url(),
    notes: z.string().min(20).max(600),
    submitterName: z.string().min(2).max(120),
    submitterEmail: z.string().email(),
    status: moderationStatusSchema,
    reviewNotes: z.string().min(4).max(500).nullable(),
    linkedEntryId: idSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict();

export type Submission = z.infer<typeof submissionSchema>;

