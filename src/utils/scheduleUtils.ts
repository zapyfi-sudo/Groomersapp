import { SalonConfig, Appointment } from '../types';

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
 * Checks whether two date strings match loosely or strictly.
 * Handles variations like "15 de Octubre 2024", "15 de octubre de 2024", "2024-10-15".
 */
export function isDateMatching(dateA?: string, dateB?: string): boolean {
  if (!dateA || !dateB) return false;
  if (dateA.trim() === dateB.trim()) return true;

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
  selectedGroomer
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

      slots.push({
        time: timeLabel,
        available: isAvailable,
        bookedCount: overlappingCount,
        reason: groomerConflict
          ? 'El estilista seleccionado ya tiene una cita en este horario'
          : overlappingCount >= capacityLimit
          ? 'Capacidad máxima del salón alcanzada para este horario'
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
  selectedGroomer
}: {
  config: SalonConfig;
  selectedDate: string;
  timeStr: string;
  serviceDurationMin?: number;
  existingAppointments?: Appointment[];
  selectedGroomer?: string;
}): CustomTimeValidationResult {
  const startMins = parseTimeToMinutes(timeStr);
  const duration = Math.max(15, serviceDurationMin || 60);
  const endMins = startMins + duration;

  const formattedTime12 = formatMinutesTo12H(startMins);
  const formattedTime24 = formatMinutesToTime(startMins);

  if (!config || !selectedDate || !timeStr) {
    return {
      isValid: false,
      isOutsideHours: true,
      isConflict: false,
      reason: 'Datos incompletos para validar el horario.',
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
        reason: `El horario (${formattedTime12}) coincide con la pausa para el almuerzo (${formatMinutesTo12H(lStart)} - ${formatMinutesTo12H(lEnd)}).`,
        formattedTime12,
        formattedTime24
      };
    }

    const fallsInMorning = startMins >= mStart && endMins <= mEnd;
    const fallsInAfternoon = startMins >= aStart && endMins <= aEnd;

    if (!fallsInMorning && !fallsInAfternoon) {
      let detail = `Horarios de atención: Mañana (${formatMinutesTo12H(mStart)} - ${formatMinutesTo12H(mEnd)}) y Tarde (${formatMinutesTo12H(aStart)} - ${formatMinutesTo12H(aEnd)}).`;
      if (startMins < mStart) {
        detail = `El salón abre a las ${formatMinutesTo12H(mStart)}.`;
      } else if (startMins >= mEnd && startMins < aStart) {
        detail = `Pausa de almuerzo entre ${formatMinutesTo12H(mEnd)} y ${formatMinutesTo12H(aStart)}.`;
      } else if (endMins > aEnd) {
        detail = `El servicio dura ${duration} min y superaría el horario de cierre (${formatMinutesTo12H(aEnd)}).`;
      }

      return {
        isValid: false,
        isOutsideHours: true,
        isConflict: false,
        reason: `El horario seleccionado (${formattedTime12}) está fuera de la jornada de atención. ${detail}`,
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
        reason: `El horario seleccionado (${formattedTime12}) está fuera de la jornada de atención (${formatMinutesTo12H(openMins)} a ${formatMinutesTo12H(closeMins)}).`,
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
      reason: `El estilista seleccionado ya tiene una cita agendada en este horario.`,
      formattedTime12,
      formattedTime24
    };
  }

  if (overlappingCount >= capacityLimit) {
    return {
      isValid: false,
      isOutsideHours: false,
      isConflict: true,
      reason: `Capacidad máxima del salón alcanzada para las ${formattedTime12} (${overlappingCount} de ${capacityLimit} cupos ocupados).`,
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
    selectedGroomer: options.selectedGroomer
  });

  if (!customCheck.isValid) {
    return {
      isValid: false,
      reason: customCheck.reason
    };
  }

  return { isValid: true };
}

