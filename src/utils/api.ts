import { SalonConfig, SalonService, Appointment, Pet } from '../types';
import { decodePublicProfileToken, extractSlugOnly } from './slugUtils';

export interface PublicBusinessResult {
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
}

/**
 * Universal resolution of a business profile for public booking:
 * 1. Query Server API (/api/businesses/:cleanSlugOrId)
 * 2. If query param businessId is also present, try that as well
 * 3. Backward-compat: decode legacy URL token (&p=...) if present
 * 4. Cache in session/localStorage for the specific business ID
 * 5. NEVER falls back to demo data or fake business!
 */
export async function fetchBusinessProfile(idOrSlug: string): Promise<PublicBusinessResult | null> {
  if (!idOrSlug) return null;
  const cleanTarget = extractSlugOnly(idOrSlug) || idOrSlug.trim();

  // 1. Query Server API (/api/businesses/:idOrSlug)
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
          appointments: data.appointments || []
        };

        // Cache successful response for offline/session reuse
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`agendacan_public_biz_${data.businessId}`, JSON.stringify(result));
            if (data.config.bookingSlug) {
              localStorage.setItem(`agendacan_public_biz_${extractSlugOnly(data.config.bookingSlug)}`, JSON.stringify(result));
            }
          } catch {}
        }

        return result;
      }
    }
  } catch (err) {
    console.warn('Network error fetching business from server:', err);
  }

  // 2. Check if a query param ?businessId= or ?bid= exists and try that against the server
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const queryBizId = searchParams.get('businessId') || searchParams.get('bid');
      if (queryBizId && queryBizId !== cleanTarget) {
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

  // 3. Backward-compatibility: Check for embedded profile payload in URL (&p=...)
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

  // 4. Check cached profile for this specific ID/slug
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(`agendacan_public_biz_${cleanTarget}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.businessId && parsed.config) {
          return {
            businessId: parsed.businessId,
            config: parsed.config,
            services: parsed.services || parsed.config.services || [],
            appointments: parsed.appointments || []
          };
        }
      }
    } catch {}
  }

  // 5. Check active salon configuration in local storage IF AND ONLY IF the ID or slug strictly matches
  try {
    const localRaw = typeof window !== 'undefined' ? localStorage.getItem('agendacan_salon_config_v2') : null;
    if (localRaw) {
      const localCfg: SalonConfig = JSON.parse(localRaw);
      const cleanCompare = cleanTarget.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idClean = (localCfg.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const slugClean = (extractSlugOnly(localCfg.bookingSlug) || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      // Strict match only — NEVER match if ID is different!
      if (idClean && (idClean === cleanCompare || slugClean === cleanCompare)) {
        return {
          businessId: localCfg.id || cleanTarget,
          config: localCfg,
          services: (localCfg.services || []).filter((s) => s.active !== false),
          appointments: []
        };
      }
    }
  } catch (e) {
    console.warn('Local storage check failed:', e);
  }

  // 6. Zero demo fallback: If not found, return null so the proper Spanish error is displayed
  return null;
}

export async function syncBusinessToServer(
  businessId: string,
  config: SalonConfig,
  pets?: Pet[],
  appointments?: Appointment[],
  bookedRetentions?: string[]
): Promise<boolean> {
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
    return res.ok;
  } catch (err) {
    console.warn('Could not sync business to server:', err);
    return false;
  }
}

export async function createPublicAppointment(
  businessIdOrSlug: string,
  appointment: Appointment,
  petData?: Partial<Pet>
): Promise<boolean> {
  // Always mark appointment as public booking request pending confirmation
  const appointmentToSave: Appointment = {
    ...appointment,
    status: 'pendiente',
    statusLabel: 'POR CONFIRMAR'
  };

  // 1. Store in local browser cache for public appointments
  if (typeof window !== 'undefined') {
    try {
      const key = `agendacan_public_apts_${businessIdOrSlug}`;
      const existingRaw = localStorage.getItem(key);
      const existing: Appointment[] = existingRaw ? JSON.parse(existingRaw) : [];
      existing.unshift(appointmentToSave);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch {}
  }

  // 2. Persist to backend server API
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment: appointmentToSave,
        petData
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not post appointment to server:', err);
    return false;
  }
}
