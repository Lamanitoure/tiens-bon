import { z } from 'zod';

export const CravingOutputSchema = z
  .object({
    challenge: z.string().min(1).max(500),
    message: z.string().min(1).max(1000),
  })
  .strict();

export const CheckinExtractionSchema = z
  .object({
    trigger: z.string().min(1).max(200),
    emotion: z.string().min(1).max(100),
    outcome: z.enum(['resisted', 'smoked', 'unknown']),
  })
  .strict();

export type CravingOutput = z.infer<typeof CravingOutputSchema>;
export type CheckinExtraction = z.infer<typeof CheckinExtractionSchema>;
