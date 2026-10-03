import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addImage,
  addSelfTalk,
  deleteImage,
  deleteSelfTalk,
  getAllImages,
  getAllSelfTalk,
  getImageById,
  resetDatabase,
} from '../src/db/index.ts';
import {
  filterAllowedCaptionsForPrompt,
  selectImageForCraving,
  selectImageForRelapse,
  selectSelfTalkForCraving,
} from '../src/lib/image-display.ts';
import { sanitizeAndEncodeImage } from '../src/lib/images.ts';
import type { ImageRecord } from '../src/schemas/images.ts';
import type { SelfTalk } from '../src/schemas/selftalk.ts';

describe('Step 13: Personal Words and Captioned Images', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Display Rules and Invariants (Section 4 & Step 13)', () => {
    const sampleImages: ImageRecord[] = [
      {
        id: 'img-1',
        kind: 'motivating',
        caption: 'Course à pied au lever du soleil',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        createdTs: 1000,
      },
      {
        id: 'img-2',
        kind: 'goal',
        caption: 'Voyage en Norvège prévu avec mes économies',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        createdTs: 2000,
      },
      {
        id: 'img-3',
        kind: 'calm',
        caption: 'Thé chaud dans le jardin silencieux',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        createdTs: 3000,
      },
      {
        id: 'img-4',
        kind: 'calm',
        caption: 'Mon fils qui sourit au parc',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        createdTs: 4000,
        isLovedOne: true,
      },
      {
        id: 'img-5',
        kind: 'deterrent',
        caption: 'Cendrier plein repoussant',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        createdTs: 5000,
      },
    ];

    it('selects motivating or goal images during a craving session', () => {
      const selected = selectImageForCraving(sampleImages);
      expect(selected).not.toBeNull();
      expect(['motivating', 'goal']).toContain(selected?.kind);
      expect(selected?.kind).not.toBe('deterrent');
    });

    it('relapse display rule INVARIANT: ONLY allows calm images, NEVER motivating or goal', () => {
      const selected = selectImageForRelapse(sampleImages);
      expect(selected).not.toBeNull();
      expect(selected?.kind).toBe('calm');
      expect(selected?.kind).not.toBe('motivating');
      expect(selected?.kind).not.toBe('goal');
      expect(selected?.kind).not.toBe('deterrent');
    });

    it('relapse display rule INVARIANT: NEVER displays a loved-one image even if calm', () => {
      // Create a set of only loved-one images and non-calm images
      const lovedOneCalm: ImageRecord[] = [
        {
          id: 'loved-1',
          kind: 'calm',
          caption: 'Mon conjoint qui me soutient',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          createdTs: 1000,
          isLovedOne: true,
        },
      ];

      const selected = selectImageForRelapse(lovedOneCalm);
      expect(selected).toBeNull();
    });

    it('relapse display rule INVARIANT: NEVER displays a deterrent image after a relapse', () => {
      const deterrentOnly: ImageRecord[] = [
        {
          id: 'det-1',
          kind: 'deterrent',
          caption: 'Poumon noirci',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          createdTs: 1000,
        },
      ];

      const selected = selectImageForRelapse(deterrentOnly);
      expect(selected).toBeNull();
    });

    it('filters text captions correctly for prompts without image analysis', () => {
      // In craving context: motivating, goal, and calm captions are allowed
      const cravingCaptions = filterAllowedCaptionsForPrompt(sampleImages, 'craving');
      expect(cravingCaptions).toContain('Course à pied au lever du soleil');
      expect(cravingCaptions).toContain('Voyage en Norvège prévu avec mes économies');
      expect(cravingCaptions).not.toContain('Cendrier plein repoussant'); // never deterrent

      // In relapse context: ONLY calm and non-loved-one captions allowed
      const relapseCaptions = filterAllowedCaptionsForPrompt(sampleImages, 'relapse');
      expect(relapseCaptions).toEqual(['Thé chaud dans le jardin silencieux']);
      expect(relapseCaptions).not.toContain('Mon fils qui sourit au parc'); // loved one excluded
      expect(relapseCaptions).not.toContain('Course à pied au lever du soleil'); // motivating excluded
    });

    it('selects self-talk message to future self for cravings', () => {
      const talks: SelfTalk[] = [
        { id: 'st-1', text: 'Respire, souviens-toi pourquoi tu as arrêté.' },
        { id: 'st-2', text: 'Tu as déjà tenu bon 3 jours, sois fière de toi.' },
      ];

      const chosen = selectSelfTalkForCraving(talks);
      expect(chosen).not.toBeNull();
      expect(talks.map((t) => t.id)).toContain(chosen?.id);
    });
  });

  describe('Storage, Count Limits, and Database Validation', () => {
    it('stores and retrieves images with full Zod validation', async () => {
      const record: ImageRecord = {
        id: 'img-test-1',
        kind: 'motivating',
        caption: 'Mon beau vélo de randonnée',
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        createdTs: Date.now(),
      };

      await addImage(record);
      const all = await getAllImages();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('img-test-1');
      expect(all[0].caption).toBe('Mon beau vélo de randonnée');

      const byId = await getImageById('img-test-1');
      expect(byId?.caption).toBe('Mon beau vélo de randonnée');

      await deleteImage('img-test-1');
      const afterDelete = await getAllImages();
      expect(afterDelete).toHaveLength(0);
    });

    it('enforces maximum image count from config (max 12 images)', async () => {
      for (let i = 1; i <= 12; i++) {
        await addImage({
          id: `img-${i}`,
          kind: 'calm',
          caption: `Photo ${i}`,
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          createdTs: 1000 + i,
        });
      }

      const all = await getAllImages();
      expect(all).toHaveLength(12);

      // Adding the 13th image must throw an error
      await expect(
        addImage({
          id: 'img-13',
          kind: 'calm',
          caption: 'Trop de photos',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          createdTs: 2000,
        }),
      ).rejects.toThrow(/Maximum limit/);
    });

    it('stores and retrieves messages to future self (SelfTalk)', async () => {
      await addSelfTalk({
        id: 'st-1',
        text: 'Chaque envie dure 3 minutes, tiens bon !',
      });

      const list = await getAllSelfTalk();
      expect(list).toHaveLength(1);
      expect(list[0].text).toBe('Chaque envie dure 3 minutes, tiens bon !');

      await deleteSelfTalk('st-1');
      const empty = await getAllSelfTalk();
      expect(empty).toHaveLength(0);
    });
  });

  describe('Canvas Image Processing Security & Limits (Item 15)', () => {
    it('rejects unsupported file MIME types', async () => {
      const fakePdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      await expect(sanitizeAndEncodeImage(fakePdf)).rejects.toThrow(/Unsupported image type/);

      const fakeGif = new Blob(['GIF89a'], { type: 'image/gif' });
      await expect(sanitizeAndEncodeImage(fakeGif)).rejects.toThrow(/Unsupported image type/);
    });
  });
});
