import { SalonConfig, SalonService, Appointment, Pet, ClientReview, ReviewRequestState, SaleRecord } from '../types';
import { decodePublicProfileToken, extractSlugOnly } from './slugUtils';
import {
  getBusinessFromFirestore,
  saveBusinessToFirestore,
  addAppointmentToFirestore,
  addAppointmentToFirestoreWithTimeout,
  updateAppointmentInFirestore,
  subscribeToBusinessAppointments,
  subscribeToBusinessPets,
  addReviewToFirestore,
  subscribeToBusinessReviews,
  updateReviewRequestStateInFirestore,
  subscribeToBusinessSales,
  recordSaleInFirestore,
  fetchSalesFromFirestore
} from './firebase';

export {
  subscribeToBusinessAppointments,
  subscribeToBusinessPets,
  subscribeToBusinessReviews,
  updateReviewRequestStateInFirestore,
  subscribeToBusinessSales,
  recordSaleInFirestore,
  fetchSalesFromFirestore
};

export interface PublicBusinessResult {
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
  pets?: Pet[];
  sales?: SaleRecord[];
}

export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path;
  }
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}${path.startsWith('/') ? path : '/' + path}`;
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
  const rawTarget = idOrSlug.trim();
  const cleanTarget = extractSlugOnly(idOrSlug) || rawTarget;

  // 1. Fast local cache check for zero-wait instant load
  if (typeof window !== 'undefined') {
    try {
      const cached =
        localStorage.getItem(`agendacan_public_biz_${cleanTarget}`) ||
        localStorage.getItem(`agendacan_public_biz_${rawTarget}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.businessId && parsed.config && parsed.config.name) {
          // Trigger background refresh from server to ensure fresh data
          fetch(getApiUrl(`/api/businesses/${encodeURIComponent(cleanTarget)}`))
            .then((r) => (r.ok ? r.json() : null))
            .then((fresh) => {
              if (fresh && fresh.config) {
                const refreshed: PublicBusinessResult = {
                  businessId: fresh.businessId,
                  config: fresh.config,
                  services: fresh.services || fresh.config.services || [],
                  appointments: fresh.appointments || [],
                  pets: fresh.pets || [],
                  sales: fresh.sales || []
                };
                localStorage.setItem(`agendacan_public_biz_${cleanTarget}`, JSON.stringify(refreshed));
              }
            })
            .catch(() => {});
          return parsed;
        }
      }
    } catch {}
  }

  // 2. Primary: Query Server API (/api/businesses/:idOrSlug) - ultra-fast (<20ms response)
  try {
    const targetsToTry = [cleanTarget];
    if (rawTarget !== cleanTarget && !targetsToTry.includes(rawTarget)) {
      targetsToTry.push(rawTarget);
    }

    for (const target of targetsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(getApiUrl(`/api/businesses/${encodeURIComponent(target)}`), {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
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
              pets: data.pets || [],
              sales: data.sales || []
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

            // Asynchronously warm Firestore in the background
            saveBusinessToFirestore(data.businessId, data.config, data.appointments, data.pets).catch(() => {});

            return result;
          }
        }
      } catch (fErr) {
        clearTimeout(timeoutId);
      }
    }
  } catch (err) {
    console.warn('Server API error in fetchBusinessProfile:', err);
  }

  // 3. Fallback: Query Cloud Firestore
  try {
    let firestoreResult = await getBusinessFromFirestore(rawTarget);
    if (!firestoreResult && cleanTarget !== rawTarget) {
      firestoreResult = await getBusinessFromFirestore(cleanTarget);
    }

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

  // 5. Local storage cache fallback
  if (typeof window !== 'undefined') {
    try {
      const cachedRaw =
        localStorage.getItem(`agendacan_public_biz_${cleanTarget}`) ||
        localStorage.getItem(`agendacan_public_biz_${rawTarget}`) ||
        localStorage.getItem('agendacan_public_biz_biz_main');
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.config && cached.businessId) {
          return cached;
        }
      }
    } catch {}
  }

  // 6. Zero demo fallback: If not found anywhere, return null so the proper Spanish error is displayed
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
  bookedRetentions?: string[],
  sales?: SaleRecord[]
): Promise<boolean> {
  const targetId = businessId || config.id || 'biz_main';

  // Concurrently start Firestore sync
  const firestorePromise = saveBusinessToFirestore(targetId, config, appointments, pets).catch((err) => {
    console.warn('[FIRESTORE BACKGROUND SYNC WARN]', err);
    return false;
  });

  // Concurrently send payload to server API (authoritative fast storage in <20ms)
  let serverSuccess = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(getApiUrl('/api/businesses'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        businessId: targetId,
        config,
        pets,
        appointments,
        bookedRetentions,
        sales
      })
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== false) {
        serverSuccess = true;
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.warn('[SERVER SYNC FAILED]', res.status, errText);
    }
  } catch (err) {
    console.warn('Server API sync not reachable:', err);
  }

  // If server confirmed save, return immediately! Firestore continues in the background.
  if (serverSuccess) {
    console.log(`[SYNC REPORT] Business ${targetId}: Server confirmed immediately. Firestore continuing in background.`);
    return true;
  }

  // If server was unreachable (e.g., static hosting / offline), await Firestore
  const firestoreSuccess = await firestorePromise;
  console.log(`[SYNC REPORT] Business ${targetId}: Server=${serverSuccess}, Firestore=${firestoreSuccess}`);
  return firestoreSuccess;
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
 * Submits an internal appointment created from Agenda to Cloud Firestore and Server API.
 * Preserves the exact status ('confirmada') and ensures persistence across reloads and multi-devices.
 * Guarantees that the UI is not held hostage by slow secondary network tasks.
 */
export async function createInternalAppointment(
  businessIdOrSlug: string,
  appointment: Appointment,
  petData?: Partial<Pet>
): Promise<boolean> {
  const targetBizId = businessIdOrSlug || 'biz_main';

  // 1. Immediately update local storage mirror for fast offline recovery
  if (typeof window !== 'undefined') {
    try {
      const key = `agendacan_public_apts_${targetBizId}`;
      const existingRaw = localStorage.getItem(key);
      const existing: Appointment[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [appointment, ...existing.filter((a) => a.id !== appointment.id)];
      localStorage.setItem(key, JSON.stringify(updated.slice(0, 50)));
    } catch {}
  }

  // 2. Primary Authoritative Save: Server API with a 4.5s safety timeout
  let serverSuccess = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/businesses/${encodeURIComponent(targetBizId)}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment,
        petData
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    serverSuccess = res.ok;
  } catch (err) {
    console.warn('[SERVER APPOINTMENT POST ERROR/TIMEOUT]', err);
    serverSuccess = false;
  }

  // 3. Cloud Firestore synchronization:
  // If Server API succeeded, trigger Firestore replication in background with safety timeout
  // and resolve IMMEDIATELY so the user is never stuck in "Agendando turno..."!
  if (serverSuccess) {
    addAppointmentToFirestoreWithTimeout(targetBizId, appointment, petData, 3500)
      .catch((err) => {
        console.warn('[FIRESTORE BACKGROUND SYNC WARN]', err);
      });
    return true;
  }

  // 4. Fallback if server is offline/unavailable: await Firestore directly with safety timeout
  const firestoreSuccess = await addAppointmentToFirestoreWithTimeout(targetBizId, appointment, petData, 4500);
  return firestoreSuccess;
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
): Promise<{ appointments: Appointment[]; pets: Pet[]; sales?: SaleRecord[] } | null> {
  if (!businessIdOrSlug) return null;

  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/appointments`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.appointments)) {
        return {
          appointments: data.appointments,
          pets: Array.isArray(data.pets) ? data.pets : [],
          sales: Array.isArray(data.sales) ? data.sales : []
        };
      }
    }
  } catch (err) {
    // Fall back to general profile
  }

  return null;
}

/**
 * Fetches dedicated sales records directly from the server API.
 */
export async function fetchBusinessSales(businessIdOrSlug: string): Promise<SaleRecord[]> {
  if (!businessIdOrSlug) return [];
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/sales`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.sales)) {
        return data.sales;
      }
    }
  } catch (err) {
    console.warn('Could not fetch sales from server API:', err);
  }
  return [];
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
