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
