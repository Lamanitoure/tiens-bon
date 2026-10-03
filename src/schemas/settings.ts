import { z } from 'zod';

export const LockSettingsSchema = z
  .object({
    enabled: z.boolean(),
    salt: z.string().max(256).optional(),
    iv: z.string().max(256).optional(),
    verifier: z.string().max(512).optional(),
  })
  .strict();

export const SettingsSchema = z
  .object({
    language: z.enum(['fr', 'en']),
    tokenReference: z.string().max(100).optional(),
    discreetMode: z.boolean(),
    lockSettings: LockSettingsSchema.optional(),
  })
  .strict();

export type LockSettings = z.infer<typeof LockSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
