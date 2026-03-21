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
    subjectName: z.string().min(2).max(120),
    variant: nameVariantSchema,
    medium: mediumSchema,
    titleOfWork: z.string().min(1).max(160),
    approximateYear: z.string().min(4).max(40),
    evidenceUrl: z.string().url().nullable(),
    evidenceDescription: z.string().min(12).max(600).nullable(),
    whatWasSeen: z.string().min(20).max(600),
    notes: z.string().min(4).max(600).nullable(),
    contactEmail: z.string().email().nullable(),
    status: moderationStatusSchema,
    reviewNotes: z.string().min(4).max(500).nullable(),
    linkedEntryId: idSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.evidenceUrl && !value.evidenceDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceUrl"],
        message: "Provide an evidence URL or an evidence description."
      });
    }
  });

export type Submission = z.infer<typeof submissionSchema>;
