import { SalonConfig, Appointment } from '../types';
import { AppLanguage, getTranslations } from './translations';

export interface TimeSlot {
  time: string; // e.g. "09:30"
  available: boolean;
  bookedCount: number;
  reason?: string;
}

/**
 * Normalizes time string ("09:30", "9:30", "09:30 AM", "9:15 am", "3:30 PM", "15:30", "12:00 AM", "12:00 PM")
 * to minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(tStr?: string): number {
  if (!tStr) return 0;
  const clean = tStr.trim().toLowerCase();

  const isPM = clean.includes('pm');
  const isAM = clean.includes('am');

  // Strip non-digits and non-colon
  const timeOnly = clean.replace(/[^\d:]/g, '');
  const [hStr, mStr] = timeOnly.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;

  if (isPM) {
    if (h < 12) h += 12;
  } else if (isAM) {
    if (h === 12) h = 0;
  }

  return Math.min(1439, Math.max(0, h * 60 + m));
}

/**
 * Parses any time string into its 12-hour components:
 * hour12 ('1'..'12'), minute ('00'..'59'), period ('AM' | 'PM').
 */
export function parseTimeParts(raw?: string): { hour12: string; minute: string; period: 'AM' | 'PM' } {
  if (!raw) return { hour12: '9', minute: '00', period: 'AM' };
  const clean = raw.trim();

  // Match 12h format e.g. "9:15 AM", "09:15 AM", "4:30 PM"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    if (h < 1) h = 12;
    if (h > 12) h = 12;
    return {
      hour12: String(h),
      minute: match12[2].padStart(2, '0'),
      period: match12[3].toUpperCase() as 'AM' | 'PM'
    };
  }

  // Match 24h format e.g. "14:00" or "08:30"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h24 = parseInt(match24[1], 10);
    const m = match24[2].padStart(2, '0');
    let period: 'AM' | 'PM' = 'AM';
    let h12 = h24;

    if (h24 === 0) {
      h12 = 12;
      period = 'AM';
    } else if (h24 === 12) {
      h12 = 12;
      period = 'PM';
    } else if (h24 > 12) {
      h12 = h24 - 12;
      period = 'PM';
    }

    return {
      hour12: String(h12),
      minute: m,
      period
    };
  }

  // Fallback default
  return { hour12: '9', minute: '00', period: 'AM' };
}

/**
 * Formats minutes from midnight to standard "HH:MM" (24-hour format).
 */
export function formatMinutesToTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats minutes from midnight to "h:mm AM/PM" (12-hour format).
 */
export function formatMinutesTo12H(totalMins: number): string {
  const h24 = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  let period: 'AM' | 'PM' = 'AM';
  let h12 = h24;

  if (h24 === 0) {
    h12 = 12;
    period = 'AM';
  } else if (h24 === 12) {
    h12 = 12;
    period = 'PM';
  } else if (h24 > 12) {
    h12 = h24 - 12;
    period = 'PM';
  }

  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Converts any time string to 24H string "HH:MM".
 */
export function timeTo24H(raw?: string): string {
  const mins = parseTimeToMinutes(raw);
  return formatMinutesToTime(mins);
}

/**
 * Converts any time string to 12H string "h:mm AM/PM".
 */
export function timeTo12H(raw?: string): string {
  const mins = parseTimeToMinutes(raw);
  return formatMinutesTo12H(mins);
}

/**
 * Parses common Spanish, ISO, or slash-separated date strings into a local calendar key YYYY-MM-DD.
 */
function toCalendarDateKey(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const clean = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean === 'hoy') {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // ISO YYYY-MM-DD (optionally with time)
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t\s].*)?$/i);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // Slash format DD/MM/YYYY or YYYY/MM/DD
  const slashMatch = clean.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/);
  if (slashMatch) {
    if (slashMatch[1].length === 4) {
      return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
    }
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }

  const months: Record<string, string> = {
    enero: '01', ene: '01',
    febrero: '02', feb: '02',
    marzo: '03', mar: '03',
    abril: '04', abr: '04',
    mayo: '05', may: '05',
    junio: '06', jun: '06',
    julio: '07', jul: '07',
    agosto: '08', ago: '08',
    septiembre: '09', setiembre: '09', sept: '09', sep: '09', set: '09',
    octubre: '10', oct: '10',
    noviembre: '11', nov: '11',
    diciembre: '12', dic: '12'
  };

  const textMatch = clean.match(/(\d{1,2})\s+(?:de\s+)?([a-z]+)\.?(?:\s+(?:de\s+)?(\d{4}))?/i);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const monthKey = textMatch[2];
    const month = months[monthKey];
    const year = textMatch[3] || String(new Date().getFullYear());
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Checks whether two date strings match loosely or strictly.
 * Handles variations like "15 de Octubre 2024", "15 de octubre de 2024", "2024-10-15", "16 nov 2026".
 */
export function isDateMatching(dateA?: string, dateB?: string): boolean {
  if (!dateA || !dateB) return false;
  if (dateA.trim() === dateB.trim()) return true;

  const keyA = toCalendarDateKey(dateA);
  const keyB = toCalendarDateKey(dateB);
  if (keyA && keyB) {
    return keyA === keyB;
  }

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\bde\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  return normalize(dateA) === normalize(dateB);
}

export interface GenerateSlotsOptions {
  config: SalonConfig;
  selectedDate: string;
  serviceDurationMin?: number;
  existingAppointments?: Appointment[];
  selectedGroomer?: string;
  lang?: AppLanguage;
}

/**
 * Generates available start time slots for appointments based on:
 * 1. Business shift schedules (morning, lunch pause, afternoon, or continuous)
 * 2. Configured interval (15, 30, or 60 minutes; defaults to 30)
 * 3. Service duration (must finish before closing or before lunch break)
 * 4. Active appointments on the date (overlapping time windows and capacity limit)
 * 5. Groomer specific conflict check if a groomer is selected
 */
export function generateAvailableTimeSlots({
  config,
  selectedDate,
  serviceDurationMin = 60,
  existingAppointments = [],
  selectedGroomer,
  lang = 'es-LA'
}: GenerateSlotsOptions): TimeSlot[] {
  if (!config || !selectedDate) return [];

  // Interval configured by business: 15, 30, or 60 (defaults to 30)
  const step = Number(config.appointmentIntervalMinutes) > 0 ? Number(config.appointmentIntervalMinutes) : 30;
  const duration = Math.max(15, serviceDurationMin || 60);

  // Capacity limit
  const capacityLimit =
    config.allowSimultaneousStaff === false
      ? 1
      : Math.max(1, config.simultaneousCapacity || 2);

  // Filter out cancelled appointments on this date
  const activeAppointmentsOnDate = existingAppointments.filter((a) => {
    if (!a || !a.time) return false;
    const isCancelled = a.status === 'cancelada' || a.statusLabel === 'CANCELADA';
    if (isCancelled) return false;
    return isDateMatching(a.date, selectedDate);
  });

  // Helper to determine service duration of existing appointments
  const getAppointmentDuration = (apt: Appointment): number => {
    if (!config.services) return 60;
    const matched = config.services.find(
      (s) => s.name?.toLowerCase().trim() === apt.serviceName?.toLowerCase().trim()
    );
    return matched?.durationMin || 60;
  };

  const slots: TimeSlot[] = [];

  const addShiftSlots = (startStr: string, endStr: string) => {
    const shiftStart = parseTimeToMinutes(startStr);
    const shiftEnd = parseTimeToMinutes(endStr);

    if (shiftEnd <= shiftStart) return;

    // A slot is offered if current + serviceDuration <= shiftEnd
    for (let current = shiftStart; current + duration <= shiftEnd; current += step) {
      const slotStart = current;
      const slotEnd = current + duration;
      const timeLabel = formatMinutesToTime(current);

      // Count appointments that overlap with this candidate slot window: [slotStart, slotEnd)
      let overlappingCount = 0;
      let groomerConflict = false;

      for (const apt of activeAppointmentsOnDate) {
        const aptStart = parseTimeToMinutes(apt.time);
        const aptDuration = getAppointmentDuration(apt);
        const aptEnd = aptStart + aptDuration;

        // Two intervals [A_start, A_end) and [B_start, B_end) overlap iff A_start < B_end && A_end > B_start
        const hasOverlap = slotStart < aptEnd && slotEnd > aptStart;

        if (hasOverlap) {
          overlappingCount++;

          if (
            selectedGroomer &&
            apt.groomer &&
            apt.groomer.toLowerCase().trim() === selectedGroomer.toLowerCase().trim()
          ) {
            groomerConflict = true;
          }
        }
      }

      const isAvailable = overlappingCount < capacityLimit && !groomerConflict;
      const tModals = getTranslations(lang).modals;

      slots.push({
        time: timeLabel,
        available: isAvailable,
        bookedCount: overlappingCount,
        reason: groomerConflict
          ? tModals.slotFullReason
          : overlappingCount >= capacityLimit
          ? tModals.slotFullReason
          : undefined
      });
    }
  };

  // Check if double shift is configured and valid
  const hasDouble =
    config.hasDoubleShift &&
    Boolean(config.morningOpen && config.morningClose && config.afternoonOpen && config.afternoonClose);

  if (hasDouble) {
    addShiftSlots(config.morningOpen, config.morningClose);
    addShiftSlots(config.afternoonOpen, config.afternoonClose);
  } else {
    const open = config.openTime || config.morningOpen || '09:00';
    const close = config.closeTime || config.afternoonClose || '19:00';
    addShiftSlots(open, close);
  }

  return slots;
}

export interface CustomTimeValidationResult {
  isValid: boolean;
  isOutsideHours: boolean;
  isConflict: boolean;
  reason?: string;
  formattedTime12: string; // e.g. "9:15 AM"
  formattedTime24: string; // e.g. "09:15"
}

/**
 * Validates a custom appointment time against:
 * - Salon working hours (morning, lunch break pause, afternoon, or continuous)
 * - Service duration (must finish before closing or before lunch break begins)
 * - Capacity limit and overlapping active appointments
 * - Groomer conflicts
 */
export function validateCustomAppointmentTime({
  config,
  selectedDate,
  timeStr,
  serviceDurationMin = 60,
  existingAppointments = [],
  selectedGroomer,
  lang = 'es-LA'
}: {
  config: SalonConfig;
  selectedDate: string;
  timeStr: string;
  serviceDurationMin?: number;
  existingAppointments?: Appointment[];
  selectedGroomer?: string;
  lang?: AppLanguage;
}): CustomTimeValidationResult {
  const startMins = parseTimeToMinutes(timeStr);
  const duration = Math.max(15, serviceDurationMin || 60);
  const endMins = startMins + duration;

  const formattedTime12 = formatMinutesTo12H(startMins);
  const formattedTime24 = formatMinutesToTime(startMins);
  const tModals = getTranslations(lang).modals;

  if (!config || !selectedDate || !timeStr) {
    return {
      isValid: false,
      isOutsideHours: true,
      isConflict: false,
      reason: getTranslations(lang).common.emptyField,
      formattedTime12,
      formattedTime24
    };
  }

  // 1. Business shift hours check
  const hasDouble =
    config.hasDoubleShift &&
    Boolean(config.morningOpen && config.morningClose && config.afternoonOpen && config.afternoonClose);

  if (hasDouble) {
    const mStart = parseTimeToMinutes(config.morningOpen || '08:00');
    const mEnd = parseTimeToMinutes(config.morningClose || '12:30');
    const aStart = parseTimeToMinutes(config.afternoonOpen || '14:00');
    const aEnd = parseTimeToMinutes(config.afternoonClose || '19:30');
    const lStart = parseTimeToMinutes(config.lunchStart || config.morningClose || '12:30');
    const lEnd = parseTimeToMinutes(config.lunchEnd || config.afternoonOpen || '13:30');

    // Check if it overlaps with lunch pause
    if (lEnd > lStart && startMins < lEnd && endMins > lStart) {
      return {
        isValid: false,
        isOutsideHours: true,
        isConflict: false,
        reason: `${tModals.lunchBreakReason} (${formatMinutesTo12H(lStart)} - ${formatMinutesTo12H(lEnd)})`,
        formattedTime12,
        formattedTime24
      };
    }

    const fallsInMorning = startMins >= mStart && endMins <= mEnd;
    const fallsInAfternoon = startMins >= aStart && endMins <= aEnd;

    if (!fallsInMorning && !fallsInAfternoon) {
      return {
        isValid: false,
        isOutsideHours: true,
        isConflict: false,
        reason: `${tModals.outsideHoursReason} (${formattedTime12})`,
        formattedTime12,
        formattedTime24
      };
    }
  } else {
    const openMins = parseTimeToMinutes(config.openTime || config.morningOpen || '09:00');
    const closeMins = parseTimeToMinutes(config.closeTime || config.afternoonClose || '19:00');

    if (startMins < openMins || endMins > closeMins) {
      return {
        isValid: false,
        isOutsideHours: true,
        isConflict: false,
        reason: `${tModals.outsideHoursReason} (${formatMinutesTo12H(openMins)} - ${formatMinutesTo12H(closeMins)})`,
        formattedTime12,
        formattedTime24
      };
    }
  }

  // 2. Capacity & Overlaps check
  const capacityLimit =
    config.allowSimultaneousStaff === false
      ? 1
      : Math.max(1, config.simultaneousCapacity || 2);

  const activeAppointmentsOnDate = existingAppointments.filter((a) => {
    if (!a || !a.time) return false;
    const isCancelled = a.status === 'cancelada' || a.statusLabel === 'CANCELADA';
    if (isCancelled) return false;
    return isDateMatching(a.date, selectedDate);
  });

  const getAppointmentDuration = (apt: Appointment): number => {
    if (!config.services) return 60;
    const matched = config.services.find(
      (s) => s.name?.toLowerCase().trim() === apt.serviceName?.toLowerCase().trim()
    );
    return matched?.durationMin || 60;
  };

  let overlappingCount = 0;
  let groomerConflict = false;

  for (const apt of activeAppointmentsOnDate) {
    const aptStart = parseTimeToMinutes(apt.time);
    const aptDuration = getAppointmentDuration(apt);
    const aptEnd = aptStart + aptDuration;

    const hasOverlap = startMins < aptEnd && endMins > aptStart;

    if (hasOverlap) {
      overlappingCount++;

      if (
        selectedGroomer &&
        apt.groomer &&
        apt.groomer.toLowerCase().trim() === selectedGroomer.toLowerCase().trim()
      ) {
        groomerConflict = true;
      }
    }
  }

  if (groomerConflict) {
    return {
      isValid: false,
      isOutsideHours: false,
      isConflict: true,
      reason: tModals.slotFullReason,
      formattedTime12,
      formattedTime24
    };
  }

  if (overlappingCount >= capacityLimit) {
    return {
      isValid: false,
      isOutsideHours: false,
      isConflict: true,
      reason: `${tModals.slotFullReason} (${overlappingCount}/${capacityLimit})`,
      formattedTime12,
      formattedTime24
    };
  }

  return {
    isValid: true,
    isOutsideHours: false,
    isConflict: false,
    formattedTime12,
    formattedTime24
  };
}

/**
 * Validates whether a specific time slot is available for booking,
 * preventing race conditions or confirmation of incompatible slots.
 */
export function validateSlotAvailability(
  options: GenerateSlotsOptions & { time: string }
): { isValid: boolean; reason?: string } {
  const customCheck = validateCustomAppointmentTime({
    config: options.config,
    selectedDate: options.selectedDate,
    timeStr: options.time,
    serviceDurationMin: options.serviceDurationMin,
    existingAppointments: options.existingAppointments,
    selectedGroomer: options.selectedGroomer,
    lang: options.lang
  });

  if (!customCheck.isValid) {
    return {
      isValid: false,
      reason: customCheck.reason
    };
  }

  return { isValid: true };
}

