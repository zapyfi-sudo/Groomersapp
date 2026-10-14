import { SalonConfig, Appointment, SalonService } from '../types';

export interface TimeSlot {
  time: string; // e.g. "09:30"
  available: boolean;
  bookedCount: number;
  reason?: string;
}

/**
 * Normalizes time string ("09:30", "9:30", "09:30 AM", "3:30 PM", "15:30") to minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(tStr?: string): number {
  if (!tStr) return 0;
  const clean = tStr.trim().toLowerCase();

  const isPM = clean.includes('pm') && !clean.includes('12:');
  const is12AM = clean.includes('am') && clean.startsWith('12:');

  // Strip AM/PM and non-digit/colon characters
  const timeOnly = clean.replace(/[a-z\s]/g, '');
  const [hStr, mStr] = timeOnly.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;

  if (isPM && h < 12) {
    h += 12;
  } else if (is12AM && h === 12) {
    h = 0;
  }

  return h * 60 + m;
}

/**
 * Formats minutes from midnight to "HH:MM" (24-hour format).
 */
export function formatMinutesToTime(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
 * 3. Service duration (must finish before the shift closing time)
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
  const step = Number(config.appointmentIntervalMinutes) || 30;
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

/**
 * Validates whether a specific time slot is available for booking,
 * preventing race conditions or confirmation of incompatible slots.
 */
export function validateSlotAvailability(
  options: GenerateSlotsOptions & { time: string }
): { isValid: boolean; reason?: string } {
  const slots = generateAvailableTimeSlots(options);
  const target = options.time.trim();

  const match = slots.find(
    (s) => s.time === target || parseTimeToMinutes(s.time) === parseTimeToMinutes(target)
  );

  if (!match) {
    return {
      isValid: false,
      reason: 'El horario seleccionado se encuentra fuera del horario de atención del establecimiento o no permite completar el servicio antes del cierre.'
    };
  }

  if (!match.available) {
    return {
      isValid: false,
      reason: match.reason || 'El horario seleccionado ya no cuenta con disponibilidad de cupos.'
    };
  }

  return { isValid: true };
}
