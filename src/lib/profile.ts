import demoProfileRaw from '../../demo/profile.demo.json';
import { type Profile, ProfileSchema } from '../schemas/profile.ts';
import { activeConfig } from './config.ts';

/**
 * Checks whether a given profile is the static demo profile (fictional persona Camille).
 */
export function isDemoProfile(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return (
    profile.quitDate === '2026-10-01T08:00:00.000Z' &&
    (!profile.userName || profile.phrases[0]?.includes('Camille'))
  );
}

/**
 * Returns the validated fictional demo profile for demo mode.
 */
export function getDemoProfile(): Profile {
  return ProfileSchema.parse(demoProfileRaw);
}

/**
 * Creates the initial user profile in normal mode.
 * - Asks for user's name/firstname (stored in userName and phrases)
 * - Sets quitDate to current instant so streak and consumption counters start strictly at 0
 * - Preserves all other prefilled fields according to current application policy
 */
export function createInitialUserProfile(
  userName: string,
  lang: 'fr' | 'en' = 'fr',
  quitDateIso: string = new Date().toISOString(),
): Profile {
  const trimmedName = userName.trim();
  const isEn = lang === 'en';

  const defaultReasons = isEn
    ? [
        'Catch my breath when climbing stairs without stopping',
        'Enjoy my weekend walks fully without coughing',
        'Treat myself to a train journey through the Alps with the saved money',
        'No longer have cold cigarette smell on my clothes',
      ]
    : [
        "Retrouver mon souffle pour monter les escaliers sans m'arrêter",
        'Profiter pleinement de mes balades le week-end sans tousser',
        "M'offrir un voyage en train dans les Alpes grâce à l'argent économisé",
        'Ne plus avoir cette odeur de tabac froid sur mes vêtements',
      ];

  const defaultRiskWindows = [
    { label: isEn ? 'Morning coffee' : 'Café du matin', time: '08:15' },
    { label: isEn ? 'Mid-morning break' : 'Pause de milieu de matinée', time: '10:30' },
    { label: isEn ? 'After lunch' : 'Fin du déjeuner', time: '13:45' },
    { label: isEn ? 'End of day unwind' : 'Décompression fin de journée', time: '18:30' },
  ];

  const defaultAlternatives = isEn
    ? [
        'Drink a warm mint tea',
        'Take 5 minutes of belly breathing',
        'Take a 3-minute walk outside hands in pockets',
        'Listen to a soothing music track with headphones',
      ]
    : [
        'Boire une infusion chaude à la menthe',
        'Faire 5 minutes de respiration ventrale',
        'Faire un tour dehors de 3 minutes les mains dans les poches',
        'Écouter un morceau de musique apaisant au casque',
      ];

  const defaultInterests = isEn
    ? ['Mountain hiking', 'Balcony gardening', 'Reading novels', 'Home cooking']
    : ['Randonnée en montagne', 'Jardinage sur le balcon', 'Lecture de romans', 'Cuisine maison'];

  const firstPhrase = isEn
    ? trimmedName
      ? `Hold on ${trimmedName}, three minutes and this wave will pass.`
      : 'Hold on, three minutes and this wave will pass.'
    : trimmedName
      ? `Allez ${trimmedName}, trois minutes et l'envie est passée.`
      : "Allez, trois minutes et l'envie est passée.";

  const otherPhrases = isEn
    ? [
        "You haven't come this far to give up now.",
        'Take a deep breath, it is just smoke in your mind.',
        'Drink a tall glass of cold water, it will settle you down.',
        'Look at your goal: the Alps by train!',
        'You are stronger than this old automatic reflex.',
        'No big deal, let the wave pass without tensing up.',
        'Remember how proud you will feel tonight when going to bed.',
        'Every minute won is a definitive victory.',
        'Do not let one minute ruin all your efforts today.',
        'Your body is thanking you, be patient with it.',
        'Hold on, you are on the right track!',
      ]
    : [
        "T'as pas fait tout ce chemin pour abandonner maintenant.",
        "Respire un grand coup, ce n'est que de la fumée dans ta tête.",
        "Bois un grand verre d'eau fraîche, ça va te poser.",
        "Regarde l'objectif : les Alpes en train !",
        'Tu es plus forte que ce vieux réflexe automatique.',
        'Même pas mal, laisse passer la vague sans te crisper.',
        'Souviens-toi de la fierté ce soir quand tu te coucheras.',
        'Chaque minute gagnée est une victoire définitive.',
        'Ne laisse pas une minute gâcher tes efforts de toute la journée.',
        "C'est ton corps qui te remercie, sois patiente avec lui.",
        'Tiens bon, tu es sur la bonne voie !',
      ];

  const candidate: Profile = {
    userName: trimmedName || undefined,
    language: lang,
    tone: isEn ? 'Warm, direct and supportive' : 'Chaleureux, direct et complice',
    reasons: defaultReasons,
    riskWindows: defaultRiskWindows,
    alternatives: defaultAlternatives,
    interests: defaultInterests,
    phrases: [firstPhrase, ...otherPhrases],
    supportPerson: {
      label: isEn ? 'Alex (trusted friend)' : 'Alex (ami de confiance)',
      contact: '+33 6 00 00 00 00',
    },
    helpline: {
      label: 'Tabac Info Service',
      contact: '3989',
    },
    habitLabel: activeConfig.app.units?.habitDefault || 'cigarettes',
    unitsPerDay: 15,
    unitPrice: 0.6,
    currency: '€',
    savingsGoal: {
      label: isEn ? 'Train trip through the Alps' : 'Voyage en train dans les Alpes',
      amount: 600,
    },
    quitDate: quitDateIso,
    discreetMode: activeConfig.app.discreetModeDefault ?? true,
  };

  return ProfileSchema.parse(candidate);
}
