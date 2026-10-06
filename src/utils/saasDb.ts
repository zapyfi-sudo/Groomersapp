import { UserAccount, BusinessAccountData, SalonConfig, Pet, Appointment, SalonService } from '../types';
import { DEFAULT_SALON_CONFIG, getDefaultPets, getDefaultAppointments, compressImage } from './storage';
import { generateStableBusinessId, slugify, extractSlugOnly } from './slugUtils';

const DB_NAME = 'agendacan_saas_db';
const DB_VERSION = 3;

const STORE_ACCOUNTS = 'accounts';
const STORE_BUSINESS_DATA = 'business_data';
const STORE_SESSIONS = 'sessions';

// Synchronous local mirror keys for immediate React mounting
const SYNC_CACHE_KEY_ACTIVE_USER = 'agendacan_saas_active_user_id';
const SYNC_CACHE_KEY_ACTIVE_DATA = 'agendacan_saas_active_data_v3';
const SYNC_CACHE_KEY_ACCOUNTS_LIST = 'agendacan_saas_accounts_list_v3';

// In-memory active cache
let memoryActiveData: BusinessAccountData | null = null;
let memoryActiveAccount: UserAccount | null = null;
let memoryAccountsList: UserAccount[] = [];

// Helper to open IndexedDB
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
        const accStore = db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
        accStore.createIndex('email', 'email', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_BUSINESS_DATA)) {
        db.createObjectStore(STORE_BUSINESS_DATA, { keyPath: 'businessId' });
      }

      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Low-level IndexedDB helpers
async function dbGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB get error in ${storeName}:`, err);
    return null;
  }
}

async function dbPut<T>(storeName: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB put error in ${storeName}:`, err);
  }
}

async function dbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB getAll error in ${storeName}:`, err);
    return [];
  }
}

async function dbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`IndexedDB delete error in ${storeName}:`, err);
  }
}

// Sync mirror update for zero-latency initial page renders
function updateSyncMirror(account: UserAccount | null, data: BusinessAccountData | null, accounts: UserAccount[]): void {
  try {
    if (typeof window === 'undefined') return;

    if (account) {
      localStorage.setItem(SYNC_CACHE_KEY_ACTIVE_USER, account.id);
    } else {
      localStorage.removeItem(SYNC_CACHE_KEY_ACTIVE_USER);
    }

    if (data) {
      localStorage.setItem(SYNC_CACHE_KEY_ACTIVE_DATA, JSON.stringify(data));
    } else {
      localStorage.removeItem(SYNC_CACHE_KEY_ACTIVE_DATA);
    }

    localStorage.setItem(SYNC_CACHE_KEY_ACCOUNTS_LIST, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Sync mirror storage warning (falling back to IndexedDB only):', err);
  }
}

// Synchronously read memory/mirror on instant mount
export function getSyncActiveData(): BusinessAccountData {
  if (memoryActiveData) {
    return memoryActiveData;
  }

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SYNC_CACHE_KEY_ACTIVE_DATA) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.businessId && parsed.config) {
        memoryActiveData = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading sync mirror data:', e);
  }

  // Safe fallback before async init completes
  const fallbackData: BusinessAccountData = {
    businessId: 'biz_default',
    userId: 'usr_default',
    config: { ...DEFAULT_SALON_CONFIG, id: 'biz_default', userId: 'usr_default' },
    pets: getDefaultPets(),
    appointments: getDefaultAppointments(),
    bookedRetentions: [],
    updatedAt: new Date().toISOString()
  };
  memoryActiveData = fallbackData;
  return fallbackData;
}

export function getSyncActiveAccount(): UserAccount | null {
  if (memoryActiveAccount) return memoryActiveAccount;

  try {
    const activeUserId = typeof window !== 'undefined' ? localStorage.getItem(SYNC_CACHE_KEY_ACTIVE_USER) : null;
    const rawList = typeof window !== 'undefined' ? localStorage.getItem(SYNC_CACHE_KEY_ACCOUNTS_LIST) : null;
    if (activeUserId && rawList) {
      const list: UserAccount[] = JSON.parse(rawList);
      const found = list.find((a) => a.id === activeUserId);
      if (found) {
        memoryActiveAccount = found;
        return found;
      }
    }
  } catch {}

  return null;
}

export function getSyncAccountsList(): UserAccount[] {
  if (memoryAccountsList && memoryAccountsList.length > 0) return memoryAccountsList;

  try {
    const rawList = typeof window !== 'undefined' ? localStorage.getItem(SYNC_CACHE_KEY_ACCOUNTS_LIST) : null;
    if (rawList) {
      const list: UserAccount[] = JSON.parse(rawList);
      if (Array.isArray(list)) {
        memoryAccountsList = list;
        return list;
      }
    }
  } catch {}

  return [];
}

// Migration of legacy localStorage data (requirement #24: DO NOT DESTROY CURRENT DATA)
function checkLegacyLocalStorageData(): {
  hasLegacy: boolean;
  config?: SalonConfig;
  pets?: Pet[];
  appointments?: Appointment[];
  bookedRetentions?: string[];
} {
  try {
    if (typeof window === 'undefined') return { hasLegacy: false };

    const rawConfig = localStorage.getItem('agendacan_salon_config_v2');
    const rawPets = localStorage.getItem('agendacan_pets_v2');
    const rawApts = localStorage.getItem('agendacan_appointments_v2');
    const rawRet = localStorage.getItem('agendacan_booked_retentions_v2');

    if (rawConfig || rawPets || rawApts) {
      const config = rawConfig ? JSON.parse(rawConfig) : undefined;
      const pets = rawPets ? JSON.parse(rawPets) : undefined;
      const appointments = rawApts ? JSON.parse(rawApts) : undefined;
      const bookedRetentions = rawRet ? JSON.parse(rawRet) : undefined;

      return {
        hasLegacy: true,
        config: config ? { ...DEFAULT_SALON_CONFIG, ...config } : undefined,
        pets: Array.isArray(pets) ? pets : undefined,
        appointments: Array.isArray(appointments) ? appointments : undefined,
        bookedRetentions: Array.isArray(bookedRetentions) ? bookedRetentions : undefined
      };
    }
  } catch (e) {
    console.warn('Error reading legacy storage:', e);
  }
  return { hasLegacy: false };
}

// Master Initialization of Database & Multi-User SaaS Accounts
export async function initSaasDatabase(): Promise<{
  activeAccount: UserAccount | null;
  activeData: BusinessAccountData;
  accounts: UserAccount[];
}> {
  try {
    const accounts = await dbGetAll<UserAccount>(STORE_ACCOUNTS);
    const session = await dbGet<{ id: string; userId: string; businessId: string }>(STORE_SESSIONS, 'active_session');

    // Case 1: Accounts already exist in IndexedDB
    if (accounts.length > 0) {
      memoryAccountsList = accounts;

      // Determine active account
      let activeAcc: UserAccount | null = null;
      if (session && session.userId) {
        activeAcc = accounts.find((a) => a.id === session.userId) || null;
      }

      if (!activeAcc) {
        // Fallback to first account
        activeAcc = accounts[0];
      }

      const bizData = await dbGet<BusinessAccountData>(STORE_BUSINESS_DATA, activeAcc.businessId);
      if (bizData) {
        memoryActiveAccount = activeAcc;
        memoryActiveData = bizData;
        updateSyncMirror(activeAcc, bizData, accounts);
        return { activeAccount: activeAcc, activeData: bizData, accounts };
      }
    }

    // Case 2: No accounts yet in IndexedDB - Check for legacy data to migrate
    const legacy = checkLegacyLocalStorageData();

    const primaryUserId = 'usr_owner';
    const legacyName = legacy.config?.name || 'Mi Peluquería Canina';
    const primaryBizId = (legacy.config?.id && legacy.config.id !== 'biz_default')
      ? legacy.config.id
      : generateStableBusinessId(legacyName);

    const initialConfig: SalonConfig = legacy.config || {
      ...DEFAULT_SALON_CONFIG,
      id: primaryBizId,
      userId: primaryUserId
    };

    initialConfig.id = primaryBizId;
    initialConfig.userId = primaryUserId;
    initialConfig.bookingSlug = extractSlugOnly(initialConfig.bookingSlug) || slugify(initialConfig.name);

    const initialPets: Pet[] = legacy.pets && legacy.pets.length > 0 ? legacy.pets : getDefaultPets();
    const initialAppointments: Appointment[] = legacy.appointments && legacy.appointments.length > 0 ? legacy.appointments : getDefaultAppointments();
    const initialRetentions: string[] = legacy.bookedRetentions || [];

    const ownerAccount: UserAccount = {
      id: primaryUserId,
      email: 'propietario@agendacan.com',
      name: initialConfig.name || 'Peluquería Luna',
      businessId: primaryBizId,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    const initialBizData: BusinessAccountData = {
      businessId: primaryBizId,
      userId: primaryUserId,
      config: initialConfig,
      pets: initialPets,
      appointments: initialAppointments,
      bookedRetentions: initialRetentions,
      updatedAt: new Date().toISOString()
    };

    // Save to IndexedDB
    await dbPut(STORE_ACCOUNTS, ownerAccount);
    await dbPut(STORE_BUSINESS_DATA, initialBizData);
    await dbPut(STORE_SESSIONS, { id: 'active_session', userId: primaryUserId, businessId: primaryBizId });

    memoryActiveAccount = ownerAccount;
    memoryActiveData = initialBizData;
    memoryAccountsList = [ownerAccount];

    updateSyncMirror(ownerAccount, initialBizData, [ownerAccount]);

    return {
      activeAccount: ownerAccount,
      activeData: initialBizData,
      accounts: [ownerAccount]
    };
  } catch (err) {
    console.error('Error during initSaasDatabase:', err);
    const fallback = getSyncActiveData();
    return {
      activeAccount: memoryActiveAccount,
      activeData: fallback,
      accounts: memoryAccountsList
    };
  }
}

// Create a new isolated SaaS business account (Requirement #4, #25)
export async function createNewBusinessAccount(params: {
  name: string;
  email: string;
  businessName: string;
  country?: string;
  currency?: string;
  phonePrefix?: string;
  phone?: string;
}): Promise<{ account: UserAccount; data: BusinessAccountData }> {
  const newUserId = `usr_${Date.now()}`;
  const newBizId = generateStableBusinessId(params.businessName);
  const now = new Date().toISOString();

  // Fresh, clean business config for new user (no fake customers or fake appointments)
  const newConfig: SalonConfig = {
    ...DEFAULT_SALON_CONFIG,
    id: newBizId,
    userId: newUserId,
    name: params.businessName || 'Mi Peluquería Canina',
    country: params.country || 'Ecuador',
    currency: params.currency || 'USD',
    phonePrefix: params.phonePrefix || '+593',
    phone: params.phone || '',
    address: 'Dirección del Salón',
    bookingSlug: slugify(params.businessName || 'mipeluqueria', 'mipeluqueria'),
    simultaneousCapacity: 2,
    // Clean starting services as editable defaults
    services: [
      {
        id: 's-1',
        name: 'Baño y Secado',
        durationMin: 45,
        price: 20,
        pricingType: 'unico',
        desc: 'Higiene profunda con champú hipoalergénico.',
        active: true
      },
      {
        id: 's-2',
        name: 'Corte Completo + Baño',
        durationMin: 75,
        price: 30,
        pricingType: 'unico',
        desc: 'Corte estético según la raza y corte higiénico.',
        active: true
      },
      {
        id: 's-3',
        name: 'Deslanado Profundo',
        durationMin: 60,
        price: 25,
        pricingType: 'unico',
        desc: 'Eliminación exhaustiva de manto muerto.',
        active: true
      }
    ],
    // Clean empty medications, staff, reviews
    medicationProducts: [],
    staffMembers: [
      {
        id: 'st-1',
        name: params.name || 'Estilista Principal',
        role: 'Peluquero / Estilista',
        active: true,
        shiftAvailability: 'todo_el_dia'
      }
    ],
    reviews: []
  };

  const newAccount: UserAccount = {
    id: newUserId,
    email: params.email.trim().toLowerCase(),
    name: params.name || params.businessName,
    businessId: newBizId,
    createdAt: now,
    lastLoginAt: now
  };

  // Requirement #25: Start with empty customers and appointments for real accounts
  const newData: BusinessAccountData = {
    businessId: newBizId,
    userId: newUserId,
    config: newConfig,
    pets: [],
    appointments: [],
    bookedRetentions: [],
    updatedAt: now
  };

  await dbPut(STORE_ACCOUNTS, newAccount);
  await dbPut(STORE_BUSINESS_DATA, newData);
  await dbPut(STORE_SESSIONS, { id: 'active_session', userId: newUserId, businessId: newBizId });

  // Update lists & memory
  const allAccounts = await dbGetAll<UserAccount>(STORE_ACCOUNTS);
  memoryAccountsList = allAccounts;
  memoryActiveAccount = newAccount;
  memoryActiveData = newData;

  updateSyncMirror(newAccount, newData, allAccounts);

  return { account: newAccount, data: newData };
}

// Switch between existing accounts (Requirement #6, #27)
export async function switchAccount(userId: string): Promise<BusinessAccountData | null> {
  const accounts = await dbGetAll<UserAccount>(STORE_ACCOUNTS);
  const targetAcc = accounts.find((a) => a.id === userId);
  if (!targetAcc) return null;

  const targetData = await dbGet<BusinessAccountData>(STORE_BUSINESS_DATA, targetAcc.businessId);
  if (!targetData) return null;

  targetAcc.lastLoginAt = new Date().toISOString();
  await dbPut(STORE_ACCOUNTS, targetAcc);
  await dbPut(STORE_SESSIONS, { id: 'active_session', userId: targetAcc.id, businessId: targetAcc.businessId });

  memoryActiveAccount = targetAcc;
  memoryActiveData = targetData;
  memoryAccountsList = accounts;

  updateSyncMirror(targetAcc, targetData, accounts);
  return targetData;
}

// Log in with email
export async function loginWithEmail(email: string): Promise<{ account: UserAccount; data: BusinessAccountData } | null> {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = await dbGetAll<UserAccount>(STORE_ACCOUNTS);
  const matched = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

  if (matched) {
    const data = await switchAccount(matched.id);
    if (data) {
      return { account: matched, data };
    }
  }

  return null;
}

// Logout without deleting data (Requirement #5)
export async function logoutAccount(): Promise<void> {
  await dbDelete(STORE_SESSIONS, 'active_session');
  memoryActiveAccount = null;

  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SYNC_CACHE_KEY_ACTIVE_USER);
    }
  } catch {}
}

// Save active business changes immediately to IndexedDB and sync mirror
export async function persistActiveBusinessData(
  patch: Partial<BusinessAccountData>
): Promise<void> {
  if (!memoryActiveData) {
    memoryActiveData = getSyncActiveData();
  }

  const updated: BusinessAccountData = {
    ...memoryActiveData,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  memoryActiveData = updated;

  // Persist to IndexedDB
  await dbPut(STORE_BUSINESS_DATA, updated);

  // Update sync mirror
  updateSyncMirror(memoryActiveAccount, updated, memoryAccountsList);
}

// Helper methods for individual state changes
export async function persistActiveConfig(config: SalonConfig): Promise<void> {
  await persistActiveBusinessData({ config });
}

export async function persistActivePets(pets: Pet[]): Promise<void> {
  await persistActiveBusinessData({ pets });
}

export async function persistActiveAppointments(appointments: Appointment[]): Promise<void> {
  await persistActiveBusinessData({ appointments });
}

export async function persistActiveBookedRetentions(bookedRetentions: string[]): Promise<void> {
  await persistActiveBusinessData({ bookedRetentions });
}

// Public Booking support: Retrieve public info for any business by ID or slug (Requirement #20, #21, #23)
export async function getPublicBusinessProfile(businessIdOrSlug: string): Promise<{
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
} | null> {
  try {
    const allData = await dbGetAll<BusinessAccountData>(STORE_BUSINESS_DATA);
    let matched = allData.find((d) => d.businessId === businessIdOrSlug);

    if (!matched) {
      // Try finding by bookingSlug or name
      const cleanTarget = businessIdOrSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
      matched = allData.find((d) => {
        const slugClean = (d.config.bookingSlug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameClean = (d.config.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return slugClean.includes(cleanTarget) || nameClean.includes(cleanTarget);
      });
    }

    if (matched) {
      // Sanitize: return public-facing data only (no private tutor notes or credentials)
      const publicConfig: SalonConfig = {
        name: matched.config.name,
        logoUrl: matched.config.logoUrl,
        country: matched.config.country,
        city: matched.config.city,
        currency: matched.config.currency,
        phonePrefix: matched.config.phonePrefix,
        phone: matched.config.phone,
        address: matched.config.address,
        googleMapsUrl: matched.config.googleMapsUrl,
        googleMapsPlaceName: matched.config.googleMapsPlaceName,
        workingDays: matched.config.workingDays,
        openTime: matched.config.openTime,
        closeTime: matched.config.closeTime,
        simultaneousCapacity: matched.config.simultaneousCapacity || 2,
        morningOpen: matched.config.morningOpen,
        morningClose: matched.config.morningClose,
        afternoonOpen: matched.config.afternoonOpen,
        afternoonClose: matched.config.afternoonClose,
        hasDoubleShift: matched.config.hasDoubleShift,
        bookingSlug: matched.config.bookingSlug,
        activeDays: matched.config.activeDays,
        services: (matched.config.services || []).filter((s: SalonService) => s.active !== false),
        reviews: matched.config.reviews || [],
        medicationFee: matched.config.medicationFee || 0
      };

      return {
        businessId: matched.businessId,
        config: publicConfig,
        services: publicConfig.services
      };
    }
  } catch (err) {
    console.error('Error fetching public business profile:', err);
  }

  // Never return demo business fallback when requested business cannot be found
  return null;
}

// Convert any image URL or file to a persistent, compressed data URL (Requirement #13)
export async function makePersistentImage(source: File | Blob | string): Promise<string> {
  if (!source) return '';

  if (typeof source !== 'string') {
    // File or Blob
    return compressImage(source as File, 800, 0.82);
  }

  // If it's already an HTTP / HTTPS URL
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  // If it's a blob: URL (temporary browser reference that expires!), fetch and convert
  if (source.startsWith('blob:')) {
    try {
      const res = await fetch(source);
      const blob = await res.blob();
      const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
      return await compressImage(file, 800, 0.82);
    } catch {
      return source;
    }
  }

  // If it's a data: URL, it's already persistent
  return source;
}
