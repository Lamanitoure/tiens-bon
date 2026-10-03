import { z } from 'zod';

export const FactSchema = z
  .object({
    id: z.string().min(1).max(64),
    language: z.enum(['fr', 'en']),
    text: z.string().min(10).max(500),
    sourceName: z.string().min(2).max(150),
    sourceUrl: z.string().url().startsWith('https://').max(300),
  })
  .strict();

export const FactsListSchema = z.array(FactSchema).min(1).max(50);

export type Fact = z.infer<typeof FactSchema>;
export type FactsList = z.infer<typeof FactsListSchema>;
