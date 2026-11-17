import { AppLanguage, LANGUAGE_OPTIONS, Translations } from './types';
import { esLA } from './esLA';
import { esES } from './esES';
import { en } from './en';
import { pt } from './pt';

export type { AppLanguage, LanguageOption, Translations } from './types';

export const TRANSLATIONS: Record<AppLanguage, Translations> = {
  'es-LA': esLA,
  'es-ES': esES,
  'en': en,
  'pt': pt
};

const STORAGE_LANG_KEY = 'agendacan_language';
const STORAGE_LANG_KEY_V2 = 'agendacan_language_v2';

export function isValidAppLanguage(val?: string | null): val is AppLanguage {
  return val === 'es-LA' || val === 'es-ES' || val === 'en' || val === 'pt';
}

export function resolveAppLanguage(val?: string | null, fallback: AppLanguage = 'es-LA'): AppLanguage {
  if (isValidAppLanguage(val)) return val;
  return fallback;
}

export function loadSavedLanguage(): AppLanguage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedV2 = window.localStorage.getItem(STORAGE_LANG_KEY_V2);
      if (isValidAppLanguage(savedV2)) return savedV2;
      const saved = window.localStorage.getItem(STORAGE_LANG_KEY);
      if (isValidAppLanguage(saved)) return saved;
    }
  } catch {
    // ignore storage access issues
  }
  return 'es-LA';
}

export function saveAppLanguage(lang: AppLanguage): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_LANG_KEY, lang);
      window.localStorage.setItem(STORAGE_LANG_KEY_V2, lang);
    }
  } catch {
    // ignore storage access issues
  }
}

export function getTranslations(lang: AppLanguage): Translations {
  return TRANSLATIONS[lang] || TRANSLATIONS['es-LA'];
}

export function getLocaleForLanguage(lang: AppLanguage): string {
  switch (lang) {
    case 'es-ES':
      return 'es-ES';
    case 'en':
      return 'en-US';
    case 'pt':
      return 'pt-BR';
    case 'es-LA':
    default:
      return 'es-419';
  }
}

export function getLanguageOption(lang: AppLanguage) {
  return LANGUAGE_OPTIONS.find((opt) => opt.code === lang) || LANGUAGE_OPTIONS[0];
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0, ene: 0,
  febrero: 1, feb: 1,
  marzo: 2, mar: 2,
  abril: 3, abr: 3,
  mayo: 4, may: 4,
  junio: 5, jun: 5,
  julio: 6, jul: 6,
  agosto: 7, ago: 7,
  septiembre: 8, setiembre: 8, sep: 8, sept: 8,
  octubre: 9, oct: 9,
  noviembre: 10, nov: 10,
  diciembre: 11, dic: 11
};

/**
 * Parses ISO dates ("2026-11-16"), Date objects, or Spanish formatted dates ("16 de noviembre de 2026")
 */
export function parseAnyDateString(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Spanish "16 de noviembre de 2026" or "16 de nov"
  const esMatch = /^(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+(?:de\s+)?(\d{4}))?/i.exec(trimmed);
  if (esMatch) {
    const day = Number(esMatch[1]);
    const monthWord = esMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = SPANISH_MONTHS[monthWord];
    const year = esMatch[3] ? Number(esMatch[3]) : new Date().getFullYear();
    if (month !== undefined) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDisplayDate(dateInput: Date | string | undefined, lang: AppLanguage, includeYear = true): string {
  if (!dateInput) return '';
  const dateObj = dateInput instanceof Date ? dateInput : parseAnyDateString(dateInput);
  if (!dateObj) return typeof dateInput === 'string' ? dateInput : '';
  const locale = getLocaleForLanguage(lang);
  try {
    return dateObj.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      ...(includeYear ? { year: 'numeric' } : {})
    });
  } catch {
    return dateObj.toDateString();
  }
}

export function formatShortDisplayDate(dateInput: Date | string | undefined, lang: AppLanguage): string {
  if (!dateInput) return '';
  const dateObj = dateInput instanceof Date ? dateInput : parseAnyDateString(dateInput);
  if (!dateObj) return typeof dateInput === 'string' ? dateInput : '';
  const locale = getLocaleForLanguage(lang);
  try {
    return dateObj.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateObj.toDateString();
  }
}

export function getWeekdayShortNames(lang: AppLanguage, startMonday = true): string[] {
  const monToSun: Record<AppLanguage, string[]> = {
    'es-LA': ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'],
    'es-ES': ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'],
    'en': ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    'pt': ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
  };
  const arr = monToSun[lang] || monToSun['es-LA'];
  if (startMonday) return arr;
  return [arr[6], ...arr.slice(0, 6)];
}

export function getDayLetters(lang: AppLanguage): Record<string, string> {
  if (lang === 'en') {
    return { L: 'M', M: 'T', X: 'W', J: 'T', V: 'F', S: 'S', D: 'S' };
  }
  if (lang === 'pt') {
    return { L: 'S', M: 'T', X: 'Q', J: 'Q', V: 'S', S: 'S', D: 'D' };
  }
  return { L: 'L', M: 'M', X: 'X', J: 'J', V: 'V', S: 'S', D: 'D' };
}

export function getDayFullNames(lang: AppLanguage): Record<string, string> {
  if (lang === 'en') {
    return { L: 'Mon', M: 'Tue', X: 'Wed', J: 'Thu', V: 'Fri', S: 'Sat', D: 'Sun' };
  }
  if (lang === 'pt') {
    return { L: 'Seg', M: 'Ter', X: 'Qua', J: 'Qui', V: 'Sex', S: 'Sáb', D: 'Dom' };
  }
  return { L: 'Lun', M: 'Mar', X: 'Mié', J: 'Jue', V: 'Vie', S: 'Sáb', D: 'Dom' };
}

export function translateStatusLabel(status: string | undefined, lang: AppLanguage): string {
  const t = getTranslations(lang).statuses;
  const s = (status || '').toLowerCase().trim();
  switch (s) {
    case 'pendiente':
    case 'pendiente_confirmacion':
    case 'por_confirmar':
      return t.pendingConfirm;
    case 'confirmada':
    case 'confirmed':
      return t.confirmed;
    case 'en_salon':
      return t.inSalon;
    case 'en_corte':
      return t.inGrooming;
    case 'por_retirar':
      return t.readyPickup;
    case 'completado':
    case 'completada':
    case 'entregado':
      return t.completed;
    case 'cancelada':
    case 'cancelado':
      return t.cancelled;
    default:
      return (status || '').toUpperCase();
  }
}

export function translateMoodLabel(mood: string | undefined, lang: AppLanguage): string {
  const t = getTranslations(lang).statuses;
  const m = (mood || 'tranquilo').toLowerCase().trim();
  if (m === 'inquieto') return t.moodRestless;
  if (m === 'dificil' || m === 'difícil') return t.moodDifficult;
  return t.moodCalm;
}

export function translateSizeLabel(size: string | undefined, lang: AppLanguage): string {
  const c = getTranslations(lang).common;
  const s = (size || 'mediano').toLowerCase().trim();
  if (s === 'pequeno' || s === 'pequeño' || s === 'small') return c.small;
  if (s === 'grande' || s === 'large') return c.large;
  if (s === 'extragrande' || s === 'extra_grande' || s === 'extra grande' || s === 'extraLarge') return c.extraLarge;
  return c.medium;
}

export function translateGenderLabel(gender: string | undefined, lang: AppLanguage): string {
  const c = getTranslations(lang).common;
  if ((gender || '').toLowerCase() === 'hembra' || (gender || '').toLowerCase() === 'female' || (gender || '').toLowerCase() === 'fêmea') {
    return c.female;
  }
  return c.male;
}

export function translatePaymentStatus(status: string | undefined, lang: AppLanguage): string {
  const s = getTranslations(lang).statuses;
  if (status === 'cobrado') return s.paid;
  if (status === 'en_proceso') return s.inProgress;
  return s.toCollect;
}

export function translatePaymentMethod(method: string | undefined, lang: AppLanguage): string {
  const s = getTranslations(lang).statuses;
  switch (method) {
    case 'efectivo':
      return s.cash;
    case 'transferencia':
      return s.transfer;
    case 'tarjeta':
      return s.card;
    default:
      return s.otherMethod;
  }
}

export function translateCareTag(tag: string, lang: AppLanguage): string {
  if (lang === 'es-LA') return tag;
  const map: Record<string, Record<Exclude<AppLanguage, 'es-LA'>, string>> = {
    'Cepillar cada 3 días': {
      'es-ES': 'Cepillar cada 3 días',
      'en': 'Brush every 3 days',
      'pt': 'Escovar a cada 3 dias'
    },
    'Cuidar zona de oídos': {
      'es-ES': 'Cuidar la zona de los oídos',
      'en': 'Care around ears area',
      'pt': 'Cuidar da região das orelhas'
    },
    'Usar champú hipoalergénico': {
      'es-ES': 'Usar champú hipoalergénico',
      'en': 'Use hypoallergenic shampoo',
      'pt': 'Usar shampoo hipoalergênico'
    },
    'Desenredar patas y cola': {
      'es-ES': 'Desenredar patas y cola',
      'en': 'Detangle paws & tail',
      'pt': 'Desembaraçar patas e cauda'
    },
    'Mantener piel seca': {
      'es-ES': 'Mantener la piel seca',
      'en': 'Keep skin dry',
      'pt': 'Manter a pele seca'
    }
  };
  return map[tag]?.[lang] || tag;
}

export function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    return acc.split(`{${key}}`).join(String(value));
  }, template);
}

export function getAuthErrorMessage(err: any, lang: AppLanguage): string {
  const t = getTranslations(lang).auth;
  const code = err?.code || '';
  const msg = String(err?.message || '').toLowerCase();

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return t.errGoogleCanceled;
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return t.errInvalidCredentials;
  }
  if (code === 'auth/email-already-in-use') {
    return t.errEmailInUse;
  }
  if (code === 'auth/invalid-email') {
    return t.errInvalidEmail;
  }
  if (code === 'auth/weak-password') {
    return t.errPasswordLength;
  }
  if (code === 'auth/too-many-requests') {
    return t.errTooManyRequests;
  }
  if (code === 'auth/network-request-failed' || msg.includes('network')) {
    return t.errNetwork;
  }
  if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed') {
    return t.errGoogleGeneric;
  }
  return t.errAccountCreation;
}
