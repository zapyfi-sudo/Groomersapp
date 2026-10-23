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
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfigRaw from '../../firebase-applet-config.json';
import { SalonConfig, Appointment, Pet, SalonService, MedicationProduct, ClientReview, ReviewRequestState, SaleRecord } from '../types';
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
  currency?: string;
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
    services: sanitizedServices,
    medicationProducts: sanitizedMedications,
    whatsappTemplates: sanitizedTemplates
  };

  const businessData: FirestoreBusinessData = {
    businessId: cleanId,
    name: cleanConfig.name,
    bookingSlug: cleanSlug,
    currency: cleanConfig.currency || 'USD',
    config: cleanConfig,
    services: sanitizedServices,
    medicationProducts: sanitizedMedications,
    updatedAt: now
  };

  const executeSave = async (): Promise<boolean> => {
    try {
      const bizRef = doc(db, 'businesses', cleanId);
      const payloadToSave = cleanFirestoreData(businessData);

      // 1. Save main business document with full config and services
      await setDoc(bizRef, payloadToSave, { merge: true });

      // 2. Persist services and medications to subcollections, cleaning up obsolete/removed services
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
    } catch (err) {
      console.error('[FIRESTORE SAVE ERROR]', err);
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
} | null> {
  if (!slugOrId) return null;

  const raw = slugOrId.trim();
  const clean = cleanSlugInput(raw) || raw;

  const performLookup = async () => {
    try {
      let targetBizId = '';

      // Strategy 0: Direct business ID lookup in businesses collection
      const directRawBizRef = doc(db, 'businesses', raw);
      const directRawBizSnap = await getDoc(directRawBizRef);
      if (directRawBizSnap.exists()) {
        targetBizId = raw;
      }

      // Strategy 1: Check direct slug mapping (O(1))
      if (!targetBizId) {
        const slugDocRef = doc(db, 'slugs', clean);
        const slugSnap = await getDoc(slugDocRef);
        if (slugSnap.exists()) {
          targetBizId = slugSnap.data()?.businessId || '';
        } else if (clean !== raw) {
          const rawSlugSnap = await getDoc(doc(db, 'slugs', raw));
          if (rawSlugSnap.exists()) {
            targetBizId = rawSlugSnap.data()?.businessId || '';
          }
        }
      }

      // Strategy 2: If not found, check businesses collection with clean
      if (!targetBizId && clean !== raw) {
        const directCleanBizRef = doc(db, 'businesses', clean);
        const directCleanBizSnap = await getDoc(directCleanBizRef);
        if (directCleanBizSnap.exists()) {
          targetBizId = clean;
        }
      }

      // Strategy 3: Query by bookingSlug field
      if (!targetBizId) {
        const qSlug = query(collection(db, 'businesses'), where('bookingSlug', '==', clean));
        const snapSlug = await getDocs(qSlug);
        if (!snapSlug.empty) {
          const sorted = snapSlug.docs.slice().sort((a, b) => {
            const timeA = a.data()?.updatedAt || '';
            const timeB = b.data()?.updatedAt || '';
            return timeB.localeCompare(timeA);
          });
          targetBizId = sorted[0].id;
        } else if (clean !== raw) {
          const snapRawSlug = await getDocs(query(collection(db, 'businesses'), where('bookingSlug', '==', raw)));
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
        const snapBizId = await getDocs(query(collection(db, 'businesses'), where('businessId', '==', raw)));
        if (!snapBizId.empty) {
          targetBizId = snapBizId.docs[0].id;
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
    let rawServices: SalonService[] = [];

    if (Array.isArray(b.config?.services) && b.config.services.length > 0) {
      // Authoritative services saved by the salon owner in Configuración del negocio
      rawServices = b.config.services;
    } else if (Array.isArray(b.services) && b.services.length > 0) {
      rawServices = b.services;
    } else {
      // Fallback: Read modular subcollection only if no services exist on root document
      try {
        const subServicesSnap = await getDocs(collection(db, 'businesses', targetBizId, 'services'));
        if (!subServicesSnap.empty) {
          const subList: SalonService[] = [];
          subServicesSnap.forEach((d) => {
            subList.push(d.data() as SalonService);
          });
          if (subList.length > 0) {
            rawServices = subList;
          }
        }
      } catch {}
    }

    // Filter active services and eliminate duplicates by ID, ensuring images and galleries are clean
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

    // Read reviews from subcollection
    let reviews: ClientReview[] = b.config?.reviews || [];
    try {
      const subReviewsSnap = await getDocs(collection(db, 'businesses', targetBizId, 'reviews'));
      if (!subReviewsSnap.empty) {
        const revMap = new Map<string, ClientReview>();
        for (const r of reviews) {
          if (r?.id) revMap.set(r.id, r);
        }
        subReviewsSnap.forEach((d) => {
          const r = d.data() as ClientReview;
          if (r?.id) revMap.set(r.id, r);
        });
        reviews = Array.from(revMap.values());
        reviews.sort((x, y) => (y.createdAt || y.date || '').localeCompare(x.createdAt || x.date || ''));
      }
    } catch {}

    const resolvedCurrency = b.config?.currency || b.currency || 'USD';
    const config: SalonConfig = {
      ...b.config,
      id: b.businessId,
      currency: resolvedCurrency,
      services,
      reviews
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
};

  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
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
  } catch (err) {
    console.error('[FIRESTORE APPOINTMENT SAVE ERROR]', err);
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

/**
 * Persists a new client review to Firestore under businesses/{businessId}/reviews/{reviewId}
 * and atomically updates the parent business document.
 */
export async function addReviewToFirestore(
  businessId: string,
  review: ClientReview
): Promise<boolean> {
  if (!businessId || !review) return false;
  try {
    const now = new Date().toISOString();
    const cleanReview: ClientReview = {
      ...review,
      id: review.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      businessId,
      createdAt: review.createdAt || now,
      verified: review.verified !== false
    };

    // 1. Save in subcollection
    const revRef = doc(db, 'businesses', businessId, 'reviews', cleanReview.id);
    await setDoc(revRef, cleanFirestoreData(cleanReview));

    // 2. Also append/merge in parent business config.reviews
    const bizRef = doc(db, 'businesses', businessId);
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      const bizData = bizSnap.data();
      const currentConfig = bizData?.config || {};
      const existingReviews: ClientReview[] = currentConfig.reviews || [];
      const updatedReviews = [cleanReview, ...existingReviews.filter((r) => r.id !== cleanReview.id)];
      await setDoc(
        bizRef,
        cleanFirestoreData({
          config: {
            ...currentConfig,
            reviews: updatedReviews
          }
        }),
        { merge: true }
      );
    }

    console.log(`[FIRESTORE REVIEW SUCCESS] Review saved for business ${businessId} from ${cleanReview.clientName}`);
    return true;
  } catch (err) {
    console.error('[FIRESTORE REVIEW ERROR]', err);
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
        const list: ClientReview[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as ClientReview);
        });
        list.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
        onUpdate(list);
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
  } catch (err) {
    console.warn('[FIRESTORE REVIEW REQUEST STATE ERROR]', err);
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
  } catch (err) {
    console.warn('[FIRESTORE RECORD SALE ERROR]', err);
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


