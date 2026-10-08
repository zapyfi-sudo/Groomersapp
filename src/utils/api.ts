import { SalonConfig, SalonService, Appointment, Pet, ClientReview, ReviewRequestState } from '../types';
import { decodePublicProfileToken, extractSlugOnly } from './slugUtils';
import {
  getBusinessFromFirestore,
  saveBusinessToFirestore,
  addAppointmentToFirestore,
  updateAppointmentInFirestore,
  subscribeToBusinessAppointments,
  subscribeToBusinessPets,
  addReviewToFirestore,
  subscribeToBusinessReviews,
  updateReviewRequestStateInFirestore
} from './firebase';

export {
  subscribeToBusinessAppointments,
  subscribeToBusinessPets,
  subscribeToBusinessReviews,
  updateReviewRequestStateInFirestore
};

export interface PublicBusinessResult {
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
  pets?: Pet[];
}

/**
 * Universal resolution of a business profile for public booking:
 * 1. Query Cloud Firestore (shared cloud database across all devices, Vercel, browsers)
 * 2. Query Server API (/api/businesses/:cleanSlugOrId)
 * 3. Backward-compat: decode legacy URL token (&p=...) if present
 * 4. NEVER falls back to demo data or fake business!
 */
export async function fetchBusinessProfile(idOrSlug: string): Promise<PublicBusinessResult | null> {
  if (!idOrSlug) return null;
  const cleanTarget = extractSlugOnly(idOrSlug) || idOrSlug.trim();

  // 1. Primary: Query Cloud Firestore
  try {
    const firestoreResult = await getBusinessFromFirestore(cleanTarget);
    if (firestoreResult && firestoreResult.businessId && firestoreResult.config) {
      const result: PublicBusinessResult = {
        businessId: firestoreResult.businessId,
        config: firestoreResult.config,
        services: firestoreResult.services || firestoreResult.config.services || [],
        appointments: firestoreResult.appointments || [],
        pets: firestoreResult.pets || []
      };

      // Cache locally for fast offline revisit
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`agendacan_public_biz_${result.businessId}`, JSON.stringify(result));
          if (result.config.bookingSlug) {
            localStorage.setItem(
              `agendacan_public_biz_${extractSlugOnly(result.config.bookingSlug)}`,
              JSON.stringify(result)
            );
          }
        } catch {}
      }

      return result;
    }
  } catch (err) {
    console.warn('[FIRESTORE PROFILE FETCH ERROR]', err);
  }

  // 2. Secondary: Query Server API (/api/businesses/:idOrSlug)
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(cleanTarget)}`);
    const contentType = res.headers.get('content-type') || '';

    // Ensure the response is valid JSON and not an HTML fallback page from static routing
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.businessId && data.config) {
        const result: PublicBusinessResult = {
          businessId: data.businessId,
          config: data.config,
          services: data.services || data.config.services || [],
          appointments: data.appointments || [],
          pets: data.pets || []
        };

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`agendacan_public_biz_${data.businessId}`, JSON.stringify(result));
            if (data.config.bookingSlug) {
              localStorage.setItem(
                `agendacan_public_biz_${extractSlugOnly(data.config.bookingSlug)}`,
                JSON.stringify(result)
              );
            }
          } catch {}
        }

        return result;
      }
    }
  } catch (err) {
    console.warn('Network error fetching business from server API:', err);
  }

  // 3. Query params check ?businessId= or ?bid=
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const queryBizId = searchParams.get('businessId') || searchParams.get('bid');
      if (queryBizId && queryBizId !== cleanTarget) {
        // Try Firestore with queryBizId
        const fbResult = await getBusinessFromFirestore(queryBizId);
        if (fbResult && fbResult.config) {
          return {
            businessId: fbResult.businessId,
            config: fbResult.config,
            services: fbResult.services || fbResult.config.services || [],
            appointments: fbResult.appointments || []
          };
        }

        // Try API with queryBizId
        const resQuery = await fetch(`/api/businesses/${encodeURIComponent(queryBizId)}`);
        const qContentType = resQuery.headers.get('content-type') || '';
        if (resQuery.ok && qContentType.includes('application/json')) {
          const data = await resQuery.json();
          if (data && data.businessId && data.config) {
            return {
              businessId: data.businessId,
              config: data.config,
              services: data.services || data.config.services || [],
              appointments: data.appointments || []
            };
          }
        }
      }
    } catch {}
  }

  // 4. Backward-compatibility: Check for legacy URL token (&p=...)
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('p') || searchParams.get('token');
      if (token) {
        const decoded = decodePublicProfileToken(token);
        if (decoded && decoded.config) {
          return {
            businessId: decoded.businessId,
            config: decoded.config,
            services: decoded.services || decoded.config.services || [],
            appointments: []
          };
        }
      }
    } catch (err) {
      console.warn('Error reading URL token:', err);
    }
  }

  // 5. Zero demo fallback: If not found, return null so the proper Spanish error is displayed
  return null;
}

/**
 * Persists the business configuration to Cloud Firestore (primary) and Server API (mirror).
 */
export async function syncBusinessToServer(
  businessId: string,
  config: SalonConfig,
  pets?: Pet[],
  appointments?: Appointment[],
  bookedRetentions?: string[]
): Promise<boolean> {
  let firestoreSuccess = false;
  let serverSuccess = false;

  // 1. Primary: Save to Cloud Firestore (guarantees cross-device / Vercel persistence)
  try {
    firestoreSuccess = await saveBusinessToFirestore(businessId, config, appointments, pets);
  } catch (fbErr) {
    console.warn('[FIRESTORE SYNC ERROR]', fbErr);
  }

  // 2. Secondary: Mirror to Server API if available
  try {
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        config,
        pets,
        appointments,
        bookedRetentions
      })
    });
    serverSuccess = res.ok;
  } catch (err) {
    console.warn('Server API sync not reachable (standard on static CDNs/Vercel):', err);
  }

  // Operation succeeds if either the cloud database or the server accepted it
  return firestoreSuccess || serverSuccess;
}

/**
 * Submits a new public appointment directly to Firestore and the server API.
 */
export async function createPublicAppointment(
  businessIdOrSlug: string,
  appointment: Appointment,
  petData?: Partial<Pet>
): Promise<boolean> {
  const appointmentToSave: Appointment = {
    ...appointment,
    status: 'pendiente',
    statusLabel: 'POR CONFIRMAR'
  };

  // 1. Resolve business ID
  let targetBizId = businessIdOrSlug;
  try {
    const biz = await getBusinessFromFirestore(businessIdOrSlug);
    if (biz && biz.businessId) {
      targetBizId = biz.businessId;
    }
  } catch {}

  let firestoreSuccess = false;
  let serverSuccess = false;

  // 2. Primary: Save to Cloud Firestore
  try {
    firestoreSuccess = await addAppointmentToFirestore(targetBizId, appointmentToSave, petData);
  } catch (err) {
    console.warn('[FIRESTORE APPOINTMENT ERROR]', err);
  }

  // 3. Secondary: Submit to Server API
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment: appointmentToSave,
        petData
      })
    });
    serverSuccess = res.ok;
  } catch (err) {
    console.warn('Could not post appointment to server API:', err);
  }

  // 4. Update local cache
  if (typeof window !== 'undefined') {
    try {
      const key = `agendacan_public_apts_${businessIdOrSlug}`;
      const existingRaw = localStorage.getItem(key);
      const existing: Appointment[] = existingRaw ? JSON.parse(existingRaw) : [];
      existing.unshift(appointmentToSave);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch {}
  }

  return firestoreSuccess || serverSuccess;
}

/**
 * Updates an appointment's status on the backend server and Firestore,
 * ensuring synchronization across devices, reloads, and offline recovery.
 */
export async function updateAppointmentStatusOnServer(
  businessIdOrSlug: string,
  appointmentId: string,
  status: string,
  statusLabel: string,
  extraPatch?: Partial<Appointment>
): Promise<boolean> {
  const patch: Partial<Appointment> = {
    status: status as any,
    statusLabel,
    ...(extraPatch || {})
  };

  // Run Server API and Cloud Firestore concurrently for speed and non-blocking resilience
  const serverTask = fetch(
    `/api/businesses/${encodeURIComponent(businessIdOrSlug)}/appointments/${encodeURIComponent(appointmentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }
  ).then((res) => res.ok).catch((err) => {
    console.warn('[SERVER APPOINTMENT STATUS UPDATE ERROR]', err);
    return false;
  });

  const firestoreTask = updateAppointmentInFirestore(businessIdOrSlug, appointmentId, patch)
    .catch((err) => {
      console.warn('[FIRESTORE APPOINTMENT STATUS UPDATE ERROR]', err);
      return false;
    });

  // Local storage mirror update
  if (typeof window !== 'undefined') {
    try {
      const key = `agendacan_public_apts_${businessIdOrSlug}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const list: Appointment[] = JSON.parse(raw);
        const updated = list.map((a) => (a.id === appointmentId ? { ...a, ...patch } : a));
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {}
  }

  const [serverOk, firestoreOk] = await Promise.all([serverTask, firestoreTask]);
  return serverOk || firestoreOk;
}

/**
 * Fetches the latest appointments and pets from the server or Firestore for background synchronization.
 */
export async function fetchLatestAppointmentsAndPets(
  businessIdOrSlug: string
): Promise<{ appointments: Appointment[]; pets: Pet[] } | null> {
  if (!businessIdOrSlug) return null;

  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/appointments`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.appointments)) {
        return {
          appointments: data.appointments,
          pets: Array.isArray(data.pets) ? data.pets : []
        };
      }
    }
  } catch (err) {
    // Fall back to general profile
  }

  return null;
}

/**
 * Submits a public client rating and review for a business.
 * Persists to both Cloud Firestore and Server API.
 */
export async function submitPublicReview(
  businessIdOrSlug: string,
  review: ClientReview
): Promise<{ success: boolean; review?: ClientReview }> {
  if (!businessIdOrSlug || !review || !review.clientName || !review.stars) {
    return { success: false };
  }

  // 1. Resolve business ID
  let targetBizId = businessIdOrSlug;
  try {
    const biz = await getBusinessFromFirestore(businessIdOrSlug);
    if (biz && biz.businessId) {
      targetBizId = biz.businessId;
    }
  } catch {}

  const now = new Date().toISOString();
  const cleanReview: ClientReview = {
    ...review,
    id: review.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId: targetBizId,
    stars: Math.min(5, Math.max(1, Number(review.stars) || 5)),
    clientName: review.clientName.trim(),
    comment: review.comment ? review.comment.trim() : '',
    date: review.date || new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    createdAt: review.createdAt || now,
    verified: true
  };

  let firestoreSuccess = false;
  let serverSuccess = false;

  // 2. Primary: Cloud Firestore
  try {
    firestoreSuccess = await addReviewToFirestore(targetBizId, cleanReview);
  } catch (err) {
    console.warn('[FIRESTORE SUBMIT REVIEW WARN]', err);
  }

  // 3. Secondary: Server API
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(targetBizId)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review: cleanReview })
    });
    serverSuccess = res.ok;
  } catch (err) {
    console.warn('Server API review post warn:', err);
  }

  // 4. Update local cache if available
  if (typeof window !== 'undefined') {
    try {
      const cacheKey = `agendacan_reviews_${targetBizId}`;
      const raw = localStorage.getItem(cacheKey);
      const existing: ClientReview[] = raw ? JSON.parse(raw) : [];
      const updated = [cleanReview, ...existing.filter((r) => r.id !== cleanReview.id)];
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch {}
  }

  return {
    success: firestoreSuccess || serverSuccess,
    review: cleanReview
  };
}

/**
 * Fetches all reviews for a business from server API or Firestore.
 */
export async function fetchBusinessReviews(businessIdOrSlug: string): Promise<ClientReview[]> {
  if (!businessIdOrSlug) return [];

  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/reviews`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.reviews)) {
        return data.reviews;
      }
    }
  } catch {}

  try {
    const biz = await getBusinessFromFirestore(businessIdOrSlug);
    if (biz && biz.config && Array.isArray(biz.config.reviews)) {
      return biz.config.reviews;
    }
  } catch {}

  return [];
}
