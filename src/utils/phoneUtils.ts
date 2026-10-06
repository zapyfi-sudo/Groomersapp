import { SalonConfig } from '../types';
import { COUNTRIES } from './countries';

/**
 * Normalizes any phone number into clean international format for WhatsApp (wa.me/NUMBER).
 * Ensures:
 * 1. Correct country calling code (e.g. 593 for Ecuador, 54 for Argentina, 52 for Mexico, etc.)
 * 2. Never duplicates country calling code if already present.
 * 3. Removes local leading zeroes (e.g. 0991234567 -> 593991234567).
 * 4. Handles Argentina mobile '9' prefix (54 9 11 ... -> 54911...).
 * 5. Returns pure digits ready for https://wa.me/DIGITS.
 */
export function normalizePhoneForWhatsApp(
  rawPhone: string,
  salonConfig?: SalonConfig
): string {
  if (!rawPhone) return '';

  // 1. Keep only digits
  const cleaned = rawPhone.replace(/[^\d]/g, '');
  if (!cleaned) return '';

  // 2. Identify business country calling code digits
  let defaultCountryPrefix = '54'; // default fallback

  if (salonConfig?.phonePrefix) {
    const prefixDigits = salonConfig.phonePrefix.replace(/[^\d]/g, '');
    if (prefixDigits) defaultCountryPrefix = prefixDigits;
  } else if (salonConfig?.country) {
    const matched = COUNTRIES.find(
      (c) =>
        c.code.toLowerCase() === salonConfig.country?.toLowerCase() ||
        c.name.toLowerCase() === salonConfig.country?.toLowerCase()
    );
    if (matched) {
      defaultCountryPrefix = matched.callingCode.replace(/[^\d]/g, '');
    }
  }

  // 3. If rawPhone started with '+', assume the user already typed an international number
  if (rawPhone.trim().startsWith('+')) {
    // If it's Argentina and missing mobile '9'
    if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
      return `549${cleaned.slice(2)}`;
    }
    return cleaned;
  }

  // 4. Special check for Ecuador (593):
  if (defaultCountryPrefix === '593') {
    // If user already wrote 593991234567
    if (cleaned.startsWith('593') && cleaned.length >= 11) {
      return cleaned;
    }
    // If user wrote 0991234567 -> strip leading 0 -> 991234567 -> add 593
    const withoutZero = cleaned.replace(/^0+/, '');
    return `593${withoutZero}`;
  }

  // 5. Special check for Argentina (54):
  if (defaultCountryPrefix === '54') {
    // If starts with 54
    if (cleaned.startsWith('54')) {
      if (cleaned.startsWith('549')) return cleaned;
      const rest = cleaned.slice(2).replace(/^0+/, '');
      return `549${rest}`;
    }
    let local = cleaned.replace(/^0+/, '');
    if (local.startsWith('9') && local.length >= 11) {
      return `54${local}`;
    }
    return `549${local}`;
  }

  // 6. General rule for other countries (e.g. Mexico 52, Spain 34, Chile 56, Colombia 57, Peru 51, etc.):
  if (cleaned.startsWith(defaultCountryPrefix) && cleaned.length > defaultCountryPrefix.length + 6) {
    // Already has country code
    return cleaned;
  }

  // Strip local trunk prefix (leading 0) and prepend country prefix
  const withoutZero = cleaned.replace(/^0+/, '');
  return `${defaultCountryPrefix}${withoutZero}`;
}

/**
 * Builds a standardized, personalized WhatsApp confirmation URL
 */
export function buildWhatsAppConfirmationUrl(
  appointment: {
    petName: string;
    tutorName: string;
    serviceName: string;
    date?: string;
    time: string;
    tutorPhone?: string;
  },
  salonConfig: SalonConfig
): string {
  const normalizedPhone = normalizePhoneForWhatsApp(appointment.tutorPhone || '', salonConfig);
  const salonName = salonConfig?.name || 'la peluquería';
  const petName = appointment.petName || 'tu mascota';
  const serviceName = appointment.serviceName || 'el servicio solicitado';
  const dateStr = appointment.date || 'la fecha acordada';
  const timeStr = appointment.time || '';

  const message = `¡Hola ${appointment.tutorName}! Te confirmamos la cita de ${petName} para ${serviceName} el día ${dateStr} a las ${timeStr} en ${salonName}. ¡Muchas gracias por agendar con nosotros!`;

  if (!normalizedPhone) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Safely opens a WhatsApp URL in a new window/tab without navigating away
 */
export function openWhatsAppUrl(url: string): void {
  if (typeof window === 'undefined') return;

  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {}
  }, 300);
}
