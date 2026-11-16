import { ClientReview, SalonConfig, SalonService, Appointment, Pet, SaleRecord } from '../types';

const DEMO_REVIEW_COMMENT =
  '¡Increíble atención! Toby quedó súper suave y con un aroma riquísimo.';

/**
 * Detects the legacy demo review from DEFAULT_SALON_CONFIG so it never leaks into real accounts.
 */
export function isLegacyDemoReview(review: ClientReview, targetBusinessId?: string): boolean {
  if (!review) return true;
  if (targetBusinessId === 'biz_main') return false;
  if (
    review.id === 'rev-1' &&
    review.clientName?.trim() === 'Ana Gómez' &&
    (!review.businessId || review.businessId === 'biz_main')
  ) {
    return true;
  }
  if (
    !review.businessId &&
    review.clientName?.trim() === 'Ana Gómez' &&
    review.petName?.trim() === 'Toby' &&
    review.comment?.includes(DEMO_REVIEW_COMMENT)
  ) {
    return true;
  }
  return false;
}

/**
 * Validates, isolates by businessId, deduplicates (by ID and semantic signature),
 * and sorts all valid client reviews from newest to oldest.
 */
export function normalizeAndMergeReviews(
  businessId?: string,
  ...sources: Array<ClientReview[] | undefined | null>
): ClientReview[] {
  const byId = new Map<string, ClientReview>();
  const semanticSeen = new Map<string, string>();

  const targetBizId = businessId?.trim() || '';

  for (const list of sources) {
    if (!Array.isArray(list)) continue;

    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;

      const parsedStars = Number(raw.stars);
      if (!Number.isFinite(parsedStars) || parsedStars < 1 || parsedStars > 5) {
        continue;
      }

      const clientName = typeof raw.clientName === 'string' ? raw.clientName.trim() : '';
      if (!clientName) continue;

      const reviewBizId = typeof raw.businessId === 'string' ? raw.businessId.trim() : '';
      // Strict business isolation: never mix reviews belonging to another businessId
      if (targetBizId && reviewBizId && reviewBizId !== targetBizId) {
        continue;
      }

      if (isLegacyDemoReview(raw, targetBizId || undefined)) {
        continue;
      }

      const normalizedComment = typeof raw.comment === 'string' ? raw.comment.trim() : '';
      const normalizedReview: ClientReview = {
        ...raw,
        id: (typeof raw.id === 'string' && raw.id.trim())
          ? raw.id.trim()
          : `rev_${clientName.toLowerCase().replace(/\s+/g, '_')}_${raw.createdAt || raw.date || parsedStars}`,
        businessId: reviewBizId || targetBizId || undefined,
        clientName,
        stars: Math.round(parsedStars * 10) / 10,
        comment: normalizedComment,
        date: raw.date || '',
        createdAt: raw.createdAt || undefined,
        verified: raw.verified !== false
      };

      const semanticKey = `${clientName.toLowerCase()}|${normalizedReview.stars}|${normalizedComment.toLowerCase()}|${normalizedReview.createdAt || normalizedReview.date || ''}`;

      const existingId = normalizedReview.id;
      if (byId.has(existingId)) {
        const prev = byId.get(existingId)!;
        // Keep the fuller/more authoritative record
        byId.set(existingId, {
          ...prev,
          ...normalizedReview,
          comment: normalizedReview.comment || prev.comment || '',
          createdAt: normalizedReview.createdAt || prev.createdAt,
          date: normalizedReview.date || prev.date,
          businessId: normalizedReview.businessId || prev.businessId
        });
        semanticSeen.set(semanticKey, existingId);
        continue;
      }

      if (semanticSeen.has(semanticKey)) {
        // Already exists under another ID with identical client, stars, comment, and timestamp
        continue;
      }

      byId.set(existingId, normalizedReview);
      semanticSeen.set(semanticKey, existingId);
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => {
    const tA = a.createdAt || a.date || '';
    const tB = b.createdAt || b.date || '';
    return tB.localeCompare(tA);
  });

  return merged;
}

export interface ReviewStats {
  reviews: ClientReview[];
  totalReviews: number;
  sumStars: number;
  rawAverage: number;
  formattedAverage: string | null;
  starCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  starPercentages: Record<1 | 2 | 3 | 4 | 5, number>;
}

/**
 * Computes exact review count, arithmetic mean, and star distribution from deduplicated valid reviews.
 */
export function calculateReviewStats(reviews?: ClientReview[] | null, businessId?: string): ReviewStats {
  const validReviews = normalizeAndMergeReviews(businessId, reviews);
  const totalReviews = validReviews.length;
  const sumStars = validReviews.reduce((acc, r) => acc + Number(r.stars), 0);
  const rawAverage = totalReviews > 0 ? sumStars / totalReviews : 0;
  const formattedAverage =
    totalReviews > 0
      ? (rawAverage % 1 === 0 ? rawAverage.toFixed(1) : rawAverage.toFixed(1).replace('.', ','))
      : null;

  const starCounts: Record<1 | 2 | 3 | 4 | 5, number> = {
    5: validReviews.filter((r) => Math.round(r.stars) === 5).length,
    4: validReviews.filter((r) => Math.round(r.stars) === 4).length,
    3: validReviews.filter((r) => Math.round(r.stars) === 3).length,
    2: validReviews.filter((r) => Math.round(r.stars) === 2).length,
    1: validReviews.filter((r) => Math.round(r.stars) === 1).length
  };

  const starPercentages: Record<1 | 2 | 3 | 4 | 5, number> = {
    5: totalReviews > 0 ? Math.round((starCounts[5] / totalReviews) * 100) : 0,
    4: totalReviews > 0 ? Math.round((starCounts[4] / totalReviews) * 100) : 0,
    3: totalReviews > 0 ? Math.round((starCounts[3] / totalReviews) * 100) : 0,
    2: totalReviews > 0 ? Math.round((starCounts[2] / totalReviews) * 100) : 0,
    1: totalReviews > 0 ? Math.round((starCounts[1] / totalReviews) * 100) : 0
  };

  return {
    reviews: validReviews,
    totalReviews,
    sumStars,
    rawAverage,
    formattedAverage,
    starCounts,
    starPercentages
  };
}

export function parseTimestampMs(isoOrDate?: string): number {
  if (!isoOrDate) return 0;
  const parsed = Date.parse(isoOrDate);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface ProfileSourceCandidate {
  businessId: string;
  config: SalonConfig;
  services: SalonService[];
  appointments: Appointment[];
  pets?: Pet[];
  sales?: SaleRecord[];
  updatedAt?: string;
}

/**
 * Reconciles a business profile fetched from multiple backends (e.g. Cloud Firestore and Server API)
 * for the SAME businessId, choosing the fresher config by updatedAt for location/settings
 * while merging all valid reviews, appointments, pets, and sales so nothing is lost.
 */
export function reconcileBusinessSources(
  primary: ProfileSourceCandidate | null,
  secondary: ProfileSourceCandidate | null
): ProfileSourceCandidate | null {
  if (!primary && !secondary) return null;
  if (!primary) {
    if (!secondary) return null;
    const mergedReviews = normalizeAndMergeReviews(secondary.businessId, secondary.config?.reviews);
    return {
      ...secondary,
      config: { ...secondary.config, reviews: mergedReviews }
    };
  }
  if (!secondary) {
    const mergedReviews = normalizeAndMergeReviews(primary.businessId, primary.config?.reviews);
    return {
      ...primary,
      config: { ...primary.config, reviews: mergedReviews }
    };
  }

  // Never mix two different businesses
  if (primary.businessId !== secondary.businessId) {
    const primaryReviews = normalizeAndMergeReviews(primary.businessId, primary.config?.reviews);
    return {
      ...primary,
      config: { ...primary.config, reviews: primaryReviews }
    };
  }

  const timePrimary = Math.max(
    parseTimestampMs(primary.updatedAt),
    parseTimestampMs(primary.config?.updatedAt)
  );
  const timeSecondary = Math.max(
    parseTimestampMs(secondary.updatedAt),
    parseTimestampMs(secondary.config?.updatedAt)
  );

  const newer = timeSecondary > timePrimary ? secondary : primary;
  const older = timeSecondary > timePrimary ? primary : secondary;

  const mergedReviews = normalizeAndMergeReviews(
    newer.businessId,
    newer.config?.reviews,
    older.config?.reviews
  );

  // Merge appointments by ID preserving progressed statuses
  const aptMap = new Map<string, Appointment>();
  for (const a of older.appointments || []) if (a?.id) aptMap.set(a.id, a);
  for (const a of newer.appointments || []) if (a?.id) aptMap.set(a.id, a);
  const mergedApts = Array.from(aptMap.values());

  // Merge pets by ID
  const petMap = new Map<string, Pet>();
  for (const p of older.pets || []) if (p?.id) petMap.set(p.id, p);
  for (const p of newer.pets || []) if (p?.id) petMap.set(p.id, p);
  const mergedPets = Array.from(petMap.values());

  // Merge sales by ID
  const salesMap = new Map<string, SaleRecord>();
  for (const s of older.sales || []) if (s?.id) salesMap.set(s.id, s);
  for (const s of newer.sales || []) if (s?.id) salesMap.set(s.id, s);
  const mergedSales = Array.from(salesMap.values());

  const resolvedServices =
    newer.services && newer.services.length > 0
      ? newer.services
      : older.services || [];

  const resolvedConfig: SalonConfig = {
    ...older.config,
    ...newer.config,
    id: newer.businessId,
    // Respect explicit empty string "" or configured value from newer source; only fallback to older if undefined
    country: newer.config.country !== undefined ? newer.config.country : older.config.country,
    city: newer.config.city !== undefined ? newer.config.city : older.config.city,
    address: newer.config.address !== undefined ? newer.config.address : older.config.address,
    services: resolvedServices,
    reviews: mergedReviews,
    updatedAt: newer.config.updatedAt || newer.updatedAt || older.config.updatedAt || older.updatedAt
  };

  return {
    businessId: newer.businessId,
    config: resolvedConfig,
    services: resolvedServices,
    appointments: mergedApts,
    pets: mergedPets,
    sales: mergedSales,
    updatedAt: resolvedConfig.updatedAt
  };
}

export type CanonicalAppointmentStatus =
  | 'pendiente'
  | 'confirmada'
  | 'en_salon'
  | 'por_retirar'
  | 'completado'
  | 'cancelada';

/**
 * Normalizes any appointment status / statusLabel variant into a canonical status.
 */
export function normalizeAppointmentStatus(
  status?: string,
  statusLabel?: string
): CanonicalAppointmentStatus {
  const s = (status || '').trim().toLowerCase();
  const lbl = (statusLabel || '').trim().toUpperCase();

  if (s === 'completado' || s === 'completed' || lbl === 'COMPLETADO' || lbl === 'FINALIZADO') {
    return 'completado';
  }
  if (s === 'por_retirar' || lbl === 'POR RETIRAR' || lbl === 'LISTO PARA RETIRAR') {
    return 'por_retirar';
  }
  if (s === 'en_salon' || s === 'en_corte' || lbl === 'EN SALÓN' || lbl === 'EN SALON' || lbl === 'EN CORTE') {
    return 'en_salon';
  }
  if (s === 'confirmada' || s === 'confirmed' || lbl === 'CONFIRMADA') {
    return 'confirmada';
  }
  if (s === 'cancelada' || s === 'cancelled' || s === 'canceled' || lbl === 'CANCELADA') {
    return 'cancelada';
  }
  return 'pendiente';
}

export function getCanonicalStatusLabel(status: CanonicalAppointmentStatus): string {
  switch (status) {
    case 'completado':
      return 'COMPLETADO';
    case 'por_retirar':
      return 'LISTO PARA RETIRAR';
    case 'en_salon':
      return 'EN SALÓN';
    case 'confirmada':
      return 'CONFIRMADA';
    case 'cancelada':
      return 'CANCELADA';
    default:
      return 'POR CONFIRMAR';
  }
}

export function getAppointmentStatusRank(status?: string, statusLabel?: string): number {
  const canon = normalizeAppointmentStatus(status, statusLabel);
  switch (canon) {
    case 'completado':
      return 6;
    case 'por_retirar':
      return 5;
    case 'en_salon':
      return 4;
    case 'confirmada':
      return 3;
    case 'cancelada':
      return 2;
    case 'pendiente':
    default:
      return 1;
  }
}

export function isAppointmentActiveServiceOrCompleted(status?: string, statusLabel?: string): boolean {
  const canon = normalizeAppointmentStatus(status, statusLabel);
  return canon === 'en_salon' || canon === 'por_retirar' || canon === 'completado';
}

/**
 * Merges multiple appointment arrays by ID and semantic signature, always keeping
 * the further-progressed lifecycle status (pendiente < cancelada < confirmada < en_salon < por_retirar < completado).
 */
export function mergeAppointments(
  ...sources: Array<Appointment[] | undefined | null>
): Appointment[] {
  const byId = new Map<string, Appointment>();

  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || !raw.id) continue;
      const canonStatus = normalizeAppointmentStatus(raw.status, raw.statusLabel);
      const normalizedIncoming: Appointment = {
        ...raw,
        status: canonStatus,
        statusLabel: getCanonicalStatusLabel(canonStatus)
      };

      const existing = byId.get(raw.id);
      if (!existing) {
        byId.set(raw.id, normalizedIncoming);
      } else {
        const existingRank = getAppointmentStatusRank(existing.status, existing.statusLabel);
        const incomingRank = getAppointmentStatusRank(normalizedIncoming.status, normalizedIncoming.statusLabel);

        const winner = incomingRank > existingRank ? normalizedIncoming : existing;
        const loser = incomingRank > existingRank ? existing : normalizedIncoming;

        byId.set(raw.id, {
          ...loser,
          ...winner,
          status: winner.status,
          statusLabel: winner.statusLabel,
          petSnapshot: winner.petSnapshot || loser.petSnapshot,
          beforePhotoUrl: winner.beforePhotoUrl || loser.beforePhotoUrl,
          saleRecordId: winner.saleRecordId || loser.saleRecordId,
          salesRecordedAmount: winner.salesRecordedAmount || loser.salesRecordedAmount,
          serviceStartedAt: winner.serviceStartedAt || loser.serviceStartedAt,
          notes: winner.notes || loser.notes
        });
      }
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
  return merged;
}

/**
 * Checks whether an appointment belongs to a pet (by petId or petName + tutor).
 */
export function doesAppointmentMatchPet(apt: Appointment, pet: Pet): boolean {
  if (!apt || !pet) return false;
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
  if (cleanAptTutor && cleanPetTutor) {
    return cleanAptTutor === cleanPetTutor;
  }

  return true;
}

/**
 * Returns true ONLY if the pet has a genuinely completed/finalized service visit.
 * Unconfirmed, pending, cancelled, or in-progress bookings with a fabricated `paid: false`
 * placeholder lastVisit DO NOT count as a completed visit.
 */
export function hasGenuineCompletedVisit(pet: Pet, appointments?: Appointment[]): boolean {
  if (!pet) return false;

  const matchingApts = Array.isArray(appointments)
    ? appointments.filter((a) => doesAppointmentMatchPet(a, pet))
    : [];

  // 1. Any completed appointment guarantees a completed service
  if (matchingApts.some((a) => normalizeAppointmentStatus(a.status, a.statusLabel) === 'completado')) {
    return true;
  }

  // 2. Real visit history entries
  if (Array.isArray(pet.visitHistory) && pet.visitHistory.length > 0) {
    // Guard against legacy server.ts bug where pending bookings pushed a single unpaid v_* entry
    const hasRealHistoryVisit = pet.visitHistory.some((v) => {
      if (!v) return false;
      if (v.paid === true) return true;
      if (v.photos?.afterUrl || v.deliveryDate || v.careRecommendations || v.nextRecommendedWeeks !== undefined) {
        return true;
      }
      // If there are multiple visits or no uncompleted matching appointment for this date, treat as genuine history
      const onlyUncompletedForDate =
        matchingApts.length > 0 &&
        matchingApts.every((a) => normalizeAppointmentStatus(a.status, a.statusLabel) !== 'completado') &&
        v.id?.startsWith('v_') &&
        v.paid === false;
      return !onlyUncompletedForDate;
    });

    if (hasRealHistoryVisit) {
      return true;
    }
  }

  // 3. Check lastVisit (must be genuine, not a legacy phantom pending-booking lastVisit with paid:false)
  if (pet.lastVisit && pet.lastVisit.date) {
    const lv = pet.lastVisit;
    if (lv.paid === true || lv.photos?.afterUrl || lv.deliveryDate || lv.careRecommendations || lv.nextRecommendedWeeks !== undefined) {
      return true;
    }

    // Legacy firebase.ts fabricated lastVisit with paid: false and visitHistory: [] on public bookings
    const looksLikePhantomBookingVisit =
      lv.paid === false &&
      (!pet.visitHistory || pet.visitHistory.length === 0) &&
      typeof lv.id === 'string' &&
      lv.id.startsWith('v_');

    if (!looksLikePhantomBookingVisit) {
      // Only treat unpaid lastVisit as genuine if there isn't strictly an unstarted/pending/cancelled appointment for it
      const hasOnlyUnstartedBooking =
        matchingApts.length > 0 &&
        matchingApts.every((a) => normalizeAppointmentStatus(a.status, a.statusLabel) !== 'completado');
      if (!hasOnlyUnstartedBooking) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines if a Pet record belongs in the "Clientes" directory.
 * A pending/confirmed/cancelled online booking that has never been attended or completed
 * must NOT appear prematurely in "Clientes".
 */
export function isClientDirectoryPet(pet: Pet, appointments?: Appointment[]): boolean {
  if (!pet) return false;
  if (pet.isManualEntry === true) return true;
  if (hasGenuineCompletedVisit(pet, appointments)) return true;

  if (Array.isArray(appointments)) {
    const hasStartedOrCompleted = appointments.some(
      (a) =>
        doesAppointmentMatchPet(a, pet) &&
        isAppointmentActiveServiceOrCompleted(a.status, a.statusLabel)
    );
    if (hasStartedOrCompleted) return true;
  }

  return false;
}

/**
 * Builds a complete Pet record from an Appointment (and optional petSnapshot / existing Pet)
 * when service begins ('en_salon') or completes ('completado').
 */
export function materializePetFromAppointment(
  apt: Appointment,
  existingPet?: Pet,
  extraPetData?: Partial<Pet>
): Pet {
  const snapshot = extraPetData || apt.petSnapshot || {};
  const incomingPhoto = apt.beforePhotoUrl || snapshot.photoUrl || existingPet?.photoUrl;
  const parsedSize = snapshot.size || apt.size || existingPet?.size || 'mediano';
  const parsedWeight =
    Number(snapshot.weightKg) ||
    existingPet?.weightKg ||
    (parsedSize === 'pequeno' ? 6 : parsedSize === 'grande' ? 24 : 14);
  const resolvedPhone = apt.tutorPhone || snapshot.tutor?.phone || existingPet?.tutor?.phone || '';

  return {
    id: existingPet?.id || apt.petId || `#PET-${Math.floor(1000 + Math.random() * 9000)}`,
    name: apt.petName || snapshot.name || existingPet?.name || 'Mascota',
    breed: apt.breed || snapshot.breed || existingPet?.breed || 'Mestizo',
    size: parsedSize,
    age: snapshot.age || existingPet?.age || '1 año',
    gender: snapshot.gender || existingPet?.gender || 'Macho',
    weightKg: parsedWeight,
    isVip: existingPet?.isVip || false,
    photoUrl:
      incomingPhoto ||
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
    tutor: {
      name: apt.tutorName || snapshot.tutor?.name || existingPet?.tutor?.name || 'Cliente',
      phone: resolvedPhone,
      rawPhone: resolvedPhone.replace(/\D/g, '')
    },
    habitualMood: (snapshot.habitualMood as any) || existingPet?.habitualMood || 'tranquilo',
    healthAllergies:
      snapshot.healthAllergies !== undefined
        ? snapshot.healthAllergies
        : existingPet?.healthAllergies || '',
    handlingObservations:
      snapshot.handlingObservations !== undefined
        ? snapshot.handlingObservations
        : existingPet?.handlingObservations || '',
    lastVisit: existingPet?.lastVisit,
    visitHistory: existingPet?.visitHistory || [],
    recommendedIntervalWeeks: existingPet?.recommendedIntervalWeeks || 4,
    returnIntervalType: existingPet?.returnIntervalType,
    customReturnWeeks: existingPet?.customReturnWeeks,
    nextRecommendedVisitDate: existingPet?.nextRecommendedVisitDate,
    isManualEntry: existingPet?.isManualEntry
  };
}

