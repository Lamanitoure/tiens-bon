import { z } from 'zod';

export const EventTypeSchema = z.enum(['craving', 'resisted', 'relapse', 'checkin']);

export const EventSchema = z
  .object({
    id: z.string().min(1).max(64),
    ts: z.number().int().positive(),
    type: EventTypeSchema,
    trigger: z.string().max(200).optional(),
    emotion: z.string().max(100).optional(),
    challengeId: z.string().max(100).optional(),
    note: z.string().max(500).optional(),
    debrief: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type EventType = z.infer<typeof EventTypeSchema>;
export type EventRecord = z.infer<typeof EventSchema>;
