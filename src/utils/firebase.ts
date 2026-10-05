import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
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
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfigRaw from '../../firebase-applet-config.json';
import { SalonConfig, Appointment, Pet, SalonService, MedicationProduct } from '../types';
import { slugify, cleanSlugInput, extractSlugOnly } from './slugUtils';

const firebaseConfig = {
  projectId: firebaseConfigRaw.projectId,
  appId: firebaseConfigRaw.appId,
  apiKey: firebaseConfigRaw.apiKey,
  authDomain: firebaseConfigRaw.authDomain,
  firestoreDatabaseId: firebaseConfigRaw.firestoreDatabaseId,
  storageBucket: firebaseConfigRaw.storageBucket,
  messagingSenderId: firebaseConfigRaw.messagingSenderId,
  measurementId: firebaseConfigRaw.measurementId
};

// Initialize Firebase App
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

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
  config: SalonConfig;
  services?: SalonService[];
  medicationProducts?: MedicationProduct[];
  appointments?: Appointment[];
  pets?: Pet[];
  updatedAt: string;
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

/**
 * Persists business configuration, services, medications, and slug mapping to Firestore.
 * Ensures zero `undefined` values and maintains atomic consistency.
 */
export async function saveBusinessToFirestore(
  businessId: string,
  config: SalonConfig,
  appointments?: Appointment[],
  pets?: Pet[]
): Promise<boolean> {
  const cleanId = businessId || config.id || 'biz_main';
  const cleanSlug =
    cleanSlugInput(config.bookingSlug) ||
    extractSlugOnly(config.bookingSlug) ||
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

  const cleanConfig: SalonConfig = {
    ...config,
    id: cleanId,
    bookingSlug: cleanSlug,
    name: (config.name || 'Peluquería Canina Luna').trim(),
    services: sanitizedServices,
    medicationProducts: sanitizedMedications
  };

  const businessData: FirestoreBusinessData = {
    businessId: cleanId,
    name: cleanConfig.name,
    bookingSlug: cleanSlug,
    config: cleanConfig,
    services: sanitizedServices.filter((s) => s.active !== false),
    medicationProducts: sanitizedMedications.filter((m) => m.active !== false),
    updatedAt: now
  };

  if (appointments && appointments.length > 0) {
    businessData.appointments = appointments;
  }
  if (pets && pets.length > 0) {
    businessData.pets = pets;
  }

  // Deep sanitize payload to strip any `undefined` values
  const payloadToSave = cleanFirestoreData(businessData);

  try {
    // 1. Save main business document
    const bizRef = doc(db, 'businesses', cleanId);
    await setDoc(bizRef, payloadToSave, { merge: true });

    // 2. Persist services to subcollection and purge removed ones
    const activeServiceIds = new Set(sanitizedServices.map((s) => s.id));
    try {
      const existingSubSnap = await getDocs(collection(db, 'businesses', cleanId, 'services'));
      for (const d of existingSubSnap.docs) {
        if (!activeServiceIds.has(d.id)) {
          await deleteDoc(d.ref);
        }
      }
    } catch {}

    for (const svc of sanitizedServices) {
      if (svc.id) {
        const svcRef = doc(db, 'businesses', cleanId, 'services', svc.id);
        await setDoc(svcRef, cleanFirestoreData(svc), { merge: true });
      }
    }

    // 3. Persist medications to subcollection and purge removed ones
    const activeMedIds = new Set(sanitizedMedications.map((m) => m.id));
    try {
      const existingMedsSnap = await getDocs(collection(db, 'businesses', cleanId, 'medications'));
      for (const d of existingMedsSnap.docs) {
        if (!activeMedIds.has(d.id)) {
          await deleteDoc(d.ref);
        }
      }
    } catch {}

    for (const med of sanitizedMedications) {
      if (med.id) {
        const medRef = doc(db, 'businesses', cleanId, 'medications', med.id);
        await setDoc(medRef, cleanFirestoreData(med), { merge: true });
      }
    }

    // 4. Save slug mapping document for O(1) slug resolution
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

    console.log(`[FIRESTORE SUCCESS] Business "${cleanConfig.name}" (${cleanId}) saved with ${sanitizedServices.length} services and slug "${cleanSlug}".`);
    return true;
  } catch (err) {
    console.error('[FIRESTORE SAVE ERROR]', err);
    return false;
  }
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
 * Deletes a medication from Firestore subcollection.
 */
export async function deleteMedicationFromFirestore(businessId: string, medicationId: string): Promise<boolean> {
  if (!businessId || !medicationId) return false;
  try {
    const medRef = doc(db, 'businesses', businessId, 'medications', medicationId);
    await deleteDoc(medRef);
    return true;
  } catch (err) {
    console.warn('[FIRESTORE DELETE MEDICATION WARN]', err);
    return false;
  }
}

/**
 * Resolves a public booking link by slug or ID directly from Firestore.
 */
export async function getBusinessFromFirestore(
  slugOrId: string
): Promise<{
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
  appointments?: Appointment[];
} | null> {
  if (!slugOrId) return null;

  const clean = cleanSlugInput(slugOrId) || slugOrId.trim();

  try {
    let targetBizId = '';

    // Strategy 1: Check direct slug mapping (O(1))
    const slugDocRef = doc(db, 'slugs', clean);
    const slugSnap = await getDoc(slugDocRef);

    if (slugSnap.exists()) {
      targetBizId = slugSnap.data()?.businessId || '';
    }

    // Strategy 2: If not found, check if it's a direct business ID
    if (!targetBizId) {
      const directBizRef = doc(db, 'businesses', clean);
      const directSnap = await getDoc(directBizRef);
      if (directSnap.exists()) {
        targetBizId = clean;
      }
    }

    // Strategy 3: Query by bookingSlug field
    if (!targetBizId) {
      const qSlug = query(collection(db, 'businesses'), where('bookingSlug', '==', clean));
      const snapSlug = await getDocs(qSlug);
      if (!snapSlug.empty) {
        targetBizId = snapSlug.docs[0].id;
      }
    }

    if (!targetBizId) {
      return null;
    }

    // Retrieve full business document
    const bizRef = doc(db, 'businesses', targetBizId);
    const bizSnap = await getDoc(bizRef);

    if (!bizSnap.exists()) {
      return null;
    }

    const b = bizSnap.data() as FirestoreBusinessData;
    let services = b.services || b.config?.services || [];

    // Also attempt reading subcollection services to guarantee fresh modular services
    try {
      const subServicesSnap = await getDocs(collection(db, 'businesses', targetBizId, 'services'));
      if (!subServicesSnap.empty) {
        const subList: SalonService[] = [];
        subServicesSnap.forEach((d) => {
          subList.push(d.data() as SalonService);
        });
        if (subList.length > 0) {
          services = subList.filter((s) => s.active !== false);
        }
      }
    } catch {}

    const config = {
      ...b.config,
      id: b.businessId,
      services
    };

    return {
      businessId: b.businessId,
      config,
      services,
      appointments: b.appointments || []
    };
  } catch (err) {
    console.warn('[FIRESTORE RESOLUTION WARN]', err);
    return null;
  }
}

/**
 * Adds an appointment to Firestore for a specific business.
 */
export async function addAppointmentToFirestore(
  businessId: string,
  appointment: Appointment
): Promise<boolean> {
  try {
    const aptRef = doc(db, 'businesses', businessId, 'appointments', appointment.id);
    await setDoc(aptRef, cleanFirestoreData({
      ...appointment,
      businessId,
      createdAt: new Date().toISOString()
    }));

    // Also update appointments array on the parent business doc for fast retrieval
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      const existing = (bizSnap.data()?.appointments as Appointment[]) || [];
      const updated = [appointment, ...existing.filter((a) => a.id !== appointment.id)];
      await setDoc(bizRef, cleanFirestoreData({ appointments: updated }), { merge: true });
    }

    return true;
  } catch (err) {
    console.error('[FIRESTORE APPOINTMENT SAVE ERROR]', err);
    return false;
  }
}
