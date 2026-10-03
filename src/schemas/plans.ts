import { z } from 'zod';

export const PlanSchema = z
  .object({
    id: z.string().min(1).max(64),
    ifText: z.string().min(1).max(300),
    thenText: z.string().min(1).max(300),
  })
  .strict();

export type Plan = z.infer<typeof PlanSchema>;
