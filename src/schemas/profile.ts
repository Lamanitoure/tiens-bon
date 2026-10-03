import { z } from 'zod';

export const RiskWindowSchema = z
  .object({
    label: z.string().min(1).max(50),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format'),
  })
  .strict();

export const ContactSchema = z
  .object({
    label: z.string().min(1).max(100),
    contact: z.string().min(1).max(100),
  })
  .strict();

export const SavingsGoalSchema = z
  .object({
    label: z.string().min(1).max(100),
    amount: z.number().positive(),
  })
  .strict();

export const ProfileSchema = z
  .object({
    language: z.enum(['fr', 'en']),
    tone: z.string().min(1).max(50),
    reasons: z.array(z.string().min(1).max(200)).min(1),
    riskWindows: z.array(RiskWindowSchema),
    alternatives: z.array(z.string().min(1).max(200)).min(1),
    interests: z.array(z.string().min(1).max(100)),
    phrases: z.array(z.string().min(1).max(250)).min(1).max(25),
    supportPerson: ContactSchema.optional(),
    // Required helpline contact (Section 4 & 7)
    helpline: ContactSchema,
    habitLabel: z.string().min(1).max(100),
    unitsPerDay: z.number().positive(),
    unitPrice: z.number().positive(),
    currency: z.string().min(1).max(10),
    savingsGoal: SavingsGoalSchema,
    quitDate: z.string().min(1), // ISO format string
    discreetMode: z.boolean(),
  })
  .strict();

export type RiskWindow = z.infer<typeof RiskWindowSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type SavingsGoal = z.infer<typeof SavingsGoalSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
