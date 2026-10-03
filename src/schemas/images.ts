import { z } from 'zod';

export const ImageKindSchema = z.enum(['motivating', 'calm', 'goal', 'deterrent']);

export const ImageRecordSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: ImageKindSchema,
    caption: z.string().min(1).max(200),
    dataUrl: z.string().min(1), // Base64 sanitized image URL
    createdTs: z.number().int().positive(),
    isLovedOne: z.boolean().optional(),
  })
  .strict();

export type ImageKind = z.infer<typeof ImageKindSchema>;
export type ImageRecord = z.infer<typeof ImageRecordSchema>;
