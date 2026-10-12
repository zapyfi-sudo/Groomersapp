import { Pet, SalonConfig, Appointment, RetentionPet } from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { AppLanguage } from './translations';
import { DEFAULT_WHATSAPP_TEMPLATES } from './phoneUtils';

const STORAGE_KEY_CONFIG = 'agendacan_salon_config_v2';
const STORAGE_KEY_PETS = 'agendacan_pets_v2';
const STORAGE_KEY_APPOINTMENTS = 'agendacan_appointments_v2';
const STORAGE_KEY_LANGUAGE = 'agendacan_language_v2';
const STORAGE_KEY_BOOKED_RETENTIONS = 'agendacan_booked_retentions_v2';

// Helper to format ISO date or relative date string
export function formatDateSpanish(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function formatShortDateSpanish(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short'
  });
}

// Generate realistic dynamic dates relative to current date (never hardcoded 2024)
function getPastDate(weeksAgo: number): { iso: string; formatted: string; short: string } {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  return {
    iso: d.toISOString(),
    formatted: formatDateSpanish(d),
    short: formatShortDateSpanish(d)
  };
}

export const DEFAULT_SALON_CONFIG: SalonConfig = {
  id: 'biz_main',
  name: 'Peluquería Canina Luna',
  logoUrl: HOTLINK_IMAGES.logo,
  country: 'Argentina',
  city: 'Buenos Aires',
  phonePrefix: '+54',
  phone: '11 5489 3210',
  address: 'Av. Corrientes 4520, Almagro, CABA',
  googleMapsPlaceName: 'Peluquería Canina Luna - Almagro, CABA',
  googleMapsUrl: 'https://maps.google.com/?q=-34.603722,-58.423145',
  coordinates: '-34.603722, -58.423145',
  allowSimultaneousStaff: true,
  maxSimultaneousAppointments: 2,
  workingDays: 'Lunes a Sábado',
  openTime: '08:00',
  closeTime: '19:30',
  currency: 'ARS',
  simultaneousCapacity: 2,
  staffMembers: [
    { id: 'st-1', name: 'Carlos Morales', role: 'Estilista Principal (Corte & Spa)', active: true, shiftAvailability: 'todo_el_dia' },
    { id: 'st-2', name: 'Mariana V.', role: 'Especialista en Baño y Deslanado', active: true, shiftAvailability: 'todo_el_dia' },
    { id: 'st-3', name: 'Roberto Díaz', role: 'Ayudante y Secado', active: true, shiftAvailability: 'solo_tarde' }
  ],
  morningOpen: '08:00',
  morningClose: '12:30',
  afternoonOpen: '14:00',
  afternoonClose: '19:30',
  hasDoubleShift: true,
  bookingSlug: 'pelo',
  activeDays: ['L', 'M', 'X', 'J', 'V', 'S'],
  staffScheduleConfig: {
    allDay: { start: '08:00', end: '18:00' },
    morning: { start: '08:00', end: '13:00' },
    afternoon: { start: '14:00', end: '19:30' }
  },
  hasMedicationProductsEnabled: true,
  medicationProducts: [
    {
      id: 'med-1',
      name: 'Tratamiento antipulgas y garrapatas',
      type: 'Gotas',
      purpose: 'Pipeta tópica para control y eliminación de pulgas y garrapatas externas.',
      price: 4500,
      photoUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
      active: true
    },
    {
      id: 'med-2',
      name: 'Antiparasitario interno en comprimido',
      type: 'Pastilla',
      purpose: 'Comprimido masticable con premio para desparasitación gastrointestinal completa.',
      price: 3500,
      photoUrl: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300&auto=format&fit=crop&q=80',
      active: true
    },
    {
      id: 'med-3',
      name: 'Loción dérmica calmante / antialérgica',
      type: 'Tratamiento tópico',
      purpose: 'Spray hidratante con aloe y avena para aliviar picazón y dermatitis tras el baño.',
      price: 2800,
      photoUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300&auto=format&fit=crop&q=80',
      active: true
    }
  ],
  medicationFee: 3500,
  reviews: [
    {
      id: 'rev-1',
      clientName: 'Ana Gómez',
      petName: 'Toby',
      serviceName: 'Baño + corte',
      stars: 5,
      comment: '¡Increíble atención! Toby quedó súper suave y con un aroma riquísimo.',
      date: formatDateSpanish(new Date()),
      verified: true
    }
  ],
  services: [
    {
      id: 's-1',
      name: 'Baño + corte',
      durationMin: 90,
      price: 25000,
      pricingType: 'tamano',
      priceBySize: {
        pequeno: 20000,
        mediano: 25000,
        grande: 30000,
        extraGrande: 35000
      },
      desc: 'Corte higiénico, estética de raza, corte de uñas y limpieza de oídos.',
      badge: 'Popular',
      icon: 'content_cut',
      active: true,
      rating: 5.0,
      reviewCount: 64
    },
    {
      id: 's-2',
      name: 'Baño completo',
      durationMin: 45,
      price: 18000,
      pricingType: 'unico',
      desc: 'Higiene profunda con champú hipoalergénico, secado y perfume.',
      icon: 'bathtub',
      active: true,
      rating: 4.9,
      reviewCount: 42
    },
    {
      id: 's-3',
      name: 'Deslanado premium',
      durationMin: 75,
      price: 22000,
      pricingType: 'unico',
      desc: 'Eliminación exhaustiva de manto muerto con cardina y cepillado profundo.',
      icon: 'pets',
      active: true,
      rating: 4.9,
      reviewCount: 28
    },
    {
      id: 's-4',
      name: 'Corte de uñas y almohadillas',
      durationMin: 20,
      price: 8000,
      pricingType: 'unico',
      desc: 'Corte y limado de uñas, despeje de pelo interdigital.',
      icon: 'spa',
      active: true,
      rating: 4.8,
      reviewCount: 19
    }
  ],
  whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES
};

export function getDefaultPets(): Pet[] {
  const tobyDate = getPastDate(6);
  const lunaDate = getPastDate(4);
  const rockyDate = getPastDate(2);

  return [
    {
      id: '#PET-2849',
      name: 'Toby',
      breed: 'Golden Retriever',
      age: '3 años',
      gender: 'Macho',
      weightKg: 28,
      isVip: true,
      photoUrl: HOTLINK_IMAGES.toby,
      tutor: {
        name: 'Ana Gómez',
        phone: '+54 9 11 5566-7788',
        rawPhone: '5491155667788'
      },
      habitualMood: 'inquieto',
      healthAllergies: 'Piel atópica / sensible en el lomo. Usar champú hipoalergénico de avena.',
      handlingObservations: 'No le gusta el secador cerca de la cara. Usar toalla primero.',
      lastVisit: {
        id: 'v-1',
        date: tobyDate.formatted,
        serviceName: 'Baño + corte',
        price: 25000,
        currency: 'ARS',
        mood: 'inquieto',
        paid: true,
        notes: '',
        photos: {
          beforeUrl: HOTLINK_IMAGES.photoBefore,
          afterUrl: HOTLINK_IMAGES.photoAfter
        },
        nextRecommendedWeeks: 6
      },
      visitHistory: [
        {
          id: 'v-1',
          date: tobyDate.formatted,
          serviceName: 'Baño + corte',
          price: 25000,
          currency: 'ARS',
          mood: 'inquieto',
          paid: true,
          notes: '',
          photos: {
            beforeUrl: HOTLINK_IMAGES.photoBefore,
            afterUrl: HOTLINK_IMAGES.photoAfter
          },
          nextRecommendedWeeks: 6
        }
      ],
      recommendedIntervalWeeks: 6
    },
    {
      id: '#PET-1920',
      name: 'Luna',
      breed: 'Caniche Toy',
      age: '2 años',
      gender: 'Hembra',
      weightKg: 4.5,
      isVip: false,
      photoUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&auto=format&fit=crop&q=80',
      tutor: {
        name: 'Carlos Benítez',
        phone: '+54 9 11 3344-9988',
        rawPhone: '5491133449988'
      },
      habitualMood: 'tranquilo',
      healthAllergies: 'Piel normal.',
      handlingObservations: 'Muy dócil. Disfruta el masaje capilar y el secado tibio.',
      lastVisit: {
        id: 'v-2',
        date: lunaDate.formatted,
        serviceName: 'Baño completo',
        price: 18000,
        currency: 'ARS',
        mood: 'tranquilo',
        paid: true,
        photos: {},
        nextRecommendedWeeks: 4
      },
      visitHistory: [
        {
          id: 'v-2',
          date: lunaDate.formatted,
          serviceName: 'Baño completo',
          price: 18000,
          currency: 'ARS',
          mood: 'tranquilo',
          paid: true,
          photos: {},
          nextRecommendedWeeks: 4
        }
      ],
      recommendedIntervalWeeks: 4
    },
    {
      id: '#PET-3012',
      name: 'Rocky',
      breed: 'Bulldog Francés',
      age: '4 años',
      gender: 'Macho',
      weightKg: 13,
      isVip: true,
      photoUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop&q=80',
      tutor: {
        name: 'Mariana Silva',
        phone: '+54 9 11 4455-6677',
        rawPhone: '5491144556677'
      },
      habitualMood: 'dificil',
      healthAllergies: 'Pliegues faciales con tendencia a hongos.',
      handlingObservations: 'Respiración braquicéfala; no exponer a calor excesivo.',
      lastVisit: {
        id: 'v-3',
        date: rockyDate.formatted,
        serviceName: 'Deslanado premium',
        price: 22000,
        currency: 'ARS',
        mood: 'dificil',
        paid: true,
        photos: {},
        nextRecommendedWeeks: 3
      },
      visitHistory: [
        {
          id: 'v-3',
          date: rockyDate.formatted,
          serviceName: 'Deslanado premium',
          price: 22000,
          currency: 'ARS',
          mood: 'dificil',
          paid: true,
          photos: {},
          nextRecommendedWeeks: 3
        }
      ],
      recommendedIntervalWeeks: 3
    }
  ];
}

export function getDefaultAppointments(): Appointment[] {
  const todayFormatted = formatDateSpanish(new Date());

  return [
    {
      id: 'apt-1',
      petId: '#PET-2849',
      petName: 'Toby',
      breed: 'Golden Retriever',
      tutorName: 'Ana Gómez',
      tutorPhone: '+54 9 11 5566-7788',
      serviceName: 'Baño + corte',
      time: '09:00',
      date: todayFormatted,
      status: 'completado',
      statusLabel: 'COMPLETADO',
      groomer: 'Carlos Morales',
      price: 25000,
      currency: 'ARS',
      paymentStatus: 'cobrado',
      paymentStatusLabel: 'Cobrado',
      subStatus: 'Finalizó con éxito',
      subStatusType: 'time',
      hasMedication: true,
      rating: 5,
      reviewComment: 'Excelente corte a tijera'
    },
    {
      id: 'apt-2',
      petId: '#PET-1920',
      petName: 'Luna',
      breed: 'Caniche Toy',
      tutorName: 'Carlos Benítez',
      tutorPhone: '+54 9 11 3344-9988',
      serviceName: 'Baño completo',
      time: '11:00',
      date: todayFormatted,
      status: 'en_salon',
      statusLabel: 'EN SALÓN',
      groomer: 'Mariana V.',
      price: 18000,
      currency: 'ARS',
      paymentStatus: 'en_proceso',
      paymentStatusLabel: 'En proceso',
      subStatus: 'En secado',
      subStatusType: 'action_pill',
      hasMedication: false
    }
  ];
}

// Storage loaders and savers
export function loadSalonConfig(): SalonConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SALON_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Error reading salon config from storage:', err);
  }
  return DEFAULT_SALON_CONFIG;
}

export function saveSalonConfig(config: SalonConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving salon config to storage:', err);
  }
}

export function loadPets(): Pet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading pets from storage:', err);
  }
  return getDefaultPets();
}

export function savePets(pets: Pet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PETS, JSON.stringify(pets));
  } catch (err) {
    console.error('Error saving pets to storage:', err);
  }
}

export function loadAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_APPOINTMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading appointments from storage:', err);
  }
  return getDefaultAppointments();
}

export function saveAppointments(apts: Appointment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(apts));
  } catch (err) {
    console.error('Error saving appointments to storage:', err);
  }
}

export function loadLanguage(): AppLanguage {
  try {
    const lang = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    if (lang === 'es-LA' || lang === 'es-ES' || lang === 'en' || lang === 'pt') {
      return lang;
    }
  } catch {
    // fallback
  }
  return 'es-LA';
}

export function saveLanguage(lang: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
  } catch (err) {
    console.error('Error saving language:', err);
  }
}

export function loadBookedRetentions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKED_RETENTIONS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function saveBookedRetentions(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BOOKED_RETENTIONS, JSON.stringify(ids));
  } catch {}
}

/**
 * Safely parses dates in ISO format, RFC format, or Spanish text format.
 * Examples: "10 de octubre de 2026", "15 de Septiembre", "2026-10-10", "4 de octubre"
 */
export function parseSpanishOrIsoDate(str?: string): Date | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // 1. Try standard ISO/RFC parse
  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime()) && (trimmed.includes('-') || trimmed.includes('/'))) {
    return direct;
  }

  // 2. Spanish text parsing
  const months: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    sept: 8,
    octubre: 9,
    oct: 9,
    noviembre: 10,
    nov: 10,
    diciembre: 11,
    dic: 11
  };

  const clean = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const match = clean.match(/(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthKey = match[2];
    const month = months[monthKey];
    const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();

    if (month !== undefined && !isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  return null;
}

// Helper to calculate total real completed visits and returns for a pet
export function calculatePetReturnStats(
  pet: Pet,
  appointments?: Appointment[]
): { totalCompletedVisits: number; returnCount: number; returnCountLabel: string } {
  // Use a map/set of unique visit keys to avoid double counting
  // We record both visit id and date to cross-reference with appointments
  const recordedVisitIds = new Set<string>();
  const recordedDates = new Set<string>();
  let visitCount = 0;

  const registerVisit = (id?: string, date?: string) => {
    const cleanId = id?.trim();
    const cleanDate = date?.trim().toLowerCase();

    // If we've already registered this exact visit ID, skip
    if (cleanId && recordedVisitIds.has(cleanId)) {
      return;
    }

    if (cleanId) recordedVisitIds.add(cleanId);
    if (cleanDate) recordedDates.add(cleanDate);
    visitCount++;
  };

  // 1. Check pet.visitHistory
  if (Array.isArray(pet.visitHistory)) {
    pet.visitHistory.forEach((v) => {
      if (v) {
        registerVisit(v.id, v.date);
      }
    });
  }

  // 2. Check pet.lastVisit (if not already counted in visitHistory)
  if (pet.lastVisit) {
    registerVisit(pet.lastVisit.id, pet.lastVisit.date);
  }

  // 3. Check completed appointments for this pet (ONLY status === 'completado' or 'completed')
  // We NEVER count scheduled, pending, or cancelled appointments
  if (Array.isArray(appointments)) {
    const cleanPetId = (pet.id || '').replace('#', '').toLowerCase();
    const cleanPetName = (pet.name || '').toLowerCase().trim();

    appointments.forEach((apt) => {
      const isCompleted =
        apt.status === 'completado' || (apt.status as any) === 'completed';
      if (!isCompleted) return;

      const aptCleanPetId = (apt.petId || '').replace('#', '').toLowerCase();
      const aptCleanPetName = (apt.petName || '').toLowerCase().trim();

      const matchesPet =
        (aptCleanPetId && aptCleanPetId === cleanPetId) ||
        (!aptCleanPetId && aptCleanPetName && aptCleanPetName === cleanPetName);

      if (matchesPet) {
        const aptDate = apt.date?.trim().toLowerCase();
        // If this appointment's date is already recorded in visitHistory / lastVisit,
        // it means the appointment was already converted into a Visit. Avoid double-counting.
        if (aptDate && recordedDates.has(aptDate)) {
          return;
        }

        // Also check if appointment ID was somehow used as visit ID
        if (apt.id && recordedVisitIds.has(apt.id)) {
          return;
        }

        registerVisit(apt.id, apt.date);
      }
    });
  }

  const totalCompletedVisits = visitCount;
  // First visit is initial visit. Returns = totalCompletedVisits - 1 (min 0)
  const returnCount = Math.max(0, totalCompletedVisits - 1);

  let returnCountLabel = 'Ha vuelto 0 veces';
  if (returnCount === 1) {
    returnCountLabel = 'Ha vuelto 1 vez';
  } else if (returnCount > 1) {
    returnCountLabel = `Ha vuelto ${returnCount} veces`;
  }

  return {
    totalCompletedVisits,
    returnCount,
    returnCountLabel
  };
}

// Dynamic Retention calculation from REAL pets (single source of truth)
export function deriveRetentionPets(
  pets: Pet[],
  salonName: string,
  bookedIds: string[],
  appointments?: Appointment[]
): RetentionPet[] {
  const results: RetentionPet[] = [];
  const now = new Date();
  const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  pets.forEach((pet) => {
    // 1. Determine interval weeks (custom or standard)
    let intervalWeeks = 6;
    if (pet.returnIntervalType === 'custom' && pet.customReturnWeeks) {
      intervalWeeks = Number(pet.customReturnWeeks) || 5;
    } else if (pet.recommendedIntervalWeeks) {
      intervalWeeks = Number(pet.recommendedIntervalWeeks) || 6;
    }

    // 2. Determine reference date and last visit
    const hasCompletedVisit = Boolean(
      pet.lastVisit?.date || (pet.visitHistory && pet.visitHistory.length > 0)
    );
    const lastVisit = pet.lastVisit || (pet.visitHistory && pet.visitHistory.length > 0 ? pet.visitHistory[0] : null);

    let refDate: Date | null = null;
    if (lastVisit?.date) {
      refDate = parseSpanishOrIsoDate(lastVisit.date);
    }
    if (!refDate && pet.visitHistory && pet.visitHistory.length > 0) {
      refDate = parseSpanishOrIsoDate(pet.visitHistory[0].date);
    }

    const lastVisitDateText = hasCompletedVisit && lastVisit?.date
      ? lastVisit.date
      : 'Sin visitas registradas';

    // If no visit exists, base reference date on today
    const effectiveRefDate = refDate || new Date();

    // 3. Determine next recommended date
    let targetDate: Date;
    if (pet.nextRecommendedVisitDate) {
      const parsedTarget = parseSpanishOrIsoDate(pet.nextRecommendedVisitDate);
      if (parsedTarget) {
        targetDate = parsedTarget;
      } else {
        targetDate = new Date(effectiveRefDate.getTime() + intervalWeeks * 7 * 24 * 60 * 60 * 1000);
      }
    } else {
      targetDate = new Date(effectiveRefDate.getTime() + intervalWeeks * 7 * 24 * 60 * 60 * 1000);
    }

    const nextRecommendedDateFormatted = formatDateSpanish(targetDate);

    // 4. Calculate calendar difference in days
    const targetZero = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    const diffMs = targetZero - todayZero;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // 5. Calculate actual weeks elapsed since last visit
    let weeksSinceLastVisit = 0;
    if (refDate) {
      const refZero = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
      const daysSinceLastVisit = Math.max(0, Math.round((todayZero - refZero) / (1000 * 60 * 60 * 24)));
      weeksSinceLastVisit = Math.floor(daysSinceLastVisit / 7);
    }

    // 6. Urgency classification & countdown text
    let urgency: 'esta_semana' | 'urgente' | 'proxima_semana' | 'mas_adelante' = 'esta_semana';
    let urgencyLabel = '¡Esta semana!';
    let countdownText = '';

    if (diffDays < 0) {
      urgency = 'urgente';
      const daysOverdue = Math.abs(diffDays);
      urgencyLabel = '! Urgente (Vencida)';
      countdownText = daysOverdue === 1 ? 'Vencida hace 1 día' : `Vencida hace ${daysOverdue} días`;
    } else if (diffDays === 0) {
      urgency = 'urgente';
      urgencyLabel = '! Hoy';
      countdownText = 'Hoy corresponde su visita';
    } else if (diffDays <= 3) {
      urgency = 'urgente';
      urgencyLabel = '! Urgente';
      countdownText = diffDays === 1 ? 'Falta 1 día' : `Faltan ${diffDays} días`;
    } else if (diffDays <= 7) {
      urgency = 'esta_semana';
      urgencyLabel = '¡Esta semana!';
      countdownText = `Faltan ${diffDays} días`;
    } else if (diffDays <= 14) {
      urgency = 'proxima_semana';
      urgencyLabel = 'Próxima semana';
      countdownText = `Faltan ${diffDays} días`;
    } else {
      urgency = 'mas_adelante';
      urgencyLabel = 'Más adelante';
      countdownText = `Faltan ${diffDays} días`;
    }

    // Check if pet is marked as booked via bookedRetentions OR has a scheduled active appointment
    const isManuallyBooked = bookedIds.includes(pet.id);
    const hasScheduledAppointment = Array.isArray(appointments) && appointments.some((a) => {
      const matchesPet =
        a.petId === pet.id ||
        (a.petName?.trim().toLowerCase() === pet.name?.trim().toLowerCase() &&
          a.tutorName?.trim().toLowerCase() === pet.tutor?.name?.trim().toLowerCase());
      if (!matchesPet) return false;
      // An active scheduled appointment (not cancelled, not completed yet)
      const isActive =
        a.status !== 'cancelada' &&
        a.status !== 'completado' &&
        (a.status as any) !== 'completed';
      return isActive;
    });

    const alreadyBooked = isManuallyBooked || hasScheduledAppointment;
    const tutorFirstName = pet.tutor?.name ? (pet.tutor.name.split(' ')[0] || pet.tutor.name) : 'Tutor';
    const serviceName = lastVisit?.serviceName || 'Baño + corte';

    // 7. Context-accurate suggested smart message
    let suggestedMessage = '';
    if (diffDays <= 0) {
      suggestedMessage = `“Hola ${tutorFirstName} 👋 Te escribimos desde ${salonName}. Ya es momento de renovar el cuidado de ${pet.name} (${serviceName}) para mantener su manto impecable y saludable. ¿Te gustaría que reservemos su próximo turno esta semana?”`;
    } else if (diffDays <= 7) {
      suggestedMessage = `“Hola ${tutorFirstName} 👋 Te saludamos desde ${salonName}. Esta semana corresponde la visita periódica de ${pet.name} para su sesión de ${serviceName}. ¿Qué día y horario te viene mejor para agendar?”`;
    } else if (diffDays <= 14) {
      suggestedMessage = `“Hola ${tutorFirstName} 👋 Te escribimos de ${salonName} para recordarte que la próxima semana le toca su turno a ${pet.name} (${serviceName}). ¿Deseas coordinar su cita con anticipación?”`;
    } else {
      suggestedMessage = `“Hola ${tutorFirstName} 👋 Te escribimos desde ${salonName}. Según la recomendación de cuidado para ${pet.name}, su próxima sesión de ${serviceName} está prevista para el ${nextRecommendedDateFormatted} (en ${intervalWeeks} semanas). ¡Estamos a tu disposición si gustas reservar con anticipación!”`;
    }

    // 8. Fidelidad / Regresos de la mascota
    const { returnCount, returnCountLabel } = calculatePetReturnStats(pet, appointments);

    results.push({
      id: `ret-${pet.id.replace('#', '')}`,
      petId: pet.id,
      name: pet.name,
      breed: pet.breed,
      tutorName: pet.tutor.name,
      tutorPhone: pet.tutor.phone,
      rawPhone: pet.tutor.rawPhone,
      photoUrl: pet.photoUrl,
      isVip: pet.isVip,
      lastVisitDate: lastVisitDateText,
      weeksSinceLastVisit,
      recommendedWeeks: intervalWeeks,
      nextRecommendedDate: nextRecommendedDateFormatted,
      daysRemaining: diffDays,
      countdownText,
      urgency,
      urgencyLabel,
      suggestedMessage,
      templateName: `Servicio ${serviceName}`,
      alreadyBooked,
      returnCount,
      returnCountLabel
    });
  });

  return results;
}

// Compress image via HTML Canvas before storing
export async function compressImage(file: File, maxWidth = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
