import { z } from 'zod';

export const ImageLimitsSchema = z
  .object({
    maxCount: z.number().int().positive(),
    maxSizeBytes: z.number().int().positive(),
    quality: z.number().min(0.1).max(1.0),
  })
  .strict();

export const UnitsConfigSchema = z
  .object({
    habitDefault: z.string().min(1),
    timeUnit: z.string().min(1),
  })
  .strict();

export const AppConfigSchema = z
  .object({
    defaultLanguage: z.enum(['fr', 'en']),
    supportedLanguages: z.array(z.enum(['fr', 'en'])).min(1),
    challengeDurationSeconds: z.number().int().positive(),
    reminderLeadTimeMinutes: z.number().int().positive(),
    batchSize: z.number().int().positive(),
    contextsList: z.array(z.string().min(1)).min(1),
    tonesList: z.array(z.string().min(1)).min(1),
    retryCounts: z.number().int().nonnegative(),
    minEventsBeforeLearnedWindow: z.number().int().positive(),
    imageLimits: ImageLimitsSchema,
    maxPromptLength: z.number().int().positive(),
    discreetModeDefault: z.boolean(),
    units: UnitsConfigSchema,
  })
  .strict();

export const SafetyConfigSchema = z
  .object({
    blockedPatterns: z.array(z.string().min(1)),
    disallowedWords: z.array(z.string().min(1)),
  })
  .strict();

export const DistressConfigSchema = z
  .object({
    words: z.object({
      fr: z.array(z.string().min(1)),
      en: z.array(z.string().min(1)),
    }),
  })
  .strict();

export const FallbackTemplatesSchema = z
  .object({
    messages: z.array(z.string().min(1)).min(1),
    challenges: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type SafetyConfig = z.infer<typeof SafetyConfigSchema>;
export type DistressConfig = z.infer<typeof DistressConfigSchema>;
export type FallbackTemplates = z.infer<typeof FallbackTemplatesSchema>;
