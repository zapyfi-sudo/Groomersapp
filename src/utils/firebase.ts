import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  getDocFromServer,
  getDocsFromServer,
  getDocFromCache,
  getDocsFromCache,
  onSnapshot,
  writeBatch,
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import {
  getStorage,
  FirebaseStorage,
  ref as storageRef,
  uploadString,
  getDownloadURL
} from 'firebase/storage';
import firebaseConfigRaw from '../../firebase-applet-config.json';
import { SalonConfig, Appointment, Pet, SalonService, MedicationProduct, ClientReview, ReviewRequestState, SaleRecord } from '../types';
import { slugify, cleanSlugInput, extractSlugOnly } from './slugUtils';
import { AppLanguage, getAuthErrorMessage, getTranslations, resolveAppLanguage } from './translations';
import {
  normalizeAndMergeReviews,
  mergeAppointments,
  isAppointmentActiveServiceOrCompleted,
  materializePetFromAppointment
} from './syncHelpers';

const firebaseConfig = {
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || firebaseConfigRaw.projectId,
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || firebaseConfigRaw.appId,
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || firebaseConfigRaw.apiKey,
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || firebaseConfigRaw.authDomain,
  firestoreDatabaseId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID) || firebaseConfigRaw.firestoreDatabaseId,
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || firebaseConfigRaw.storageBucket,
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || firebaseConfigRaw.messagingSenderId,
  measurementId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) || firebaseConfigRaw.measurementId
};

// Initialize Firebase App
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth: Auth = getAuth(app);

// Initialize Firestore with specific database ID if configured
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Cloud Storage
export const storage: FirebaseStorage = firebaseConfig.storageBucket
  ? getStorage(app, `gs://${firebaseConfig.storageBucket}`)
  : getStorage(app);

/**
 * Uploads a base64 DataURL or binary image to Firebase Cloud Storage
 * and returns the permanent public download URL.
 * Falls back safely to the compressed dataUrl if offline or storage warning.
 */
export async function uploadImageToStorage(
  storagePath: string,
  dataUrlOrBase64: string
): Promise<string> {
  if (!dataUrlOrBase64) return '';
  // If it's already a remote URL (http/https), return it directly
  if (dataUrlOrBase64.startsWith('http://') || dataUrlOrBase64.startsWith('https://')) {
    return dataUrlOrBase64;
  }
  // Must be a base64 DataURL
  if (!dataUrlOrBase64.startsWith('data:')) {
    return dataUrlOrBase64;
  }

  try {
    const fileRef = storageRef(storage, storagePath);
    await uploadString(fileRef, dataUrlOrBase64, 'data_url');
    const downloadUrl = await getDownloadURL(fileRef);
    console.log(`[STORAGE UPLOAD SUCCESS] Saved ${storagePath} -> ${downloadUrl.substring(0, 60)}...`);
    return downloadUrl;
  } catch (err) {
    console.warn(`[STORAGE UPLOAD WARN] Failed to upload ${storagePath} to Firebase Storage, keeping local compressed version:`, err);
    return dataUrlOrBase64;
  }
}

/**
 * Real Google Authentication using Firebase Auth signInWithPopup
 */
export async function authWithGoogle(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || undefined
  };
}

/**
 * Real Email & Password Registration using Firebase Auth createUserWithEmailAndPassword
 */
export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<{
  uid: string;
  email: string;
  displayName: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  if (displayName && cred.user) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch (e) {
      console.warn('Could not update profile displayName:', e);
    }
  }
  return {
    uid: cred.user.uid,
    email: cred.user.email || cleanEmail,
    displayName: displayName?.trim() || cred.user.displayName || ''
  };
}

/**
 * Real Email & Password Login using Firebase Auth
 */
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  return cred.user;
}

/**
 * Sign out from Firebase Auth
 */
export async function logoutFirebaseAuth(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Error signing out from Firebase Auth:', err);
  }
}

/**
 * Translates Firebase Auth error codes into helpful Spanish user messages with exact console actions
 */
export function translateFirebaseAuthError(err: any, lang: AppLanguage = 'es-LA'): string {
  const code = err?.code || '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'domain';
  const projectId = firebaseConfig.projectId || 'third-strength-vh7nb';

  if (lang !== 'es-LA') {
    if (code === 'auth/operation-not-allowed' || code === 'auth/unauthorized-domain') {
      return `${getAuthErrorMessage(err, lang)} (${currentHost} / ${projectId})`;
    }
    return getAuthErrorMessage(err, lang);
  }

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado en Firebase. Inicia sesión con tu contraseña o con Google.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico ingresado no es válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de inicio de sesión de Google antes de completar la autenticación.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente de Google. Por favor permite las ventanas emergentes (popups) para este sitio.';
    case 'auth/cancelled-popup-request':
      return 'Ya hay una solicitud de autenticación en curso.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con este correo vinculada a otro método de acceso. Inicia sesión con tu método original.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Credenciales inválidas o contraseña incorrecta. Verifica tu correo y contraseña.';
    case 'auth/user-not-found':
      return 'No existe ninguna cuenta registrada con este correo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Por favor espera unos momentos antes de intentar nuevamente.';
    case 'auth/network-request-failed':
      return 'Error de conexión de red. Verifica tu conexión a internet.';
    case 'auth/operation-not-allowed':
      return `El método de acceso (Correo y Contraseña o Google) está deshabilitado en Firebase. Debes habilitarlo en Firebase Console (Proyecto: ${projectId}) → Authentication → pestaña "Sign-in method" → activar "Correo electrónico/contraseña".`;
    case 'auth/unauthorized-domain': {
      const uniqueDomains = Array.from(new Set([currentHost, 'groomers-app.vercel.app'])).filter(Boolean);
      return `Dominio no autorizado en Firebase (${currentHost}). Para permitir el acceso con Google, agrega ${uniqueDomains.map((d) => `"${d}"`).join(' y ')} en Firebase Console (Proyecto: ${projectId}) → Authentication → pestaña "Settings" → "Authorized domains".`;
    }
    default:
      return err?.message || 'Ocurrió un error en la autenticación. Por favor intenta nuevamente.';
  }
}

// Connectivity check (as per Firebase skill)
let connectionTested = false;
export async function testFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return true;
  try {
    await getDocFromServer(doc(db, 'slugs', '_ping_test'));
    connectionTested = true;
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline or network restricted.');
      return false;
    }
    // If permission or not found, it still reached the server
    connectionTested = true;
    return true;
  }
}

/**
 * Recursively removes all `undefined` values from an object or array.
 * Firestore strictly forbids `undefined` anywhere in document payloads.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as any;
  }
  return obj;
}

export interface FirestoreBusinessData {
  businessId: string;
  name: string;
  bookingSlug: string;
  reviewSlug?: string;
  currency?: string;
  config: SalonConfig;
  services?: SalonService[];
  medicationProducts?: MedicationProduct[];
  appointments?: Appointment[];
  pets?: Pet[];
  updatedAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  code?: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errObj = error as any;
  return {
    error: error instanceof Error ? error.message : String(error),
    code: errObj?.code,
    operationType,
    path,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    }
  };
}

export function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Separate circuit breakers for Firestore read vs write quota exhaustion
let writeQuotaExhaustedUntil = 0;
let readQuotaExhaustedUntil = 0;
let lastFirestoreReadErrorKind: 'quota-exceeded' | 'permission-denied' | 'offline' | null = null;

export function getLastFirestoreReadErrorKind(): 'quota-exceeded' | 'permission-denied' | 'offline' | null {
  if (isReadQuotaExhausted()) return 'quota-exceeded';
  return lastFirestoreReadErrorKind;
}

export function resetLastFirestoreReadErrorKind(): void {
  if (!isReadQuotaExhausted()) {
    lastFirestoreReadErrorKind = null;
  }
}

export function isQuotaExhausted(): boolean {
  return Date.now() < writeQuotaExhaustedUntil;
}

export function isReadQuotaExhausted(): boolean {
  return Date.now() < readQuotaExhaustedUntil;
}

export function markQuotaExhausted(cooldownMs = 60000 * 5): void {
  writeQuotaExhaustedUntil = Date.now() + cooldownMs;
  console.warn(
    `[FIRESTORE WRITE QUOTA GUARD] Write quota limit reached. Pausing remote Firestore writes for ${Math.round(
      cooldownMs / 1000
    )}s.`
  );
}

export function markReadQuotaExhausted(cooldownMs = 60000 * 5): void {
  const wasActive = isReadQuotaExhausted();
  readQuotaExhaustedUntil = Date.now() + cooldownMs;
  lastFirestoreReadErrorKind = 'quota-exceeded';
  if (!wasActive) {
    console.warn(
      `[FIRESTORE READ QUOTA GUARD] Read quota limit reached. Falling back to local cache/server for ${Math.round(
        cooldownMs / 1000
      )}s.`
    );
  }
}

function classifyQuotaError(err: any): 'read' | 'write' | 'unknown' | null {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  if (code !== 'resource-exhausted' && !msg.includes('Quota limit exceeded') && !msg.includes('resource-exhausted')) {
    return null;
  }
  if (msg.includes('Free daily read units')) return 'read';
  if (msg.includes('Free daily write units')) return 'write';
  return 'unknown';
}

function recordReadFailure(err: any): void {
  const quotaKind = classifyQuotaError(err);
  if (quotaKind === 'read' || quotaKind === 'unknown') {
    markReadQuotaExhausted();
    return;
  }
  const code = err?.code || '';
  const msg = String(err?.message || '').toLowerCase();
  if (code === 'permission-denied') {
    lastFirestoreReadErrorKind = 'permission-denied';
  } else if (code === 'unavailable' || msg.includes('offline')) {
    lastFirestoreReadErrorKind = 'offline';
  }
}

async function getDocFresh<T = DocumentData>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  if (isReadQuotaExhausted()) {
    lastFirestoreReadErrorKind = 'quota-exceeded';
    return getDocFromCache(ref);
  }
  try {
    return await getDocFromServer(ref);
  } catch (err: any) {
    recordReadFailure(err);
    return getDocFromCache(ref);
  }
}

async function getDocsFresh<T = DocumentData>(q: Query<T>): Promise<QuerySnapshot<T>> {
  if (isReadQuotaExhausted()) {
    lastFirestoreReadErrorKind = 'quota-exceeded';
    return getDocsFromCache(q);
  }
  try {
    return await getDocsFromServer(q);
  } catch (err: any) {
    recordReadFailure(err);
    return getDocsFromCache(q);
  }
}

async function hydrateOwnerBusinessResult(
  businessId: string,
  data: FirestoreBusinessData,
  firestoreDocId?: string
): Promise<{
  businessId: string;
  config: SalonConfig;
  appointments?: Appointment[];
  pets?: Pet[];
  sales?: SaleRecord[];
}> {
  const docIdsToQuery = Array.from(new Set([businessId, firestoreDocId].filter(Boolean) as string[]));

  const reviewQueries = docIdsToQuery.map((id) =>
    getDocsFresh(collection(db, 'businesses', id, 'reviews'))
  );

  const [subAptsRes, subPetsRes, subSalesRes, ...subReviewsSettled] = await Promise.allSettled([
    getDocsFresh(collection(db, 'businesses', businessId, 'appointments')),
    getDocsFresh(collection(db, 'businesses', businessId, 'pets')),
    getDocsFresh(collection(db, 'businesses', businessId, 'sales')),
    ...reviewQueries
  ]);

  const subReviews: ClientReview[] = [];
  for (const res of subReviewsSettled) {
    if (res.status === 'fulfilled') {
      res.value.forEach((rDoc) => {
        const rData = rDoc.data() as ClientReview;
        subReviews.push({ ...rData, id: rData?.id || rDoc.id });
      });
    }
  }

  const subApts: Appointment[] = [];
  if (subAptsRes.status === 'fulfilled') {
    subAptsRes.value.forEach((aDoc) => {
      const aData = aDoc.data() as Appointment;
      if (aData) subApts.push({ ...aData, id: aData.id || aDoc.id });
    });
  }

  const subPets: Pet[] = [];
  if (subPetsRes.status === 'fulfilled') {
    subPetsRes.value.forEach((pDoc) => {
      const pData = pDoc.data() as Pet;
      if (pData) subPets.push({ ...pData, id: pData.id || pDoc.id });
    });
  }

  const subSales: SaleRecord[] = [];
  if (subSalesRes.status === 'fulfilled') {
    subSalesRes.value.forEach((sDoc) => {
      const sData = sDoc.data() as SaleRecord;
      if (sData) subSales.push({ ...sData, id: sData.id || sDoc.id });
    });
  }

  const mergedReviews = normalizeAndMergeReviews(businessId, data.config?.reviews, subReviews);
  const mergedAppointments = mergeAppointments(data.appointments || [], subApts);

  const petsMap = new Map<string, Pet>();
  for (const p of data.pets || []) {
    if (p?.id) petsMap.set(p.id, p);
  }
  for (const p of subPets) {
    if (p?.id) petsMap.set(p.id, p);
  }
  const mergedPets = Array.from(petsMap.values());

  const salesMap = new Map<string, SaleRecord>();
  for (const s of ((data as any).sales as SaleRecord[]) || []) {
    if (s?.id) salesMap.set(s.id, s);
  }
  for (const s of subSales) {
    if (s?.id) salesMap.set(s.id, s);
  }
  const mergedSales = Array.from(salesMap.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  const config: SalonConfig = {
    ...data.config,
    id: businessId,
    reviews: mergedReviews,
    updatedAt: data.config?.updatedAt || data.updatedAt
  };

  return {
    businessId,
    config,
    appointments: mergedAppointments,
    pets: mergedPets,
    sales: mergedSales
  };
}

/**
 * Searches Firestore for an existing business owned by the user (by Firebase UID or Email).
 */
export async function findBusinessByOwner(
  uid: string,
  email?: string
): Promise<{
  businessId: string;
  config: SalonConfig;
  appointments?: Appointment[];
  pets?: Pet[];
  sales?: SaleRecord[];
} | null> {
  if (!uid && !email) return null;

  const pickBestDoc = (docs: QuerySnapshot<DocumentData>['docs']) => {
    return docs.slice().sort((a, b) => {
      const dA = a.data() || {};
      const dB = b.data() || {};
      const timeA = String(dA.config?.updatedAt || dA.updatedAt || '');
      const timeB = String(dB.config?.updatedAt || dB.updatedAt || '');
      return timeB.localeCompare(timeA);
    })[0];
  };

  try {
    // 1. Search by config.userId == uid
    if (uid) {
      const qUid = query(collection(db, 'businesses'), where('config.userId', '==', uid));
      const snapUid = await getDocsFresh(qUid);
      if (!snapUid.empty) {
        const d = pickBestDoc(snapUid.docs);
        const data = d.data() as FirestoreBusinessData;
        return await hydrateOwnerBusinessResult(data.businessId || d.id, data, d.id);
      }

      // Check direct document with ID uid
      const directDoc = await getDocFresh(doc(db, 'businesses', uid));
      if (directDoc.exists()) {
        const data = directDoc.data() as FirestoreBusinessData;
        return await hydrateOwnerBusinessResult(data.businessId || directDoc.id, data, directDoc.id);
      }
    }

    // 2. Search by email if available
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const qEmail = query(collection(db, 'businesses'), where('config.email', '==', cleanEmail));
      const snapEmail = await getDocsFresh(qEmail);
      if (!snapEmail.empty) {
        const d = pickBestDoc(snapEmail.docs);
        const data = d.data() as FirestoreBusinessData;
        return await hydrateOwnerBusinessResult(data.businessId || d.id, data, d.id);
      }
    }

    return null;
  } catch (err) {
    console.warn('[FIRESTORE FIND BIZ WARNING]', err);
    return null;
  }
}

/**
 * Checks whether a booking slug is already registered to a DIFFERENT business.
 */
export async function checkSlugAvailabilityInFirestore(
  slug: string,
  currentBusinessId: string
): Promise<{ available: boolean; conflictBusinessName?: string }> {
  const clean = cleanSlugInput(slug);
  if (!clean) return { available: false };

  try {
    // 1. Direct slug mapping lookup
    const slugDocRef = doc(db, 'slugs', clean);
    const slugSnap = await getDoc(slugDocRef);

    if (slugSnap.exists()) {
      const data = slugSnap.data();
      if (data && data.businessId && data.businessId !== currentBusinessId) {
        // Fetch conflicting business name
        const conflictBizSnap = await getDoc(doc(db, 'businesses', data.businessId));
        const conflictName = conflictBizSnap.exists()
          ? conflictBizSnap.data()?.name || 'Otro negocio'
          : 'Otro negocio';
        return { available: false, conflictBusinessName: conflictName };
      }
    }

    // 2. Query businesses collection for both bookingSlug and reviewSlug
    const [qBookingSnap, qReviewSnap] = await Promise.all([
      getDocs(query(collection(db, 'businesses'), where('bookingSlug', '==', clean))),
      getDocs(query(collection(db, 'businesses'), where('reviewSlug', '==', clean)))
    ]);

    for (const d of [...qBookingSnap.docs, ...qReviewSnap.docs]) {
      if (d.id !== currentBusinessId) {
        const bizData = d.data();
        return {
          available: false,
          conflictBusinessName: bizData?.name || 'Otro negocio'
        };
      }
    }

    return { available: true };
  } catch (err) {
    console.warn('[FIRESTORE SLUG CHECK WARN]', err);
    return { available: true };
  }
}

// Quota guard helpers moved above getDocFresh to handle both read & write quotas cleanly.

/**
 * Persists business configuration, services, medications, and slug mapping to Firestore.
 * Merges existing public appointments so client bookings are NEVER overwritten.
 */
export async function saveBusinessToFirestore(
  businessId: string,
  config: SalonConfig,
  appointments?: Appointment[],
  pets?: Pet[]
): Promise<boolean> {
  if (isQuotaExhausted()) {
    return false;
  }
  const cleanId = businessId || config.id || 'biz_main';
  const cleanSlug =
    extractSlugOnly(config.bookingSlug) ||
    cleanSlugInput(config.bookingSlug) ||
    slugify(config.name || 'salon', 'salon');
  const cleanReviewSlug =
    extractSlugOnly(config.reviewSlug) ||
    cleanSlugInput(config.reviewSlug) ||
    '';

  const now = new Date().toISOString();

  // Normalize services so each has a unique ID and is bound to businessId
  const sanitizedServices: SalonService[] = (config.services || []).map((s, idx) => ({
    ...s,
    id: s.id || `svc-${Date.now()}-${idx}`,
    businessId: cleanId,
    name: (s.name || '').trim(),
    durationMin: Number(s.durationMin) || 60,
    price: Number(s.price) || 0,
    pricingType: s.pricingType || 'unico',
    ...(s.imageUrl ? { imageUrl: s.imageUrl } : {}),
    ...(Array.isArray(s.galleryUrls) && s.galleryUrls.length > 0 ? { galleryUrls: s.galleryUrls.filter(Boolean).slice(0, 4) } : {}),
    active: s.active !== false
  }));

  // Normalize medications
  const sanitizedMedications: MedicationProduct[] = (config.medicationProducts || []).map((m, idx) => ({
    ...m,
    id: m.id || `med-${Date.now()}-${idx}`,
    name: (m.name || '').trim(),
    price: Number(m.price) || 0,
    active: m.active !== false
  }));

  const sanitizedTemplates = (config.whatsappTemplates || []).map((t, idx) => ({
    id: t.id || `tmpl-${Date.now()}-${idx}`,
    title: (t.title || 'Plantilla').trim(),
    content: t.content || '',
    isDefault: !!t.isDefault,
    createdAt: t.createdAt || now
  }));

  const cleanConfig: SalonConfig = {
    ...config,
    id: cleanId,
    bookingSlug: cleanSlug,
    ...(cleanReviewSlug ? { reviewSlug: cleanReviewSlug } : {}),
    ...(config.language ? { language: config.language } : {}),
    name: (config.name || 'Groomer Aida').trim(),
    country: config.country !== undefined ? String(config.country).trim() : '',
    city: config.city !== undefined ? String(config.city).trim() : '',
    address: config.address !== undefined ? String(config.address).trim() : '',
    services: sanitizedServices,
    medicationProducts: sanitizedMedications,
    whatsappTemplates: sanitizedTemplates,
    reviews: normalizeAndMergeReviews(cleanId, config.reviews),
    updatedAt: config.updatedAt || now
  };

  const businessData: FirestoreBusinessData = {
    businessId: cleanId,
    name: cleanConfig.name,
    bookingSlug: cleanSlug,
    ...(cleanReviewSlug ? { reviewSlug: cleanReviewSlug } : {}),
    currency: cleanConfig.currency || 'USD',
    config: cleanConfig,
    services: sanitizedServices,
    medicationProducts: sanitizedMedications,
    updatedAt: cleanConfig.updatedAt || now
  };

  const executeSave = async (): Promise<boolean> => {
    try {
      // 1. Persist services and medications to subcollections FIRST to guarantee individual document persistence
      try {
        const batch = writeBatch(db);
        const activeServiceIds = new Set(sanitizedServices.map((s) => s.id));

        // Fetch existing subcollection services to delete any removed ones
        try {
          const existingSubSnap = await getDocs(collection(db, 'businesses', cleanId, 'services'));
          existingSubSnap.forEach((docSnap) => {
            if (!activeServiceIds.has(docSnap.id)) {
              batch.delete(docSnap.ref);
            }
          });
        } catch {}

        for (const svc of sanitizedServices) {
          if (svc.id) {
            const svcRef = doc(db, 'businesses', cleanId, 'services', svc.id);
            batch.set(svcRef, cleanFirestoreData(svc), { merge: true });
          }
        }
        for (const med of sanitizedMedications) {
          if (med.id) {
            const medRef = doc(db, 'businesses', cleanId, 'medications', med.id);
            batch.set(medRef, cleanFirestoreData(med), { merge: true });
          }
        }
        await batch.commit();
      } catch (subErr) {
        console.warn('[FIRESTORE SUBCOLLECTIONS WARN]', subErr);
      }

      // 2. Save slug mapping documents for O(1) public URL resolution (booking & custom review link)
      const slugEntries: Array<{ slug: string; type: string }> = [];
      if (cleanSlug) slugEntries.push({ slug: cleanSlug, type: 'booking' });
      if (cleanReviewSlug && cleanReviewSlug !== cleanSlug) {
        slugEntries.push({ slug: cleanReviewSlug, type: 'review' });
      }
      for (const entry of slugEntries) {
        try {
          const slugRef = doc(db, 'slugs', entry.slug);
          await setDoc(
            slugRef,
            {
              slug: entry.slug,
              businessId: cleanId,
              businessName: cleanConfig.name,
              type: entry.type,
              updatedAt: now
            },
            { merge: true }
          );
        } catch (slugErr) {
          console.warn('[FIRESTORE SLUG MAPPING WARN]', slugErr);
        }
      }

      // 3. Save main business document (guard against 1MB Firestore document limit caused by duplicated arrays/images)
      const bizRef = doc(db, 'businesses', cleanId);
      let payloadToSave = cleanFirestoreData(businessData);
      try {
        const estimatedBytes = JSON.stringify(payloadToSave).length;
        if (estimatedBytes > 820000) {
          const compactPayload: any = {
            ...payloadToSave,
            services: [],
            medicationProducts: [],
            config: {
              ...payloadToSave.config,
              reviews: (payloadToSave.config?.reviews || []).slice(0, 20)
            }
          };
          payloadToSave = compactPayload;
        }
      } catch {}
      await setDoc(bizRef, payloadToSave, { merge: true });

      console.log(`[FIRESTORE SUCCESS] Business "${cleanConfig.name}" (${cleanId}) saved with ${sanitizedServices.length} services and slug "${cleanSlug}".`);
      return true;
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('Quota limit exceeded') ||
        err?.message?.includes('resource-exhausted')
      ) {
        markQuotaExhausted();
      } else {
        console.error('[FIRESTORE SAVE ERROR]', err);
      }
      return false;
    }
  };

  // 4.5-second timeout race to prevent UI freeze under unstable networks
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => {
      console.warn('[FIRESTORE SAVE TIMEOUT] Remote Firestore save exceeded 4500ms');
      resolve(false);
    }, 4500);
  });

  return Promise.race([executeSave(), timeoutPromise]);
}

/**
 * Deletes a service from Firestore subcollection.
 */
export async function deleteServiceFromFirestore(businessId: string, serviceId: string): Promise<boolean> {
  if (!businessId || !serviceId) return false;
  try {
    const svcRef = doc(db, 'businesses', businessId, 'services', serviceId);
    await deleteDoc(svcRef);
    return true;
  } catch (err) {
    console.warn('[FIRESTORE DELETE SERVICE WARN]', err);
    return false;
  }
}

/**
 * Resolves a public booking or review link by slug or ID directly from Firestore.
 * Reuses already-fetched root snapshots, supports nested/legacy fields, and skips subcollections when summaryOnly=true.
 */
export async function getBusinessFromFirestore(
  slugOrId: string,
  options?: { summaryOnly?: boolean }
): Promise<{
  businessId: string;
  firestoreDocId?: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
  pets: Pet[];
  updatedAt?: string;
} | null> {
  if (!slugOrId) return null;

  const raw = slugOrId.trim();
  const clean = cleanSlugInput(raw) || raw;
  const summaryOnly = Boolean(options?.summaryOnly);
  resetLastFirestoreReadErrorKind();

  const pickNewestDoc = (docs: QuerySnapshot<DocumentData>['docs']) => {
    return docs.slice().sort((a, b) => {
      const timeA = String(a.data()?.config?.updatedAt || a.data()?.updatedAt || '');
      const timeB = String(b.data()?.config?.updatedAt || b.data()?.updatedAt || '');
      return timeB.localeCompare(timeA);
    })[0];
  };

  const performLookup = async () => {
    try {
      let targetBizId = '';
      let cachedBizSnap: DocumentSnapshot<DocumentData> | null = null;

      // Strategy 0: Direct business ID lookup in businesses collection
      try {
        const directRawBizSnap = await getDocFresh(doc(db, 'businesses', raw));
        if (directRawBizSnap.exists()) {
          targetBizId = raw;
          cachedBizSnap = directRawBizSnap;
        }
      } catch {}

      // Strategy 1: Check direct slug mapping (O(1))
      if (!targetBizId) {
        try {
          const slugSnap = await getDocFresh(doc(db, 'slugs', clean));
          if (slugSnap.exists()) {
            targetBizId = slugSnap.data()?.businessId || '';
          } else if (clean !== raw) {
            const rawSlugSnap = await getDocFresh(doc(db, 'slugs', raw));
            if (rawSlugSnap.exists()) {
              targetBizId = rawSlugSnap.data()?.businessId || '';
            }
          }
        } catch {}
      }

      // Strategy 2: If not found, check businesses collection with clean
      if (!targetBizId && clean !== raw) {
        try {
          const directCleanBizSnap = await getDocFresh(doc(db, 'businesses', clean));
          if (directCleanBizSnap.exists()) {
            targetBizId = clean;
            cachedBizSnap = directCleanBizSnap;
          }
        } catch {}
      }

      // Strategy 3: Query by root bookingSlug, config.bookingSlug, root reviewSlug, or config.reviewSlug
      if (!targetBizId) {
        try {
          const snapSlug = await getDocsFresh(query(collection(db, 'businesses'), where('bookingSlug', '==', clean)));
          if (!snapSlug.empty) {
            const best = pickNewestDoc(snapSlug.docs);
            targetBizId = best.id;
            cachedBizSnap = best;
          } else {
            const snapNestedSlug = await getDocsFresh(
              query(collection(db, 'businesses'), where('config.bookingSlug', '==', clean))
            );
            if (!snapNestedSlug.empty) {
              const best = pickNewestDoc(snapNestedSlug.docs);
              targetBizId = best.id;
              cachedBizSnap = best;
            } else {
              const snapReviewSlug = await getDocsFresh(
                query(collection(db, 'businesses'), where('reviewSlug', '==', clean))
              );
              if (!snapReviewSlug.empty) {
                const best = pickNewestDoc(snapReviewSlug.docs);
                targetBizId = best.id;
                cachedBizSnap = best;
              } else {
                const snapNestedReviewSlug = await getDocsFresh(
                  query(collection(db, 'businesses'), where('config.reviewSlug', '==', clean))
                );
                if (!snapNestedReviewSlug.empty) {
                  const best = pickNewestDoc(snapNestedReviewSlug.docs);
                  targetBizId = best.id;
                  cachedBizSnap = best;
                } else if (clean !== raw) {
                  const snapRawSlug = await getDocsFresh(
                    query(collection(db, 'businesses'), where('bookingSlug', '==', raw))
                  );
                  if (!snapRawSlug.empty) {
                    const best = pickNewestDoc(snapRawSlug.docs);
                    targetBizId = best.id;
                    cachedBizSnap = best;
                  }
                }
              }
            }
          }
        } catch {}
      }

      // Strategy 4: Query by businessId or config.id field
      if (!targetBizId) {
        try {
          const snapBizId = await getDocsFresh(query(collection(db, 'businesses'), where('businessId', '==', raw)));
          if (!snapBizId.empty) {
            const best = pickNewestDoc(snapBizId.docs);
            targetBizId = best.id;
            cachedBizSnap = best;
          } else {
            const snapCfgId = await getDocsFresh(query(collection(db, 'businesses'), where('config.id', '==', raw)));
            if (!snapCfgId.empty) {
              const best = pickNewestDoc(snapCfgId.docs);
              targetBizId = best.id;
              cachedBizSnap = best;
            }
          }
        } catch {}
      }

      if (!targetBizId) {
        return null;
      }

      // Ensure we have the business root document (and fall back to querying businessId/config.id if doc.id !== businessId)
      if (!cachedBizSnap) {
        try {
          const directSnap = await getDocFresh(doc(db, 'businesses', targetBizId));
          if (directSnap.exists()) {
            cachedBizSnap = directSnap;
          } else {
            const byBizId = await getDocsFresh(
              query(collection(db, 'businesses'), where('businessId', '==', targetBizId))
            );
            if (!byBizId.empty) {
              const best = pickNewestDoc(byBizId.docs);
              targetBizId = best.id;
              cachedBizSnap = best;
            } else {
              const byCfgId = await getDocsFresh(
                query(collection(db, 'businesses'), where('config.id', '==', targetBizId))
              );
              if (!byCfgId.empty) {
                const best = pickNewestDoc(byCfgId.docs);
                targetBizId = best.id;
                cachedBizSnap = best;
              }
            }
          }
        } catch {}
      }

      if (!cachedBizSnap || !cachedBizSnap.exists()) {
        return null;
      }

      const b = cachedBizSnap.data() as FirestoreBusinessData;
      const resolvedBizId = b.businessId || b.config?.id || targetBizId;
      const resolvedCurrency = b.config?.currency || b.currency || 'USD';
      const resolvedUpdatedAt = b.config?.updatedAt || b.updatedAt;

      if (summaryOnly) {
        const rootServices = (Array.isArray(b.config?.services) && b.config.services.length > 0
          ? b.config.services
          : Array.isArray(b.services)
          ? b.services
          : []
        ).filter((s) => s && s.id && s.active !== false);

        const summaryConfig: SalonConfig = {
          ...b.config,
          id: resolvedBizId,
          currency: resolvedCurrency,
          services: rootServices,
          reviews: normalizeAndMergeReviews(resolvedBizId, b.config?.reviews),
          updatedAt: resolvedUpdatedAt
        };

        return {
          businessId: resolvedBizId,
          firestoreDocId: targetBizId,
          config: summaryConfig,
          services: rootServices,
          appointments: [],
          pets: [],
          updatedAt: resolvedUpdatedAt
        };
      }

      // Retrieve subcollections in parallel only when full profile is requested
      const [subServicesRes, subAptsRes, subPetsRes, subReviewsRes] = await Promise.allSettled([
        getDocsFresh(collection(db, 'businesses', targetBizId, 'services')),
        getDocsFresh(collection(db, 'businesses', targetBizId, 'appointments')),
        getDocsFresh(collection(db, 'businesses', targetBizId, 'pets')),
        getDocsFresh(collection(db, 'businesses', targetBizId, 'reviews'))
      ]);

      let rawServices: SalonService[] = [];

      // 1. Read from modular subcollection
      if (subServicesRes.status === 'fulfilled' && !subServicesRes.value.empty) {
        const subList: SalonService[] = [];
        subServicesRes.value.forEach((d) => {
          subList.push(d.data() as SalonService);
        });
        if (subList.length > 0) {
          rawServices = subList;
        }
      }

      // 2. Combine with root document services to guarantee no services or photos are missed
      const rootServices = Array.isArray(b.config?.services) && b.config.services.length > 0
        ? b.config.services
        : (Array.isArray(b.services) ? b.services : []);

      if (rawServices.length === 0) {
        rawServices = rootServices;
      } else if (rootServices.length > 0) {
        const subMap = new Map(rawServices.map((s) => [s.id, s]));
        for (const rSvc of rootServices) {
          if (!subMap.has(rSvc.id)) {
            rawServices.push(rSvc);
          } else {
            const existing = subMap.get(rSvc.id)!;
            if (!existing.imageUrl && rSvc.imageUrl) existing.imageUrl = rSvc.imageUrl;
            if ((!existing.galleryUrls || existing.galleryUrls.length === 0) && rSvc.galleryUrls) {
              existing.galleryUrls = rSvc.galleryUrls;
            }
          }
        }
      }

      const svcMap = new Map<string, SalonService>();
      for (const svc of rawServices) {
        if (svc && svc.id && svc.active !== false) {
          svcMap.set(svc.id, {
            ...svc,
            imageUrl: svc.imageUrl?.trim() || undefined,
            galleryUrls: Array.isArray(svc.galleryUrls) ? svc.galleryUrls.filter(Boolean).slice(0, 4) : undefined
          });
        }
      }
      const services: SalonService[] = Array.from(svcMap.values());

      // Merge appointments from subcollection + root doc
      let appointments = b.appointments || [];
      if (subAptsRes.status === 'fulfilled' && !subAptsRes.value.empty) {
        const aptsMap = new Map<string, Appointment>();
        for (const a of appointments) {
          if (a?.id) aptsMap.set(a.id, a);
        }
        subAptsRes.value.forEach((d) => {
          const apt = d.data() as Appointment;
          if (apt?.id) aptsMap.set(apt.id, apt);
        });
        appointments = Array.from(aptsMap.values());
        appointments.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
      }

      // Merge pets from subcollection + root doc
      let pets = b.pets || [];
      if (subPetsRes.status === 'fulfilled' && !subPetsRes.value.empty) {
        const petsMap = new Map<string, Pet>();
        for (const p of pets) {
          if (p?.id) petsMap.set(p.id, p);
        }
        subPetsRes.value.forEach((d) => {
          const p = d.data() as Pet;
          if (p?.id) petsMap.set(p.id, p);
        });
        pets = Array.from(petsMap.values());
      }

      // Merge ALL reviews from subcollection + parent config.reviews with strict businessId isolation & dedup
      const subReviews: ClientReview[] = [];
      if (subReviewsRes.status === 'fulfilled' && !subReviewsRes.value.empty) {
        subReviewsRes.value.forEach((d) => {
          subReviews.push({ ...(d.data() as ClientReview), id: (d.data() as ClientReview)?.id || d.id });
        });
      }

      // Also check secondary reviews subcollection if legacy doc.id differs from b.businessId
      const extraReviews: ClientReview[] = [];
      if (resolvedBizId && resolvedBizId !== targetBizId) {
        try {
          const altRevSnap = await getDocsFresh(collection(db, 'businesses', resolvedBizId, 'reviews'));
          altRevSnap.forEach((d) => {
            extraReviews.push({ ...(d.data() as ClientReview), id: (d.data() as ClientReview)?.id || d.id });
          });
        } catch {}
      }

      const reviews = normalizeAndMergeReviews(resolvedBizId, b.config?.reviews, subReviews, extraReviews);

      const config: SalonConfig = {
        ...b.config,
        id: resolvedBizId,
        currency: resolvedCurrency,
        services,
        reviews,
        updatedAt: resolvedUpdatedAt
      };

      return {
        businessId: resolvedBizId,
        firestoreDocId: targetBizId,
        config,
        services,
        appointments,
        pets,
        updatedAt: resolvedUpdatedAt
      };
    } catch (err) {
      recordReadFailure(err);
      console.warn('[FIRESTORE RESOLUTION WARN]', err);
      return null;
    }
  };

  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    return await Promise.race([performLookup(), timeoutPromise]);
  } catch (err) {
    recordReadFailure(err);
    console.warn('[FIRESTORE LOOKUP ERROR]', err);
    return null;
  }
}

/**
 * Persists or updates a single Pet ficha in Firestore (subcollection + parent doc).
 * Should be called only when a pet is attended/completed or created manually as a client.
 */
export async function upsertPetInFirestore(businessId: string, pet: Pet): Promise<boolean> {
  if (!businessId || !pet || !pet.id) return false;
  if (isQuotaExhausted()) return false;
  try {
    const petRef = doc(db, 'businesses', businessId, 'pets', pet.id);
    await setDoc(petRef, cleanFirestoreData(pet), { merge: true });

    try {
      const bizRef = doc(db, 'businesses', businessId);
      const bizSnap = await getDoc(bizRef);
      if (bizSnap.exists()) {
        const existingPets = (bizSnap.data()?.pets as Pet[]) || [];
        const updatedPets = [pet, ...existingPets.filter((p) => p.id !== pet.id)];
        await setDoc(bizRef, cleanFirestoreData({ pets: updatedPets }), { merge: true });
      }
    } catch {}
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('resource-exhausted')) {
      markQuotaExhausted();
    } else {
      console.warn('[FIRESTORE UPSERT PET ERROR]', err);
    }
    return false;
  }
}

/**
 * Fetches latest appointments, pets, and sales directly from Firestore for a business.
 */
export async function fetchAppointmentsAndPetsFromFirestore(
  businessId: string
): Promise<{ appointments: Appointment[]; pets: Pet[]; sales: SaleRecord[] } | null> {
  if (!businessId) return null;
  try {
    const bizRef = doc(db, 'businesses', businessId);
    const [bizSnapRes, subAptsRes, subPetsRes, subSalesRes] = await Promise.allSettled([
      getDocFresh(bizRef),
      getDocsFresh(collection(db, 'businesses', businessId, 'appointments')),
      getDocsFresh(collection(db, 'businesses', businessId, 'pets')),
      getDocsFresh(collection(db, 'businesses', businessId, 'sales'))
    ]);

    const rootData =
      bizSnapRes.status === 'fulfilled' && bizSnapRes.value.exists()
        ? (bizSnapRes.value.data() as FirestoreBusinessData)
        : null;

    const subApts: Appointment[] = [];
    if (subAptsRes.status === 'fulfilled') {
      subAptsRes.value.forEach((d) => {
        const a = d.data() as Appointment;
        if (a) subApts.push({ ...a, id: a.id || d.id });
      });
    }

    const subPets: Pet[] = [];
    if (subPetsRes.status === 'fulfilled') {
      subPetsRes.value.forEach((d) => {
        const p = d.data() as Pet;
        if (p) subPets.push({ ...p, id: p.id || d.id });
      });
    }

    const subSales: SaleRecord[] = [];
    if (subSalesRes.status === 'fulfilled') {
      subSalesRes.value.forEach((d) => {
        const s = d.data() as SaleRecord;
        if (s) subSales.push({ ...s, id: s.id || d.id });
      });
    }

    const appointments = mergeAppointments(rootData?.appointments || [], subApts);

    const petsMap = new Map<string, Pet>();
    for (const p of rootData?.pets || []) if (p?.id) petsMap.set(p.id, p);
    for (const p of subPets) if (p?.id) petsMap.set(p.id, p);

    const salesMap = new Map<string, SaleRecord>();
    for (const s of ((rootData as any)?.sales as SaleRecord[]) || []) if (s?.id) salesMap.set(s.id, s);
    for (const s of subSales) if (s?.id) salesMap.set(s.id, s);

    return {
      appointments,
      pets: Array.from(petsMap.values()),
      sales: Array.from(salesMap.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      )
    };
  } catch (err) {
    console.warn('[FIRESTORE POLL APPOINTMENTS ERROR]', err);
    return null;
  }
}

/**
 * Adds an appointment to Firestore for a specific business.
 * IMPORTANT (Etapa 6): Does NOT prematurely create a client Pet or fabricated lastVisit for
 * pending, confirmed, or cancelled bookings. Only materializes a Pet record when the appointment
 * is actively in service ('en_salon' / 'por_retirar') or 'completado'.
 */
export async function addAppointmentToFirestore(
  businessId: string,
  appointment: Appointment,
  petData?: Partial<Pet>
): Promise<boolean> {
  if (isQuotaExhausted()) return false;
  try {
    const now = new Date().toISOString();

    // 1. Prepare appointment payload preserving full pet snapshot for deferred ficha creation
    const aptRef = doc(db, 'businesses', businessId, 'appointments', appointment.id);
    const appointmentPayload: Appointment = {
      ...appointment,
      businessId,
      petSnapshot: petData || appointment.petSnapshot,
      createdAt: appointment.createdAt || now,
      updatedAt: now
    };

    const shouldCreatePetFicha = isAppointmentActiveServiceOrCompleted(
      appointmentPayload.status,
      appointmentPayload.statusLabel
    );

    const writeTasks: Promise<any>[] = [
      setDoc(aptRef, cleanFirestoreData(appointmentPayload), { merge: true })
    ];

    let materializedPet: Pet | null = null;
    if (shouldCreatePetFicha) {
      materializedPet = materializePetFromAppointment(appointmentPayload, undefined, petData);
      const petRef = doc(db, 'businesses', businessId, 'pets', materializedPet.id);
      writeTasks.push(setDoc(petRef, cleanFirestoreData(materializedPet), { merge: true }));
    }

    await Promise.all(writeTasks);

    // 2. Atomically update parent business document with new appointment (and pet only if started/completed)
    try {
      const bizRef = doc(db, 'businesses', businessId);
      const bizSnap = await getDocFresh(bizRef);
      if (bizSnap.exists()) {
        const existingApts = (bizSnap.data()?.appointments as Appointment[]) || [];
        const updatedApts = mergeAppointments(existingApts, [appointmentPayload]);

        const patchPayload: Record<string, any> = {
          appointments: updatedApts,
          updatedAt: now
        };

        if (materializedPet) {
          const existingPets = (bizSnap.data()?.pets as Pet[]) || [];
          const updatedPets = [
            materializedPet,
            ...existingPets.filter((p) => p.id !== materializedPet!.id)
          ];
          patchPayload.pets = updatedPets;
        }

        await setDoc(bizRef, cleanFirestoreData(patchPayload), { merge: true });
      }
    } catch (parentErr) {
      console.warn('[FIRESTORE PARENT BIZ UPDATE WARN]', parentErr);
    }

    console.log(`[FIRESTORE BOOKING SAVED] Appointment "${appointment.id}" (${appointment.status}) for "${appointment.petName}" stored.`);
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('resource-exhausted')) {
      markQuotaExhausted();
    } else {
      console.error('[FIRESTORE APPOINTMENT SAVE ERROR]', err);
    }
    return false;
  }
}

/**
 * Executes addAppointmentToFirestore with a safety timeout to guarantee that
 * Firestore cloud synchronization never freezes or indefinitely blocks the user interface.
 */
export async function addAppointmentToFirestoreWithTimeout(
  businessId: string,
  appointment: Appointment,
  petData?: Partial<Pet>,
  timeoutMs: number = 3500
): Promise<boolean> {
  let timer: any;
  const timeoutPromise = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[FIRESTORE TIMEOUT] addAppointmentToFirestore exceeded ${timeoutMs}ms, resolving safety fallback.`);
      resolve(false);
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([
      addAppointmentToFirestore(businessId, appointment, petData),
      timeoutPromise
    ]);
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

/**
 * Real-time listener for incoming public appointments.
 * Fires whenever a new appointment is booked anywhere (e.g. from the public link on a customer's phone).
 */
export function subscribeToBusinessAppointments(
  businessId: string,
  onUpdate: (appointments: Appointment[]) => void
): () => void {
  if (!businessId) return () => {};

  try {
    const q = collection(db, 'businesses', businessId, 'appointments');
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Appointment[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Appointment);
        });
        // Sort newest first
        list.sort((a, b) => (b.createdAt || b.id || '').localeCompare(a.createdAt || a.id || ''));
        onUpdate(list);
      },
      (err) => {
        console.warn('[FIRESTORE APPOINTMENTS LISTENER ERROR]', err);
      }
    );
  } catch (err) {
    console.warn('[FIRESTORE SUBSCRIBE ERROR]', err);
    return () => {};
  }
}

/**
 * Real-time listener for incoming pets created by online bookings.
 */
export function subscribeToBusinessPets(
  businessId: string,
  onUpdate: (pets: Pet[]) => void
): () => void {
  if (!businessId) return () => {};

  try {
    const q = collection(db, 'businesses', businessId, 'pets');
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Pet[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Pet);
        });
        onUpdate(list);
      },
      (err) => {
        console.warn('[FIRESTORE PETS LISTENER ERROR]', err);
      }
    );
  } catch (err) {
    console.warn('[FIRESTORE SUBSCRIBE PETS ERROR]', err);
    return () => {};
  }
}

/**
 * Updates an appointment in Firestore (both subcollection and parent doc).
 */
export async function updateAppointmentInFirestore(
  businessId: string,
  appointmentId: string,
  patch: Partial<Appointment>
): Promise<boolean> {
  if (!businessId || !appointmentId) return false;
  if (isQuotaExhausted()) return false;
  try {
    const now = new Date().toISOString();
    const fullPatch = { ...patch, id: appointmentId, businessId, updatedAt: now };
    const aptRef = doc(db, 'businesses', businessId, 'appointments', appointmentId);
    await setDoc(aptRef, cleanFirestoreData(fullPatch), { merge: true });

    // Also update or upsert in parent business doc
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDocFresh(bizRef);
    if (bizSnap.exists()) {
      const existingApts: Appointment[] = bizSnap.data()?.appointments || [];
      const found = existingApts.some((a) => a.id === appointmentId);
      const updatedApts = found
        ? existingApts.map((a) => (a.id === appointmentId ? { ...a, ...fullPatch } : a))
        : [{ ...fullPatch } as Appointment, ...existingApts];
      await setDoc(bizRef, cleanFirestoreData({ appointments: updatedApts, updatedAt: now }), { merge: true });
    }
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('resource-exhausted')) {
      markQuotaExhausted();
    } else {
      console.warn('[FIRESTORE APPOINTMENT UPDATE ERROR]', err);
    }
    return false;
  }
}

export interface FirestoreReviewSaveResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Persists a new client review atomically in Firestore under
 * businesses/{targetDocId}/reviews/{reviewId}.
 * Does NOT perform extra server reads or rewrite the entire parent business config blob,
 * preventing legacy missing-businessId permission errors, 1MB doc bloat, and read-quota failures.
 */
export async function addReviewToFirestore(
  businessId: string,
  review: ClientReview,
  firestoreDocId?: string,
  language?: AppLanguage
): Promise<FirestoreReviewSaveResult> {
  const cleanBizId = String(businessId || '').trim();
  const targetDocId = String(firestoreDocId || cleanBizId).trim();
  const tReview = getTranslations(resolveAppLanguage(language)).publicReview;

  if (!cleanBizId || !targetDocId || !review) {
    return {
      success: false,
      errorCode: 'invalid-argument',
      errorMessage: tReview.errSaveFailed
    };
  }

  if (isQuotaExhausted()) {
    return {
      success: false,
      errorCode: 'resource-exhausted',
      errorMessage: tReview.errSaveFailed
    };
  }

  const parsedStars = Number(review.stars);
  const trimmedName = String(review.clientName || '').trim().slice(0, 120);
  if (!trimmedName || !Number.isFinite(parsedStars) || parsedStars < 1 || parsedStars > 5) {
    return {
      success: false,
      errorCode: 'invalid-argument',
      errorMessage: tReview.errMissingStars
    };
  }

  const now = new Date().toISOString();
  const rawReviewId = String(
    review.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  )
    .trim()
    .replace(/[^a-zA-Z0-9_#.\-]/g, '_')
    .slice(0, 128);

  const cleanReview: Record<string, any> = {
    id: rawReviewId,
    businessId: cleanBizId,
    clientName: trimmedName,
    stars: Math.round(parsedStars * 10) / 10,
    comment: review.comment ? String(review.comment).trim().slice(0, 2000) : '',
    date: review.date ? String(review.date).slice(0, 80) : now.split('T')[0],
    createdAt: review.createdAt ? String(review.createdAt).slice(0, 64) : now,
    verified: review.verified !== false
  };

  if (review.petName) cleanReview.petName = String(review.petName).trim().slice(0, 120);
  if (review.serviceName) cleanReview.serviceName = String(review.serviceName).trim().slice(0, 160);
  if (review.tutorPhone) cleanReview.tutorPhone = String(review.tutorPhone).trim().slice(0, 40);

  const reviewPath = `businesses/${targetDocId}/reviews/${rawReviewId}`;
  const revRef = doc(db, 'businesses', targetDocId, 'reviews', rawReviewId);

  try {
    const writePromise = setDoc(revRef, cleanFirestoreData(cleanReview), { merge: true }).then(() => ({
      success: true as const
    }));

    const timeoutPromise = new Promise<FirestoreReviewSaveResult>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          errorCode: 'timeout',
          errorMessage: tReview.errConnectionFailed
        });
      }, 6500);
    });

    const outcome = await Promise.race([writePromise, timeoutPromise]);
    if (outcome.success) {
      console.log(
        `[FIRESTORE REVIEW SUCCESS] Review "${rawReviewId}" saved at ${reviewPath} for business ${cleanBizId}`
      );
    }
    return outcome;
  } catch (err: any) {
    const info = logFirestoreError(err, OperationType.WRITE, reviewPath);
    const quotaKind = classifyQuotaError(err);
    if (quotaKind === 'write' || quotaKind === 'unknown') {
      markQuotaExhausted();
      return {
        success: false,
        errorCode: 'resource-exhausted',
        errorMessage: tReview.errSaveFailed
      };
    }
    return {
      success: false,
      errorCode: info.code || err?.code || 'unknown',
      errorMessage: tReview.errSaveFailed
    };
  }
}

/**
 * Subscribes to reviews in real-time from Firestore.
 */
export function subscribeToBusinessReviews(
  businessId: string,
  onUpdate: (reviews: ClientReview[]) => void
): () => void {
  if (!businessId) return () => {};

  const path = `businesses/${businessId}/reviews`;
  try {
    const q = collection(db, 'businesses', businessId, 'reviews');
    return onSnapshot(
      q,
      (snapshot) => {
        const rawList: ClientReview[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as ClientReview;
          rawList.push({ ...data, id: data?.id || d.id, businessId });
        });
        onUpdate(normalizeAndMergeReviews(businessId, rawList));
      },
      (err) => {
        const quotaKind = classifyQuotaError(err);
        if (quotaKind === 'read' || quotaKind === 'unknown') {
          markReadQuotaExhausted();
        }
        logFirestoreError(err, OperationType.LIST, path);
      }
    );
  } catch (err) {
    console.warn('[FIRESTORE SUBSCRIBE REVIEWS ERROR]', err);
    return () => {};
  }
}

/**
 * Updates a review request state (e.g. 'pendiente', 'iniciada', 'calificado')
 */
export async function updateReviewRequestStateInFirestore(
  businessId: string,
  requestId: string,
  state: ReviewRequestState
): Promise<boolean> {
  if (!businessId || !requestId) return false;
  if (isQuotaExhausted()) return false;
  try {
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      const bizData = bizSnap.data();
      const currentConfig = bizData?.config || {};
      const requests = currentConfig.reviewRequests || {};
      requests[requestId] = {
        state,
        requestedAt: new Date().toISOString()
      };
      await setDoc(
        bizRef,
        cleanFirestoreData({
          config: {
            ...currentConfig,
            reviewRequests: requests
          }
        }),
        { merge: true }
      );
    }
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('resource-exhausted')) {
      markQuotaExhausted();
    } else {
      console.warn('[FIRESTORE REVIEW REQUEST STATE ERROR]', err);
    }
    return false;
  }
}

/**
 * Persists a Sale record in Firestore under businesses/{businessId}/sales/{saleId}
 * and atomically adds it to the parent business document sales array.
 */
export async function recordSaleInFirestore(
  businessId: string,
  sale: SaleRecord
): Promise<boolean> {
  if (!businessId || !sale || !sale.id) return false;
  if (isQuotaExhausted()) return false;
  try {
    const saleRef = doc(db, 'businesses', businessId, 'sales', sale.id);
    await setDoc(saleRef, cleanFirestoreData(sale), { merge: true });

    // Also update parent business doc
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      const existingSales: SaleRecord[] = bizSnap.data()?.sales || [];
      const updated = existingSales.filter((s) => s.id !== sale.id);
      updated.unshift(sale);
      await setDoc(bizRef, cleanFirestoreData({ sales: updated }), { merge: true });
    }
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('resource-exhausted')) {
      markQuotaExhausted();
    } else {
      console.warn('[FIRESTORE RECORD SALE ERROR]', err);
    }
    return false;
  }
}

/**
 * Subscribes to real-time sales collection for a business.
 */
export function subscribeToBusinessSales(
  businessId: string,
  onUpdate: (sales: SaleRecord[]) => void
): () => void {
  if (!businessId) return () => {};
  try {
    const salesCol = collection(db, 'businesses', businessId, 'sales');
    return onSnapshot(
      salesCol,
      (snapshot) => {
        const list: SaleRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ ...(d.data() as SaleRecord), id: d.id });
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onUpdate(list);
      },
      (err) => {
        console.warn('[FIRESTORE SALES LISTENER ERROR]', err);
      }
    );
  } catch (err) {
    console.warn('[FIRESTORE SUBSCRIBE SALES ERROR]', err);
    return () => {};
  }
}

/**
 * Fetches all sales from Firestore for a business.
 */
export async function fetchSalesFromFirestore(businessId: string): Promise<SaleRecord[]> {
  if (!businessId) return [];
  try {
    const salesCol = collection(db, 'businesses', businessId, 'sales');
    const snapshot = await getDocs(salesCol);
    const list: SaleRecord[] = [];
    snapshot.forEach((d) => {
      list.push({ ...(d.data() as SaleRecord), id: d.id });
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  } catch (err) {
    console.warn('[FIRESTORE FETCH SALES ERROR]', err);
    return [];
  }
}


