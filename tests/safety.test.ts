import { describe, expect, it } from 'vitest';
import { checkDistress, validateModelOutput } from '../src/security/safety.ts';

describe('Safety and Distress Filters', () => {
  describe('Distress Filter (Section 8 Item 1)', () => {
    it('detects French distress keywords and triggers emergency flag', () => {
      expect(checkDistress('Je suis à bout, je veux en finir', 'fr').isDistress).toBe(true);
      expect(checkDistress('Pensées de suicide récurrentes', 'fr').isDistress).toBe(true);
      expect(checkDistress('Je veux mourir, plus la force', 'fr').isDistress).toBe(true);
    });

    it('detects English distress keywords and triggers emergency flag', () => {
      expect(checkDistress('I feel like I want to kill myself today', 'en').isDistress).toBe(true);
      expect(checkDistress('I just want to end it all', 'en').isDistress).toBe(true);
    });

    it('does not trigger on ordinary conversational stress', () => {
      expect(checkDistress('Grosse journée de travail stressante', 'fr').isDistress).toBe(false);
      expect(checkDistress('I had a stressful meeting at work', 'en').isDistress).toBe(false);
      expect(checkDistress('J ai très envie d une cigarette après le café', 'fr').isDistress).toBe(
        false,
      );
    });
  });

  describe('Output Safety Filter (Section 8 Item 2)', () => {
    it('rejects model output with a percentage and replaces with fallback', () => {
      const output = {
        challenge: 'Bois un verre d eau',
        message: '95% des envies passent en 3 minutes.',
      };
      const res = validateModelOutput(output, 'fr');
      expect(res.isValid).toBe(false);
      expect(res.sanitized.message).not.toContain('95%');
      expect(res.reason).toContain('percentage');
    });

    it('rejects model output recommending medication or dosage', () => {
      const output = {
        challenge: 'Mets un patch 21mg',
        message: 'Utilise de la nicotine de substitution ou du Champix.',
      };
      const res = validateModelOutput(output, 'fr');
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('drug or medication');
    });

    it('rejects model output with predictions like "tu vas"', () => {
      const output = {
        challenge: 'Prends 5 respirations',
        message: 'Tu vas voir que demain tu seras totalement libéré.',
      };
      const res = validateModelOutput(output, 'fr');
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('predictive');
    });

    it('rejects model output with guilt or reproach', () => {
      const output = {
        challenge: 'Pense à tes enfants',
        message: 'Tu as échoué, tu es trop faible pour tenir.',
      };
      const res = validateModelOutput(output, 'fr');
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('reproach');
    });

    it('accepts clean, supportive output without modifying it', () => {
      const output = {
        challenge: 'Bois un grand verre d eau fraîche et respire lentement.',
        message: 'Tiens bon Camille, ce n est qu une vague qui passe.',
      };
      const res = validateModelOutput(output, 'fr');
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toEqual(output);
    });
  });
});
