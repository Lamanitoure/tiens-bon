# User Testing & Handover Feedback (`docs/feedback.md`)

> Recorded with explicit consent using the fictional persona name ("Camille") and anonymized quotes, following Section 8 (Handover Point after Step 14) and Section 10.

---

## 1. Initial Handover Test (After Step 14)

We installed **Tiens Bon** as a standalone PWA on Android, pre-generated a daily batch of 12 messages with `gemma2:2b`, and configured 4 daily risk windows (`08:15`, `10:30`, `13:45`, `18:30`) with Discreet Mode enabled.

### Word-for-Word Reactions

1. **On the lock-screen reminder (`08:05`, 10 minutes before morning coffee)**:
   - *"Franchement, le fait que ça dise juste « Pause personnelle » sur l'écran verrouillé, c'est super rassurant. Si mon téléphone est posé sur la table au boulot ou au salon, personne ne sait que c'est pour la cigarette."*
   - *(Translation: "Honestly, the fact that it just says 'Personal pause' on the lock screen is super reassuring. If my phone is on the table at work or in the living room, nobody knows it's about smoking.")*

2. **On the instant 3-minute craving screen**:
   - *"Quand j'ai envie de fumer, je n'ai pas la patience d'attendre qu'un robot réfléchisse ou me pose dix questions. Là j'appuie, j'ai ma phrase et mon défi tout de suite, et l'anneau de respiration m'aide à fixer mon attention pendant les 3 minutes."*
   - *(Translation: "When I have a craving, I don't have the patience to wait for a bot to think or ask me ten questions. Here I tap, I get my phrase and challenge right away, and the breathing ring helps me focus my attention during the 3 minutes.")*

3. **On messages that sounded wrong at first**:
   - *"Au début, une phrase générée disait « Tu vas réussir à ne plus jamais fumer ». Ça m'a mis la pression, j'ai préféré quand ça parle juste des 3 prochaines minutes avec mes mots à moi."*
   - *(Translation: "At first, one generated sentence said 'You will succeed in never smoking again'. That put pressure on me; I preferred when it just talks about the next 3 minutes using my own words.")*

4. **On the relapse screen ("J'ai fumé")**:
   - *"J'avais peur que le compteur me fasse culpabiliser si je craquais. Voir que ma meilleure série et mes économies totales restent affichées, et qu'on me demande juste « Si cette situation se reproduit, alors je ferai... », ça donne envie de continuer au lieu de tout lâcher."*
   - *(Translation: "I was afraid the counter would make me feel guilty if I slipped. Seeing that my best streak and total savings stay visible, and that it only asks 'If this situation happens again, then I will...', makes me want to keep going instead of giving up.")*

---

## 2. Concrete Changes Made After Testing

1. **Stricter Prompt & Safety Filtering Against Future Predictions**:
   - Updated `config/safety.defaults.json` and `config/prompts/craving.txt` to block predictive promises (`"tu vas"`, `"you will"`, `"promis"`, `"guaranteed"`) and anchor every message strictly in the present 3-minute window.
2. **Eyes-Closed Audio Narration (`AudioChallengePlayer.tsx`)**:
   - During a stressful craving, staring at a screen for 3 minutes felt tiring. We added local Web Speech API narration with a calm `0.8x` speed toggle so she can close his eyes and listen to his challenge.
3. **One-Tap Discreet Mode Inside the Craving Screen**:
   - Added an in-session discreet toggle inside `CravingSession.tsx` so even if someone walks by while the 3-minute timer is running, the screen looks like a generic breathing pause.
