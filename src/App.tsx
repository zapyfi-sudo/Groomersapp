import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Pet, SalonConfig, Appointment, RetentionPet, ClientReview, UserAccount, BusinessAccountData, WhatsAppTemplate, SaleRecord } from './types';
import {
  deriveRetentionPets,
  loadLanguage,
  saveLanguage
} from './utils/storage';
import {
  initSaasDatabase,
  getSyncActiveData,
  getSyncActiveAccount,
  getSyncAccountsList,
  persistActiveConfig,
  persistActivePets,
  persistActiveAppointments,
  persistActiveBookedRetentions,
  persistActiveBusinessData,
  persistActiveSales
} from './utils/saasDb';
import {
  syncBusinessToServer,
  fetchBusinessProfile,
  subscribeToBusinessAppointments,
  subscribeToBusinessPets,
  subscribeToBusinessReviews,
  updateAppointmentStatusOnServer,
  fetchLatestAppointmentsAndPets,
  createInternalAppointment,
  subscribeToBusinessSales,
  recordSaleInFirestore
} from './utils/api';
import { AppLanguage } from './utils/translations';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { RetentionView } from './components/RetentionView';
import { PetProfileView } from './components/PetProfileView';
import { AjustesView } from './components/AjustesView';
import { AgendaView } from './components/AgendaView';
import { InSalonView } from './components/InSalonView';
import { PetListView } from './components/PetListView';
import { AccountAuthModal } from './components/AccountAuthModal';
import { LoginScreen } from './components/LoginScreen';
import { PublicBookingPage } from './components/PublicBookingPage';
import { PublicReviewPage } from './components/PublicReviewPage';
import { NewAppointmentView } from './components/NewAppointmentView';
import { sortPetsByAgendaDate } from './utils/petSorting';

import { decodePublicProfileToken, extractSlugOnly } from './utils/slugUtils';

function getPublicReviewIdentifierFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Path routing: /calificar/:idOrSlug, /opiniones/:idOrSlug, /review/:idOrSlug, /reviews/:idOrSlug, /calificaciones/:idOrSlug
  const path = window.location.pathname;
  const pathMatch = path.match(/^\/(?:calificar|opiniones|review|reviews|calificaciones)\/([^\/?#]+)/i);
  if (pathMatch && pathMatch[1]) {
    return extractSlugOnly(decodeURIComponent(pathMatch[1]));
  }

  // 2. Query params: ?calificar=slug or ?review=slug
  const searchParams = new URLSearchParams(window.location.search);
  const explicitReview = searchParams.get('calificar') || searchParams.get('review') || searchParams.get('opinion');
  if (explicitReview) {
    return extractSlugOnly(explicitReview) || explicitReview;
  }

  // 3. Hash routing: #calificar/:idOrSlug, #review/:idOrSlug
  const hash = window.location.hash;
  const hashMatch = hash.match(/^#(?:calificar|opiniones|review|reviews|calificaciones)(?:\/([^\/?#]+))?/i);
  if (hashMatch && hashMatch[1]) {
    return extractSlugOnly(decodeURIComponent(hashMatch[1]));
  }

  // 4. Exact path match /calificar or /opiniones without slug -> default
  if (path === '/calificar' || path === '/calificar/' || path === '/opiniones' || path === '/opiniones/' || hash === '#calificar') {
    return 'default_review';
  }

  return null;
}

function getPublicBookingIdentifierFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Path routing: /reservas/:idOrSlug, /book/:idOrSlug, /booking/:idOrSlug, /reservar/:idOrSlug
  const path = window.location.pathname;
  const pathMatch = path.match(/^\/(?:book|booking|reservar|reservas)\/([^\/?#]+)/i);
  if (pathMatch && pathMatch[1]) {
    return extractSlugOnly(decodeURIComponent(pathMatch[1]));
  }

  // 2. Query params: businessId, bid, slug, or embedded token p
  const searchParams = new URLSearchParams(window.location.search);
  const explicitBiz = searchParams.get('businessId') || searchParams.get('bid') || searchParams.get('slug');
  if (explicitBiz) {
    return extractSlugOnly(explicitBiz) || explicitBiz;
  }

  const token = searchParams.get('p') || searchParams.get('token');
  if (token) {
    const decoded = decodePublicProfileToken(token);
    if (decoded && decoded.businessId) {
      return decoded.businessId;
    }
  }

  // 3. Hash routing: #reservas/:idOrSlug, #reservar/:idOrSlug or #book/:idOrSlug
  const hash = window.location.hash;
  const hashMatch = hash.match(/^#(?:book|booking|reservar|reservas)(?:\/([^\/?#]+))?/i);
  if (hashMatch && hashMatch[1]) {
    return extractSlugOnly(decodeURIComponent(hashMatch[1]));
  }

  // 4. ?book=online parameter without explicit id -> invalid identifier to show clean error
  if (searchParams.get('book') === 'online' || hash === '#reservar' || hash === '#reservas' || path === '/reservas' || path === '/book') {
    return explicitBiz || 'not_specified_business';
  }

  return null;
}

export default function App() {
  // Check if current URL is a public booking or public review page request
  const [urlBookingId, setUrlBookingId] = useState<string | null>(() => getPublicBookingIdentifierFromUrl());
  const [urlReviewId, setUrlReviewId] = useState<string | null>(() => getPublicReviewIdentifierFromUrl());
  const [previewBookingId, setPreviewBookingId] = useState<string | null>(null);
  const [previewReviewId, setPreviewReviewId] = useState<string | null>(null);

  useEffect(() => {
    const handleUrlChange = () => {
      setUrlBookingId(getPublicBookingIdentifierFromUrl());
      setUrlReviewId(getPublicReviewIdentifierFromUrl());
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Synchronous initial state from local persistent cache (zero flicker / immediate render)
  const initialData = useMemo(() => getSyncActiveData(), []);
  const initialAccount = useMemo(() => getSyncActiveAccount(), []);
  const initialAccountsList = useMemo(() => getSyncAccountsList(), []);

  // Multi-User SaaS Account State
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(initialAccount);
  const [accountsList, setAccountsList] = useState<UserAccount[]>(initialAccountsList);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);

  // Business Data State
  const [salonConfig, setSalonConfig] = useState<SalonConfig>(initialData.config);
  const [pets, setPets] = useState<Pet[]>(() => sortPetsByAgendaDate(initialData.pets, initialData.appointments));
  const [appointments, setAppointments] = useState<Appointment[]>(initialData.appointments);
  const [currentLanguage, setCurrentLanguage] = useState<AppLanguage>(() => loadLanguage());
  const [bookedRetentions, setBookedRetentions] = useState<string[]>(initialData.bookedRetentions || []);

  // Selected pet for profile view (defaults to the most recently attended pet)
  const [selectedPetId, setSelectedPetId] = useState<string>(() => {
    const sorted = sortPetsByAgendaDate(initialData.pets, initialData.appointments);
    return sorted[0]?.id || initialData.pets[0]?.id || '#PET-2849';
  });

  // Booking from Por Volver
  const [bookingFromRetention, setBookingFromRetention] = useState<{
    isOpen: boolean;
    pet: Pet | null;
    targetDate?: string;
  }>({
    isOpen: false,
    pet: null
  });

  // Real-time sales records state (Mejora 3)
  const [sales, setSales] = useState<SaleRecord[]>(() => {
    return initialData.sales || [];
  });

  // Real-time notification for incoming public bookings (Mejora 1)
  const [newBookingNotification, setNewBookingNotification] = useState<{
    id?: string;
    tutorName: string;
    petName: string;
    serviceName: string;
    time?: string;
    date?: string;
  } | null>(null);

  // Navigation tabs: Agenda, En salón, Clientes, Por volver, Ajustes
  const [currentTab, setCurrentTab] = useState<'retencion' | 'ficha' | 'onboarding' | 'agenda' | 'en_salon' | 'mascotas'>('agenda');

  // Guard ref to prevent initial mount from overwriting IndexedDB with stale fallback state
  const isDbInitialized = useRef<boolean>(false);

  // Helper to merge pet records preserving rich existing groomer details
  const mergePetRecords = (existing: Pet, incoming: Pet): Pet => {
    return {
      ...incoming,
      ...existing,
      size: existing.size || incoming.size || 'mediano',
      weightKg: existing.weightKg || incoming.weightKg || 10,
      habitualMood: existing.habitualMood || incoming.habitualMood || 'tranquilo',
      healthAllergies: existing.healthAllergies || incoming.healthAllergies || '',
      handlingObservations: existing.handlingObservations || incoming.handlingObservations || '',
      photoUrl: existing.photoUrl || incoming.photoUrl || '',
      tutor: {
        ...incoming.tutor,
        ...existing.tutor
      },
      lastVisit: existing.lastVisit || incoming.lastVisit,
      visitHistory: (existing.visitHistory && existing.visitHistory.length > 0)
        ? existing.visitHistory
        : (incoming.visitHistory || []),
      recommendedIntervalWeeks: existing.recommendedIntervalWeeks || incoming.recommendedIntervalWeeks || 4,
      returnIntervalType: existing.returnIntervalType || incoming.returnIntervalType,
      customReturnWeeks: existing.customReturnWeeks || incoming.customReturnWeeks,
      nextRecommendedVisitDate: existing.nextRecommendedVisitDate || incoming.nextRecommendedVisitDate
    };
  };

  // Initialize IndexedDB & multi-account database on startup (with automatic migration of legacy data)
  useEffect(() => {
    initSaasDatabase().then((res) => {
      if (res.activeAccount) {
        setActiveAccount(res.activeAccount);
      }
      if (res.accounts && res.accounts.length > 0) {
        setAccountsList(res.accounts);
      }
      if (res.activeData) {
        const sortedPets = sortPetsByAgendaDate(res.activeData.pets, res.activeData.appointments);
        setSalonConfig(res.activeData.config);
        setPets(sortedPets);
        setAppointments(res.activeData.appointments);
        setBookedRetentions(res.activeData.bookedRetentions || []);
        if (sortedPets.length > 0) {
          setSelectedPetId(sortedPets[0].id);
        }
        isDbInitialized.current = true;

        // Fetch from persistent cloud database (Firestore / Server API) to ensure latest slug, appointments, and pets
        const bizId = res.activeData.config?.id || res.activeData.businessId || 'biz_main';
        fetchBusinessProfile(bizId)
          .then((profile) => {
            if (profile && profile.config) {
              setSalonConfig((prev) => {
                const prevHasPhotos = (prev.services || []).some((s) => s.imageUrl || (s.galleryUrls && s.galleryUrls.length > 0));
                const profileHasPhotos = (profile.config.services || []).some((s) => s.imageUrl || (s.galleryUrls && s.galleryUrls.length > 0));

                let mergedServices = (profile.config.services && profile.config.services.length > 0)
                  ? profile.config.services
                  : (prev.services || []);

                if (prevHasPhotos && !profileHasPhotos) {
                  const prevSvcMap = new Map((prev.services || []).map((s) => [s.name.trim().toLowerCase(), s]));
                  mergedServices = mergedServices.map((resSvc) => {
                    const match = prevSvcMap.get(resSvc.name.trim().toLowerCase());
                    if (match && (match.imageUrl || match.galleryUrls)) {
                      return {
                        ...resSvc,
                        imageUrl: match.imageUrl || resSvc.imageUrl,
                        galleryUrls: match.galleryUrls || resSvc.galleryUrls
                      };
                    }
                    return resSvc;
                  });
                }

                return {
                  ...prev,
                  ...profile.config,
                  name: prev.name && prev.name !== 'Groomer Aida' ? prev.name : profile.config.name,
                  country: prev.country && prev.country !== 'Argentina' ? prev.country : profile.config.country,
                  currency: prev.currency || profile.config.currency,
                  bookingSlug: profile.config.bookingSlug || prev.bookingSlug,
                  services: mergedServices
                };
              });

              if (profile.appointments && profile.appointments.length > 0) {
                setAppointments((prev) => {
                  const map = new Map<string, Appointment>();
                  for (const a of prev) if (a?.id) map.set(a.id, a);

                  for (const incoming of profile.appointments) {
                    if (!incoming?.id) continue;
                    const existing = map.get(incoming.id);
                    if (!existing) {
                      map.set(incoming.id, incoming);
                    } else {
                      // Confirmed status must ALWAYS take precedence and never revert to pending
                      const isConfirmed =
                        existing.status === 'confirmada' ||
                        (existing.status as any) === 'confirmed' ||
                        incoming.status === 'confirmada' ||
                        (incoming.status as any) === 'confirmed';
                      const isCompleted =
                        existing.status === 'completado' ||
                        (existing.status as any) === 'completed' ||
                        incoming.status === 'completado' ||
                        (incoming.status as any) === 'completed';
                      const isInSalon =
                        existing.status === 'en_salon' ||
                        existing.status === 'en_corte' ||
                        incoming.status === 'en_salon' ||
                        incoming.status === 'en_corte';
                      const isCancelled =
                        existing.status === 'cancelada' ||
                        incoming.status === 'cancelada';

                      const resolvedStatus = isConfirmed
                        ? 'confirmada'
                        : isCompleted
                        ? 'completado'
                        : isInSalon
                        ? 'en_salon'
                        : isCancelled
                        ? 'cancelada'
                        : (incoming.status || existing.status || 'pendiente');

                      const resolvedLabel = resolvedStatus === 'confirmada'
                        ? 'CONFIRMADA'
                        : resolvedStatus === 'completado'
                        ? 'COMPLETADO'
                        : resolvedStatus === 'en_salon'
                        ? 'EN SALÓN'
                        : resolvedStatus === 'cancelada'
                        ? 'CANCELADA'
                        : (incoming.statusLabel || existing.statusLabel || 'POR CONFIRMAR');

                      map.set(incoming.id, {
                        ...incoming,
                        ...existing,
                        status: resolvedStatus,
                        statusLabel: resolvedLabel
                      });
                    }
                  }

                  const merged = Array.from(map.values());
                  merged.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
                  persistActiveAppointments(merged);
                  return merged;
                });
              }

              if (profile.pets && profile.pets.length > 0) {
                setPets((prev) => {
                  const map = new Map<string, Pet>();
                  for (const p of prev) if (p?.id) map.set(p.id, p);
                  for (const incoming of profile.pets!) {
                    if (!incoming?.id) continue;
                    const existing = map.get(incoming.id);
                    if (existing) {
                      map.set(incoming.id, mergePetRecords(existing, incoming));
                    } else {
                      map.set(incoming.id, incoming);
                    }
                  }
                  const merged = Array.from(map.values());
                  persistActivePets(merged);
                  return merged;
                });
              }
            }
          })
          .catch((err) => {
            console.warn('Initial cloud sync warning:', err);
          });
      }
    }).catch((err) => {
      console.warn('initSaasDatabase warning:', err);
    });
  }, []);

  // Real-time synchronization of public appointments & pets from Cloud Firestore + Server Polling
  useEffect(() => {
    const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';
    if (!currentBizId) return;

    // 1. Subscribe to real-time incoming public appointments via Firestore
    const unsubApts = subscribeToBusinessAppointments(currentBizId, (incomingApts) => {
      if (!incomingApts) return;

      setAppointments((prev) => {
        const prevIds = new Set(prev.map((a) => a.id));
        const brandNew = incomingApts.filter(
          (a) => !prevIds.has(a.id) && (a.status === 'pendiente' || a.statusLabel === 'POR CONFIRMAR')
        );

        if (brandNew.length > 0) {
          const latest = brandNew[0];
          setNewBookingNotification({
            id: latest.id,
            tutorName: latest.tutorName || 'Cliente',
            petName: latest.petName || 'Mascota',
            serviceName: latest.serviceName || 'Servicio de peluquería',
            time: latest.time,
            date: latest.date
          });
          setTimeout(() => setNewBookingNotification(null), 8000);
        }

        const map = new Map<string, Appointment>();
        for (const a of prev) if (a?.id) map.set(a.id, a);

        for (const incoming of incomingApts) {
          if (!incoming?.id) continue;
          const existing = map.get(incoming.id);
          if (!existing) {
            map.set(incoming.id, incoming);
          } else {
            // Never overwrite a progressed appointment status backwards
            const isCompleted =
              existing.status === 'completado' ||
              (existing.status as any) === 'completed' ||
              incoming.status === 'completado' ||
              (incoming.status as any) === 'completed';
            const isPorRetirar =
              existing.status === 'por_retirar' ||
              existing.statusLabel === 'LISTO PARA RETIRAR' ||
              incoming.status === 'por_retirar' ||
              incoming.statusLabel === 'LISTO PARA RETIRAR';
            const isInSalon =
              existing.status === 'en_salon' ||
              existing.status === 'en_corte' ||
              incoming.status === 'en_salon' ||
              incoming.status === 'en_corte';
            const isConfirmed =
              existing.status === 'confirmada' ||
              (existing.status as any) === 'confirmed' ||
              incoming.status === 'confirmada' ||
              (incoming.status as any) === 'confirmed';
            const isCancelled =
              existing.status === 'cancelada' ||
              incoming.status === 'cancelada';

            const resolvedStatus = isCompleted
              ? 'completado'
              : isPorRetirar
              ? 'por_retirar'
              : isInSalon
              ? 'en_salon'
              : isConfirmed
              ? 'confirmada'
              : isCancelled
              ? 'cancelada'
              : (incoming.status || existing.status || 'pendiente');

            const resolvedLabel = resolvedStatus === 'completado'
              ? 'COMPLETADO'
              : resolvedStatus === 'por_retirar'
              ? 'LISTO PARA RETIRAR'
              : resolvedStatus === 'en_salon'
              ? 'EN SALÓN'
              : resolvedStatus === 'confirmada'
              ? 'CONFIRMADA'
              : resolvedStatus === 'cancelada'
              ? 'CANCELADA'
              : (incoming.statusLabel || existing.statusLabel || 'POR CONFIRMAR');

            map.set(incoming.id, {
              ...incoming,
              ...existing,
              status: resolvedStatus,
              statusLabel: resolvedLabel
            });
          }
        }

        const merged = Array.from(map.values());
        merged.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
        persistActiveAppointments(merged);
        return merged;
      });
    });

    // 2. Subscribe to real-time incoming pets via Firestore
    const unsubPets = subscribeToBusinessPets(currentBizId, (incomingPets) => {
      if (!incomingPets) return;

      setPets((prev) => {
        const map = new Map<string, Pet>();
        for (const p of prev) if (p?.id) map.set(p.id, p);
        for (const incoming of incomingPets) {
          if (!incoming?.id) continue;
          const existing = map.get(incoming.id);
          if (existing) {
            map.set(incoming.id, mergePetRecords(existing, incoming));
          } else {
            map.set(incoming.id, incoming);
          }
        }
        const merged = Array.from(map.values());
        persistActivePets(merged);
        return merged;
      });
    });

    // 2b. Subscribe to real-time incoming reviews via Firestore
    const unsubReviews = subscribeToBusinessReviews(currentBizId, (incomingReviews) => {
      if (!incomingReviews) return;

      setSalonConfig((prev) => {
        const revMap = new Map<string, ClientReview>();
        for (const r of (prev.reviews || [])) if (r?.id) revMap.set(r.id, r);
        for (const r of incomingReviews) if (r?.id) revMap.set(r.id, r);
        const merged = Array.from(revMap.values());
        merged.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
        return {
          ...prev,
          reviews: merged
        };
      });
    });

    // 2c. Subscribe to real-time incoming sales via Firestore (Mejora 3)
    const unsubSales = subscribeToBusinessSales(currentBizId, (incomingSales) => {
      if (!incomingSales) return;
      setSales((prev) => {
        const map = new Map<string, SaleRecord>();
        for (const s of prev) if (s?.id) map.set(s.id, s);
        for (const s of incomingSales) if (s?.id) map.set(s.id, s);
        const merged = Array.from(map.values());
        merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        persistActiveSales(merged);
        return merged;
      });
    });

    // 3. Periodic server polling (every 8 seconds + window focus) to ensure zero desync across all environments
    const pollServerSync = async () => {
      try {
        const latest = await fetchLatestAppointmentsAndPets(currentBizId);
        if (latest) {
          if (latest.appointments && latest.appointments.length > 0) {
            setAppointments((prev) => {
              const prevMap = new Map<string, Appointment>();
              for (const a of prev) if (a?.id) prevMap.set(a.id, a);

              const brandNew = latest.appointments.filter(
                (a) => !prevMap.has(a.id) && (a.status === 'pendiente' || a.statusLabel === 'POR CONFIRMAR')
              );

              if (brandNew.length > 0) {
                const newest = brandNew[0];
                setNewBookingNotification({
                  id: newest.id,
                  tutorName: newest.tutorName || 'Cliente',
                  petName: newest.petName || 'Mascota',
                  serviceName: newest.serviceName || 'Servicio de peluquería',
                  time: newest.time,
                  date: newest.date
                });
                setTimeout(() => setNewBookingNotification(null), 8000);
              }

              for (const a of latest.appointments) {
                if (a?.id) {
                  const existing = prevMap.get(a.id);
                  if (!existing) {
                    prevMap.set(a.id, a);
                  } else {
                    // Progressed status must ALWAYS take precedence and never revert
                    const isCompleted =
                      existing.status === 'completado' ||
                      (existing.status as any) === 'completed' ||
                      a.status === 'completado' ||
                      (a.status as any) === 'completed';
                    const isPorRetirar =
                      existing.status === 'por_retirar' ||
                      existing.statusLabel === 'LISTO PARA RETIRAR' ||
                      a.status === 'por_retirar' ||
                      a.statusLabel === 'LISTO PARA RETIRAR';
                    const isInSalon =
                      existing.status === 'en_salon' ||
                      existing.status === 'en_corte' ||
                      a.status === 'en_salon' ||
                      a.status === 'en_corte';
                    const isConfirmed =
                      existing.status === 'confirmada' ||
                      (existing.status as any) === 'confirmed' ||
                      a.status === 'confirmada' ||
                      (a.status as any) === 'confirmed';
                    const isCancelled =
                      existing.status === 'cancelada' ||
                      a.status === 'cancelada';

                    const resolvedStatus = isCompleted
                      ? 'completado'
                      : isPorRetirar
                      ? 'por_retirar'
                      : isInSalon
                      ? 'en_salon'
                      : isConfirmed
                      ? 'confirmada'
                      : isCancelled
                      ? 'cancelada'
                      : (a.status || existing.status || 'pendiente');

                    const resolvedLabel = resolvedStatus === 'completado'
                      ? 'COMPLETADO'
                      : resolvedStatus === 'por_retirar'
                      ? 'LISTO PARA RETIRAR'
                      : resolvedStatus === 'en_salon'
                      ? 'EN SALÓN'
                      : resolvedStatus === 'confirmada'
                      ? 'CONFIRMADA'
                      : resolvedStatus === 'cancelada'
                      ? 'CANCELADA'
                      : (a.statusLabel || existing.statusLabel || 'POR CONFIRMAR');

                    prevMap.set(a.id, {
                      ...a,
                      ...existing,
                      status: resolvedStatus,
                      statusLabel: resolvedLabel
                    });
                  }
                }
              }

              const merged = Array.from(prevMap.values());
              merged.sort((x, y) => (y.createdAt || y.id || '').localeCompare(x.createdAt || x.id || ''));
              persistActiveAppointments(merged);
              return merged;
            });
          }

          if (latest.pets && latest.pets.length > 0) {
            setPets((prev) => {
              const map = new Map<string, Pet>();
              for (const p of prev) if (p?.id) map.set(p.id, p);
              for (const incoming of latest.pets) {
                if (!incoming?.id) continue;
                const existing = map.get(incoming.id);
                if (existing) {
                  map.set(incoming.id, mergePetRecords(existing, incoming));
                } else {
                  map.set(incoming.id, incoming);
                }
              }
              const merged = Array.from(map.values());
              persistActivePets(merged);
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn('Background server polling error:', err);
      }
    };

    pollServerSync();
    const pollInterval = setInterval(pollServerSync, 8000);

    const onFocus = () => pollServerSync();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      unsubApts();
      unsubPets();
      unsubReviews();
      unsubSales();
      clearInterval(pollInterval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [activeAccount?.businessId, salonConfig?.id]);

  // Auto-sync: Guarantee any appointment that has been started (en_salon, en_corte, por_retirar, completado)
  // is registered in sales state and persisted permanently (Mejora 3)
  useEffect(() => {
    if (!appointments || appointments.length === 0) return;
    const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';

    const existingSalesMap = new Map<string, SaleRecord>();
    for (const s of sales) {
      if (s?.id) existingSalesMap.set(s.appointmentId || s.id, s);
    }

    let hasAdded = false;
    for (const apt of appointments) {
      const isStarted =
        apt.status === 'en_salon' ||
        apt.status === 'en_corte' ||
        apt.status === 'por_retirar' ||
        apt.status === 'completado';

      if (!isStarted) continue;

      const key = apt.id;
      if (!existingSalesMap.has(key)) {
        let priceVal = Number(apt.salesRecordedAmount);
        if (!priceVal || isNaN(priceVal) || priceVal <= 0) {
          priceVal = Number(String(apt.price).replace(/[^0-9.,]/g, '').replace(',', '.'));
        }
        if (!priceVal || isNaN(priceVal) || priceVal <= 0) {
          const matched = salonConfig.services?.find(
            (s) => s.name?.toLowerCase().trim() === apt.serviceName?.toLowerCase().trim()
          );
          if (matched) {
            priceVal = Number(matched.price);
          }
        }

        if (priceVal > 0) {
          const dateIso = apt.serviceStartedAt || apt.createdAt || new Date().toISOString();
          const autoSale: SaleRecord = {
            id: apt.saleRecordId || `sale_${apt.id}`,
            appointmentId: apt.id,
            businessId: currentBizId,
            petId: apt.petId,
            petName: apt.petName,
            breed: apt.breed,
            tutorName: apt.tutorName,
            tutorPhone: apt.tutorPhone,
            serviceName: apt.serviceName,
            amount: priceVal,
            servicePrice: priceVal,
            finalPrice: priceVal,
            currency: apt.currency || salonConfig.currency || 'MXN',
            groomer: apt.groomer || 'Personal de turno',
            paymentStatus: apt.paymentStatus || 'cobrado',
            date: apt.date || dateIso.split('T')[0],
            time: apt.time || 'En servicio',
            createdAt: apt.createdAt || dateIso,
            serviceStartedAt: apt.serviceStartedAt || dateIso,
            status: (apt.status as any) || 'en_salon'
          };
          existingSalesMap.set(key, autoSale);
          hasAdded = true;
          recordSaleInFirestore(currentBizId, autoSale).catch(() => {});
          fetch(`/api/businesses/${encodeURIComponent(currentBizId)}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sale: autoSale })
          }).catch(() => {});
        }
      }
    }

    if (hasAdded) {
      const merged = Array.from(existingSalesMap.values());
      setSales(merged);
      persistActiveSales(merged);
    }
  }, [appointments, salonConfig.services, salonConfig.currency, activeAccount?.businessId, salonConfig?.id]);

  // Immediate Persistent Auto-Save to IndexedDB, Mirror, and Server API
  useEffect(() => {
    if (!isDbInitialized.current) return;
    if (salonConfig) {
      persistActiveConfig(salonConfig);
    }
  }, [salonConfig]);

  useEffect(() => {
    if (!isDbInitialized.current) return;
    persistActivePets(pets);
  }, [pets]);

  useEffect(() => {
    if (!isDbInitialized.current) return;
    persistActiveAppointments(appointments);
  }, [appointments]);

  useEffect(() => {
    if (!isDbInitialized.current) return;
    saveLanguage(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    if (!isDbInitialized.current) return;
    persistActiveBookedRetentions(bookedRetentions);
  }, [bookedRetentions]);

  // Derived dynamic Retention Pets directly from real Pet state
  const retentionPets: RetentionPet[] = useMemo(() => {
    return deriveRetentionPets(pets, salonConfig.name, bookedRetentions, appointments);
  }, [pets, salonConfig.name, bookedRetentions, appointments]);

  // Active selected pet (fallback to first pet or clean default)
  const currentPet: Pet = useMemo(() => {
    return pets.find((p) => p.id === selectedPetId) || pets[0] || {
      id: '#PET-1000',
      name: 'Sin Mascota',
      breed: 'Mestizo',
      age: '1 año',
      gender: 'Macho',
      weightKg: 10,
      isVip: false,
      photoUrl: '',
      tutor: { name: 'Tutor', phone: '', rawPhone: '' },
      habitualMood: 'tranquilo',
      healthAllergies: '',
      handlingObservations: '',
      lastVisit: {
        id: 'v-0',
        date: 'Hoy',
        serviceName: 'Baño',
        price: 20,
        currency: salonConfig.currency,
        mood: 'tranquilo',
        paid: true,
        photos: {}
      },
      visitHistory: [],
      recommendedIntervalWeeks: 6
    };
  }, [pets, selectedPetId, salonConfig.currency]);

  // Account switching / login handler
  const handleAccountChanged = (newData: BusinessAccountData, newAccount: UserAccount) => {
    setActiveAccount(newAccount);
    setSalonConfig(newData.config);
    setPets(newData.pets);
    setAppointments(newData.appointments);
    setBookedRetentions(newData.bookedRetentions || []);
    if (newData.pets.length > 0) {
      setSelectedPetId(newData.pets[0].id);
    }

    setAccountsList((prev) => {
      const exists = prev.some((a) => a.id === newAccount.id);
      if (!exists) return [...prev, newAccount];
      return prev.map((a) => (a.id === newAccount.id ? newAccount : a));
    });
  };

  // Logout handler (keeps data safely stored in IndexedDB without deleting it)
  const handleLoggedOut = () => {
    setActiveAccount(null);
  };

  const handleUpdatePet = async (updated: Pet): Promise<void> => {
    let nextPets: Pet[] = [];
    setPets((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      const list = exists
        ? prev.map((p) => (p.id === updated.id ? updated : p))
        : [updated, ...prev];
      nextPets = sortPetsByAgendaDate(list, appointments);
      return nextPets;
    });

    // When a pet receives a new completed visit or recommendation, clear it from bookedRetentions
    // so it naturally re-enters the Por Volver cycle for its NEXT cycle!
    const cleanId = updated.id.replace('#', '');
    const updatedBooked = bookedRetentions.filter((id) => id !== updated.id && id !== cleanId);
    setBookedRetentions(updatedBooked);

    // Atomically persist to IndexedDB AND local sync mirror immediately
    await persistActiveBusinessData({
      pets: nextPets.length > 0 ? nextPets : [updated, ...pets.filter((p) => p.id !== updated.id)],
      bookedRetentions: updatedBooked
    });

    // Background sync to Cloud Firestore & Server API
    const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';
    syncBusinessToServer(
      currentBizId,
      salonConfig,
      nextPets.length > 0 ? nextPets : [updated, ...pets.filter((p) => p.id !== updated.id)],
      appointments,
      updatedBooked
    ).catch((err) => {
      console.warn('Background server sync warning on pet update:', err);
    });
  };

  const handleSelectPetForProfile = (petId: string) => {
    setSelectedPetId(petId);
    setCurrentTab('ficha');
  };

  const handleSelectPetFromList = (pet: Pet) => {
    setSelectedPetId(pet.id);
    setCurrentTab('ficha');
  };

  const handleMarkAsBooked = (retId: string) => {
    const cleanPetId = retId.replace('ret-', '').replace('#', '');
    const matchedPet = pets.find((p) => p.id.replace('#', '') === cleanPetId);
    const petKey = matchedPet ? matchedPet.id : retId;

    setBookedRetentions((prev) => {
      if (prev.includes(petKey)) {
        return prev.filter((id) => id !== petKey);
      }
      return [...prev, petKey];
    });
  };

  const handleBookFromRetention = (retPet: RetentionPet) => {
    // Find real pet by petId or name
    const cleanPetId = retPet.petId.replace('#', '').toLowerCase();
    const matched =
      pets.find((p) => p.id.replace('#', '').toLowerCase() === cleanPetId) ||
      pets.find((p) => p.name.trim().toLowerCase() === retPet.name.trim().toLowerCase()) ||
      null;

    if (matched) {
      setBookingFromRetention({
        isOpen: true,
        pet: matched,
        targetDate: retPet.nextRecommendedDate
      });
    }
  };

  const handleOpenWhatsApp = (retPet: RetentionPet) => {
    const textEncoded = encodeURIComponent(retPet.suggestedMessage);
    const cleanPhone = retPet.rawPhone || retPet.tutorPhone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${textEncoded}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAddNewPet = () => {
    const newId = `#PET-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPet: Pet = {
      id: newId,
      name: 'Nueva Mascota',
      breed: 'Mestizo',
      age: '2 años',
      gender: 'Macho',
      weightKg: 10,
      isVip: false,
      photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
      tutor: {
        name: 'Tutor Responsable',
        phone: `${salonConfig.phonePrefix} 11 0000-0000`,
        rawPhone: `${salonConfig.phonePrefix.replace('+', '')}1100000000`
      },
      habitualMood: 'tranquilo',
      healthAllergies: 'Sin afecciones registradas.',
      handlingObservations: 'Manejo habitual sin restricciones.',
      lastVisit: undefined,
      visitHistory: [],
      recommendedIntervalWeeks: 6
    };

    setPets((prev) => [newPet, ...prev]);
    setSelectedPetId(newId);
    setCurrentTab('ficha');
  };

  const handleAddNewReview = (review: ClientReview) => {
    setSalonConfig((prev) => ({
      ...prev,
      reviews: [review, ...(prev.reviews || [])]
    }));
  };

  // Cross-Module Automation: When an appointment is created, automatically add/update Pet & Tutor & PERSIST
  const handleAddNewAppointment = async (
    newApt: Appointment,
    newPetData?: Partial<Pet>
  ): Promise<boolean> => {
    try {
      const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';

      // 1. Duplicate Prevention: Check for existing appointment by ID or semantic match (same pet, tutor, date, time, service)
      const existingApt = appointments.find(
        (a) =>
          a.id === newApt.id ||
          (a.petName?.trim().toLowerCase() === newApt.petName?.trim().toLowerCase() &&
            a.tutorName?.trim().toLowerCase() === newApt.tutorName?.trim().toLowerCase() &&
            a.date === newApt.date &&
            a.time === newApt.time &&
            a.serviceName === newApt.serviceName)
      );

      const resolvedApt: Appointment = existingApt
        ? { ...existingApt, ...newApt, id: existingApt.id }
        : newApt;

      const updatedAppointments = existingApt
        ? appointments.map((a) => (a.id === existingApt.id ? resolvedApt : a))
        : [resolvedApt, ...appointments.filter((a) => a.id !== resolvedApt.id)];

      setAppointments(updatedAppointments);

      // 2. Calculate updated pets
      const existing = pets.find(
        (p) =>
          p.id === resolvedApt.petId ||
          (p.name.toLowerCase() === resolvedApt.petName.toLowerCase() &&
            p.tutor.name.toLowerCase() === resolvedApt.tutorName.toLowerCase())
      );

      const incomingPhoto = newApt.beforePhotoUrl || newPetData?.photoUrl || existing?.photoUrl;
      const parsedWeight = Number(newPetData?.weightKg) || existing?.weightKg || 10;
      const parsedSize = (newPetData as any)?.size || newApt.size || existing?.size || 'mediano';

      const isAptCompleted =
        newApt.status === 'completado' || (newApt.status as any) === 'completed';

      let updatedPets: Pet[] = [];

      if (existing) {
        updatedPets = pets.map((p) => {
          if (p.id === existing.id) {
            return {
              ...p,
              breed: newApt.breed || newPetData?.breed || p.breed,
              size: parsedSize,
              age: newPetData?.age || p.age || '1 año',
              gender: newPetData?.gender || p.gender || 'Macho',
              weightKg: parsedWeight,
              photoUrl: incomingPhoto || p.photoUrl,
              habitualMood: (newPetData?.habitualMood as any) || p.habitualMood || 'tranquilo',
              healthAllergies:
                newPetData?.healthAllergies !== undefined
                  ? newPetData.healthAllergies
                  : p.healthAllergies,
              handlingObservations:
                newPetData?.handlingObservations !== undefined
                  ? newPetData.handlingObservations
                  : p.handlingObservations,
              tutor: {
                ...p.tutor,
                name: newApt.tutorName || p.tutor.name,
                phone: newApt.tutorPhone || p.tutor.phone,
                rawPhone: (newApt.tutorPhone || '').replace(/\D/g, '')
              },
              // Only update lastVisit and visitHistory if the appointment was actually marked completed
              lastVisit: isAptCompleted
                ? {
                    id: `v-${Date.now()}`,
                    date: newApt.date || 'Hoy',
                    serviceName: newApt.serviceName,
                    price: newApt.price,
                    currency: newApt.currency,
                    mood: (newPetData?.habitualMood as any) || p.habitualMood || 'tranquilo',
                    paid: newApt.paymentStatus === 'cobrado',
                    photos: {
                      beforeUrl: incomingPhoto || p.lastVisit?.photos?.beforeUrl
                    }
                  }
                : p.lastVisit,
              visitHistory: isAptCompleted
                ? [
                    {
                      id: `v-${Date.now()}`,
                      date: newApt.date || 'Hoy',
                      serviceName: newApt.serviceName,
                      price: newApt.price,
                      currency: newApt.currency,
                      mood: (newPetData?.habitualMood as any) || p.habitualMood || 'tranquilo',
                      paid: newApt.paymentStatus === 'cobrado',
                      photos: {
                        beforeUrl: incomingPhoto || p.lastVisit?.photos?.beforeUrl
                      }
                    },
                    ...(p.visitHistory || [])
                  ]
                : (p.visitHistory || []),
              recommendedIntervalWeeks: p.recommendedIntervalWeeks || 4
            };
          }
          return p;
        });
      } else {
        const createdPet: Pet = {
          id: newApt.petId || `#PET-${Math.floor(1000 + Math.random() * 9000)}`,
          name: newApt.petName,
          breed: newApt.breed || newPetData?.breed || 'Mestizo',
          size: parsedSize,
          age: newPetData?.age || '1 año',
          gender: newPetData?.gender || 'Macho',
          weightKg: parsedWeight,
          isVip: false,
          photoUrl:
            incomingPhoto ||
            'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
          tutor: {
            name: newApt.tutorName,
            phone: newApt.tutorPhone || `${salonConfig.phonePrefix} 11 0000-0000`,
            rawPhone: (newApt.tutorPhone || '').replace(/\D/g, '')
          },
          habitualMood: (newPetData?.habitualMood as any) || 'tranquilo',
          healthAllergies: newPetData?.healthAllergies || '',
          handlingObservations: newPetData?.handlingObservations || '',
          // An initial scheduled appointment does NOT count as a completed visit
          lastVisit: isAptCompleted
            ? {
                id: `v-${Date.now()}`,
                date: newApt.date || 'Hoy',
                serviceName: newApt.serviceName,
                price: newApt.price,
                currency: newApt.currency,
                mood: (newPetData?.habitualMood as any) || 'tranquilo',
                paid: newApt.paymentStatus === 'cobrado',
                photos: {
                  beforeUrl: incomingPhoto
                }
              }
            : undefined,
          visitHistory: isAptCompleted
            ? [
                {
                  id: `v-${Date.now()}`,
                  date: newApt.date || 'Hoy',
                  serviceName: newApt.serviceName,
                  price: newApt.price,
                  currency: newApt.currency,
                  mood: (newPetData?.habitualMood as any) || 'tranquilo',
                  paid: newApt.paymentStatus === 'cobrado',
                  photos: {
                    beforeUrl: incomingPhoto
                  }
                }
              ]
            : [],
          recommendedIntervalWeeks: 4
        };
        updatedPets = [createdPet, ...pets];
      }

      const sortedPets = sortPetsByAgendaDate(updatedPets, updatedAppointments);
      setPets(sortedPets);

      // 3. Atomically persist to IndexedDB AND local mirror immediately
      await persistActiveBusinessData({
        appointments: updatedAppointments,
        pets: sortedPets
      });

      // 4. Save to Cloud Firestore & Server API
      await createInternalAppointment(currentBizId, resolvedApt, {
        id: resolvedApt.petId,
        name: resolvedApt.petName,
        breed: resolvedApt.breed,
        size: parsedSize,
        weightKg: parsedWeight,
        gender: newPetData?.gender,
        age: newPetData?.age,
        photoUrl: incomingPhoto,
        habitualMood: newPetData?.habitualMood,
        healthAllergies: newPetData?.healthAllergies,
        handlingObservations: newPetData?.handlingObservations,
        tutor: {
          name: resolvedApt.tutorName || '',
          phone: resolvedApt.tutorPhone || '',
          rawPhone: (resolvedApt.tutorPhone || '').replace(/\D/g, '')
        }
      });

      return true;
    } catch (err) {
      console.error('[HANDLE ADD APPOINTMENT ERROR]', err);
      return false;
    }
  };

  const handleUpdateAppointmentStatus = async (
    appointmentId: string,
    status: string,
    statusLabel: string,
    extraPatch?: Partial<Appointment>
  ): Promise<boolean> => {
    const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';

    const targetApt = appointments.find((a) => a.id === appointmentId);
    let createdSale: SaleRecord | null = null;
    let salePatch: Partial<Appointment> = {};

    // MEJORA 3: Fuente de ingresos al pulsar «Comenzar servicio» o «Comenzar corte»
    const isStartingService = (status === 'en_salon' || status === 'en_corte');
    if (isStartingService && targetApt) {
      // Garantizar idempotencia: verificar que no haya sido registrada previamente
      const alreadyHasSale =
        Boolean(targetApt.saleRecordId) ||
        (targetApt.salesRecordedAmount !== undefined && Number(targetApt.salesRecordedAmount) > 0) ||
        sales.some((s) => s.appointmentId === appointmentId);

      if (!alreadyHasSale) {
        // Parse price safely
        let rawPrice = Number(targetApt.price);
        if (isNaN(rawPrice) || rawPrice <= 0) {
          const cleaned = String(targetApt.price || '').replace(/[^0-9.,]/g, '').replace(',', '.');
          rawPrice = parseFloat(cleaned);
        }
        if (isNaN(rawPrice) || rawPrice <= 0) {
          const matchedService = salonConfig.services?.find(
            (s) => s.name?.toLowerCase().trim() === targetApt.serviceName?.toLowerCase().trim()
          );
          if (matchedService) {
            rawPrice = Number(matchedService.price) || 0;
          }
        }
        if (isNaN(rawPrice) || rawPrice <= 0) {
          if (extraPatch?.price) {
            rawPrice = Number(extraPatch.price) || 0;
          }
        }

        if (rawPrice > 0) {
          const saleId = targetApt.saleRecordId || `sale_${appointmentId}`;
          const nowIso = new Date().toISOString();

          createdSale = {
            id: saleId,
            appointmentId: targetApt.id,
            businessId: currentBizId,
            petId: targetApt.petId,
            petName: targetApt.petName,
            breed: targetApt.breed,
            tutorName: targetApt.tutorName,
            tutorPhone: targetApt.tutorPhone,
            serviceName: targetApt.serviceName,
            amount: rawPrice,
            servicePrice: rawPrice,
            finalPrice: rawPrice,
            currency: targetApt.currency || salonConfig.currency || 'MXN',
            groomer: targetApt.groomer || 'Personal de turno',
            paymentStatus: targetApt.paymentStatus || 'cobrado',
            date: targetApt.date || nowIso.split('T')[0],
            time: targetApt.time || 'En servicio',
            createdAt: nowIso,
            serviceStartedAt: nowIso,
            status: 'en_salon'
          };

          salePatch = {
            serviceStartedAt: nowIso,
            salesRecordedAmount: rawPrice,
            saleRecordId: saleId
          };
        }
      }
    }

    const mergedPatch = { ...(extraPatch || {}), ...salePatch };

    const updatedList = appointments.map((a) =>
      a.id === appointmentId ? { ...a, status: status as any, statusLabel, ...mergedPatch } : a
    );
    setAppointments(updatedList);

    // 1. Guardar la venta registrada permanentemente si fue creada
    if (createdSale) {
      const saleToSave = createdSale;
      setSales((prev) => {
        const next = [saleToSave, ...prev.filter((s) => s.appointmentId !== appointmentId && s.id !== saleToSave.id)];
        persistActiveSales(next);
        return next;
      });

      // Persistir en Firestore y en Server API
      recordSaleInFirestore(currentBizId, createdSale).catch(() => {});
      fetch(`/api/businesses/${encodeURIComponent(currentBizId)}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale: createdSale })
      }).catch(() => {});
    }

    // 2. Guarantee persistence in local IndexedDB & localStorage cache first
    await persistActiveAppointments(updatedList);

    // 3. Guarantee persistence in Backend Server API & Cloud Firestore
    try {
      await updateAppointmentStatusOnServer(currentBizId, appointmentId, status, statusLabel, mergedPatch);
    } catch (err) {
      console.warn('Error syncing appointment status update:', err);
    }

    return true;
  };

  const handleSaveWhatsAppTemplate = async (template: WhatsAppTemplate) => {
    const currentTemplates = salonConfig.whatsappTemplates || [];
    const exists = currentTemplates.some(
      (t) => t.id === template.id || t.title.toLowerCase().trim() === template.title.toLowerCase().trim()
    );
    const updatedTemplates = exists
      ? currentTemplates.map((t) =>
          t.id === template.id || t.title.toLowerCase().trim() === template.title.toLowerCase().trim()
            ? template
            : t
        )
      : [...currentTemplates, template];

    const updatedConfig: SalonConfig = {
      ...salonConfig,
      whatsappTemplates: updatedTemplates
    };

    setSalonConfig(updatedConfig);
    await persistActiveConfig(updatedConfig);

    const currentBizId = activeAccount?.businessId || salonConfig?.id || 'biz_main';
    try {
      await syncBusinessToServer(currentBizId, updatedConfig, pets, appointments, bookedRetentions);
    } catch (err) {
      console.warn('Error syncing template to server:', err);
    }
  };

  const urgentCount = useMemo(() => {
    return retentionPets.filter((p) => (p.urgency === 'esta_semana' || p.urgency === 'urgente') && !p.alreadyBooked).length;
  }, [retentionPets]);

  const inSalonAppointmentsCount = useMemo(() => {
    return appointments.filter(
      (a) =>
        a.status === 'en_salon' ||
        a.status === 'en_corte' ||
        a.status === 'por_retirar' ||
        a.statusLabel === 'EN SALÓN' ||
        a.statusLabel === 'EN CORTE' ||
        a.statusLabel === 'POR RETIRAR' ||
        a.statusLabel === 'LISTO PARA RETIRAR' ||
        (a.subStatus && a.subStatus.toLowerCase().includes('retirar'))
    ).length;
  }, [appointments]);

  // 1. PUBLIC REVIEWS FLOW (Independent public rating form for customers - Requirement #1 & #2)
  if (urlReviewId) {
    const targetSlugOrId =
      urlReviewId === 'default_review'
        ? salonConfig.bookingSlug || salonConfig.id || 'biz_main'
        : urlReviewId;

    return (
      <PublicReviewPage
        businessIdOrSlug={targetSlugOrId}
        onReviewSubmitted={(newReview) => {
          handleAddNewReview(newReview);
        }}
      />
    );
  }

  // 1b. ADMIN PREVIEW FLOW FOR REVIEWS ("Probar enlace" from Ajustes -> Calificaciones)
  if (previewReviewId) {
    return (
      <div className="relative">
        <div className="sticky top-0 z-50 bg-[#2e004e] text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-md border-b-2 border-[#f9b900]">
          <span className="font-bold flex items-center gap-1.5 text-[#ffdea1]">
            <span className="material-symbols-outlined text-sm text-[#f9b900]">visibility</span>
            <span>MODO VISTA PREVIA: Así ve tu cliente el formulario de calificación</span>
          </span>
          <button
            type="button"
            onClick={() => setPreviewReviewId(null)}
            className="px-3 py-1 bg-[#f9b900] text-[#261900] font-bold rounded-lg text-xs hover:bg-[#ffdea1] cursor-pointer"
          >
            Volver a Ajustes
          </button>
        </div>
        <PublicReviewPage
          businessIdOrSlug={previewReviewId}
          onReviewSubmitted={(newReview) => {
            handleAddNewReview(newReview);
          }}
        />
      </div>
    );
  }

  // 2. PUBLIC BOOKING LINK FLOW (Requirement #10: COMPLETELY SEPARATE FROM THE ADMIN APP)
  // When a customer visits via a shared booking link, ONLY show the Public Customer Booking page
  if (urlBookingId) {
    return (
      <PublicBookingPage
        businessIdOrSlug={urlBookingId}
        isPreviewMode={false}
        onAppointmentCreated={(newApt, newPetData) => {
          handleAddNewAppointment(newApt, newPetData);
        }}
      />
    );
  }

  // 2b. ADMIN PREVIEW FLOW ("Probar flujo como cliente" inside Ajustes)
  if (previewBookingId) {
    return (
      <PublicBookingPage
        businessIdOrSlug={previewBookingId}
        isPreviewMode={true}
        onClosePreview={() => setPreviewBookingId(null)}
        onAppointmentCreated={(newApt, newPetData) => {
          handleAddNewAppointment(newApt, newPetData);
        }}
      />
    );
  }

  // 3. LOGGED-OUT SCREEN: Multi-account login / creation
  if (!activeAccount) {
    return (
      <LoginScreen
        accountsList={accountsList}
        onLoginSuccess={handleAccountChanged}
      />
    );
  }

  // 4. ADMIN SALON DASHBOARD
  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1a1a26] flex flex-col font-sans selection:bg-[#f9b900] selection:text-[#261900]">
      {/* Top Application Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        salonName={salonConfig.name}
        logoUrl={salonConfig.logoUrl}
        urgentCount={urgentCount}
        inSalonCount={inSalonAppointmentsCount}
        currentLanguage={currentLanguage}
        activeAccount={activeAccount}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
      />

      {/* Floating Real-Time New Booking Notification Banner (Mejora 1: Dimensión, Bordes y Jerarquía) */}
      {newBookingNotification && (
        <aside
          role="alert"
          aria-live="polite"
          className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] sm:w-full max-w-lg bg-[#2e004e] text-white rounded-2xl shadow-2xl border-2 border-[#f9b900] p-3.5 sm:p-4 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto box-border"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f9b900] text-[#261900] flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <span className="material-symbols-outlined text-xl">notifications_active</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#f9b900]">
                  ¡Nueva Solicitud de Cita Online!
                </span>
                <button
                  type="button"
                  onClick={() => setNewBookingNotification(null)}
                  className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                  title="Cerrar notificación"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="mt-1 space-y-0.5 text-xs">
                <div className="font-black text-white break-words">
                  <span className="text-white/70 font-medium">Cliente: </span>
                  {newBookingNotification.tutorName}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-white/90">
                  <span className="font-extrabold text-[#ffdea1] break-words">
                    🐾 {newBookingNotification.petName}
                  </span>
                  <span className="text-white/40">•</span>
                  <span className="text-white break-words font-medium">
                    ✂️ {newBookingNotification.serviceName}
                  </span>
                  {newBookingNotification.time && (
                    <>
                      <span className="text-white/40">•</span>
                      <span className="text-emerald-300 font-bold whitespace-nowrap">
                        🕒 {newBookingNotification.time}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                <span className="text-[10px] text-white/60">Recibida en tiempo real</span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('agenda');
                    setNewBookingNotification(null);
                  }}
                  className="px-3.5 py-1.5 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  <span>Ver en Agenda</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Screen Mode Layout Container */}
      <div className="flex-1 w-full flex justify-center md:pt-16">
        <main className="w-full bg-[#fcf8ff] min-h-screen transition-all shadow-sm">
          {/* Screen: Agenda del Día */}
          {currentTab === 'agenda' && (
            <AgendaView
              appointments={appointments}
              pets={pets}
              onSelectPet={handleSelectPetFromList}
              onNavigateToRetention={() => setCurrentTab('retencion')}
              onAddNewAppointment={handleAddNewAppointment}
              onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
              salonConfig={salonConfig}
              onSaveWhatsAppTemplate={handleSaveWhatsAppTemplate}
              urgentRetentionCount={urgentCount}
              totalRetentionCount={retentionPets.filter((p) => !p.alreadyBooked).length}
              currentLanguage={currentLanguage}
              onNavigateToInSalon={() => setCurrentTab('en_salon')}
            />
          )}

          {/* Screen: En Salón (Módulo operativo de mascotas en proceso o por retirar) */}
          {currentTab === 'en_salon' && (
            <InSalonView
              appointments={appointments}
              pets={pets}
              salonConfig={salonConfig}
              currentLanguage={currentLanguage}
              onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
              onSelectPetForProfile={handleSelectPetForProfile}
              onNavigateToAgenda={() => setCurrentTab('agenda')}
              onCompleteAndRegisterVisit={(apt, pet) => {
                setSelectedPetId(pet.id);
                setCurrentTab('ficha');
              }}
            />
          )}

          {/* Screen: Ajustes y Negocio */}
          {currentTab === 'onboarding' && (
            <AjustesView
              config={salonConfig}
              sales={sales}
              onUpdateConfig={(updated) => {
                setSalonConfig(updated);
                syncBusinessToServer(updated.id || 'biz_main', updated, pets, appointments, bookedRetentions, sales);
              }}
              onPreviewClientFlow={() => {
                setPreviewBookingId(salonConfig.id || salonConfig.bookingSlug || 'biz_main');
              }}
              onPreviewReviewFlow={() => {
                setPreviewReviewId(salonConfig.id || salonConfig.bookingSlug || 'biz_main');
              }}
              appointments={appointments}
              onAddNewReview={handleAddNewReview}
              currentLanguage={currentLanguage}
              onUpdateLanguage={setCurrentLanguage}
              activeAccount={activeAccount}
              onOpenAccountModal={() => setIsAccountModalOpen(true)}
            />
          )}

          {/* Screen: Por Volver (Módulo de Fidelización derivado directamente de Clientes) */}
          {currentTab === 'retencion' && (
            <RetentionView
              retentionPets={retentionPets}
              onSelectPetForProfile={handleSelectPetForProfile}
              onMarkAsBooked={handleMarkAsBooked}
              onOpenWhatsApp={handleOpenWhatsApp}
              onBookAppointment={handleBookFromRetention}
              currentLanguage={currentLanguage}
            />
          )}

          {/* Screen: Ficha Mascota */}
          {currentTab === 'ficha' && (
            <PetProfileView
              pet={currentPet}
              onUpdatePet={handleUpdatePet}
              onNavigateOnboarding={() => setCurrentTab('onboarding')}
              salonConfig={salonConfig}
              appointments={appointments}
              onAppointmentCompleted={async (appointmentId: string) => {
                await handleUpdateAppointmentStatus(appointmentId, 'completado', 'COMPLETADO');
              }}
            />
          )}

          {/* Screen: Directorio de Mascotas / Clientes */}
          {currentTab === 'mascotas' && (
            <PetListView
              pets={pets}
              appointments={appointments}
              selectedPetId={selectedPetId}
              onSelectPet={handleSelectPetFromList}
              onAddNewPet={handleAddNewPet}
              currentLanguage={currentLanguage}
            />
          )}
        </main>
      </div>

      {/* Modal Agendar Cita desde Por Volver */}
      {bookingFromRetention.isOpen && bookingFromRetention.pet && (
        <NewAppointmentView
          onClose={() => setBookingFromRetention({ isOpen: false, pet: null })}
          onAppointmentCreated={async (newApt, newPetData) => {
            const success = await handleAddNewAppointment(newApt, newPetData);
            if (success !== false) {
              // Ensure this pet is marked in bookedRetentions so it disappears from pending retentions immediately
              const petKey = bookingFromRetention.pet?.id || newApt.petId;
              if (petKey) {
                setBookedRetentions((prev) => (prev.includes(petKey) ? prev : [...prev, petKey]));
              }
              setBookingFromRetention({ isOpen: false, pet: null });
            }
            return success;
          }}
          salonName={salonConfig.name}
          salonAddress={salonConfig.address}
          salonPhone={salonConfig.phone}
          simultaneousCapacity={salonConfig.allowSimultaneousStaff === false ? 1 : salonConfig.simultaneousCapacity || 2}
          existingAppointments={appointments}
          existingPets={pets}
          isOnlineClientPortal={false}
          salonConfig={salonConfig}
          initialPet={bookingFromRetention.pet}
          initialDate={bookingFromRetention.targetDate}
        />
      )}

      {/* Account Switcher & SaaS Management Modal */}
      <AccountAuthModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        activeAccount={activeAccount}
        accountsList={accountsList}
        onAccountChanged={handleAccountChanged}
        onLoggedOut={handleLoggedOut}
      />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        urgentCount={urgentCount}
        inSalonCount={inSalonAppointmentsCount}
        currentLanguage={currentLanguage}
      />
    </div>
  );
}
