export type BehaviorMood = 'tranquilo' | 'inquieto' | 'dificil';

export interface VisitPhoto {
  beforeUrl?: string;
  afterUrl?: string;
}

export interface VisitServiceItem {
  id: string;
  name: string;
  price: number;
}

export interface Visit {
  id: string;
  date: string; // e.g. "15 de Septiembre" or ISO
  serviceName: string;
  services?: VisitServiceItem[]; // List of services performed (main + additional)
  price: number;
  currency: string;
  mood?: BehaviorMood;
  paid: boolean;
  notes?: string;
  careRecommendations?: string;
  healthNotes?: string;
  handlingNotes?: string;
  photos: VisitPhoto;
  nextRecommendedWeeks?: number | string;
  returnIntervalType?: '4' | '6' | '8' | 'custom';
  customReturnWeeks?: number | string;
  nextRecommendedVisitDate?: string;
  serviceResponsible?: string;
  deliveryDate?: string;
  deliveryTime?: string;
}

export interface Pet {
  id: string; // e.g. "#PET-2849"
  name: string;
  breed: string;
  size?: 'pequeno' | 'mediano' | 'grande' | string;
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
  sessionMood?: BehaviorMood;
  healthAllergies: string;
  handlingObservations: string;
  sessionNotes?: string;
  sessionHealthNotes?: string;
  sessionHandlingNotes?: string;
  careRecommendations?: string;
  lastVisit?: Visit;
  visitHistory: Visit[];
  recommendedIntervalWeeks: number | string;
  returnIntervalType?: '4' | '6' | '8' | 'custom';
  customReturnWeeks?: number | string;
  nextRecommendedVisitDate?: string;
  serviceResponsible?: string;
  deliveryDate?: string;
  deliveryTime?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  businessId: string;
  authProvider?: 'google' | 'password' | 'legacy';
  firebaseUid?: string;
  photoUrl?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface SaleRecord {
  id: string; // unique sale ID, e.g. "sale_1729..." or "sale_apt-1"
  businessId?: string;
  appointmentId: string;
  tutorName: string;
  tutorPhone?: string;
  petId?: string;
  petName: string;
  breed?: string;
  serviceName: string;
  amount: number; // Historical revenue amount locked upon service start
  servicePrice?: number; // alias
  finalPrice?: number;
  currency: string;
  groomer?: string;
  serviceStartedAt?: string; // ISO date string e.g. "2026-10-14T15:30:00.000Z"
  date: string; // e.g. "2026-10-14" or "14 de Octubre"
  time?: string; // e.g. "09:30 AM"
  paymentStatus?: 'cobrado' | 'en_proceso' | 'por_cobrar';
  paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';
  createdAt?: string; // ISO timestamp
  status: 'generado' | 'iniciado' | 'en_salon' | 'por_retirar' | 'listo' | 'entregado' | 'completado' | 'cancelado';
}

export interface BusinessAccountData {
  businessId: string;
  userId: string;
  config: SalonConfig;
  pets: Pet[];
  appointments: Appointment[];
  bookedRetentions: string[];
  sales?: SaleRecord[];
  updatedAt: string;
}

export interface ClientReview {
  id: string;
  businessId?: string;
  clientName: string;
  petName?: string;
  serviceName?: string;
  stars: number; // 1 to 5
  comment?: string;
  date: string; // formatted date or ISO
  createdAt?: string; // ISO timestamp
  verified?: boolean;
  tutorPhone?: string;
}

export type ReviewRequestState = 'pendiente' | 'iniciada' | 'calificado';

export interface ReviewRequestStatus {
  id: string; // appointment id or unique key
  tutorName: string;
  petName?: string;
  phone: string;
  rawPhone: string;
  lastVisitDate: string;
  state: ReviewRequestState;
  requestedAt?: string;
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
  galleryUrls?: string[]; // Up to 4 additional photos for public booking gallery
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
  city?: string;
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
  reviewRequests?: Record<string, { state: ReviewRequestState; requestedAt?: string }>;
  morningOpen: string; // e.g. '08:00'
  morningClose: string; // e.g. '12:30'
  lunchStart?: string; // e.g. '12:30 PM' or '12:30'
  lunchEnd?: string; // e.g. '01:30 PM' or '13:30'
  afternoonOpen: string; // e.g. '14:00'
  afternoonClose: string; // e.g. '19:30'
  hasDoubleShift: boolean;
  appointmentIntervalMinutes?: 15 | 30 | 45 | 60 | 90 | 120 | number; // e.g. 15, 30, 45, 60, 90, 120 or -1 (duration)
  bookingSlotInterval?: number; // alias
  bookingSlotMode?: 'fixed' | 'service_duration';
  bookingSlug: string;
  activeDays: string[];
  hasMedicationProductsEnabled?: boolean;
  medicationProducts?: MedicationProduct[];
  medicationFee: number;
  whatsappTemplates?: WhatsAppTemplate[];
}

export interface WhatsAppTemplate {
  id: string;
  title: string;
  content: string;
  isDefault?: boolean;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  businessId?: string;
  petId: string;
  petName: string;
  breed: string;
  size?: 'pequeno' | 'mediano' | 'grande' | string;
  tutorName: string;
  tutorPhone?: string;
  serviceName: string;
  time: string; // e.g. "09:00 AM"
  date?: string; // e.g. "15 de Octubre 2024"
  status: 'completado' | 'en_salon' | 'en_corte' | 'pendiente' | 'pendiente_confirmacion' | 'confirmada' | 'confirmed' | 'cancelada' | 'por_retirar';
  statusLabel: string; // e.g. "COMPLETADO", "EN SALÓN", "EN CORTE", "PENDIENTE", "POR CONFIRMAR", "CONFIRMADA", "CANCELADA", "LISTO PARA RETIRAR"
  groomer: string; // e.g. "Carlos Morales", "Mariana V."
  price: number;
  currency: string;
  paymentStatus: 'cobrado' | 'en_proceso' | 'por_cobrar';
  paymentStatusLabel: string; // "Cobrado", "En proceso", "Por cobrar"
  subStatus?: string; // e.g. "Finalizó 10:20", "En secado", "Sin confirmar", "Cliente recurrente", "En 2h 15m"
  subStatusType?: 'time' | 'action_pill' | 'warning' | 'tag';
  hasMedication?: boolean;
  beforePhotoUrl?: string;
  notes?: string;
  rating?: number;
  reviewComment?: string;
  createdAt?: string;
  serviceStartedAt?: string; // ISO date when "Comenzar servicio" was clicked
  salesRecordedAmount?: number; // Exact price recorded upon service initiation
  saleRecordId?: string; // ID of the associated sale record
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
  nextRecommendedDate?: string; // e.g. "14 de noviembre de 2026"
  daysRemaining?: number; // e.g. 35, 14, 7, 3, 1, 0, -4
  countdownText?: string; // e.g. "Faltan 35 días", "Hoy corresponde su visita", "Vencida hace 4 días"
  urgency: 'esta_semana' | 'urgente' | 'proxima_semana' | 'mas_adelante';
  urgencyLabel: string; // e.g. "! Esta semana", "! Urgente (Vencida)", "Próxima semana", "Más adelante"
  suggestedMessage: string;
  templateName: string; // e.g. "Plantilla Spa Premium"
  alreadyBooked?: boolean;
  returnCount?: number; // Total completed return visits (totalCompleted - 1, 0 if <= 1)
  returnCountLabel?: string; // "Sin regresos registrados", "Ha vuelto 1 vez", "Ha vuelto X veces"
}

