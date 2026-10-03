import bundledPregeneratedRaw from '../../demo/pregenerated.demo.json';
import { addPregeneratedMessage, getAllPregenerated } from '../db/index.ts';
import { type PregeneratedMessage, PregeneratedMessageSchema } from '../schemas/pregenerated.ts';

export function isStaticDemoMode(): boolean {
  try {
    if (import.meta.env.MODE === 'demo') {
      return true;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === '1') {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export function getValidatedBundledDemoMessages(): PregeneratedMessage[] {
  const valid: PregeneratedMessage[] = [];
  for (const item of bundledPregeneratedRaw) {
    const parsed = PregeneratedMessageSchema.safeParse(item);
    if (parsed.success) {
      valid.push(parsed.data);
    }
  }
  return valid;
}

export async function ensureDemoPregeneratedSeeded(): Promise<number> {
  const existing = await getAllPregenerated();
  if (existing.length > 0) {
    return existing.filter((m) => !m.used && m.shownCount === 0).length;
  }

  const bundled = getValidatedBundledDemoMessages();
  for (const msg of bundled) {
    await addPregeneratedMessage(msg);
  }
  return bundled.length;
}
