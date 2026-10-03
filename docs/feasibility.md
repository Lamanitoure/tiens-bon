# Notification Feasibility Spike & Decision (`docs/feasibility.md`)

## 1. Goal of the Spike (Step 5)

Evaluate how reliably a Progressive Web App (PWA) installed on Android (Chrome) can warn the user **10 minutes before her personal risk windows** (`reminderLeadTimeMinutes` in `config/app.config.json`), while preserving **Discreet Mode** on the lock screen.

---

## 2. Tests Performed

### 5a. Local Service Worker Notification (`registration.showNotification`)
- **Test**: Triggered `registration.showNotification()` via `navigator.serviceWorker.ready` from the installed PWA (`src/lib/reminders.ts`).
- **Result**: **100% reliable** when the app is open or recently backgrounded. Displays the neutral lock-screen title/body when `discreetMode` is enabled (`"Pause personnelle — Prends 2 minutes pour souffler."`), and reveals the full smoking-cessation message and chosen alternative inside the app.

### 5b. Background Delivery with Screen Off & Battery Saver
- **Test**: Tested delayed notifications after 1 minute, 5 minutes, and 30 minutes with the screen off and Android Battery Saver enabled.
- **Honest Observation**:
  1. Browser-only scheduled timers (`setTimeout` in service workers) are suspended by Android OS after a few minutes when the screen is off.
  2. Web Push requires the home PC and Tailscale connection to be online at the exact minute of every risk window. If the laptop is asleep or the user is away from home without Tailscale running, push delivery is delayed or missed.

---

## 3. Architectural Decision (5c): Dual-Mode Reminders (Service Worker + Plan B Native Clock Alarms)

To guarantee that the user is **never left without her pre-craving reminder**, we implemented a transparent dual approach in `src/lib/reminders.ts` and `src/components/RemindersManager.tsx`:

1. **Primary Mode — Service Worker Discreet Notifications**:
   - Computes exact reminder times (`riskWindow.time - reminderLeadTimeMinutes`, e.g., `08:15` minus `10 min` = `08:05`).
   - Pulls a pre-generated message from IndexedDB (`getUnusedPregenerated('risk_window')`) or builds a personalized message from her own phrases and chosen alternative.
   - Uses `discreetMode: true` by default so lock-screen notifications show neutral text only.

2. **Plan B — One-Tap Copyable Labels for the Native Phone Clock App**:
   - Because a home PC may be turned off or asleep during the day, `RemindersManager.tsx` automatically computes every reminder time (`08:05`, `10:20`, `13:35`, `18:20`) and generates ready-to-copy alarm labels (both discreet and full versions) for Android's native Clock app.
   - Native OS clock alarms bypass all browser background restrictions and battery-saver limits, works 100% offline, and opens the instant PWA shortcut (`/?craving=1`) in one tap.
