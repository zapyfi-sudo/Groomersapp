import { Pet, SalonConfig, Appointment, RetentionPet } from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { AppLanguage } from './translations';

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
  name: 'Peluquería Canina Luna',
  logoUrl: HOTLINK_IMAGES.logo,
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
  bookingSlug: 'agendacan.app/peluquerialuna',
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
  ]
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

// Dynamic Retention calculation from REAL pets (single source of truth)
export function deriveRetentionPets(
  pets: Pet[],
  salonName: string,
  bookedIds: string[]
): RetentionPet[] {
  const results: RetentionPet[] = [];
  const now = new Date();

  pets.forEach((pet) => {
    // Must have a visit and a recommended interval
    const intervalWeeks = Number(pet.recommendedIntervalWeeks) || 6;
    const lastVisit = pet.lastVisit;

    if (!lastVisit) return;

    // Parse date of last visit or calculate relative
    // If lastVisit has an ISO date or day/month, compute realistic difference
    let daysSince = 0;
    const dateParsed = Date.parse(lastVisit.date);
    if (!isNaN(dateParsed)) {
      daysSince = Math.max(0, Math.floor((now.getTime() - dateParsed) / (1000 * 60 * 60 * 24)));
    } else {
      // Default to matching recommended interval if sample
      daysSince = intervalWeeks * 7;
    }

    const weeksSinceLastVisit = Math.max(1, Math.round(daysSince / 7));
    const targetWeeks = intervalWeeks;

    let urgency: 'esta_semana' | 'urgente' | 'proxima_semana' = 'esta_semana';
    let urgencyLabel = '! Esta semana';

    if (weeksSinceLastVisit > targetWeeks) {
      urgency = 'urgente';
      urgencyLabel = '! Urgente (Vencido)';
    } else if (weeksSinceLastVisit === targetWeeks - 1) {
      urgency = 'proxima_semana';
      urgencyLabel = 'Próxima semana';
    } else if (weeksSinceLastVisit >= targetWeeks) {
      urgency = 'esta_semana';
      urgencyLabel = '! Esta semana';
    }

    const alreadyBooked = bookedIds.includes(pet.id);

    const tutorFirstName = pet.tutor.name.split(' ')[0] || pet.tutor.name;
    const serviceName = lastVisit.serviceName || 'Baño + corte';

    const suggestedMessage = `“Hola ${tutorFirstName} 👋 Han pasado aproximadamente ${weeksSinceLastVisit} semanas desde la última sesión de ${pet.name} en ${salonName}. ¿Quieres reservar su próxima cita de ${serviceName} para mantener su pelaje impecable?”`;

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
      lastVisitDate: lastVisit.date,
      weeksSinceLastVisit,
      recommendedWeeks: targetWeeks,
      urgency,
      urgencyLabel,
      suggestedMessage,
      templateName: `Servicio ${serviceName}`,
      alreadyBooked
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
