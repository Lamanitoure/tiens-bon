import type { Profile } from '../schemas/profile.ts';

/**
 * Suggests the most relevant context based on his personalized risk windows or current time of day.
 * Step 10: context choice (or suggested from the time).
 */
export function suggestContextFromTime(profile: Profile, now: Date = new Date()): string {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Check if currently within +/- 45 minutes of a personalized risk window
  if (profile.riskWindows && profile.riskWindows.length > 0) {
    for (const rw of profile.riskWindows) {
      const parts = rw.time.split(':');
      if (parts.length === 2) {
        const rwHour = parseInt(parts[0], 10);
        const rwMinute = parseInt(parts[1], 10);
        if (!Number.isNaN(rwHour) && !Number.isNaN(rwMinute)) {
          const rwMinutes = rwHour * 60 + rwMinute;
          if (Math.abs(currentMinutes - rwMinutes) <= 45) {
            return rw.label;
          }
        }
      }
    }
  }

  // 2. Otherwise suggest by time-of-day category
  const hour = now.getHours();
  const isEn = profile.language === 'en';

  if (hour >= 6 && hour < 10) {
    return isEn ? 'Morning coffee' : 'Café du matin';
  }
  if (hour >= 11 && hour < 14) {
    return isEn ? 'After meal' : 'Fin du déjeuner';
  }
  if (hour >= 14 && hour < 17) {
    return isEn ? 'Afternoon break' : 'Pause de l’après-midi';
  }
  if (hour >= 17 && hour < 21) {
    return isEn ? 'Evening unwind' : 'Décompression fin de journée';
  }
  return isEn ? 'Night / Calm moment' : 'Soirée / Moment de calme';
}

/**
 * Returns a list of quick trigger chips for fast 1-tap switching in the craving screen.
 */
export function getAvailableContextChips(profile: Profile): string[] {
  const list = new Set<string>();

  // Add his risk windows
  if (profile.riskWindows) {
    for (const rw of profile.riskWindows) {
      if (rw.label) list.add(rw.label);
    }
  }

  // Add standard common triggers
  const isEn = profile.language === 'en';
  if (isEn) {
    list.add('Coffee');
    list.add('After meal');
    list.add('Stress');
    list.add('Social / Friends');
    list.add('Boredom');
  } else {
    list.add('Café');
    list.add('Fin de repas');
    list.add('Coup de stress');
    list.add('Pause collègues');
    list.add('Ennui / Attente');
  }

  return Array.from(list);
}
