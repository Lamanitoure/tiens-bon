import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { addEvent, getAllEvents, resetDatabase } from '../src/db/index.ts';
import { buildCheckinPrompt, localFallbackExtraction } from '../src/lib/checkin.ts';
import type { EventRecord } from '../src/schemas/events.ts';
import { CheckinExtractionSchema } from '../src/schemas/model.ts';
import { checkDistress } from '../src/security/safety.ts';

describe('Step 15: Evening check-in and journal extraction', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Prompt building & Untrusted input encapsulation', () => {
    it('isolates user input and requests strict JSON output', () => {
      const userText =
        "Journée difficile au travail avec beaucoup de réunions, mais j'ai tenu bon.";
      const prompt = buildCheckinPrompt(userText);

      expect(prompt).toContain('trigger');
      expect(prompt).toContain('emotion');
      expect(prompt).toContain('outcome');
      expect(prompt).toContain(userText);
      expect(prompt).toContain('untrusted data');
    });

    it('caps user text length to avoid token inflation', () => {
      const longText = 'a'.repeat(3000);
      const prompt = buildCheckinPrompt(longText);
      expect(prompt.length).toBeLessThan(2000);
    });
  });

  describe('Local heuristic extraction and schema validation', () => {
    it('extracts resisted outcome when user resists craving', () => {
      const text =
        "Journée calme, une petite envie vers 16h mais j'ai bu un verre d'eau et j'ai résisté.";
      const extracted = localFallbackExtraction(text);

      const parsed = CheckinExtractionSchema.safeParse(extracted);
      expect(parsed.success).toBe(true);
      expect(extracted.outcome).toBe('resisted');
      expect(extracted.trigger).toBeTruthy();
      expect(extracted.emotion).toBeTruthy();
    });

    it('extracts smoked outcome when user slipped', () => {
      const text =
        'Soirée entre amis, coup de pression et mauvaise nouvelle, j’ai fumé une cigarette.';
      const extracted = localFallbackExtraction(text);

      const parsed = CheckinExtractionSchema.safeParse(extracted);
      expect(parsed.success).toBe(true);
      expect(extracted.outcome).toBe('smoked');
      expect(extracted.trigger).toContain('Soirée');
    });

    it('extracts emotion and trigger clues accurately', () => {
      const text =
        "Gros coup de stress avec mon patron, j'étais très anxieux et fatigué mais zéro cigarette.";
      const extracted = localFallbackExtraction(text);

      expect(extracted.outcome).toBe('resisted');
      expect(extracted.trigger).toContain('Stress');
      expect(['Stress', 'Fatigue']).toContain(extracted.emotion);
    });
  });

  describe('Distress verification before model extraction (Invariants)', () => {
    it('catches distress in check-in text BEFORE calling the model', () => {
      const distressedText = "Je n'en peux plus de tout, j'ai envie d'en finir c'est trop dur.";
      const check = checkDistress(distressedText, 'fr');

      expect(check.isDistress).toBe(true);
      expect(check.matchedWord).toBeTruthy();
    });

    it('allows normal quit-smoking struggle text without false alarm', () => {
      const normalStruggle =
        "Une envie forte après le café ce matin, mais j'ai respiré un grand coup.";
      const check = checkDistress(normalStruggle, 'fr');

      expect(check.isDistress).toBe(false);
    });
  });

  describe('Journal storage of check-in events', () => {
    it('persists check-in event in IndexedDB and retrieves it cleanly', async () => {
      const checkinEvent: EventRecord = {
        id: 'evt-checkin-test-1',
        ts: Date.now(),
        type: 'checkin',
        trigger: 'Café du matin',
        emotion: 'Fierté',
        note: "Journée réussie, j'ai pensé à mon objectif de voyage.",
        debrief: {
          outcome: 'resisted',
          rawInput: "Très bonne journée, j'ai tenu.",
        },
      };

      await addEvent(checkinEvent);
      const all = await getAllEvents();

      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('evt-checkin-test-1');
      expect(all[0].type).toBe('checkin');
      expect(all[0].trigger).toBe('Café du matin');
      expect(all[0].emotion).toBe('Fierté');
      expect(all[0].debrief?.outcome).toBe('resisted');
    });
  });
});
