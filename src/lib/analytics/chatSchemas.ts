import { z } from 'zod';

export const chatNormalizationAppliedSchema = z.object({
  normalization_applied: z.boolean(),
  fixes_count: z.number().int().min(0),
  message_type: z.enum(['content_plan', 'community_inspiration', 'other']),
  session_id: z.string().min(1),
});

export type ChatNormalizationAppliedPayload = z.infer<typeof chatNormalizationAppliedSchema>;
