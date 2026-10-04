import { SalonConfig, SalonService, Appointment, Pet } from '../types';

export interface PublicBusinessResult {
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
}

export async function fetchBusinessProfile(idOrSlug: string): Promise<PublicBusinessResult | null> {
  if (!idOrSlug) return null;

  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(idOrSlug)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.businessId && data.config) {
        return {
          businessId: data.businessId,
          config: data.config,
          services: data.services || data.config.services || [],
          appointments: data.appointments || []
        };
      }
    }
  } catch (err) {
    console.warn('Network error fetching from server, checking local fallback:', err);
  }

  // Fallback: Check local storage (in case running offline or before server sync)
  try {
    const localRaw = typeof window !== 'undefined' ? localStorage.getItem('agendacan_salon_config_v2') : null;
    if (localRaw) {
      const localCfg: SalonConfig = JSON.parse(localRaw);
      const cleanTarget = idOrSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
      const slugClean = (localCfg.bookingSlug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const idClean = (localCfg.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const nameClean = (localCfg.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (
        idClean === cleanTarget ||
        slugClean === cleanTarget ||
        cleanTarget.endsWith(slugClean) ||
        nameClean === cleanTarget ||
        cleanTarget.includes(nameClean)
      ) {
        return {
          businessId: localCfg.id || 'biz_main',
          config: localCfg,
          services: (localCfg.services || []).filter((s) => s.active !== false),
          appointments: []
        };
      }
    }
  } catch (e) {
    console.warn('Local storage check failed:', e);
  }

  // NEVER silently return demo data or another business!
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
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessIdOrSlug)}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment,
        petData
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not post appointment to server:', err);
    return false;
  }
}
