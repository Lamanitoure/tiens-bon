import appConfigRaw from '../../config/app.config.json';
import distressConfigRaw from '../../config/distress.defaults.json';
import safetyConfigRaw from '../../config/safety.defaults.json';
import {
  type AppConfig,
  AppConfigSchema,
  type DistressConfig,
  DistressConfigSchema,
  type SafetyConfig,
  SafetyConfigSchema,
} from '../schemas/config.ts';

export interface ValidatedConfig {
  app: AppConfig;
  safety: SafetyConfig;
  distress: DistressConfig;
  isValid: boolean;
  errors: string[];
}

export function validateConfigurations(): ValidatedConfig {
  const errors: string[] = [];

  const appResult = AppConfigSchema.safeParse(appConfigRaw);
  if (!appResult.success) {
    errors.push(`App config invalid: ${appResult.error.issues.map((i) => i.message).join(', ')}`);
  }

  const safetyResult = SafetyConfigSchema.safeParse(safetyConfigRaw);
  if (!safetyResult.success) {
    errors.push(
      `Safety config invalid: ${safetyResult.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  const distressResult = DistressConfigSchema.safeParse(distressConfigRaw);
  if (!distressResult.success) {
    errors.push(
      `Distress config invalid: ${distressResult.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  return {
    app: appResult.success ? appResult.data : (appConfigRaw as unknown as AppConfig),
    safety: safetyResult.success ? safetyResult.data : (safetyConfigRaw as unknown as SafetyConfig),
    distress: distressResult.success
      ? distressResult.data
      : (distressConfigRaw as unknown as DistressConfig),
    isValid: errors.length === 0,
    errors,
  };
}

export const activeConfig = validateConfigurations();
