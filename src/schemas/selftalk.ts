import { z } from 'zod';

export const SelfTalkSchema = z
  .object({
    id: z.string().min(1).max(64),
    text: z.string().min(1).max(500),
  })
  .strict();

export type SelfTalk = z.infer<typeof SelfTalkSchema>;
