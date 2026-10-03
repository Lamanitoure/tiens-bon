import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import {
  addEvent,
  addPlan,
  addPregeneratedMessage,
  addSelfTalk,
  clearAllEvents,
  getAllEvents,
  getAllPlans,
  getAllPregenerated,
  getAllSelfTalk,
  getSettings,
  getStoredProfile,
  resetDatabase,
  setSettings,
  setStoredProfile,
} from '../src/db/index.ts';
import type { Profile } from '../src/schemas/profile.ts';

describe('IndexedDB Storage Layer (Item 14 & Step 5)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('stores and retrieves profile with Zod validation', async () => {
    expect(await getStoredProfile()).toBeNull();

    await setStoredProfile(demoProfile as unknown as Profile);
    const stored = await getStoredProfile();

    expect(stored).not.toBeNull();
    expect(stored?.language).toBe('fr');
    expect(stored?.habitLabel).toBe('cigarettes');
    expect(stored?.helpline.label).toBe('Tabac Info Service');
  });

  it('rejects storing profile with invalid schema', async () => {
    const invalid = { ...demoProfile, unitsPerDay: -5 } as unknown as Profile;
    await expect(setStoredProfile(invalid)).rejects.toThrow();
  });

  it('adds and retrieves events sorted by timestamp', async () => {
    await addEvent({
      id: 'e1',
      ts: 2000,
      type: 'craving',
      trigger: 'coffee',
    });
    await addEvent({
      id: 'e2',
      ts: 1000,
      type: 'resisted',
    });

    const events = await getAllEvents();
    expect(events.length).toBe(2);
    // Should be sorted by ts ascending
    expect(events[0].id).toBe('e2');
    expect(events[1].id).toBe('e1');

    await clearAllEvents();
    expect((await getAllEvents()).length).toBe(0);
  });

  it('handles pregenerated messages, plans and selftalk', async () => {
    await addPregeneratedMessage({
      id: 'p1',
      context: 'morning_coffee',
      tone: 'calm',
      language: 'fr',
      challenge: 'Respire 3 minutes',
      message: 'Tu as la force de tenir.',
      createdTs: Date.now(),
      shownCount: 0,
    });
    const pregenerated = await getAllPregenerated();
    expect(pregenerated.length).toBe(1);
    expect(pregenerated[0].context).toBe('morning_coffee');

    await addPlan({
      id: 'plan-1',
      ifText: 'Si je ressens une forte envie après le déjeuner',
      thenText: 'Alors je sors faire 5 minutes de marche rapide',
    });
    const plans = await getAllPlans();
    expect(plans.length).toBe(1);
    expect(plans[0].ifText).toContain('déjeuner');

    await addSelfTalk({
      id: 'st-1',
      text: 'Ce n est qu une impulsion de 3 minutes.',
    });
    const selftalk = await getAllSelfTalk();
    expect(selftalk.length).toBe(1);
    expect(selftalk[0].text).toContain('3 minutes');
  });

  it('stores and retrieves settings', async () => {
    expect(await getSettings()).toBeNull();
    await setSettings({
      language: 'fr',
      discreetMode: true,
      tokenReference: 'local-token',
    });
    const settings = await getSettings();
    expect(settings).not.toBeNull();
    expect(settings?.discreetMode).toBe(true);
  });
});
