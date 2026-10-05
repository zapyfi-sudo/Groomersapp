import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfigRaw from '../../firebase-applet-config.json';
import { SalonConfig, Appointment, Pet, SalonService } from '../types';
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

export interface FirestoreBusinessData {
  businessId: string;
  name: string;
  bookingSlug: string;
  config: SalonConfig;
  services?: SalonService[];
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
    // On read error, allow save to attempt
    return { available: true };
  }
}

/**
 * Persists business configuration and slug mapping to Firestore.
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

  const businessData: FirestoreBusinessData = {
    businessId: cleanId,
    name: config.name || 'Peluquería Canina',
    bookingSlug: cleanSlug,
    config: {
      ...config,
      id: cleanId,
      bookingSlug: cleanSlug
    },
    services: (config.services || []).filter((s) => s.active !== false),
    updatedAt: now
  };

  if (appointments && appointments.length > 0) {
    businessData.appointments = appointments;
  }
  if (pets && pets.length > 0) {
    businessData.pets = pets;
  }

  try {
    // 1. Save business document
    const bizRef = doc(db, 'businesses', cleanId);
    await setDoc(bizRef, businessData, { merge: true });

    // 2. Save slug mapping document for O(1) slug resolution
    const slugRef = doc(db, 'slugs', cleanSlug);
    await setDoc(
      slugRef,
      {
        slug: cleanSlug,
        businessId: cleanId,
        businessName: config.name,
        updatedAt: now
      },
      { merge: true }
    );

    console.log(`[FIRESTORE SUCCESS] Business "${config.name}" (${cleanId}) saved with slug "${cleanSlug}".`);
    return true;
  } catch (err) {
    console.error('[FIRESTORE SAVE ERROR]', err);
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
    // Strategy 1: Check direct slug mapping (O(1))
    const slugDocRef = doc(db, 'slugs', clean);
    const slugSnap = await getDoc(slugDocRef);

    if (slugSnap.exists()) {
      const slugData = slugSnap.data();
      const targetBizId = slugData?.businessId;
      if (targetBizId) {
        const bizRef = doc(db, 'businesses', targetBizId);
        const bizSnap = await getDoc(bizRef);
        if (bizSnap.exists()) {
          const b = bizSnap.data() as FirestoreBusinessData;
          return {
            businessId: b.businessId,
            config: b.config,
            services: b.services || b.config?.services || [],
            appointments: b.appointments || []
          };
        }
      }
    }

    // Strategy 2: Direct businessId lookup
    const directBizRef = doc(db, 'businesses', clean);
    const directSnap = await getDoc(directBizRef);
    if (directSnap.exists()) {
      const b = directSnap.data() as FirestoreBusinessData;
      return {
        businessId: b.businessId,
        config: b.config,
        services: b.services || b.config?.services || [],
        appointments: b.appointments || []
      };
    }

    // Strategy 3: Query by bookingSlug field
    const qSlug = query(collection(db, 'businesses'), where('bookingSlug', '==', clean));
    const snapSlug = await getDocs(qSlug);
    if (!snapSlug.empty) {
      const b = snapSlug.docs[0].data() as FirestoreBusinessData;
      return {
        businessId: b.businessId,
        config: b.config,
        services: b.services || b.config?.services || [],
        appointments: b.appointments || []
      };
    }

    return null;
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
    await setDoc(aptRef, {
      ...appointment,
      businessId,
      createdAt: new Date().toISOString()
    });

    // Also update appointments array on the parent business doc for fast retrieval
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      const existing = (bizSnap.data()?.appointments as Appointment[]) || [];
      const updated = [appointment, ...existing.filter((a) => a.id !== appointment.id)];
      await setDoc(bizRef, { appointments: updated }, { merge: true });
    }

    return true;
  } catch (err) {
    console.error('[FIRESTORE APPOINTMENT SAVE ERROR]', err);
    return false;
  }
}
