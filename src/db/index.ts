import {
  type EventRecord,
  EventSchema,
  type Plan,
  PlanSchema,
  type PregeneratedMessage,
  PregeneratedMessageSchema,
  type Profile,
  ProfileSchema,
  type SelfTalk,
  SelfTalkSchema,
  type Settings,
  SettingsSchema,
} from '../schemas/index.ts';

const DB_NAME = 'tiens_bon_db';
const DB_VERSION = 1;

export const STORES = {
  PROFILE: 'profile',
  EVENTS: 'events',
  PREGENERATED: 'pregenerated',
  IMAGES: 'images',
  PLANS: 'plans',
  SELFTALK: 'selftalk',
  SETTINGS: 'settings',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // In browser or test environment (with fake-indexeddb)
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.PROFILE)) {
        db.createObjectStore(STORES.PROFILE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
        eventStore.createIndex('ts', 'ts', { unique: false });
        eventStore.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.PREGENERATED)) {
        const pregStore = db.createObjectStore(STORES.PREGENERATED, { keyPath: 'id' });
        pregStore.createIndex('context', 'context', { unique: false });
        pregStore.createIndex('tone', 'tone', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.IMAGES)) {
        db.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.PLANS)) {
        db.createObjectStore(STORES.PLANS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SELFTALK)) {
        db.createObjectStore(STORES.SELFTALK, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// 1. Profile operations
export async function getStoredProfile(): Promise<Profile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROFILE, 'readonly');
    const store = tx.objectStore(STORES.PROFILE);
    const req = store.get('current');
    req.onsuccess = () => {
      if (!req.result?.data) return resolve(null);
      const parsed = ProfileSchema.safeParse(req.result.data);
      if (!parsed.success) {
        return reject(
          new Error(
            `Database Profile validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
          ),
        );
      }
      resolve(parsed.data);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function setStoredProfile(profile: Profile): Promise<void> {
  // Validate with Zod before write
  const validated = ProfileSchema.parse(profile);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PROFILE, 'readwrite');
    const store = tx.objectStore(STORES.PROFILE);
    const req = store.put({ key: 'current', data: validated });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// 2. Events operations
export async function addEvent(event: EventRecord): Promise<void> {
  const validated = EventSchema.parse(event);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.EVENTS);
    const req = store.put(validated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllEvents(): Promise<EventRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, 'readonly');
    const store = tx.objectStore(STORES.EVENTS);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      const validated: EventRecord[] = [];
      for (const item of records) {
        const parsed = EventSchema.safeParse(item);
        if (parsed.success) {
          validated.push(parsed.data);
        }
      }
      resolve(validated.sort((a, b) => a.ts - b.ts));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllEvents(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.EVENTS);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// 3. Pregenerated messages operations
export async function addPregeneratedMessage(msg: PregeneratedMessage): Promise<void> {
  const validated = PregeneratedMessageSchema.parse(msg);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREGENERATED, 'readwrite');
    const store = tx.objectStore(STORES.PREGENERATED);
    const req = store.put(validated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPregenerated(): Promise<PregeneratedMessage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREGENERATED, 'readonly');
    const store = tx.objectStore(STORES.PREGENERATED);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      const list: PregeneratedMessage[] = [];
      for (const r of records) {
        const parsed = PregeneratedMessageSchema.safeParse(r);
        if (parsed.success) list.push(parsed.data);
      }
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 4. Plans (If/Then) operations
export async function addPlan(plan: Plan): Promise<void> {
  const validated = PlanSchema.parse(plan);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PLANS, 'readwrite');
    const store = tx.objectStore(STORES.PLANS);
    const req = store.put(validated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPlans(): Promise<Plan[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PLANS, 'readonly');
    const store = tx.objectStore(STORES.PLANS);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      const list: Plan[] = [];
      for (const r of records) {
        const parsed = PlanSchema.safeParse(r);
        if (parsed.success) list.push(parsed.data);
      }
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 5. Self-talk operations
export async function addSelfTalk(item: SelfTalk): Promise<void> {
  const validated = SelfTalkSchema.parse(item);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SELFTALK, 'readwrite');
    const store = tx.objectStore(STORES.SELFTALK);
    const req = store.put(validated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSelfTalk(): Promise<SelfTalk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SELFTALK, 'readonly');
    const store = tx.objectStore(STORES.SELFTALK);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result || [];
      const list: SelfTalk[] = [];
      for (const r of records) {
        const parsed = SelfTalkSchema.safeParse(r);
        if (parsed.success) list.push(parsed.data);
      }
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// 6. Settings operations
export async function getSettings(): Promise<Settings | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);
    const req = store.get('current');
    req.onsuccess = () => {
      if (!req.result?.data) return resolve(null);
      const parsed = SettingsSchema.safeParse(req.result.data);
      if (!parsed.success) return resolve(null);
      resolve(parsed.data);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function setSettings(settings: Settings): Promise<void> {
  const validated = SettingsSchema.parse(settings);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    const req = store.put({ key: 'current', data: validated });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Clear all data
export async function resetDatabase(): Promise<void> {
  const db = await openDB();
  const storeNames = [
    STORES.PROFILE,
    STORES.EVENTS,
    STORES.PREGENERATED,
    STORES.IMAGES,
    STORES.PLANS,
    STORES.SELFTALK,
    STORES.SETTINGS,
  ];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
