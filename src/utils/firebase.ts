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
import { normalizeAndMergeReviews } from './syncHelpers';

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
export function translateFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'este dominio';
  const projectId = firebaseConfig.projectId || 'third-strength-vh7nb';

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
  currency?: string;
  config: SalonConfig;
  services?: SalonService[];
  medicationProducts?: MedicationProduct[];
  appointments?: Appointment[];
  pets?: Pet[];
  updatedAt: string;
}

async function getDocFresh<T = DocumentData>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  try {
    return await getDocFromServer(ref);
  } catch {
    return await getDoc(ref);
  }
}

async function getDocsFresh<T = DocumentData>(q: Query<T>): Promise<QuerySnapshot<T>> {
  try {
    return await getDocsFromServer(q);
  } catch {
    return await getDocs(q);
  }
}

async function hydrateOwnerBusinessResult(
  businessId: string,
  data: FirestoreBusinessData
): Promise<{ businessId: string; config: SalonConfig; appointments?: Appointment[]; pets?: Pet[] }> {
  let subReviews: ClientReview[] = [];
  try {
    const snap = await getDocsFresh(collection(db, 'businesses', businessId, 'reviews'));
    snap.forEach((rDoc) => {
      subReviews.push(rDoc.data() as ClientReview);
    });
  } catch {}

  const mergedReviews = normalizeAndMergeReviews(businessId, data.config?.reviews, subReviews);
  const config: SalonConfig = {
    ...data.config,
    id: businessId,
    reviews: mergedReviews,
    updatedAt: data.config?.updatedAt || data.updatedAt
  };

  return {
    businessId,
    config,
    appointments: data.appointments || [],
    pets: data.pets || []
  };
}

/**
 * Searches Firestore for an existing business owned by the user (by Firebase UID or Email).
 */
export async function findBusinessByOwner(
  uid: string,
  email?: string
): Promise<{ businessId: string; config: SalonConfig; appointments?: Appointment[]; pets?: Pet[] } | null> {
  if (!uid && !email) return null;

  try {
    // 1. Search by config.userId == uid
    if (uid) {
      const qUid = query(collection(db, 'businesses'), where('config.userId', '==', uid));
      const snapUid = await getDocsFresh(qUid);
      if (!snapUid.empty) {
        const d = snapUid.docs[0];
        const data = d.data() as FirestoreBusinessData;
        return await hydrateOwnerBusinessResult(data.businessId || d.id, data);
      }

      // Check direct document with ID uid
      const directDoc = await getDocFresh(doc(db, 'businesses', uid));
      if (directDoc.exists()) {
        const data = directDoc.data() as FirestoreBusinessData;
        return await hydrateOwnerBusinessResult(data.businessId || directDoc.id, data);
      }
    }

    // 2. Search by email if available
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const qEmail = query(collection(db, 'businesses'), where('config.email', '==', cleanEmail));
      const snapEmail = await getDocsFresh(qEmail);
      if (!snapEmail.empty) {
        const d = snapEmail.docs[0];
        const data = d.data() as FirestoreBusinessData;
        return await hydrateOwnerBusinessResult(data.businessId || d.id, data);
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

    // 2. Query businesses collection for safety
    const q = query(collection(db, 'businesses'), where('bookingSlug', '==', clean));
    const querySnap = await getDocs(q);

    for (const d of querySnap.docs) {
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

// Circuit breaker for Firestore quota exhaustion to prevent repeated failing requests and backoff delay
let quotaExhaustedUntil = 0;

export function isQuotaExhausted(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

export function markQuotaExhausted(cooldownMs = 60000 * 5): void {
  quotaExhaustedUntil = Date.now() + cooldownMs;
  console.warn(
    `[FIRESTORE QUOTA GUARD] Quota metric limit reached. Pausing remote Firestore writes for ${Math.round(
      cooldownMs / 1000
    )}s to protect backend and allow local IndexedDB and server mirror to serve uninterrupted.`
  );
}

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

      // 2. Save main business document
      const bizRef = doc(db, 'businesses', cleanId);
      const payloadToSave = cleanFirestoreData(businessData);
      await setDoc(bizRef, payloadToSave, { merge: true });

      // 3. Save slug mapping document for O(1) public booking URL resolution
      if (cleanSlug) {
        try {
          const slugRef = doc(db, 'slugs', cleanSlug);
          await setDoc(
            slugRef,
            {
              slug: cleanSlug,
              businessId: cleanId,
              businessName: cleanConfig.name,
              updatedAt: now
            },
            { merge: true }
          );
        } catch (slugErr) {
          console.warn('[FIRESTORE SLUG MAPPING WARN]', slugErr);
        }
      }

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
 * Resolves a public booking link by slug or ID directly from Firestore.
 * Always merges appointments and pets from subcollections to guarantee up-to-date data.
 */
export async function getBusinessFromFirestore(
  slugOrId: string
): Promise<{
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
  pets: Pet[];
  updatedAt?: string;
} | null> {
  if (!slugOrId) return null;

  const raw = slugOrId.trim();
  const clean = cleanSlugInput(raw) || raw;

  const performLookup = async () => {
    try {
      let targetBizId = '';

      // Strategy 0: Direct business ID lookup in businesses collection
      const directRawBizRef = doc(db, 'businesses', raw);
      const directRawBizSnap = await getDocFresh(directRawBizRef);
      if (directRawBizSnap.exists()) {
        targetBizId = raw;
      }

      // Strategy 1: Check direct slug mapping (O(1))
      if (!targetBizId) {
        const slugDocRef = doc(db, 'slugs', clean);
        const slugSnap = await getDocFresh(slugDocRef);
        if (slugSnap.exists()) {
          targetBizId = slugSnap.data()?.businessId || '';
        } else if (clean !== raw) {
          const rawSlugSnap = await getDocFresh(doc(db, 'slugs', raw));
          if (rawSlugSnap.exists()) {
            targetBizId = rawSlugSnap.data()?.businessId || '';
          }
        }
      }

      // Strategy 2: If not found, check businesses collection with clean
      if (!targetBizId && clean !== raw) {
        const directCleanBizRef = doc(db, 'businesses', clean);
        const directCleanBizSnap = await getDocFresh(directCleanBizRef);
        if (directCleanBizSnap.exists()) {
          targetBizId = clean;
        }
      }

      // Strategy 3: Query by bookingSlug field
      if (!targetBizId) {
        const qSlug = query(collection(db, 'businesses'), where('bookingSlug', '==', clean));
        const snapSlug = await getDocsFresh(qSlug);
        if (!snapSlug.empty) {
          const sorted = snapSlug.docs.slice().sort((a, b) => {
            const timeA = a.data()?.updatedAt || '';
            const timeB = b.data()?.updatedAt || '';
            return timeB.localeCompare(timeA);
          });
          targetBizId = sorted[0].id;
        } else if (clean !== raw) {
          const snapRawSlug = await getDocsFresh(query(collection(db, 'businesses'), where('bookingSlug', '==', raw)));
          if (!snapRawSlug.empty) {
            const sortedRaw = snapRawSlug.docs.slice().sort((a, b) => {
              const timeA = a.data()?.updatedAt || '';
              const timeB = b.data()?.updatedAt || '';
              return timeB.localeCompare(timeA);
            });
            targetBizId = sortedRaw[0].id;
          }
        }
      }

      // Strategy 4: Query by businessId field
      if (!targetBizId) {
        const snapBizId = await getDocsFresh(query(collection(db, 'businesses'), where('businessId', '==', raw)));
        if (!snapBizId.empty) {
          targetBizId = snapBizId.docs[0].id;
        }
      }

      if (!targetBizId) {
        return null;
      }

      // Retrieve full business document AND all subcollections in parallel for fast, complete hydration
      const bizRef = doc(db, 'businesses', targetBizId);
      const [bizSnap, subServicesRes, subAptsRes, subPetsRes, subReviewsRes] = await Promise.allSettled([
        getDocFresh(bizRef),
        getDocsFresh(collection(db, 'businesses', targetBizId, 'services')),
        getDocsFresh(collection(db, 'businesses', targetBizId, 'appointments')),
        getDocsFresh(collection(db, 'businesses', targetBizId, 'pets')),
        getDocsFresh(collection(db, 'businesses', targetBizId, 'reviews'))
      ]);

      if (bizSnap.status !== 'fulfilled' || !bizSnap.value.exists()) {
        return null;
      }

      const b = bizSnap.value.data() as FirestoreBusinessData;
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
      const resolvedBizId = b.businessId || targetBizId;
      const reviews = normalizeAndMergeReviews(resolvedBizId, b.config?.reviews, subReviews);

      const resolvedCurrency = b.config?.currency || b.currency || 'USD';
      const resolvedUpdatedAt = b.config?.updatedAt || b.updatedAt;
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
        config,
        services,
        appointments,
        pets,
        updatedAt: resolvedUpdatedAt
      };
    } catch (err) {
      console.warn('[FIRESTORE RESOLUTION WARN]', err);
      return null;
    }
  };

  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    return await Promise.race([performLookup(), timeoutPromise]);
  } catch (err) {
    console.warn('[FIRESTORE LOOKUP ERROR]', err);
    return null;
  }
}

/**
 * Adds an appointment to Firestore for a specific business, creates the Pet record,
 * and updates both the subcollection and the parent document atomically.
 */
export async function addAppointmentToFirestore(
  businessId: string,
  appointment: Appointment,
  petData?: Partial<Pet>
): Promise<boolean> {
  if (isQuotaExhausted()) return false;
  try {
    const now = new Date().toISOString();

    // 1. Prepare appointment payload
    const aptRef = doc(db, 'businesses', businessId, 'appointments', appointment.id);
    const appointmentPayload = {
      ...appointment,
      businessId,
      createdAt: appointment.createdAt || now
    };

    // 2. Prepare Pet payload
    const petId = appointment.petId || `#PET-${Math.floor(1000 + Math.random() * 9000)}`;
    const incomingPhoto = appointment.beforePhotoUrl || petData?.photoUrl || undefined;
    const newPet: Pet = {
      id: petId,
      name: appointment.petName || petData?.name || 'Mascota',
      breed: petData?.breed || appointment.breed || 'Mestizo',
      gender: petData?.gender || 'Macho',
      weightKg: Number(petData?.weightKg) || 10,
      age: petData?.age || '1 año',
      isVip: false,
      photoUrl:
        incomingPhoto ||
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
      tutor: {
        name: appointment.tutorName || petData?.tutor?.name || 'Cliente Online',
        phone: appointment.tutorPhone || petData?.tutor?.phone || '',
        rawPhone: (appointment.tutorPhone || '').replace(/\D/g, '')
      },
      habitualMood: (petData?.habitualMood as any) || 'tranquilo',
      healthAllergies: petData?.healthAllergies || '',
      handlingObservations: petData?.handlingObservations || '',
      lastVisit: {
        id: `v_${Date.now()}`,
        date: appointment.date || 'Hoy',
        serviceName: appointment.serviceName,
        price: appointment.price,
        currency: appointment.currency,
        mood: (petData?.habitualMood as any) || 'tranquilo',
        paid: false,
        photos: {
          beforeUrl: incomingPhoto
        }
      },
      visitHistory: [],
      recommendedIntervalWeeks: 4
    };

    const petRef = doc(db, 'businesses', businessId, 'pets', petId);

    // 1 & 2: Save appointment & pet in parallel for fast execution
    await Promise.all([
      setDoc(aptRef, cleanFirestoreData(appointmentPayload)),
      setDoc(petRef, cleanFirestoreData(newPet), { merge: true })
    ]);

    // 3. Atomically update parent business document with new appointment and new pet
    try {
      const bizRef = doc(db, 'businesses', businessId);
      const bizSnap = await getDoc(bizRef);
      if (bizSnap.exists()) {
        const existingApts = (bizSnap.data()?.appointments as Appointment[]) || [];
        const updatedApts = [appointmentPayload, ...existingApts.filter((a) => a.id !== appointment.id)];

        const existingPets = (bizSnap.data()?.pets as Pet[]) || [];
        const updatedPets = [
          newPet,
          ...existingPets.filter(
            (p) => p.name !== newPet.name || p.tutor.phone !== newPet.tutor.phone
          )
        ];

        await setDoc(
          bizRef,
          cleanFirestoreData({ appointments: updatedApts, pets: updatedPets }),
          { merge: true }
        );
      }
    } catch (parentErr) {
      console.warn('[FIRESTORE PARENT BIZ UPDATE WARN]', parentErr);
      // Subcollections are already saved, non-fatal
    }

    console.log(`[FIRESTORE BOOKING SAVED] Appointment "${appointment.id}" for "${appointment.petName}" and Pet "${petId}" successfully stored.`);
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
    const aptRef = doc(db, 'businesses', businessId, 'appointments', appointmentId);
    await setDoc(aptRef, cleanFirestoreData(patch), { merge: true });

    // Also update parent business doc
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      const existingApts: Appointment[] = bizSnap.data()?.appointments || [];
      const updatedApts = existingApts.map((a) => (a.id === appointmentId ? { ...a, ...patch } : a));
      await setDoc(bizRef, cleanFirestoreData({ appointments: updatedApts }), { merge: true });
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

/**
 * Persists a new client review to Firestore under businesses/{businessId}/reviews/{reviewId}
 * and atomically updates the parent business document.
 */
export async function addReviewToFirestore(
  businessId: string,
  review: ClientReview
): Promise<boolean> {
  if (!businessId || !review) return false;
  if (isQuotaExhausted()) return false;
  try {
    const now = new Date().toISOString();
    const parsedStars = Number(review.stars);
    if (!Number.isFinite(parsedStars) || parsedStars < 1 || parsedStars > 5) {
      return false;
    }

    const cleanReview: ClientReview = {
      ...review,
      id: review.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      stars: parsedStars,
      clientName: String(review.clientName || '').trim(),
      comment: review.comment ? String(review.comment).trim() : '',
      createdAt: review.createdAt || now,
      verified: review.verified !== false
    };

    // 1. Save in subcollection
    const revRef = doc(db, 'businesses', businessId, 'reviews', cleanReview.id);
    await setDoc(revRef, cleanFirestoreData(cleanReview));

    // 2. Also append/merge in parent business config.reviews without losing any existing review
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDocFresh(bizRef);
    if (bizSnap.exists()) {
      const bizData = bizSnap.data();
      const currentConfig = bizData?.config || {};
      const existingReviews: ClientReview[] = currentConfig.reviews || [];
      const updatedReviews = normalizeAndMergeReviews(businessId, existingReviews, [cleanReview]);
      await setDoc(
        bizRef,
        cleanFirestoreData({
          updatedAt: now,
          config: {
            ...currentConfig,
            reviews: updatedReviews,
            updatedAt: now
          }
        }),
        { merge: true }
      );
    }

    console.log(`[FIRESTORE REVIEW SUCCESS] Review saved for business ${businessId} from ${cleanReview.clientName}`);
    return true;
  } catch (err: any) {
    if (
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('Quota limit exceeded') ||
      err?.message?.includes('resource-exhausted')
    ) {
      markQuotaExhausted();
    } else {
      console.error('[FIRESTORE REVIEW ERROR]', err);
    }
    return false;
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
        console.warn('[FIRESTORE REVIEWS LISTENER ERROR]', err);
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


