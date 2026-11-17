import { SalonConfig, SalonService, Appointment, Pet, ClientReview, ReviewRequestState, SaleRecord } from '../types';
import { decodePublicProfileToken, extractSlugOnly } from './slugUtils';
import {
  getBusinessFromFirestore,
  saveBusinessToFirestore,
  addAppointmentToFirestoreWithTimeout,
  updateAppointmentInFirestore,
  subscribeToBusinessAppointments,
  subscribeToBusinessPets,
  addReviewToFirestore,
  subscribeToBusinessReviews,
  updateReviewRequestStateInFirestore,
  subscribeToBusinessSales,
  recordSaleInFirestore,
  fetchSalesFromFirestore,
  upsertPetInFirestore,
  fetchAppointmentsAndPetsFromFirestore,
  getLastFirestoreReadErrorKind
} from './firebase';
import {
  normalizeAndMergeReviews,
  reconcileBusinessSources,
  mergeAppointments
} from './syncHelpers';

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
  firestoreDocId?: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
  pets?: Pet[];
  sales?: SaleRecord[];
  updatedAt?: string;
}

export function getApiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path;
  }
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}${path.startsWith('/') ? path : '/' + path}`;
}

async function fetchServerProfile(rawTarget: string, cleanTarget: string): Promise<PublicBusinessResult | null> {
  const targetsToTry = [cleanTarget];
  if (rawTarget !== cleanTarget && !targetsToTry.includes(rawTarget)) {
    targetsToTry.push(rawTarget);
  }

  for (const target of targetsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(getApiUrl(`/api/businesses/${encodeURIComponent(target)}`), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const contentType = res.headers.get('content-type') || '';

      // Ensure the response is valid JSON and not an HTML fallback page from static routing
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.businessId && data.config) {
          const rawSvcs = data.services && data.services.length > 0 ? data.services : data.config.services || [];
          const cleanSvcs = rawSvcs.filter((s: SalonService) => s && s.id && s.active !== false);
          const mergedReviews = normalizeAndMergeReviews(data.businessId, data.config.reviews);
          const resolvedUpdatedAt = data.updatedAt || data.config.updatedAt;
          const resolvedConfig: SalonConfig = {
            ...data.config,
            id: data.businessId,
            currency: data.config.currency || 'USD',
            services: cleanSvcs,
            reviews: mergedReviews,
            updatedAt: resolvedUpdatedAt
          };

          return {
            businessId: data.businessId,
            config: resolvedConfig,
            services: cleanSvcs,
            appointments: data.appointments || [],
            pets: data.pets || [],
            sales: data.sales || [],
            updatedAt: resolvedUpdatedAt
          };
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }
  return null;
}

async function fetchFirestoreProfile(
  rawTarget: string,
  cleanTarget: string,
  options?: { summaryOnly?: boolean }
): Promise<PublicBusinessResult | null> {
  try {
    let firestoreResult = await getBusinessFromFirestore(rawTarget, options);
    if (!firestoreResult && cleanTarget !== rawTarget) {
      firestoreResult = await getBusinessFromFirestore(cleanTarget, options);
    }

    if (firestoreResult && firestoreResult.businessId && firestoreResult.config) {
      const cleanSvcs = (firestoreResult.services && firestoreResult.services.length > 0
        ? firestoreResult.services
        : firestoreResult.config.services || []
      ).filter((s) => s && s.id && s.active !== false);

      const mergedReviews = normalizeAndMergeReviews(
        firestoreResult.businessId,
        firestoreResult.config.reviews
      );
      const resolvedUpdatedAt = firestoreResult.updatedAt || firestoreResult.config.updatedAt;

      const resolvedConfig: SalonConfig = {
        ...firestoreResult.config,
        id: firestoreResult.businessId,
        currency: firestoreResult.config.currency || 'USD',
        services: cleanSvcs,
        reviews: mergedReviews,
        updatedAt: resolvedUpdatedAt
      };

      return {
        businessId: firestoreResult.businessId,
        firestoreDocId: firestoreResult.firestoreDocId || firestoreResult.businessId,
        config: resolvedConfig,
        services: cleanSvcs,
        appointments: firestoreResult.appointments || [],
        pets: firestoreResult.pets || [],
        updatedAt: resolvedUpdatedAt
      };
    }
  } catch (err) {
    console.warn('[FIRESTORE PROFILE FETCH ERROR]', err);
  }
  return null;
}

const resolvedBizIdCache = new Map<string, string>();

function rememberResolvedBusinessId(idOrSlug: string | undefined, canonicalId: string): void {
  if (!idOrSlug || !canonicalId) return;
  const raw = idOrSlug.trim();
  const clean = extractSlugOnly(raw) || raw;
  resolvedBizIdCache.set(raw, canonicalId);
  resolvedBizIdCache.set(clean, canonicalId);
}

async function resolveCanonicalBusinessId(businessIdOrSlug: string): Promise<string> {
  const raw = (businessIdOrSlug || '').trim();
  if (!raw) return 'biz_main';
  if (raw.startsWith('biz_') || raw === 'default') return raw;

  const clean = extractSlugOnly(raw) || raw;
  const memHit = resolvedBizIdCache.get(raw) || resolvedBizIdCache.get(clean);
  if (memHit) return memHit;

  if (typeof window !== 'undefined') {
    try {
      const cachedRaw =
        localStorage.getItem(`agendacan_public_biz_${clean}`) ||
        localStorage.getItem(`agendacan_public_biz_${raw}`);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed?.businessId) {
          rememberResolvedBusinessId(raw, parsed.businessId);
          return parsed.businessId;
        }
      }
    } catch {}
  }

  try {
    const profile = await fetchBusinessProfile(raw);
    if (profile?.businessId) {
      rememberResolvedBusinessId(raw, profile.businessId);
      return profile.businessId;
    }
  } catch {}

  return raw;
}

export interface BusinessProfileLookupOutcome {
  profile: PublicBusinessResult | null;
  reason?: 'quota_exceeded' | 'not_found';
}

export async function fetchBusinessProfileWithStatus(
  idOrSlug: string,
  options?: { summaryOnly?: boolean }
): Promise<BusinessProfileLookupOutcome> {
  if (!idOrSlug) return { profile: null, reason: 'not_found' };
  const rawTarget = idOrSlug.trim();
  const cleanTarget = extractSlugOnly(idOrSlug) || rawTarget;

  // 1. Query both Server API and Cloud Firestore in parallel
  const [serverSettled, firestoreSettled] = await Promise.allSettled([
    fetchServerProfile(rawTarget, cleanTarget),
    fetchFirestoreProfile(rawTarget, cleanTarget, options)
  ]);

  const serverResult = serverSettled.status === 'fulfilled' ? serverSettled.value : null;
  const firestoreResult = firestoreSettled.status === 'fulfilled' ? firestoreSettled.value : null;

  let resolvedResult: PublicBusinessResult | null = null;
  if (firestoreResult && serverResult) {
    if (firestoreResult.businessId === serverResult.businessId) {
      const reconciled = reconcileBusinessSources(firestoreResult, serverResult);
      resolvedResult = reconciled
        ? {
            ...reconciled,
            firestoreDocId: firestoreResult.firestoreDocId || firestoreResult.businessId
          }
        : null;
    } else {
      resolvedResult =
        serverResult.businessId === rawTarget || serverResult.businessId === cleanTarget
          ? serverResult
          : firestoreResult;
    }
  } else {
    resolvedResult = firestoreResult || serverResult;
  }

  if (resolvedResult && resolvedResult.businessId && resolvedResult.config) {
    rememberResolvedBusinessId(rawTarget, resolvedResult.businessId);
    if (resolvedResult.config.bookingSlug) {
      rememberResolvedBusinessId(resolvedResult.config.bookingSlug, resolvedResult.businessId);
    }
    if (typeof window !== 'undefined') {
      try {
        const serialized = JSON.stringify(resolvedResult);
        localStorage.setItem(`agendacan_public_biz_${resolvedResult.businessId}`, serialized);
        if (resolvedResult.config.bookingSlug) {
          localStorage.setItem(
            `agendacan_public_biz_${extractSlugOnly(resolvedResult.config.bookingSlug)}`,
            serialized
          );
        }
      } catch {}
    }
    return { profile: resolvedResult };
  }

  // 2. Fallback: Local storage & IndexedDB cache (strictly for the requested business, NEVER demo data)
  if (typeof window !== 'undefined') {
    try {
      const keysToTry = [`agendacan_public_biz_${cleanTarget}`];
      if (rawTarget !== cleanTarget) {
        keysToTry.push(`agendacan_public_biz_${rawTarget}`);
      }
      if (cleanTarget === 'biz_main' || rawTarget === 'biz_main') {
        keysToTry.push('agendacan_public_biz_biz_main');
      }

      for (const k of keysToTry) {
        const cachedRaw = localStorage.getItem(k);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.config && cached.businessId) {
            return {
              profile: {
                ...cached,
                config: {
                  ...cached.config,
                  reviews: normalizeAndMergeReviews(cached.businessId, cached.config.reviews)
                }
              }
            };
          }
        }
      }

      // Check local IndexedDB business store (covers owners/devices where localStorage mirror hit 5MB quota)
      const { findBusinessInLocalSaaSDb } = await import('./saasDb');
      const localSaaS = await findBusinessInLocalSaaSDb(rawTarget);
      if (localSaaS && localSaaS.config) {
        return {
          profile: {
            businessId: localSaaS.businessId,
            firestoreDocId: localSaaS.businessId,
            config: localSaaS.config,
            services: localSaaS.services || [],
            appointments: localSaaS.appointments || [],
            pets: localSaaS.pets || [],
            sales: localSaaS.sales || [],
            updatedAt: localSaaS.updatedAt
          }
        };
      }
    } catch {}
  }

  // 3. Query params check ?businessId= or ?bid=
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const queryBizId = searchParams.get('businessId') || searchParams.get('bid');
      if (queryBizId && queryBizId !== cleanTarget && queryBizId !== rawTarget) {
        const fbResult = await getBusinessFromFirestore(queryBizId, options);
        if (fbResult && fbResult.config) {
          return {
            profile: {
              businessId: fbResult.businessId,
              firestoreDocId: fbResult.firestoreDocId || fbResult.businessId,
              config: fbResult.config,
              services: fbResult.services || fbResult.config.services || [],
              appointments: fbResult.appointments || [],
              updatedAt: fbResult.updatedAt
            }
          };
        }

        const resQuery = await fetch(`/api/businesses/${encodeURIComponent(queryBizId)}`);
        const qContentType = resQuery.headers.get('content-type') || '';
        if (resQuery.ok && qContentType.includes('application/json')) {
          const data = await resQuery.json();
          if (data && data.businessId && data.config) {
            return {
              profile: {
                businessId: data.businessId,
                config: {
                  ...data.config,
                  reviews: normalizeAndMergeReviews(data.businessId, data.config.reviews)
                },
                services: data.services || data.config.services || [],
                appointments: data.appointments || [],
                updatedAt: data.updatedAt || data.config.updatedAt
              }
            };
          }
        }
      }
    } catch {}
  }

  // 4. Backward-compatibility: Check for legacy URL token (&p=...)
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('p') || searchParams.get('token');
      if (token) {
        const decoded = decodePublicProfileToken(token);
        if (decoded && decoded.config) {
          return {
            profile: {
              businessId: decoded.businessId,
              config: decoded.config,
              services: decoded.services || decoded.config.services || [],
              appointments: []
            }
          };
        }
      }
    } catch (err) {
      console.warn('Error reading URL token:', err);
    }
  }

  // 5. Distinguish Firestore read quota exhaustion from genuine missing business links
  const lastReadErr = getLastFirestoreReadErrorKind();
  return {
    profile: null,
    reason: lastReadErr === 'quota-exceeded' ? 'quota_exceeded' : 'not_found'
  };
}

/**
 * Universal resolution of a business profile for public booking and reviews.
 * NEVER falls back to demo data or another business!
 */
export async function fetchBusinessProfile(
  idOrSlug: string,
  options?: { summaryOnly?: boolean }
): Promise<PublicBusinessResult | null> {
  const outcome = await fetchBusinessProfileWithStatus(idOrSlug, options);
  return outcome.profile;
}

const inFlightSyncs = new Map<string, Promise<boolean>>();

/**
 * Persists the business configuration to Cloud Firestore and Server API in parallel.
 * Awaits both so changes saved in Ajustes are guaranteed to persist in Cloud Firestore AND Server API.
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
  const cleanSlug = extractSlugOnly(config.bookingSlug) || config.bookingSlug;
  const syncTimestamp = config.updatedAt || new Date().toISOString();

  const configToSync: SalonConfig = {
    ...config,
    id: targetId,
    updatedAt: syncTimestamp,
    reviews: normalizeAndMergeReviews(targetId, config.reviews)
  };

  // Deduplicate concurrent identical sync calls (e.g. AjustesView + App.tsx onUpdateConfig)
  const dedupKey = `${targetId}|${syncTimestamp}|${configToSync.country || ''}|${configToSync.city || ''}|${configToSync.address || ''}|${cleanSlug}`;
  const existingFlight = inFlightSyncs.get(dedupKey);
  if (existingFlight) {
    return existingFlight;
  }

  const runSync = async (): Promise<boolean> => {
    // Immediately synchronize local public cache without wiping existing appointments/pets/sales if omitted
    if (typeof window !== 'undefined') {
      try {
        let existingCached: Partial<PublicBusinessResult> | null = null;
        try {
          const prevRaw =
            localStorage.getItem(`agendacan_public_biz_${targetId}`) ||
            (cleanSlug ? localStorage.getItem(`agendacan_public_biz_${cleanSlug}`) : null);
          if (prevRaw) {
            const parsedPrev = JSON.parse(prevRaw);
            if (parsedPrev && parsedPrev.businessId === targetId) {
              existingCached = parsedPrev;
            }
          }
        } catch {}

        const publicData: PublicBusinessResult = {
          businessId: targetId,
          config: configToSync,
          services: configToSync.services || [],
          appointments:
            appointments && appointments.length > 0
              ? appointments
              : existingCached?.appointments || appointments || [],
          pets:
            pets && pets.length > 0
              ? pets
              : existingCached?.pets || pets || [],
          sales:
            sales && sales.length > 0
              ? sales
              : existingCached?.sales || sales || [],
          updatedAt: syncTimestamp
        };
        const serialized = JSON.stringify(publicData);
        localStorage.setItem(`agendacan_public_biz_${targetId}`, serialized);
        if (cleanSlug) {
          localStorage.setItem(`agendacan_public_biz_${cleanSlug}`, serialized);
        }
      } catch (e) {
        console.warn('Error updating local public cache in syncBusinessToServer:', e);
      }
    }

    // Run Firestore sync and Server API sync concurrently and await BOTH
    const firestorePromise = saveBusinessToFirestore(targetId, configToSync, appointments, pets).catch((err) => {
      console.warn('[FIRESTORE SYNC WARN]', err);
      return false;
    });

    const serverPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(getApiUrl('/api/businesses'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            businessId: targetId,
            config: configToSync,
            pets,
            appointments,
            bookedRetentions,
            sales
          })
        });
        clearTimeout(timeoutId);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json().catch(() => null);
          return Boolean(data && data.success !== false);
        }
      } catch (err) {
        console.warn('Server API sync not reachable:', err);
      }
      return false;
    })();

    const [firestoreSuccess, serverSuccess] = await Promise.all([firestorePromise, serverPromise]);
    console.log(`[SYNC REPORT] Business ${targetId}: Server=${serverSuccess}, Firestore=${firestoreSuccess}`);
    return firestoreSuccess || serverSuccess;
  };

  const promise = runSync().finally(() => {
    setTimeout(() => {
      inFlightSyncs.delete(dedupKey);
    }, 1500);
  });
  inFlightSyncs.set(dedupKey, promise);
  return promise;
}

/**
 * Submits a new public appointment directly to Cloud Firestore and the Server API
 * using the canonical businessId so phone & computer read from the exact same record.
 */
export async function createPublicAppointment(
  businessIdOrSlug: string,
  appointment: Appointment,
  petData?: Partial<Pet>
): Promise<boolean> {
  const canonicalBizId = await resolveCanonicalBusinessId(businessIdOrSlug);
  const now = new Date().toISOString();

  const appointmentToSave: Appointment = {
    ...appointment,
    businessId: canonicalBizId,
    status: 'pendiente',
    statusLabel: 'POR CONFIRMAR',
    createdFromPublic: true,
    petSnapshot: petData || appointment.petSnapshot,
    createdAt: appointment.createdAt || now,
    updatedAt: now
  };

  // 1. Immediately update local storage cache for zero-delay feedback
  if (typeof window !== 'undefined') {
    try {
      const keys = Array.from(
        new Set([`agendacan_public_apts_${canonicalBizId}`, `agendacan_public_apts_${businessIdOrSlug}`])
      );
      for (const key of keys) {
        const existingRaw = localStorage.getItem(key);
        const existing: Appointment[] = existingRaw ? JSON.parse(existingRaw) : [];
        const deduped = [appointmentToSave, ...existing.filter((a) => a.id !== appointmentToSave.id)];
        localStorage.setItem(key, JSON.stringify(deduped.slice(0, 50)));
      }
    } catch {}
  }

  // 2. Server API save task with bounded timeout
  const serverTask = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(getApiUrl(`/api/businesses/${encodeURIComponent(canonicalBizId)}/appointments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          appointment: appointmentToSave,
          petData
        })
      });
      clearTimeout(timeoutId);
      const contentType = res.headers.get('content-type') || '';
      return res.ok && contentType.includes('application/json');
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Could not post public appointment to server API:', err);
      return false;
    }
  })();

  // 3. Firestore save task in parallel (always writes to businesses/{canonicalBizId}/appointments)
  const firestoreTask = addAppointmentToFirestoreWithTimeout(canonicalBizId, appointmentToSave, petData, 4500)
    .catch((err) => {
      console.warn('[FIRESTORE APPOINTMENT ERROR]', err);
      return false;
    });

  // 4. Wait for both bounded persistence tasks so a fast Server 404 never short-circuits Firestore
  const [serverOk, firestoreOk] = await Promise.all([serverTask, firestoreTask]);
  return serverOk || firestoreOk;
}

/**
 * Submits an internal appointment created from Agenda to Cloud Firestore and Server API.
 * Preserves exact status & petSnapshot and guarantees persistence across devices.
 */
export async function createInternalAppointment(
  businessIdOrSlug: string,
  appointment: Appointment,
  petData?: Partial<Pet>
): Promise<boolean> {
  const canonicalBizId = await resolveCanonicalBusinessId(businessIdOrSlug);
  const now = new Date().toISOString();
  const appointmentToSave: Appointment = {
    ...appointment,
    businessId: canonicalBizId,
    petSnapshot: petData || appointment.petSnapshot,
    createdAt: appointment.createdAt || now,
    updatedAt: now
  };

  // 1. Immediately update local storage mirror for fast offline recovery
  if (typeof window !== 'undefined') {
    try {
      const key = `agendacan_public_apts_${canonicalBizId}`;
      const existingRaw = localStorage.getItem(key);
      const existing: Appointment[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [appointmentToSave, ...existing.filter((a) => a.id !== appointmentToSave.id)];
      localStorage.setItem(key, JSON.stringify(updated.slice(0, 50)));
    } catch {}
  }

  // 2. Server API save with safety timeout
  const serverTask = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch(getApiUrl(`/api/businesses/${encodeURIComponent(canonicalBizId)}/appointments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment: appointmentToSave,
          petData
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const contentType = res.headers.get('content-type') || '';
      return res.ok && contentType.includes('application/json');
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('[SERVER APPOINTMENT POST ERROR/TIMEOUT]', err);
      return false;
    }
  })();

  // 3. Cloud Firestore save in parallel so cross-device clients without local Express see it immediately
  const firestoreTask = addAppointmentToFirestoreWithTimeout(canonicalBizId, appointmentToSave, petData, 4500)
    .catch((err) => {
      console.warn('[FIRESTORE BACKGROUND SYNC WARN]', err);
      return false;
    });

  const [serverOk, firestoreOk] = await Promise.all([serverTask, firestoreTask]);
  return serverOk || firestoreOk;
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
  const canonicalBizId = await resolveCanonicalBusinessId(businessIdOrSlug);
  const now = new Date().toISOString();
  const patch: Partial<Appointment> = {
    status: status as any,
    statusLabel,
    updatedAt: now,
    ...(extraPatch || {})
  };

  // Run Server API and Cloud Firestore concurrently for speed and cross-device consistency
  const serverTask = fetch(
    getApiUrl(`/api/businesses/${encodeURIComponent(canonicalBizId)}/appointments/${encodeURIComponent(appointmentId)}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }
  )
    .then((res) => res.ok)
    .catch((err) => {
      console.warn('[SERVER APPOINTMENT STATUS UPDATE ERROR]', err);
      return false;
    });

  const firestoreTask = updateAppointmentInFirestore(canonicalBizId, appointmentId, patch)
    .catch((err) => {
      console.warn('[FIRESTORE APPOINTMENT STATUS UPDATE ERROR]', err);
      return false;
    });

  // Local storage mirror update
  if (typeof window !== 'undefined') {
    try {
      const key = `agendacan_public_apts_${canonicalBizId}`;
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
 * Persists a materialized or manually edited Pet ficha to both Cloud Firestore and Server API.
 */
export async function syncPetToBackend(businessIdOrSlug: string, pet: Pet): Promise<boolean> {
  if (!businessIdOrSlug || !pet || !pet.id) return false;
  const canonicalBizId = await resolveCanonicalBusinessId(businessIdOrSlug);

  const firestoreTask = upsertPetInFirestore(canonicalBizId, pet).catch(() => false);
  const serverTask = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(getApiUrl(`/api/businesses/${encodeURIComponent(canonicalBizId)}/pets`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ pet })
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  })();

  const [fsOk, srvOk] = await Promise.all([firestoreTask, serverTask]);
  return fsOk || srvOk;
}

/**
 * Fetches and reconciles the latest appointments, pets, and sales from BOTH
 * Server API and Cloud Firestore for background/focus synchronization across devices.
 */
export async function fetchLatestAppointmentsAndPets(
  businessIdOrSlug: string,
  options?: { includeFirestore?: boolean }
): Promise<{ appointments: Appointment[]; pets: Pet[]; sales?: SaleRecord[] } | null> {
  if (!businessIdOrSlug) return null;
  const canonicalBizId = await resolveCanonicalBusinessId(businessIdOrSlug);
  const includeFirestore = options?.includeFirestore !== false;

  const serverFetch = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(
        getApiUrl(`/api/businesses/${encodeURIComponent(canonicalBizId)}/appointments`),
        {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && Array.isArray(data.appointments)) {
          return {
            appointments: data.appointments as Appointment[],
            pets: Array.isArray(data.pets) ? (data.pets as Pet[]) : [],
            sales: Array.isArray(data.sales) ? (data.sales as SaleRecord[]) : []
          };
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }
    return null;
  })();

  const firestoreFetch = includeFirestore
    ? fetchAppointmentsAndPetsFromFirestore(canonicalBizId).catch(() => null)
    : Promise.resolve(null);

  const [serverSettled, firestoreSettled] = await Promise.allSettled([serverFetch, firestoreFetch]);
  const serverData = serverSettled.status === 'fulfilled' ? serverSettled.value : null;
  const firestoreData = firestoreSettled.status === 'fulfilled' ? firestoreSettled.value : null;

  if (!serverData && !firestoreData) {
    return null;
  }

  const mergedAppointments = mergeAppointments(
    serverData?.appointments || [],
    firestoreData?.appointments || []
  );

  const petsMap = new Map<string, Pet>();
  for (const p of serverData?.pets || []) if (p?.id) petsMap.set(p.id, p);
  for (const p of firestoreData?.pets || []) {
    if (!p?.id) continue;
    const prev = petsMap.get(p.id);
    petsMap.set(p.id, prev ? { ...prev, ...p } : p);
  }

  const salesMap = new Map<string, SaleRecord>();
  for (const s of serverData?.sales || []) if (s?.id) salesMap.set(s.id, s);
  for (const s of firestoreData?.sales || []) if (s?.id) salesMap.set(s.id, s);

  return {
    appointments: mergedAppointments,
    pets: Array.from(petsMap.values()),
    sales: Array.from(salesMap.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    )
  };
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

export interface ReviewBusinessSummary {
  businessId: string;
  name?: string;
  bookingSlug?: string;
  country?: string;
  city?: string;
  address?: string;
  currency?: string;
  logoUrl?: string;
}

export interface SubmitReviewResult {
  success: boolean;
  review?: ClientReview;
  error?: string;
  errorCode?: string;
  persistedTo?: ('firestore' | 'server')[];
}

/**
 * Submits a public client rating and review for a business.
 * Persists to both Cloud Firestore and Server API without redundant reads or unsafe fallbacks.
 */
export async function submitPublicReview(
  businessIdOrSlug: string,
  review: ClientReview,
  options?: {
    firestoreDocId?: string;
    businessSummary?: ReviewBusinessSummary;
  }
): Promise<SubmitReviewResult> {
  const trimmedTarget = (businessIdOrSlug || '').trim();
  const trimmedName = String(review?.clientName || '').trim().slice(0, 120);
  const parsedStars = Number(review?.stars);

  if (!trimmedTarget || !review || !trimmedName || !Number.isFinite(parsedStars) || parsedStars < 1 || parsedStars > 5) {
    return {
      success: false,
      errorCode: 'invalid-argument',
      error: 'Por favor escribe tu nombre y selecciona una calificación de 1 a 5 estrellas.'
    };
  }

  // 1. Resolve canonical businessId and Firestore docId (reuse pre-resolved profile if provided)
  let targetBizId = options?.businessSummary?.businessId?.trim() || trimmedTarget;
  let targetDocId = options?.firestoreDocId?.trim() || '';
  let resolvedSlug = options?.businessSummary?.bookingSlug
    ? extractSlugOnly(options.businessSummary.bookingSlug)
    : '';
  let businessSummary: ReviewBusinessSummary | undefined = options?.businessSummary
    ? {
        ...options.businessSummary,
        businessId: targetBizId
      }
    : undefined;

  if (!businessSummary || !targetDocId) {
    try {
      const resolvedProfile = await fetchBusinessProfile(trimmedTarget);
      if (resolvedProfile && resolvedProfile.businessId) {
        targetBizId = resolvedProfile.businessId;
        targetDocId = resolvedProfile.firestoreDocId || resolvedProfile.businessId;
        resolvedSlug = resolvedProfile.config?.bookingSlug
          ? extractSlugOnly(resolvedProfile.config.bookingSlug)
          : resolvedSlug;
        if (!businessSummary) {
          businessSummary = {
            businessId: resolvedProfile.businessId,
            name: resolvedProfile.config?.name,
            bookingSlug: resolvedProfile.config?.bookingSlug,
            country: resolvedProfile.config?.country,
            city: resolvedProfile.config?.city,
            address: resolvedProfile.config?.address,
            currency: resolvedProfile.config?.currency,
            logoUrl: resolvedProfile.config?.logoUrl
          };
        }
      }
    } catch {}
  }

  if (!targetDocId) {
    targetDocId = targetBizId;
  }

  const now = new Date().toISOString();
  const safeStars = Math.round(Math.min(5, Math.max(1, parsedStars)) * 10) / 10;

  const cleanReview: ClientReview = {
    ...review,
    id: review.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    businessId: targetBizId,
    stars: safeStars,
    clientName: trimmedName,
    comment: review.comment ? String(review.comment).trim().slice(0, 2000) : '',
    date: review.date || new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    createdAt: review.createdAt || now,
    verified: true
  };

  // 2. Run Cloud Firestore and Server API saves in parallel
  const firestoreTask = addReviewToFirestore(targetBizId, cleanReview, targetDocId).catch((err) => {
    console.warn('[FIRESTORE SUBMIT REVIEW WARN]', err);
    return {
      success: false,
      errorCode: err?.code || 'unknown',
      errorMessage: 'Ocurrió un error al guardar tu calificación. Por favor intenta nuevamente.'
    };
  });

  const serverTask = (async (): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch(getApiUrl(`/api/businesses/${encodeURIComponent(targetBizId)}/reviews`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          review: cleanReview,
          businessSummary
        })
      });
      clearTimeout(timeoutId);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        return Boolean(data && data.success !== false);
      }
      return false;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Server API review post warn:', err);
      return false;
    }
  })();

  const [firestoreOutcome, serverSuccess] = await Promise.all([firestoreTask, serverTask]);
  const firestoreSuccess = Boolean(firestoreOutcome?.success);
  const overallSuccess = firestoreSuccess || serverSuccess;

  const persistedTo: ('firestore' | 'server')[] = [];
  if (firestoreSuccess) persistedTo.push('firestore');
  if (serverSuccess) persistedTo.push('server');

  // 3. ONLY update local caches if real persistent storage confirmed saving the review
  if (overallSuccess && typeof window !== 'undefined') {
    try {
      const cacheKey = `agendacan_reviews_${targetBizId}`;
      const raw = localStorage.getItem(cacheKey);
      const existing: ClientReview[] = raw ? JSON.parse(raw) : [];
      const updated = normalizeAndMergeReviews(targetBizId, existing, [cleanReview]);
      localStorage.setItem(cacheKey, JSON.stringify(updated));

      const keysToPatch = [`agendacan_public_biz_${targetBizId}`];
      if (resolvedSlug) keysToPatch.push(`agendacan_public_biz_${resolvedSlug}`);
      if (trimmedTarget !== targetBizId && trimmedTarget !== resolvedSlug) {
        keysToPatch.push(`agendacan_public_biz_${trimmedTarget}`);
      }
      for (const pubKey of keysToPatch) {
        const pubRaw = localStorage.getItem(pubKey);
        if (pubRaw) {
          const parsed = JSON.parse(pubRaw);
          if (parsed && parsed.config) {
            parsed.config.reviews = normalizeAndMergeReviews(
              targetBizId,
              parsed.config.reviews,
              [cleanReview]
            );
            localStorage.setItem(pubKey, JSON.stringify(parsed));
          }
        }
      }
    } catch {}
  }

  if (!overallSuccess) {
    return {
      success: false,
      errorCode: firestoreOutcome?.errorCode || 'save-failed',
      error:
        firestoreOutcome?.errorMessage ||
        'Ocurrió un error al guardar tu calificación. Por favor intenta nuevamente.',
      persistedTo
    };
  }

  return {
    success: true,
    review: cleanReview,
    persistedTo
  };
}

/**
 * Fetches all valid reviews for a business by merging Server API and Cloud Firestore.
 */
export async function fetchBusinessReviews(businessIdOrSlug: string): Promise<ClientReview[]> {
  if (!businessIdOrSlug) return [];

  const [serverRes, firestoreRes] = await Promise.allSettled([
    (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      try {
        const res = await fetch(getApiUrl(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/reviews`), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          return Array.isArray(data?.reviews) ? (data.reviews as ClientReview[]) : [];
        }
      } catch {
        clearTimeout(timeoutId);
      }
      return [] as ClientReview[];
    })(),
    (async () => {
      try {
        const biz = await getBusinessFromFirestore(businessIdOrSlug);
        return {
          businessId: biz?.businessId || '',
          reviews: biz?.config?.reviews || []
        };
      } catch {}
      return { businessId: '', reviews: [] as ClientReview[] };
    })()
  ]);

  const serverReviews = serverRes.status === 'fulfilled' ? serverRes.value : [];
  const fbBizId = firestoreRes.status === 'fulfilled' ? firestoreRes.value.businessId : '';
  const fbReviews = firestoreRes.status === 'fulfilled' ? firestoreRes.value.reviews : [];

  const targetBizId = fbBizId || (businessIdOrSlug.startsWith('biz_') ? businessIdOrSlug : undefined);
  return normalizeAndMergeReviews(targetBizId, fbReviews, serverReviews);
}
