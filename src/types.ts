export type BehaviorMood = 'tranquilo' | 'inquieto' | 'dificil';

export interface VisitPhoto {
  beforeUrl?: string;
  afterUrl?: string;
}

export interface Visit {
  id: string;
  date: string; // e.g. "15 de Septiembre" or ISO
  serviceName: string;
  price: number;
  currency: string;
  mood: BehaviorMood;
  paid: boolean;
  notes?: string;
  healthNotes?: string;
  handlingNotes?: string;
  photos: VisitPhoto;
  nextRecommendedWeeks?: number | string;
}

export interface Pet {
  id: string; // e.g. "#PET-2849"
  name: string;
  breed: string;
  age: string; // e.g. "3 años"
  gender: 'Macho' | 'Hembra';
  weightKg: number;
  isVip: boolean;
  photoUrl: string;
  tutor: {
    name: string;
    phone: string;
    rawPhone: string;
  };
  habitualMood: BehaviorMood;
  healthAllergies: string;
  handlingObservations: string;
  lastVisit: Visit;
  visitHistory: Visit[];
  recommendedIntervalWeeks: number | string;
}

export interface UserAccount {
  id: string; // e.g. "usr_1001"
  email: string;
  name: string;
  businessId: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface BusinessAccountData {
  businessId: string;
  userId: string;
  config: SalonConfig;
  pets: Pet[];
  appointments: Appointment[];
  bookedRetentions: string[];
  updatedAt: string;
}

export interface ClientReview {
  id: string;
  clientName: string;
  petName: string;
  serviceName: string;
  stars: number; // 1 to 5
  comment: string;
  date: string; // e.g. "14 Octubre 2024"
  verified: boolean;
}

export interface ServicePricingBySize {
  pequeno: number;
  mediano: number;
  grande: number;
  extraGrande: number;
}

export interface SalonService {
  id: string;
  name: string;
  durationMin: number;
  price: number; // default or base price
  pricingType?: 'unico' | 'tamano';
  priceBySize?: ServicePricingBySize;
  desc?: string;
  badge?: string;
  icon?: string;
  imageUrl?: string;
  active: boolean;
  rating?: number;
  reviewCount?: number;
}

export interface MedicationProduct {
  id: string;
  name: string;
  type: string; // 'Pastilla' | 'Gotas' | 'Jarabe' | 'Tratamiento tópico' | 'Antiparasitario' | 'Otro'
  purpose: string; // ¿Para qué sirve?
  price: number;
  photoUrl?: string;
  active: boolean;
}

export interface StaffScheduleConfig {
  allDay: { start: string; end: string };
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
}

export interface StaffMember {
  id: string;
  name: string;
  role: string; // e.g. "Estilista Principal (Corte y Spa)", "Bañador / Asistente", "Peluquero Canino"
  specialty?: string;
  active: boolean;
  shiftAvailability?: 'todo_el_dia' | 'solo_manana' | 'solo_tarde';
}

export interface SalonConfig {
  id?: string;
  userId?: string;
  name: string;
  logoUrl: string;
  country?: string;
  language?: string;
  phonePrefix: string;
  phone: string;
  address: string;
  googleMapsUrl?: string;
  googleMapsPlaceName?: string;
  coordinates?: string;
  allowSimultaneousStaff?: boolean;
  maxSimultaneousAppointments?: number;
  workingDays: string;
  openTime: string;
  closeTime: string;
  currency: string;
  services: SalonService[];
  simultaneousCapacity: number; // e.g. 1 (solo groomer), 2 (2 groomers), 3+ (large team)
  staffMembers?: StaffMember[];
  staffScheduleConfig?: StaffScheduleConfig;
  reviews?: ClientReview[];
  morningOpen: string; // e.g. '08:00'
  morningClose: string; // e.g. '12:30'
  afternoonOpen: string; // e.g. '14:00'
  afternoonClose: string; // e.g. '19:30'
  hasDoubleShift: boolean;
  bookingSlug: string;
  activeDays: string[];
  hasMedicationProductsEnabled?: boolean;
  medicationProducts?: MedicationProduct[];
  medicationFee: number;
}

export interface Appointment {
  id: string;
  petId: string;
  petName: string;
  breed: string;
  tutorName: string;
  tutorPhone?: string;
  serviceName: string;
  time: string; // e.g. "09:00 AM"
  date?: string; // e.g. "15 de Octubre 2024"
  status: 'completado' | 'en_salon' | 'en_corte' | 'pendiente' | 'confirmada';
  statusLabel: string; // e.g. "COMPLETADO", "EN SALÓN", "EN CORTE", "PENDIENTE", "CONFIRMADA"
  groomer: string; // e.g. "Carlos Morales", "Mariana V."
  price: number;
  currency: string;
  paymentStatus: 'cobrado' | 'en_proceso' | 'por_cobrar';
  paymentStatusLabel: string; // "Cobrado", "En proceso", "Por cobrar"
  subStatus?: string; // e.g. "Finalizó 10:20", "En secado", "Sin confirmar", "Cliente recurrente", "En 2h 15m"
  subStatusType?: 'time' | 'action_pill' | 'warning' | 'tag';
  hasMedication?: boolean;
  notes?: string;
  rating?: number;
  reviewComment?: string;
}

export interface RetentionPet {
  id: string;
  petId: string;
  name: string;
  breed: string;
  tutorName: string;
  tutorPhone: string;
  rawPhone: string;
  photoUrl: string;
  isVip: boolean;
  lastVisitDate: string; // e.g. "15 de sept."
  weeksSinceLastVisit: number; // e.g. 6
  recommendedWeeks: number;
  urgency: 'esta_semana' | 'urgente' | 'proxima_semana';
  urgencyLabel: string; // e.g. "! Esta semana"
  suggestedMessage: string;
  templateName: string; // e.g. "Plantilla Spa Premium"
  alreadyBooked?: boolean;
}
