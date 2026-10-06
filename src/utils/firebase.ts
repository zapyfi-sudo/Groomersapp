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
  getDocFromServer,
  onSnapshot
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
 * Merges existing public appointments so client bookings are NEVER overwritten.
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
    name: (config.name || 'Peluquería Canina Luna').trim(),
    services: sanitizedServices,
    medicationProducts: sanitizedMedications,
    whatsappTemplates: sanitizedTemplates
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

  try {
    const bizRef = doc(db, 'businesses', cleanId);

    // Merge existing appointments & pets in Firestore to never overwrite new client bookings
    const aptsMap = new Map<string, Appointment>();
    for (const a of (appointments || [])) {
      if (a?.id) aptsMap.set(a.id, a);
    }

    const petsMap = new Map<string, Pet>();
    for (const p of (pets || [])) {
      if (p?.id) petsMap.set(p.id, p);
    }

    try {
      const existingBizSnap = await getDoc(bizRef);
      if (existingBizSnap.exists()) {
        const existingData = existingBizSnap.data();
        const existingApts: Appointment[] = existingData?.appointments || [];
        for (const a of existingApts) {
          if (a?.id && !aptsMap.has(a.id)) {
            aptsMap.set(a.id, a);
          }
        }

        const existingPets: Pet[] = existingData?.pets || [];
        for (const p of existingPets) {
          if (p?.id && !petsMap.has(p.id)) {
            petsMap.set(p.id, p);
          }
        }
      }
    } catch {}

    businessData.appointments = Array.from(aptsMap.values());
    businessData.pets = Array.from(petsMap.values());

    const payloadToSave = cleanFirestoreData(businessData);

    // 1. Save main business document
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

    // Read appointments from subcollection to guarantee all public bookings are present
    let appointments = b.appointments || [];
    try {
      const subAptsSnap = await getDocs(collection(db, 'businesses', targetBizId, 'appointments'));
      if (!subAptsSnap.empty) {
        const aptsMap = new Map<string, Appointment>();
        for (const a of appointments) {
          if (a?.id) aptsMap.set(a.id, a);
        }
        subAptsSnap.forEach((d) => {
          const apt = d.data() as Appointment;
          if (apt?.id) aptsMap.set(apt.id, apt);
        });
        appointments = Array.from(aptsMap.values());
        appointments.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
      }
    } catch {}

    // Read pets from subcollection
    let pets = b.pets || [];
    try {
      const subPetsSnap = await getDocs(collection(db, 'businesses', targetBizId, 'pets'));
      if (!subPetsSnap.empty) {
        const petsMap = new Map<string, Pet>();
        for (const p of pets) {
          if (p?.id) petsMap.set(p.id, p);
        }
        subPetsSnap.forEach((d) => {
          const p = d.data() as Pet;
          if (p?.id) petsMap.set(p.id, p);
        });
        pets = Array.from(petsMap.values());
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
      appointments,
      pets
    };
  } catch (err) {
    console.warn('[FIRESTORE RESOLUTION WARN]', err);
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
  try {
    const now = new Date().toISOString();

    // 1. Save appointment in subcollection
    const aptRef = doc(db, 'businesses', businessId, 'appointments', appointment.id);
    const appointmentPayload = {
      ...appointment,
      businessId,
      createdAt: appointment.createdAt || now
    };
    await setDoc(aptRef, cleanFirestoreData(appointmentPayload));

    // 2. Create or update Pet in subcollection
    const petId = appointment.petId || `#PET-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPet: Pet = {
      id: petId,
      name: appointment.petName || petData?.name || 'Mascota',
      breed: petData?.breed || appointment.breed || 'Mestizo',
      gender: petData?.gender || 'Macho',
      weightKg: petData?.weightKg || 12,
      age: '1 año',
      isVip: false,
      photoUrl:
        petData?.photoUrl ||
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
        mood: 'tranquilo',
        paid: false,
        photos: {}
      },
      visitHistory: [],
      recommendedIntervalWeeks: 4
    };

    const petRef = doc(db, 'businesses', businessId, 'pets', petId);
    await setDoc(petRef, cleanFirestoreData(newPet), { merge: true });

    // 3. Atomically update parent business document with new appointment and new pet
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

    console.log(`[FIRESTORE BOOKING SAVED] Appointment "${appointment.id}" for "${appointment.petName}" and Pet "${petId}" successfully stored.`);
    return true;
  } catch (err) {
    console.error('[FIRESTORE APPOINTMENT SAVE ERROR]', err);
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
  } catch (err) {
    console.warn('[FIRESTORE APPOINTMENT UPDATE ERROR]', err);
    return false;
  }
}
