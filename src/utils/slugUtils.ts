import { SalonConfig, SalonService, ServicePricingBySize } from '../types';

/**
 * Normalizes Spanish text safely into a URL-friendly slug.
 * Example: "Peluquería Canina Niño Feliz" -> "peluqueria-canina-nino-feliz"
 */
export function slugify(text?: string): string {
  if (!text) return 'salon';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accent diacritics (á -> a, ñ -> n)
    .replace(/ñ/g, 'n')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric except space and hyphen
    .replace(/\s+/g, '-') // Replace spaces with hyphen
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens
}

/**
 * Generates a collision-safe, permanent business ID.
 * Example: "robocat_k9x2m4"
 */
export function generateStableBusinessId(name?: string): string {
  const base = slugify(name || 'salon').slice(0, 16) || 'salon';
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${base}_${randomSuffix}`;
}

export interface CompactPublicPayload {
  bid: string;
  slug?: string;
  name: string;
  logo?: string;
  addr?: string;
  phone?: string;
  pref?: string;
  cur?: string;
  days?: string[];
  wdDesc?: string;
  open?: string;
  close?: string;
  mOpen?: string;
  mClose?: string;
  aOpen?: string;
  aClose?: string;
  cap?: number;
  srv: {
    id: string;
    name: string;
    durationMin: number;
    price: number;
    pricingType?: 'unico' | 'tamano';
    priceBySize?: ServicePricingBySize;
    desc?: string;
    badge?: string;
    active: boolean;
  }[];
  meds?: {
    id: string;
    name: string;
    type?: string;
    purpose?: string;
    price: number;
    active: boolean;
  }[];
  medFee?: number;
}

/**
 * Encodes public business information into a compact, URL-safe base64 token.
 * This guarantees 100% cross-device, cross-browser, incognito availability
 * with ZERO dependence on external servers or local cookies.
 */
export function encodePublicProfileToken(
  businessId: string,
  config: SalonConfig,
  services?: SalonService[]
): string {
  try {
    const activeServices = (services || config.services || [])
      .filter((s) => s.active !== false)
      .map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        price: s.price,
        pricingType: s.pricingType,
        priceBySize: s.priceBySize,
        desc: s.desc,
        badge: s.badge,
        active: true
      }));

    const activeMeds = (config.medicationProducts || [])
      .filter((m) => m.active !== false)
      .map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        purpose: m.purpose,
        price: m.price,
        active: true
      }));

    const payload: CompactPublicPayload = {
      bid: businessId,
      slug: config.bookingSlug ? slugify(config.bookingSlug) : slugify(config.name),
      name: config.name || 'Peluquería Canina',
      logo: config.logoUrl,
      addr: config.address,
      phone: config.phone,
      pref: config.phonePrefix || '+593',
      cur: config.currency || 'USD',
      days: config.activeDays || ['L', 'M', 'X', 'J', 'V', 'S'],
      wdDesc: config.workingDays || 'Lunes a Sábado',
      open: config.openTime || '08:00',
      close: config.closeTime || '19:00',
      mOpen: config.morningOpen,
      mClose: config.morningClose,
      aOpen: config.afternoonOpen,
      aClose: config.afternoonClose,
      cap: config.simultaneousCapacity || 2,
      srv: activeServices,
      meds: activeMeds,
      medFee: config.medicationFee || 0
    };

    const jsonStr = JSON.stringify(payload);
    // URL-safe base64 encoding (works in all browsers & Node)
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return base64;
  } catch (err) {
    console.warn('Could not encode public profile token:', err);
    return '';
  }
}

/**
 * Decodes a public profile token from the URL.
 */
export function decodePublicProfileToken(token: string): {
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
} | null {
  if (!token || typeof token !== 'string') return null;

  try {
    // Restore standard base64 from URL-safe
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const jsonStr = decodeURIComponent(escape(atob(base64)));
    const p: CompactPublicPayload = JSON.parse(jsonStr);

    if (!p || !p.bid || !p.name) {
      return null;
    }

    const reconstructedConfig: SalonConfig = {
      id: p.bid,
      name: p.name,
      logoUrl: p.logo || '',
      address: p.addr || '',
      phone: p.phone || '',
      phonePrefix: p.pref || '+593',
      currency: p.cur || 'USD',
      workingDays: p.wdDesc || 'Lunes a Sábado',
      activeDays: p.days || ['L', 'M', 'X', 'J', 'V', 'S'],
      openTime: p.open || '08:00',
      closeTime: p.close || '19:00',
      morningOpen: p.mOpen || '08:00',
      morningClose: p.mClose || '12:30',
      afternoonOpen: p.aOpen || '14:00',
      afternoonClose: p.aClose || '19:00',
      hasDoubleShift: Boolean(p.mOpen && p.aOpen),
      simultaneousCapacity: p.cap || 2,
      bookingSlug: p.slug || slugify(p.name),
      services: (p.srv || []).map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        price: s.price,
        pricingType: s.pricingType || 'unico',
        priceBySize: s.priceBySize,
        desc: s.desc,
        badge: s.badge,
        active: true
      })),
      medicationProducts: (p.meds || []).map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type || 'Gotas',
        purpose: m.purpose || '',
        price: m.price,
        active: true
      })),
      medicationFee: p.medFee || 0,
      hasMedicationProductsEnabled: (p.meds && p.meds.length > 0) || false,
      reviews: []
    };

    return {
      businessId: p.bid,
      config: reconstructedConfig,
      services: reconstructedConfig.services
    };
  } catch (err) {
    console.warn('Failed to decode public profile token:', err);
    return null;
  }
}

/**
 * Builds the complete public booking link with dual resolution:
 * 1. Clean route (/reservas/:slug?businessId=:id)
 * 2. Embedded payload token (&p=:token) for 100% cross-device guarantee
 */
export function buildPublicBookingUrl(
  origin: string,
  businessId: string,
  slug?: string,
  config?: SalonConfig
): string {
  const safeSlug = slug ? slugify(slug) : (config ? slugify(config.name) : 'reservas');
  const token = config ? encodePublicProfileToken(businessId, config) : '';

  // Clean base origin (strip trailing slash)
  const base = origin.replace(/\/+$/, '');
  
  const tokenParam = token ? `&p=${encodeURIComponent(token)}` : '';
  return `${base}/reservas/${safeSlug}?businessId=${encodeURIComponent(businessId)}${tokenParam}`;
}
