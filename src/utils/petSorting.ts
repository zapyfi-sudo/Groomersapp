import { Pet, Appointment, Visit } from '../types';
import { parseSpanishOrIsoDate } from './storage';

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

/**
 * Calculates a millisecond timestamp for an appointment based on its actual date and time.
 */
export function getAppointmentTimestamp(apt: Appointment): number {
  let dateObj: Date | null = null;

  if (apt.date) {
    const dLower = apt.date.trim().toLowerCase();
    if (dLower === 'hoy' || dLower.startsWith('hoy')) {
      dateObj = new Date();
    } else {
      dateObj = parseSpanishOrIsoDate(apt.date);
    }
  }

  // Fallback to createdAt or serviceStartedAt if date string parsing yields nothing
  if (!dateObj && apt.createdAt) {
    const c = new Date(apt.createdAt);
    if (!isNaN(c.getTime())) dateObj = c;
  }
  if (!dateObj && apt.serviceStartedAt) {
    const s = new Date(apt.serviceStartedAt);
    if (!isNaN(s.getTime())) dateObj = s;
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return 0;
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();

  const timeParsed = parseTimeString(apt.time);
  const hours = timeParsed ? timeParsed.hours : 12;
  const minutes = timeParsed ? timeParsed.minutes : 0;
  let seconds = 0;

  // Preserve registration order tie-breaker via createdAt seconds if available
  if (apt.createdAt) {
    const c = new Date(apt.createdAt);
    if (!isNaN(c.getTime())) {
      seconds = c.getSeconds();
    }
  }

  return new Date(year, month, day, hours, minutes, seconds).getTime();
}

/**
 * Calculates a millisecond timestamp for a recorded visit.
 */
export function getVisitTimestamp(visit?: Visit): number {
  if (!visit || !visit.date) return 0;
  const dLower = visit.date.trim().toLowerCase();
  let dateObj: Date | null = null;

  if (dLower === 'hoy' || dLower.startsWith('hoy')) {
    dateObj = new Date();
  } else {
    dateObj = parseSpanishOrIsoDate(visit.date);
  }

  if (!dateObj || isNaN(dateObj.getTime())) return 0;

  const timeParsed = parseTimeString(visit.deliveryTime);
  const hours = timeParsed ? timeParsed.hours : 12;
  const minutes = timeParsed ? timeParsed.minutes : 0;

  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hours, minutes).getTime();
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
 * Finds the latest appointment or visit timestamp for a pet across:
 * 1. Appointments in Agenda (most recent scheduled, in-service, or completed date/time).
 * 2. Pet's lastVisit record.
 * 3. Pet's visitHistory records.
 */
export function getLatestPetAttentionTimestamp(pet: Pet, appointments?: Appointment[]): number {
  let maxTimestamp = 0;

  // 1. Check all matching appointments
  if (Array.isArray(appointments)) {
    for (const apt of appointments) {
      if (isAppointmentForPet(apt, pet)) {
        const ts = getAppointmentTimestamp(apt);
        if (ts > maxTimestamp) {
          maxTimestamp = ts;
        }
      }
    }
  }

  // 2. Check pet.lastVisit
  if (pet.lastVisit) {
    const ts = getVisitTimestamp(pet.lastVisit);
    if (ts > maxTimestamp) {
      maxTimestamp = ts;
    }
  }

  // 3. Check pet.visitHistory
  if (Array.isArray(pet.visitHistory)) {
    for (const v of pet.visitHistory) {
      const ts = getVisitTimestamp(v);
      if (ts > maxTimestamp) {
        maxTimestamp = ts;
      }
    }
  }

  return maxTimestamp;
}

/**
 * Automatically sorts pets for the "Clientes" directory by their most recent agenda/attention date & time:
 * - Most recent dates first (today at the top, then recent days in descending order).
 * - Within the same day: from most recent appointment time to oldest time.
 * - Previous days follow the same descending order.
 * - Pets with multiple appointments keep their single pet record positioned by their latest appointment.
 * - Pets without valid appointment dates are preserved and placed at the bottom without altering their data.
 */
export function sortPetsByAgendaDate(pets: Pet[], appointments?: Appointment[]): Pet[] {
  if (!Array.isArray(pets) || pets.length === 0) {
    return [];
  }

  // Ensure unique pet cards (prevent any duplicates from appearing)
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

  // Pre-calculate timestamps for fast, stable O(N log N) sorting
  const timestampMap = new Map<string, number>();
  for (const pet of uniquePets) {
    const ts = getLatestPetAttentionTimestamp(pet, appointments);
    timestampMap.set(pet.id, ts);
  }

  return [...uniquePets].sort((a, b) => {
    const tsA = timestampMap.get(a.id) || 0;
    const tsB = timestampMap.get(b.id) || 0;

    // Both have valid dates
    if (tsA > 0 && tsB > 0) {
      if (tsB !== tsA) {
        return tsB - tsA; // Descending: newest date & time first
      }
      return (a.name || '').localeCompare(b.name || '');
    }

    // Only one has a valid date
    if (tsA > 0 && tsB <= 0) return -1;
    if (tsA <= 0 && tsB > 0) return 1;

    // Neither has a valid date: keep stable alphabetical
    return (a.name || '').localeCompare(b.name || '');
  });
}
