import { z } from 'zod';

export const OutcomeStatsSchema = z
  .object({
    resisted: z.number().int().nonnegative().default(0),
    smoked: z.number().int().nonnegative().default(0),
  })
  .strict();

export const PregeneratedMessageSchema = z
  .object({
    id: z.string().min(1).max(64),
    context: z.string().min(1).max(100),
    tone: z.string().min(1).max(50),
    language: z.enum(['fr', 'en']),
    challenge: z.string().min(1).max(500),
    message: z.string().min(1).max(1000),
    createdTs: z.number().int().positive(),
    shownCount: z.number().int().nonnegative().default(0),
    outcomeStats: OutcomeStatsSchema.optional(),
  })
  .strict();

export type OutcomeStats = z.infer<typeof OutcomeStatsSchema>;
export type PregeneratedMessage = z.infer<typeof PregeneratedMessageSchema>;
