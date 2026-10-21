import { Pet, Appointment, Visit } from '../types';
import { parseSpanishOrIsoDate } from './storage';
import { AppLanguage } from './translations';

/**
 * Parses time string like "09:00 AM", "11:00 AM", "13:30 PM", "15:30 PM", "17:00 PM", "14:30", "09:00 hs"
 * into numerical hours (0-23) and minutes (0-59).
 */
export function parseTimeString(timeStr?: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toLowerCase();

  // Match "HH:MM", "HH:MM AM/PM", "HH:MM hs"
  const match = clean.match(/(\d{1,2})[:.](\d{2})(?:\s*(am|pm|hs))?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3]?.toLowerCase();

    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }

    return { hours, minutes };
  }

  // Match single hour format "9 AM", "14 hs", "10"
  const singleMatch = clean.match(/^(\d{1,2})\s*(am|pm|hs)?$/i);
  if (singleMatch) {
    let hours = parseInt(singleMatch[1], 10);
    const meridian = singleMatch[2]?.toLowerCase();
    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }
    return { hours, minutes: 0 };
  }

  return null;
}

export interface PetAttentionRecord {
  dateObj: Date | null;
  timestamp: number;
}

/**
 * Extracts normalized attention date and millisecond timestamp for an appointment.
 */
export function getAppointmentAttentionRecord(apt: Appointment): PetAttentionRecord | null {
  let dateObj: Date | null = null;

  if (apt.date) {
    const dLower = apt.date.trim().toLowerCase();
    if (dLower === 'hoy' || dLower.startsWith('hoy')) {
      dateObj = new Date();
    } else if (dLower === 'ayer' || dLower.startsWith('ayer')) {
      dateObj = new Date(Date.now() - 86400000);
    } else {
      dateObj = parseSpanishOrIsoDate(apt.date);
    }
  }

  // Fallback to serviceStartedAt or createdAt if date string parsing yields nothing
  if (!dateObj && apt.serviceStartedAt) {
    const s = new Date(apt.serviceStartedAt);
    if (!isNaN(s.getTime())) dateObj = s;
  }
  if (!dateObj && apt.createdAt) {
    const c = new Date(apt.createdAt);
    if (!isNaN(c.getTime())) dateObj = c;
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return null;
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();

  const timeParsed = parseTimeString(apt.time);
  let hours = timeParsed ? timeParsed.hours : 12;
  let minutes = timeParsed ? timeParsed.minutes : 0;
  let seconds = 0;

  if (!timeParsed && apt.serviceStartedAt) {
    const s = new Date(apt.serviceStartedAt);
    if (!isNaN(s.getTime())) {
      hours = s.getHours();
      minutes = s.getMinutes();
      seconds = s.getSeconds();
    }
  } else if (!timeParsed && apt.createdAt) {
    const c = new Date(apt.createdAt);
    if (!isNaN(c.getTime())) {
      hours = c.getHours();
      minutes = c.getMinutes();
      seconds = c.getSeconds();
    }
  } else if (apt.createdAt) {
    const c = new Date(apt.createdAt);
    if (!isNaN(c.getTime())) {
      seconds = c.getSeconds();
    }
  }

  const finalDate = new Date(year, month, day, hours, minutes, seconds);
  return {
    dateObj: new Date(year, month, day),
    timestamp: finalDate.getTime()
  };
}

/**
 * Extracts normalized attention date and millisecond timestamp for a visit.
 */
export function getVisitAttentionRecord(visit?: Visit): PetAttentionRecord | null {
  if (!visit || !visit.date) return null;
  const dLower = visit.date.trim().toLowerCase();
  let dateObj: Date | null = null;

  if (dLower === 'hoy' || dLower.startsWith('hoy')) {
    dateObj = new Date();
  } else if (dLower === 'ayer' || dLower.startsWith('ayer')) {
    dateObj = new Date(Date.now() - 86400000);
  } else {
    dateObj = parseSpanishOrIsoDate(visit.date);
  }

  if (!dateObj || isNaN(dateObj.getTime())) return null;

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();

  const timeParsed = parseTimeString(visit.deliveryTime);
  const hours = timeParsed ? timeParsed.hours : 12;
  const minutes = timeParsed ? timeParsed.minutes : 0;

  const finalDate = new Date(year, month, day, hours, minutes);
  return {
    dateObj: new Date(year, month, day),
    timestamp: finalDate.getTime()
  };
}

/**
 * Legacy helper for backwards compatibility.
 */
export function getAppointmentTimestamp(apt: Appointment): number {
  const rec = getAppointmentAttentionRecord(apt);
  return rec ? rec.timestamp : 0;
}

/**
 * Legacy helper for backwards compatibility.
 */
export function getVisitTimestamp(visit?: Visit): number {
  const rec = getVisitAttentionRecord(visit);
  return rec ? rec.timestamp : 0;
}

/**
 * Checks whether an appointment belongs to a given pet.
 */
export function isAppointmentForPet(apt: Appointment, pet: Pet): boolean {
  const cleanAptPetId = (apt.petId || '').replace('#', '').trim().toLowerCase();
  const cleanPetId = (pet.id || '').replace('#', '').trim().toLowerCase();

  if (cleanAptPetId && cleanPetId && cleanAptPetId === cleanPetId) {
    return true;
  }

  const cleanAptPetName = (apt.petName || '').trim().toLowerCase();
  const cleanPetName = (pet.name || '').trim().toLowerCase();

  if (!cleanAptPetName || !cleanPetName || cleanAptPetName !== cleanPetName) {
    return false;
  }

  const cleanAptTutor = (apt.tutorName || '').trim().toLowerCase();
  const cleanPetTutor = (pet.tutor?.name || '').trim().toLowerCase();
  const cleanAptPhone = (apt.tutorPhone || '').replace(/\D/g, '');
  const cleanPetPhone = (pet.tutor?.phone || pet.tutor?.rawPhone || '').replace(/\D/g, '');

  if (cleanAptTutor && cleanPetTutor && cleanAptTutor === cleanPetTutor) {
    return true;
  }
  if (cleanAptPhone && cleanPetPhone && cleanAptPhone === cleanPetPhone) {
    return true;
  }

  return true;
}

/**
 * Finds the latest attention record (date and timestamp) for a pet across:
 * 1. Appointments in Agenda (most recent scheduled, in-service, or completed date/time).
 * 2. Pet's lastVisit record.
 * 3. Pet's visitHistory records.
 */
export function getLatestPetAttentionRecord(pet: Pet, appointments?: Appointment[]): PetAttentionRecord {
  let bestRecord: PetAttentionRecord = {
    dateObj: null,
    timestamp: 0
  };

  // 1. Check all matching appointments
  if (Array.isArray(appointments)) {
    for (const apt of appointments) {
      if (isAppointmentForPet(apt, pet)) {
        const rec = getAppointmentAttentionRecord(apt);
        if (rec && rec.timestamp > bestRecord.timestamp) {
          bestRecord = rec;
        }
      }
    }
  }

  // 2. Check pet.lastVisit
  if (pet.lastVisit) {
    const rec = getVisitAttentionRecord(pet.lastVisit);
    if (rec && rec.timestamp > bestRecord.timestamp) {
      bestRecord = rec;
    }
  }

  // 3. Check pet.visitHistory
  if (Array.isArray(pet.visitHistory)) {
    for (const v of pet.visitHistory) {
      const rec = getVisitAttentionRecord(v);
      if (rec && rec.timestamp > bestRecord.timestamp) {
        bestRecord = rec;
      }
    }
  }

  return bestRecord;
}

/**
 * Legacy helper: finds the latest appointment or visit timestamp for a pet.
 */
export function getLatestPetAttentionTimestamp(pet: Pet, appointments?: Appointment[]): number {
  return getLatestPetAttentionRecord(pet, appointments).timestamp;
}

/**
 * Formats a date string respecting the app's configured language.
 * Default in Spanish: "20 de octubre de 2026".
 */
export function formatDateByLanguage(date: Date, lang?: AppLanguage): string {
  const localeMap: Record<string, string> = {
    'es-LA': 'es-419',
    'es-ES': 'es-ES',
    'en': 'en-US',
    'pt': 'pt-BR'
  };
  const locale = (lang && localeMap[lang]) || 'es-ES';
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export interface PetDateGroup {
  dateKey: string; // YYYY-MM-DD or 'no-date'
  formattedDate: string; // e.g. "20 de octubre de 2026"
  dateObj: Date | null;
  dayTimestamp: number;
  pets: Pet[];
}

/**
 * Automatically groups and sorts pets for the "Clientes" directory:
 * - Grouped by the date of their service/attention.
 * - Groups sorted descending by date (newest date first, then older days).
 * - Within each date group, pets sorted from most recent attention time to oldest.
 * - Single pet profile preserved (no duplicates; placed under their latest attention date).
 * - Pets without valid appointment dates are preserved at the end under a fallback group.
 */
export function groupAndSortPetsByDate(
  pets: Pet[],
  appointments?: Appointment[],
  lang?: AppLanguage
): PetDateGroup[] {
  if (!Array.isArray(pets) || pets.length === 0) {
    return [];
  }

  // 1. Ensure unique pet profiles (prevent duplicate cards)
  const uniquePets: Pet[] = [];
  const seenIds = new Set<string>();

  for (const p of pets) {
    if (!p) continue;
    const cleanKey = (p.id || '').replace('#', '').trim().toLowerCase() || p.name.trim().toLowerCase();
    if (!seenIds.has(cleanKey)) {
      seenIds.add(cleanKey);
      uniquePets.push(p);
    }
  }

  // 2. Pre-calculate attention record for each pet
  const petRecordMap = new Map<string, PetAttentionRecord>();
  for (const pet of uniquePets) {
    const rec = getLatestPetAttentionRecord(pet, appointments);
    petRecordMap.set(pet.id, rec);
  }

  // 3. Group pets by their calendar dateKey
  const groupsMap = new Map<string, PetDateGroup>();

  for (const pet of uniquePets) {
    const rec = petRecordMap.get(pet.id)!;
    let dateKey = 'no-date';
    let formattedDate = 'Otras mascotas registradas';
    let dayTimestamp = 0;

    if (lang === 'en') {
      formattedDate = 'Other registered pets';
    } else if (lang === 'pt') {
      formattedDate = 'Outros pets registrados';
    }

    if (rec.dateObj && rec.timestamp > 0) {
      const y = rec.dateObj.getFullYear();
      const m = String(rec.dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(rec.dateObj.getDate()).padStart(2, '0');
      dateKey = `${y}-${m}-${d}`;
      formattedDate = formatDateByLanguage(rec.dateObj, lang);
      dayTimestamp = rec.dateObj.getTime();
    }

    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, {
        dateKey,
        formattedDate,
        dateObj: rec.dateObj,
        dayTimestamp,
        pets: []
      });
    }

    groupsMap.get(dateKey)!.pets.push(pet);
  }

  // 4. Sort pets inside each group by attention timestamp descending
  // (most recent time first within the same day)
  for (const group of groupsMap.values()) {
    group.pets.sort((a, b) => {
      const recA = petRecordMap.get(a.id);
      const recB = petRecordMap.get(b.id);
      const tsA = recA?.timestamp || 0;
      const tsB = recB?.timestamp || 0;

      if (tsB !== tsA) {
        return tsB - tsA; // Most recent attention time first
      }

      // Stable secondary tie-breaker: pet name, then ID
      const nameCompare = (a.name || '').localeCompare(b.name || '');
      if (nameCompare !== 0) return nameCompare;
      return (a.id || '').localeCompare(b.id || '');
    });
  }

  // 5. Sort groups descending by date: newest day first, 'no-date' group at the end
  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.dateKey === 'no-date') return 1;
    if (b.dateKey === 'no-date') return -1;
    return b.dayTimestamp - a.dayTimestamp;
  });

  return sortedGroups;
}

/**
 * Automatically sorts pets for the "Clientes" directory by their most recent agenda/attention date & time.
 * Reuses groupAndSortPetsByDate to guarantee 100% consistent ordering.
 */
export function sortPetsByAgendaDate(pets: Pet[], appointments?: Appointment[]): Pet[] {
  const groups = groupAndSortPetsByDate(pets, appointments);
  const result: Pet[] = [];
  for (const g of groups) {
    result.push(...g.pets);
  }
  return result;
}
