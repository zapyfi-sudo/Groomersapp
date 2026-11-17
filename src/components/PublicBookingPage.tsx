import React, { useState, useEffect, useMemo } from 'react';
import { SalonConfig, SalonService, Appointment, Pet, BehaviorMood } from '../types';
import { fetchBusinessProfileWithStatus, createPublicAppointment, subscribeToBusinessReviews } from '../utils/api';
import { formatDateSpanish, compressImage } from '../utils/storage';
import { normalizePhoneForWhatsApp } from '../utils/phoneUtils';
import { getSyncActiveData } from '../utils/saasDb';
import { HOTLINK_IMAGES } from '../mockData';
import { formatPrice } from '../utils/priceUtils';
import { parseTimeToMinutes, isDateMatching } from '../utils/scheduleUtils';
import { extractSlugOnly } from '../utils/slugUtils';
import { normalizeAndMergeReviews, calculateReviewStats, parseTimestampMs } from '../utils/syncHelpers';
import { useTranslation } from '../utils/i18n/I18nContext';
import {
  resolveAppLanguage,
  getTranslations,
  getLocaleForLanguage,
  translateMoodLabel,
  formatTemplate
} from '../utils/i18n/helpers';

interface PublicBookingPageProps {
  businessIdOrSlug: string;
  isPreviewMode?: boolean;
  onClosePreview?: () => void;
  onAppointmentCreated?: (newApt: Appointment, newPetData?: Partial<Pet>) => void;
}

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({
  businessIdOrSlug,
  isPreviewMode = false,
  onClosePreview,
  onAppointmentCreated
}) => {
  const { lang } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [businessData, setBusinessData] = useState<{
    businessId: string;
    config: SalonConfig;
    services: SalonService[];
    appointments: Appointment[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorKind, setLoadErrorKind] = useState<'quota_exceeded' | 'not_found' | null>(null);

  // Form states
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDogSize, setSelectedDogSize] = useState<'pequeno' | 'mediano' | 'grande' | 'extraGrande'>('mediano');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  const [tutorName, setTutorName] = useState<string>('');
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');
  const [petName, setPetName] = useState<string>('');
  const [breed, setBreed] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<'Macho' | 'Hembra'>('Macho');
  const [weightKg, setWeightKg] = useState<string>('10');
  const [petPhoto, setPetPhoto] = useState<string>('');
  const [isPhotoCompressing, setIsPhotoCompressing] = useState<boolean>(false);
  const [behavior, setBehavior] = useState<BehaviorMood>('tranquilo');
  const [healthNotes, setHealthNotes] = useState<string>('');
  const [handlingNotes, setHandlingNotes] = useState<string>('');

  const [selectedMedicationIds, setSelectedMedicationIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  // Gallery viewer state for service additional photos
  const [galleryModalService, setGalleryModalService] = useState<SalonService | null>(null);
  const [galleryActiveIndex, setGalleryActiveIndex] = useState<number>(0);
  const [logoLoadFailed, setLogoLoadFailed] = useState<boolean>(false);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [businessData?.config?.logoUrl]);

  // Load business from persistent storage using URL identifier
  useEffect(() => {
    let isMounted = true;
    setLoadError(null);
    setLoadErrorKind(null);

    // Eagerly initialize if previewing, matching public cache, or matching current active session
    if (typeof window !== 'undefined') {
      try {
        const targetRaw = businessIdOrSlug.trim();
        const targetClean = extractSlugOnly(businessIdOrSlug) || targetRaw;
        const syncData = getSyncActiveData();
        const activeSlug = syncData?.config?.bookingSlug ? extractSlugOnly(syncData.config.bookingSlug) : '';
        const syncBizId = syncData?.businessId?.trim() || '';
        const isSessionMatch =
          Boolean(syncData?.config) &&
          (isPreviewMode ||
            (Boolean(syncBizId) &&
              (syncBizId === targetClean ||
                syncBizId === targetRaw ||
                (Boolean(activeSlug) && activeSlug === targetClean) ||
                syncData.config?.name?.toLowerCase().replace(/\s+/g, '-') === targetClean)));

        let eagerData: {
          businessId: string;
          config: SalonConfig;
          services: SalonService[];
          appointments: Appointment[];
        } | null = null;

        if (isSessionMatch && syncData?.config) {
          const resolvedBizId = syncBizId || syncData.config.id || 'biz_main';
          eagerData = {
            businessId: resolvedBizId,
            config: {
              ...syncData.config,
              reviews: normalizeAndMergeReviews(resolvedBizId, syncData.config.reviews)
            },
            services: syncData.config.services || [],
            appointments: syncData.appointments || []
          };
        } else if (!isPreviewMode) {
          const cachedRaw =
            localStorage.getItem(`agendacan_public_biz_${targetClean}`) ||
            localStorage.getItem(`agendacan_public_biz_${targetRaw}`);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached?.businessId && cached?.config) {
              eagerData = {
                businessId: cached.businessId,
                config: {
                  ...cached.config,
                  reviews: normalizeAndMergeReviews(cached.businessId, cached.config.reviews)
                },
                services: cached.services || cached.config.services || [],
                appointments: cached.appointments || []
              };
            }
          }
        }

        if (eagerData) {
          setBusinessData(eagerData);
          if (eagerData.services && eagerData.services.length > 0) {
            setSelectedServiceId(eagerData.services[0].id);
          }
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
      } catch {
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
    }

    fetchBusinessProfileWithStatus(businessIdOrSlug)
      .then((outcome) => {
        if (!isMounted) return;
        const result = outcome.profile;
        if (result && result.config) {
          setBusinessData((prevData) => {
            const normalizedResultReviews = normalizeAndMergeReviews(
              result.businessId,
              result.config.reviews
            );

            // Anti-overwrite protection:
            // Only merge if this is the SAME business. If a different business is requested, use result directly!
            if (prevData && prevData.config) {
              const isSameBiz = prevData.businessId === result.businessId;

              if (!isSameBiz) {
                return {
                  ...result,
                  config: {
                    ...result.config,
                    reviews: normalizedResultReviews
                  }
                };
              }

              const prevSvcs = prevData.services || [];
              const resultSvcs = result.services || [];

              // Helper to detect generic placeholder default services that should NEVER replace real customized services
              const isDefaultPlaceholder = (s: SalonService) =>
                (s.name === 'Corte Completo + Baño' && s.price === 30) ||
                (s.name === 'Deslanado Profundo' && s.price === 25) ||
                (s.name === 'Baño + corte' && s.price === 25000);

              const resultOnlyHasDefaults =
                resultSvcs.length > 0 &&
                resultSvcs.some(isDefaultPlaceholder) &&
                !prevSvcs.some(isDefaultPlaceholder);

              let mergedServices: SalonService[] = [];

              if (prevSvcs.length > 0 && resultOnlyHasDefaults) {
                mergedServices = prevSvcs;
              } else if (prevSvcs.length >= resultSvcs.length && prevSvcs.length > 0) {
                const resMap = new Map(resultSvcs.map((s) => [s.id, s]));
                mergedServices = prevSvcs.map((pSvc) => {
                  const rSvc = resMap.get(pSvc.id);
                  if (rSvc) {
                    return {
                      ...rSvc,
                      imageUrl: pSvc.imageUrl || rSvc.imageUrl,
                      galleryUrls:
                        Array.isArray(pSvc.galleryUrls) && pSvc.galleryUrls.length > 0
                          ? pSvc.galleryUrls
                          : rSvc.galleryUrls
                    };
                  }
                  return pSvc;
                });
              } else if (resultSvcs.length > 0) {
                const prevIdMap = new Map(prevSvcs.map((s) => [s.id, s]));
                const prevNameMap = new Map(prevSvcs.map((s) => [s.name.trim().toLowerCase(), s]));

                mergedServices = resultSvcs.map((rSvc) => {
                  const match = prevIdMap.get(rSvc.id) || prevNameMap.get(rSvc.name.trim().toLowerCase());
                  if (match) {
                    return {
                      ...rSvc,
                      imageUrl: match.imageUrl || rSvc.imageUrl,
                      galleryUrls:
                        Array.isArray(match.galleryUrls) && match.galleryUrls.length > 0
                          ? match.galleryUrls
                          : rSvc.galleryUrls
                    };
                  }
                  return rSvc;
                });

                const resIdSet = new Set(resultSvcs.map((s) => s.id));
                for (const pSvc of prevSvcs) {
                  if (!resIdSet.has(pSvc.id) && !isDefaultPlaceholder(pSvc)) {
                    mergedServices.push(pSvc);
                  }
                }
              } else {
                mergedServices = prevSvcs;
              }

              const prevUpdatedMs = parseTimestampMs(prevData.config.updatedAt);
              const resultUpdatedMs = parseTimestampMs(result.updatedAt || result.config.updatedAt);
              const localStrictlyNewer = prevUpdatedMs > 0 && resultUpdatedMs > 0 && prevUpdatedMs > resultUpdatedMs;

              const mergedReviews = normalizeAndMergeReviews(
                result.businessId,
                prevData.config.reviews,
                normalizedResultReviews
              );

              const keepCustomConfig: SalonConfig = {
                ...result.config,
                id: result.businessId,
                name: localStrictlyNewer
                  ? (prevData.config.name || result.config.name)
                  : (result.config.name || prevData.config.name),
                logoUrl: result.config.logoUrl || prevData.config.logoUrl,
                reviewSlug: result.config.reviewSlug || prevData.config.reviewSlug,
                language: localStrictlyNewer
                  ? (prevData.config.language || result.config.language)
                  : (result.config.language || prevData.config.language),
                country: localStrictlyNewer
                  ? (prevData.config.country !== undefined ? prevData.config.country : result.config.country)
                  : (result.config.country !== undefined ? result.config.country : prevData.config.country),
                city: localStrictlyNewer
                  ? (prevData.config.city !== undefined ? prevData.config.city : result.config.city)
                  : (result.config.city !== undefined ? result.config.city : prevData.config.city),
                currency: result.config.currency || prevData.config.currency,
                address: localStrictlyNewer
                  ? (prevData.config.address !== undefined ? prevData.config.address : result.config.address)
                  : (result.config.address !== undefined ? result.config.address : prevData.config.address),
                phone: result.config.phone || prevData.config.phone,
                services: mergedServices,
                reviews: mergedReviews,
                updatedAt: localStrictlyNewer
                  ? prevData.config.updatedAt
                  : (result.updatedAt || result.config.updatedAt || prevData.config.updatedAt)
              };

              return {
                ...result,
                config: keepCustomConfig,
                services: mergedServices
              };
            }
            return {
              ...result,
              config: {
                ...result.config,
                reviews: normalizedResultReviews
              }
            };
          });

          if (result.services && result.services.length > 0) {
            setSelectedServiceId((prev) => (prev && result.services.some((s) => s.id === prev) ? prev : result.services[0].id));
          }
        } else {
          // Robust fallback: ONLY if in preview mode or active local session actually belongs to this business
          if (typeof window !== 'undefined') {
            const syncData = getSyncActiveData();
            const activeSlug = syncData?.config?.bookingSlug ? extractSlugOnly(syncData.config.bookingSlug) : '';
            const targetClean = extractSlugOnly(businessIdOrSlug) || businessIdOrSlug.trim();
            const isMatch =
              isPreviewMode ||
              (syncData &&
                (syncData.businessId === targetClean ||
                  activeSlug === targetClean ||
                  syncData.config?.name?.toLowerCase().replace(/\s+/g, '-') === targetClean));

            if (isMatch && syncData?.config) {
              setBusinessData({
                businessId: syncData.businessId || 'biz_main',
                config: syncData.config,
                services: syncData.config.services || [],
                appointments: syncData.appointments || []
              });
              if (syncData.config.services && syncData.config.services.length > 0) {
                setSelectedServiceId(syncData.config.services[0].id);
              }
              return;
            }
          }
          if (outcome.reason === 'quota_exceeded') {
            setLoadErrorKind('quota_exceeded');
            setLoadError(
              'Se alcanzó temporalmente el límite diario gratuito de consultas en la base de datos. Intenta nuevamente más tarde o verifica tu plan en Firebase.'
            );
          } else {
            setLoadErrorKind('not_found');
            setLoadError('No encontramos este negocio. Este enlace de reservas no es válido o ya no está disponible.');
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error loading public business:', err);
        if (typeof window !== 'undefined') {
          const syncData = getSyncActiveData();
          const activeSlug = syncData?.config?.bookingSlug ? extractSlugOnly(syncData.config.bookingSlug) : '';
          const targetClean = extractSlugOnly(businessIdOrSlug) || businessIdOrSlug.trim();
          const isMatch =
            isPreviewMode ||
            (syncData &&
              (syncData.businessId === targetClean ||
                activeSlug === targetClean ||
                syncData.config?.name?.toLowerCase().replace(/\s+/g, '-') === targetClean));

          if (isMatch && syncData?.config) {
            setBusinessData({
              businessId: syncData.businessId || 'biz_main',
              config: syncData.config,
              services: syncData.config.services || [],
              appointments: syncData.appointments || []
            });
            if (syncData.config.services && syncData.config.services.length > 0) {
              setSelectedServiceId(syncData.config.services[0].id);
            }
            return;
          }
        }
        setLoadError('No encontramos este negocio. Este enlace de reservas no es válido o ya no está disponible.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [businessIdOrSlug, isPreviewMode]);

  // Real-time synchronization of reviews from Cloud Firestore (merge with existing reviews instead of overwriting)
  useEffect(() => {
    if (!businessData?.businessId) return;
    const targetBizId = businessData.businessId;
    const unsub = subscribeToBusinessReviews(targetBizId, (incomingReviews) => {
      if (!incomingReviews) return;
      setBusinessData((prev) => {
        if (!prev || !prev.config || prev.businessId !== targetBizId) return prev;
        const mergedReviews = normalizeAndMergeReviews(
          prev.businessId,
          prev.config.reviews,
          incomingReviews
        );
        return {
          ...prev,
          config: {
            ...prev.config,
            reviews: mergedReviews
          }
        };
      });
    });
    return () => unsub();
  }, [businessData?.businessId]);

  const config = businessData?.config;
  const pageLang = resolveAppLanguage(config?.language, lang);
  const bt = getTranslations(pageLang).publicBooking;
  const ct = getTranslations(pageLang).common;
  const mt = getTranslations(pageLang).managers;
  const mdt = getTranslations(pageLang).modals;

  // Real reviews and reputation metrics (deduplicated, isolated by businessId, exact arithmetic mean)
  const reviewStats = useMemo(() => {
    return calculateReviewStats(config?.reviews, businessData?.businessId);
  }, [config?.reviews, businessData?.businessId]);

  const totalReviews = reviewStats.totalReviews;
  const rawAvg = reviewStats.rawAverage;
  const avgRating = reviewStats.formattedAverage;

  // Real configured services only, filtering out inactive or malformed services
  const services = useMemo(() => {
    const list = businessData?.services && businessData.services.length > 0
      ? businessData.services
      : businessData?.config?.services || [];
    return list.filter((s) => s && s.id && s.active !== false);
  }, [businessData]);

  const activeService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0];
  }, [services, selectedServiceId]);

  // Keep selectedServiceId in sync when services change
  useEffect(() => {
    if (services.length > 0) {
      if (!selectedServiceId || !services.some((s) => s.id === selectedServiceId)) {
        setSelectedServiceId(services[0].id);
      }
    }
  }, [services, selectedServiceId]);

  // Consolidate main photo and additional gallery photos for the selected service
  const galleryPhotos = useMemo(() => {
    if (!galleryModalService) return [];
    const list: string[] = [];
    if (galleryModalService.imageUrl && galleryModalService.imageUrl.trim()) {
      list.push(galleryModalService.imageUrl.trim());
    }
    if (galleryModalService.galleryUrls && Array.isArray(galleryModalService.galleryUrls)) {
      list.push(...galleryModalService.galleryUrls.filter((u) => u && typeof u === 'string' && u.trim()));
    }
    return list;
  }, [galleryModalService]);

  // Keyboard navigation & escape listener for gallery
  useEffect(() => {
    if (!galleryModalService || galleryPhotos.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGalleryModalService(null);
      } else if (e.key === 'ArrowLeft') {
        setGalleryActiveIndex((prev) => (prev > 0 ? prev - 1 : galleryPhotos.length - 1));
      } else if (e.key === 'ArrowRight') {
        setGalleryActiveIndex((prev) => (prev < galleryPhotos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryModalService, galleryPhotos.length]);

  const currency = config?.currency || businessData?.config?.currency || 'USD';

  useEffect(() => {
    if (config?.name) {
      document.title = `${config.name} | ${bt.pageTitleSuffix}`;
    }
  }, [config?.name, bt.pageTitleSuffix]);

  // Base price for service based on size
  const serviceBasePrice = useMemo(() => {
    if (!activeService) return 0;
    if (activeService.pricingType === 'tamano' && activeService.priceBySize) {
      return activeService.priceBySize[selectedDogSize] || activeService.price;
    }
    return activeService.price;
  }, [activeService, selectedDogSize]);

  // Available medications configured specifically by this business
  const availableMedications = useMemo(() => {
    if (config?.hasMedicationProductsEnabled === false) return [];
    return config?.medicationProducts?.filter((p) => p.active) || [];
  }, [config]);

  const totalMedicationCost = useMemo(() => {
    return availableMedications
      .filter((m) => selectedMedicationIds.includes(m.id))
      .reduce((acc, m) => acc + (m.price || 0), 0);
  }, [availableMedications, selectedMedicationIds]);

  const totalPrice = serviceBasePrice + totalMedicationCost;

  // Calendar dates starting strictly from today
  const today = useMemo(() => new Date(), []);
  const activeDayLetters = config?.activeDays || ['L', 'M', 'X', 'J', 'V', 'S'];
  const dayIndexToLetter = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  const availableDates = useMemo(() => {
    const dates = [];
    const locale = getLocaleForLanguage(pageLang);
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const letter = dayIndexToLetter[d.getDay()];
      const isWorkingDay = activeDayLetters.includes(letter);
      const formatted = formatDateSpanish(d);

      dates.push({
        dateObj: d,
        formatted,
        dayName: d.toLocaleDateString(locale, { weekday: 'short' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString(locale, { month: 'short' }),
        isWorkingDay
      });
    }
    return dates;
  }, [today, activeDayLetters, pageLang]);

  // Set default date when dates are available
  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      const firstValid = availableDates.find((d) => d.isWorkingDay);
      if (firstValid) {
        setSelectedDate(firstValid.formatted);
      }
    }
  }, [availableDates, selectedDate]);

  // Time slots generation based on salon appointmentIntervalMinutes and lunch break
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !config) return [];

    const slots: { time: string; available: boolean }[] = [];
    const capacityLimit = config.allowSimultaneousStaff === false ? 1 : config.simultaneousCapacity || 2;
    const existing = businessData?.appointments || [];
    const durationMin = activeService?.durationMin || 60;

    // Interval determination: -1 means according to service duration, otherwise 15, 30, 45, 60, etc.
    const intervalSetting = config.appointmentIntervalMinutes;
    const stepMinutes = intervalSetting === -1
      ? Math.max(durationMin, 15)
      : (Number(intervalSetting) > 0 ? Number(intervalSetting) : 30);

    const lunchStartMins = config.lunchStart
      ? parseTimeToMinutes(config.lunchStart)
      : (config.morningClose ? parseTimeToMinutes(config.morningClose) : 0);
    const lunchEndMins = config.lunchEnd
      ? parseTimeToMinutes(config.lunchEnd)
      : (config.afternoonOpen ? parseTimeToMinutes(config.afternoonOpen) : 0);

    const addRangeSlots = (startStr: string, endStr: string) => {
      const startMins = parseTimeToMinutes(startStr);
      const endMins = parseTimeToMinutes(endStr);

      if (endMins <= startMins) return;

      for (let current = startMins; current + Math.min(durationMin, 30) <= endMins; current += stepMinutes) {
        if (current + durationMin > endMins && current > startMins) {
          break;
        }

        // Exclude slots that overlap with lunch break pause if double shift is active
        if (config.hasDoubleShift && lunchEndMins > lunchStartMins) {
          if (current < lunchEndMins && (current + durationMin) > lunchStartMins) {
            continue;
          }
        }

        const h = Math.floor(current / 60);
        const m = current % 60;
        const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        const booked = existing.filter((apt) => {
          if (!isDateMatching(apt.date, selectedDate)) return false;
          if (apt.status === 'cancelada') return false;

          const aptStart = parseTimeToMinutes(apt.time);
          const aptDuration = 60;

          return current < aptStart + aptDuration && current + durationMin > aptStart;
        }).length;

        slots.push({
          time: timeLabel,
          available: booked < capacityLimit
        });
      }
    };

    if (config.hasDoubleShift && config.morningOpen && config.morningClose && config.afternoonOpen && config.afternoonClose) {
      addRangeSlots(config.morningOpen, config.morningClose);
      addRangeSlots(config.afternoonOpen, config.afternoonClose);
    } else {
      const open = config.openTime || '09:00';
      const close = config.closeTime || '19:00';
      addRangeSlots(open, close);
    }

    return slots;
  }, [selectedDate, config, businessData, activeService]);

  // Set default time slot
  useEffect(() => {
    if (availableTimeSlots.length > 0 && !selectedTime) {
      const firstAvail = availableTimeSlots.find((s) => s.available);
      if (firstAvail) {
        setSelectedTime(firstAvail.time);
      }
    }
  }, [availableTimeSlots, selectedTime]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!activeService) {
      setFormError(bt.errSelectService);
      return;
    }
    if (!selectedDate || !selectedTime) {
      setFormError(bt.errSelectDateTime);
      return;
    }
    if (!tutorName.trim() || !whatsappPhone.trim() || !petName.trim()) {
      setFormError(bt.errFillRequired);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const normalizedDigits = normalizePhoneForWhatsApp(whatsappPhone.trim(), config);
    const formattedTutorPhone = normalizedDigits ? `+${normalizedDigits}` : whatsappPhone.trim();

    const parsedWeight = Number(weightKg) || (selectedDogSize === 'pequeno' ? 6 : selectedDogSize === 'mediano' ? 14 : selectedDogSize === 'grande' ? 24 : 35);
    const nowIso = new Date().toISOString();
    const generatedPetId = `#PET-${Math.floor(1000 + Math.random() * 9000)}`;

    const petData: Partial<Pet> = {
      id: generatedPetId,
      name: petName.trim(),
      breed: breed.trim() || 'Mestizo',
      size: selectedDogSize,
      age: age.trim() || '1 año',
      gender,
      weightKg: parsedWeight,
      photoUrl: petPhoto || undefined,
      tutor: {
        name: tutorName.trim(),
        phone: formattedTutorPhone,
        rawPhone: normalizedDigits || whatsappPhone.trim()
      },
      habitualMood: behavior,
      healthAllergies: healthNotes.trim(),
      handlingObservations: handlingNotes.trim()
    };

    const newApt: Appointment = {
      id: `apt_pub_${Date.now()}`,
      businessId: businessData?.businessId,
      petId: generatedPetId,
      petName: petName.trim(),
      breed: breed.trim() || 'Mestizo',
      size: selectedDogSize,
      tutorName: tutorName.trim(),
      tutorPhone: formattedTutorPhone,
      serviceName: activeService.name,
      time: `${selectedTime} hs`,
      date: selectedDate,
      status: 'pendiente',
      statusLabel: 'POR CONFIRMAR',
      groomer: config?.staffMembers?.[0]?.name || 'Peluquero asignado',
      price: totalPrice,
      currency,
      paymentStatus: 'por_cobrar',
      paymentStatusLabel: 'Por cobrar',
      subStatus: 'Reserva online (Por confirmar)',
      subStatusType: 'warning',
      hasMedication: selectedMedicationIds.length > 0,
      beforePhotoUrl: petPhoto || undefined,
      createdFromPublic: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      petSnapshot: petData,
      notes: [
        healthNotes ? `Salud: ${healthNotes}` : '',
        handlingNotes ? `Manejo: ${handlingNotes}` : ''
      ].filter(Boolean).join(' | ')
    };

    try {
      const saved = await createPublicAppointment(businessData?.businessId || businessIdOrSlug, newApt, petData);
      if (!saved && !isPreviewMode) {
        setFormError(bt.errBookingFailed);
        return;
      }
      if (onAppointmentCreated) {
        onAppointmentCreated(newApt, petData);
      }
      setCreatedAppointment(newApt);
    } catch (err) {
      console.error('Error saving appointment:', err);
      if (isPreviewMode) {
        setCreatedAppointment(newApt);
      } else {
        setFormError(bt.errBookingFailed);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to book another appointment
  const handleResetForm = () => {
    setCreatedAppointment(null);
    setPetName('');
    setBreed('');
    setAge('');
    setGender('Macho');
    setWeightKg('10');
    setPetPhoto('');
    setHealthNotes('');
    setHandlingNotes('');
    setSelectedMedicationIds([]);
    setFormError(null);
  };

  // 1. Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcf8ff] flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#2e004e] text-[#f9b900] flex items-center justify-center shadow-lg animate-pulse mb-4">
          <span className="material-symbols-outlined text-3xl">pets</span>
        </div>
        <p className="text-sm font-bold text-[#2e004e]">{bt.loadingSalonInfo}</p>
        <p className="text-xs text-[#7e7482] mt-1">{bt.connectingSystem}</p>
      </div>
    );
  }

  // 2. Clean error state: NEVER substitute another business!
  if (loadError || !config) {
    return (
      <div className="min-h-screen bg-[#fcf8ff] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-[#cfc2d2]/40 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-3xl">
            <span className="material-symbols-outlined text-4xl">
              {loadErrorKind === 'quota_exceeded' ? 'cloud_off' : 'store'}
            </span>
          </div>
          <h2 className="text-xl font-black text-[#1a1a26]">
            {bt.businessNotFoundTitle}
          </h2>
          <p className="text-xs text-[#7e7482] leading-relaxed">
            {bt.businessNotFoundDesc}
          </p>
          {isPreviewMode && onClosePreview && (
            <button
              type="button"
              onClick={onClosePreview}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#2e004e] text-white text-xs font-bold hover:bg-[#4b0878] transition-all cursor-pointer"
            >
              {bt.exitPreview}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#1a1a26] flex flex-col">
      {/* Admin preview banner (ONLY if opened in preview mode from admin panel) */}
      {isPreviewMode && (
        <div className="bg-[#2e004e] text-white text-xs py-2 px-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#f9b900]">visibility</span>
            <span className="font-semibold">{bt.previewBannerTitle}</span>
          </div>
          {onClosePreview && (
            <button
              type="button"
              onClick={onClosePreview}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer"
            >
              {bt.exitPreview}
            </button>
          )}
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-start">
        {/* Salon Branding Card */}
        <header className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#f5f2ff] p-2 flex items-center justify-center overflow-hidden border border-[#cfc2d2]/30 shrink-0 shadow-xs">
            {config?.logoUrl && !logoLoadFailed ? (
              <img
                src={config.logoUrl}
                alt={config?.name || 'Salon'}
                className="w-full h-full object-contain"
                onError={() => setLogoLoadFailed(true)}
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-[#2e004e] text-[#f9b900] flex items-center justify-center font-black text-2xl sm:text-3xl shadow-inner">
                {config?.name ? config.name.charAt(0).toUpperCase() : <span className="material-symbols-outlined text-3xl">pets</span>}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-[#7a5900] uppercase tracking-wider block mb-0.5">
              {bt.defaultTagline}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2e004e] tracking-tight">
              {config?.name || 'AgendaCan'}
            </h1>

            {/* Compact reputation indicator */}
            {totalReviews > 0 ? (
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1.5 flex-wrap">
                <div className="flex items-center text-[#f9b900] text-sm">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={s <= Math.round(rawAvg) ? 'text-[#f9b900]' : 'text-gray-300'}>
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-xs font-black text-[#1a1a26]">
                  {formatTemplate(bt.ratingOf5, { avg: avgRating || '0.0' })}
                </span>
                <span className="text-xs text-[#7e7482]">
                  ({totalReviews} {totalReviews === 1 ? bt.reviewCountSingular : bt.reviewCountPlural})
                </span>
              </div>
            ) : null}

            {/* Location: [City], [Country] and [Address] */}
            {([config.city?.trim(), config.country?.trim()].filter(Boolean).length > 0 || Boolean(config.address?.trim())) && (
              <div className="flex items-start justify-center sm:justify-start gap-1.5 mt-2 text-xs text-[#7e7482]">
                <span className="material-symbols-outlined text-sm text-[#2e004e] shrink-0 mt-0.5">location_on</span>
                <div className="flex flex-col text-center sm:text-left">
                  {[config.city?.trim(), config.country?.trim()].filter(Boolean).length > 0 && (
                    <span className="font-bold text-[#1a1a26]">
                      {[config.city?.trim(), config.country?.trim()].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {config.address?.trim() && (
                    <span>{config.address.trim()}</span>
                  )}
                </div>
              </div>
            )}

            {/* Phone */}
            {config.phone && (
              <div className="flex items-center justify-center sm:justify-start gap-1 mt-1 text-xs text-[#7e7482]">
                <span className="material-symbols-outlined text-sm text-[#2e004e]">call</span>
                <span>{config.phonePrefix} {config.phone}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <span className="inline-flex items-center gap-1 bg-[#f5f2ff] text-[#2e004e] px-2.5 py-1 rounded-full text-[11px] font-bold">
                <span className="material-symbols-outlined text-xs">schedule</span>
                <span>{config.workingDays || bt.defaultWorkingDays} ({config.morningOpen || config.openTime} - {config.afternoonClose || config.closeTime})</span>
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Content: Confirmation Screen OR Booking Form */}
        {createdAppointment ? (
          /* Confirmation Screen */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#cfc2d2]/40 text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-3xl shadow-sm">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1a1a26]">
                {bt.thankYouTitle}
              </h2>
              <p className="text-sm text-[#7e7482] mt-1.5 font-medium">
                {bt.requestRegisteredDesc} <strong className="text-[#2e004e]">{config.name}</strong>.
              </p>
              <p className="text-xs text-[#2e004e] font-bold mt-1">
                {bt.waConfirmSoon}
              </p>
            </div>

            {/* Appointment Details Card */}
            <div className="bg-[#fcf8ff] rounded-2xl p-5 border border-[#cfc2d2]/40 text-left space-y-3 text-xs max-w-lg mx-auto">
              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">{bt.summaryPet}:</span>
                <strong className="text-[#1a1a26] font-bold text-sm">{createdAppointment.petName} ({createdAppointment.breed})</strong>
              </div>

              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">{bt.summaryTutor}:</span>
                <strong className="text-[#1a1a26] font-bold">{createdAppointment.tutorName}</strong>
              </div>

              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">{bt.requestedServiceLabel}</span>
                <strong className="text-[#2e004e] font-bold">{createdAppointment.serviceName}</strong>
              </div>

              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">{bt.dateTimeLabel}</span>
                <strong className="text-[#1a1a26] font-bold">{createdAppointment.date} {bt.atWord} {createdAppointment.time}</strong>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[#7e7482] font-bold text-sm">{bt.summaryTotal}:</span>
                <strong className="text-[#2e004e] text-base font-black">
                  {formatPrice(createdAppointment.price, createdAppointment.currency, { includeCode: true })}
                </strong>
              </div>
            </div>

            {/* WhatsApp Confirmation Notice */}
            <div className="bg-[#eefcf2] border border-emerald-200 rounded-2xl p-4 max-w-lg mx-auto text-left flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-2xl shrink-0 mt-0.5">chat</span>
              <div className="text-xs text-emerald-950 space-y-1">
                <strong className="block text-emerald-900 font-bold text-sm">
                  {bt.waWillConfirmTitle}
                </strong>
                <p>
                  {formatTemplate(bt.waWillConfirmDesc, { phone: createdAppointment.tutorPhone || '' })}
                </p>
              </div>
            </div>

            {/* Direct WhatsApp Contact Button */}
            {config.phone && (
              <div className="max-w-lg mx-auto">
                <a
                  href={`https://wa.me/${config.phonePrefix.replace(/\+/g, '')}${config.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    formatTemplate(bt.waBookingMessage, {
                      salonName: config.name,
                      petName: createdAppointment.petName,
                      date: createdAppointment.date || '',
                      time: createdAppointment.time,
                      serviceName: createdAppointment.serviceName
                    })
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>
                  <span>{bt.sendWaToSalonBtn}</span>
                </a>
              </div>
            )}

            {/* Reset / Book another pet button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="py-3 px-6 rounded-2xl bg-[#2e004e] text-white font-bold text-xs hover:bg-[#4b0878] active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                {bt.bookAnotherBtn}
              </button>
            </div>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-[#cfc2d2]/40 space-y-6">
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Select service */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  {bt.selectServiceTitle}
                </h3>
              </div>

              {services.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-xs text-[#7e7482] text-center">
                  {bt.noServicesAvailable}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc) => {
                    const isSelected = svc.id === selectedServiceId;
                    const hasGallery = Array.isArray(svc.galleryUrls) && svc.galleryUrls.length > 0;
                    const totalPhotosCount = (svc.imageUrl ? 1 : 0) + (hasGallery ? svc.galleryUrls!.length : 0);

                    return (
                      <div
                        key={svc.id}
                        onClick={() => setSelectedServiceId(svc.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'border-[#2e004e] ring-2 ring-[#2e004e]/20 bg-[#f5f2ff]'
                            : 'border-[#cfc2d2]/40 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Fotografía principal del servicio si existe */}
                          {svc.imageUrl ? (
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-100 border border-[#cfc2d2]/40 shrink-0 shadow-2xs">
                              <img
                                src={svc.imageUrl}
                                alt={svc.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {hasGallery && (
                                <span className="absolute bottom-1 right-1 bg-black/65 text-white text-[9px] font-extrabold px-1 py-0.5 rounded flex items-center gap-0.5 pointer-events-none">
                                  <span className="material-symbols-outlined text-[10px]">photo_library</span>
                                  {totalPhotosCount}
                                </span>
                              )}
                            </div>
                          ) : null}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <h4 className="font-bold text-xs sm:text-sm text-[#1a1a26] leading-snug">
                                {svc.name}
                              </h4>
                              <span className="font-black text-xs sm:text-sm text-[#2e004e] shrink-0">
                                {formatPrice(svc.price, currency, { includeCode: true })}
                              </span>
                            </div>

                            {svc.desc && (
                              <p className="text-[11px] text-[#7e7482] mt-1 line-clamp-2 leading-tight">
                                {svc.desc}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Footer de la tarjeta con duración y control de galería (si tiene fotos adicionales) */}
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#cfc2d2]/25">
                          <span className="text-[10px] text-[#7e7482] font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            {svc.durationMin} min
                            {svc.pricingType === 'tamano' && (
                              <span className="ml-1 px-1.5 py-0.2 rounded bg-[#f2daff] text-[#2e004e] font-bold text-[9px]">
                                {bt.bySizeBadge}
                              </span>
                            )}
                          </span>

                          {/* View photos button ONLY if extra gallery exists */}
                          {hasGallery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGalleryModalService(svc);
                                setGalleryActiveIndex(0);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#f5f2ff] hover:bg-[#2e004e] hover:text-white text-[#2e004e] border border-[#cfc2d2]/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-xs">photo_library</span>
                              <span>{formatTemplate(bt.viewPhotosBtn, { count: totalPhotosCount })}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Size selector if service has size-based pricing */}
              {activeService?.pricingType === 'tamano' && (
                <div className="p-3.5 bg-[#fcf8ff] rounded-2xl border border-[#cfc2d2]/40 space-y-2.5">
                  <span className="text-xs font-bold text-[#4c4451] block">
                    {bt.selectedPetSizeLabel}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {(['pequeno', 'mediano', 'grande', 'extraGrande'] as const).map((sz) => {
                      const labels = {
                        pequeno: mt.sizeSmallRange,
                        mediano: mt.sizeMediumRange,
                        grande: mt.sizeLargeRange,
                        extraGrande: mt.sizeExtraLargeRange
                      };
                      const priceForSize = activeService.priceBySize?.[sz] || activeService.price;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedDogSize(sz)}
                          className={`p-2 rounded-xl text-center font-bold transition-all cursor-pointer ${
                            selectedDogSize === sz
                              ? 'bg-[#2e004e] text-white shadow-xs'
                              : 'bg-white text-[#4c4451] border border-[#cfc2d2]/30 hover:bg-gray-50'
                          }`}
                        >
                          <span className="block truncate">{labels[sz]}</span>
                          <span className="block text-[11px] font-black mt-0.5">
                            {formatPrice(priceForSize, currency, { includeCode: true })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Date selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  {bt.selectDateTimeTitle}
                </h3>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {availableDates.map((item, idx) => {
                  const isSelected = selectedDate === item.formatted;
                  const isWorking = item.isWorkingDay;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isWorking}
                      onClick={() => setSelectedDate(item.formatted)}
                      className={`min-w-[68px] py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                        !isWorking
                          ? 'opacity-40 bg-gray-100 border border-gray-200 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#2e004e] text-white shadow-md scale-105'
                          : 'bg-white border border-[#cfc2d2]/40 text-[#4c4451] hover:border-[#2e004e]'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider">{item.dayName}</span>
                      <span className="text-base font-black my-0.5">{item.dayNum}</span>
                      <span className="text-[9px] uppercase font-semibold">{item.monthName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Time slots */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  {bt.stepDateTime.replace('2. ', '')}
                </h3>
              </div>

              {availableTimeSlots.length === 0 ? (
                <p className="text-xs text-[#7e7482]">{bt.noSlotsAvailable}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {availableTimeSlots.map((slot) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          !slot.available
                            ? 'opacity-40 bg-gray-100 text-gray-400 border border-gray-200 line-through cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#2e004e] text-white shadow-xs scale-105'
                            : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-gray-50'
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Owner and pet info */}
            <div className="space-y-3 pt-2 border-t border-[#cfc2d2]/30">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  {bt.tutorAndPetTitle}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {bt.tutorNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={tutorName}
                    onChange={(e) => setTutorName(e.target.value)}
                    placeholder={bt.tutorNamePlaceholder}
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {bt.whatsappLabel}
                  </label>
                  <input
                    type="tel"
                    required
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder={bt.whatsappPlaceholder}
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {bt.petNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder={bt.petNamePlaceholder}
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {bt.petBreedLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder={bt.petBreedPlaceholder}
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>

              {/* Age, Gender and Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {bt.ageFieldLabel}
                  </label>
                  <input
                    type="text"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder={bt.ageFieldPlaceholder}
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {mdt.petGenderLabel}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Macho' | 'Hembra')}
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e] cursor-pointer"
                  >
                    <option value="Macho">{ct.male} ♂</option>
                    <option value="Hembra">{ct.female} ♀</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {bt.weightFieldLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="100"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="10"
                      className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-[#7e7482] font-bold">
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Optional before photo */}
              <div className="p-3.5 bg-[#fcf8ff] rounded-2xl border border-[#cfc2d2]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#2e004e]">photo_camera</span>
                    <span>{bt.beforePhotoOptTitle}</span>
                  </label>
                  {petPhoto && (
                    <button
                      type="button"
                      onClick={() => setPetPhoto('')}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      {ct.delete}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#7e7482] leading-tight">
                  {bt.beforePhotoOptDesc}
                </p>

                {petPhoto ? (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#cfc2d2]/60 bg-gray-100 shrink-0 shadow-xs">
                      <img src={petPhoto} alt={petName || 'Pet'} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      <span>{mdt.photoAttachedOk}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <label className="flex-1 py-2.5 px-3 bg-white hover:bg-[#f5f2ff] border border-dashed border-[#cfc2d2] hover:border-[#2e004e] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#2e004e] cursor-pointer transition-all active:scale-98">
                      <span className="material-symbols-outlined text-base">photo_camera</span>
                      <span>{mdt.takePhotoOption}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsPhotoCompressing(true);
                            try {
                              const compressed = await compressImage(file, 800, 0.85);
                              setPetPhoto(compressed);
                            } catch (err) {
                              console.error('Error comprimiendo foto:', err);
                            } finally {
                              setIsPhotoCompressing(false);
                            }
                          }
                        }}
                      />
                    </label>

                    <label className="flex-1 py-2.5 px-3 bg-white hover:bg-[#f5f2ff] border border-dashed border-[#cfc2d2] hover:border-[#2e004e] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#4c4451] cursor-pointer transition-all active:scale-98">
                      <span className="material-symbols-outlined text-base">photo_library</span>
                      <span>{mdt.uploadFromGallery}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsPhotoCompressing(true);
                            try {
                              const compressed = await compressImage(file, 800, 0.85);
                              setPetPhoto(compressed);
                            } catch (err) {
                              console.error('Error comprimiendo foto:', err);
                            } finally {
                              setIsPhotoCompressing(false);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                )}

                {isPhotoCompressing && (
                  <p className="text-[11px] text-[#4b0878] font-bold animate-pulse">
                    {mdt.processingImage}
                  </p>
                )}
              </div>

              {/* Behavior */}
              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  {bt.petBehaviorLabel}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['tranquilo', 'inquieto', 'dificil'] as const).map((mId) => (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => setBehavior(mId)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        behavior === mId
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-gray-50'
                      }`}
                    >
                      {translateMoodLabel(mId, pageLang)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Health and handling notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {bt.notesLabel}
                  </label>
                  <input
                    type="text"
                    value={healthNotes}
                    onChange={(e) => setHealthNotes(e.target.value)}
                    placeholder={bt.notesPlaceholder}
                    className="w-full bg-[#fcf8ff] text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    {getTranslations(pageLang).petProfile.handlingNotes}
                  </label>
                  <input
                    type="text"
                    value={handlingNotes}
                    onChange={(e) => setHandlingNotes(e.target.value)}
                    placeholder={mdt.handlingObsPlaceholder}
                    className="w-full bg-[#fcf8ff] text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Optional medications (ONLY if configured by this salon) */}
            {availableMedications.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#cfc2d2]/30">
                <h4 className="font-extrabold text-xs text-[#2e004e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">medication</span>
                  <span>{bt.addMedicationsTitle}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableMedications.map((med) => {
                    const isChecked = selectedMedicationIds.includes(med.id);
                    return (
                      <label
                        key={med.id}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isChecked
                            ? 'border-[#2e004e] bg-[#f5f2ff]'
                            : 'border-[#cfc2d2]/30 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMedicationIds([...selectedMedicationIds, med.id]);
                              } else {
                                setSelectedMedicationIds(selectedMedicationIds.filter((id) => id !== med.id));
                              }
                            }}
                            className="accent-[#2e004e] w-4 h-4 rounded"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#1a1a26] block truncate">{med.name}</span>
                            <span className="text-[10px] text-[#7e7482] block truncate">{med.purpose}</span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#2e004e] shrink-0">
                          +{formatPrice(med.price, currency, { includeCode: true })}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Total & Submit Button */}
            <div className="pt-4 border-t border-[#cfc2d2]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-[#7e7482] block font-semibold">{bt.totalAtSalon}</span>
                <strong className="text-2xl font-black text-[#2e004e]">
                  {formatPrice(totalPrice, currency, { includeCode: true })}
                </strong>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="py-3.5 px-6 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-75"
              >
                <span className={`material-symbols-outlined font-black ${isSubmitting ? 'animate-spin' : ''}`}>
                  {isSubmitting ? 'progress_activity' : 'event_available'}
                </span>
                <span>{isSubmitting ? bt.processingRequest : bt.submitRequestBtn}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[#7e7482] border-t border-[#cfc2d2]/30 bg-white">
        <p>{bt.footerTagline}</p>
      </footer>

      {/* Service Photo Gallery Modal */}
      {galleryModalService && galleryPhotos.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setGalleryModalService(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#cfc2d2]/30 flex items-center justify-between gap-3 bg-[#fcf8ff]">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7a5900] block">
                  {bt.galleryHeaderLabel}
                </span>
                <h3 className="font-black text-base sm:text-lg text-[#1a1a26] truncate">
                  {galleryModalService.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-[#7e7482] bg-white px-2.5 py-1 rounded-full border border-[#cfc2d2]/40 shadow-2xs">
                  {galleryActiveIndex + 1} / {galleryPhotos.length}
                </span>
                <button
                  type="button"
                  onClick={() => setGalleryModalService(null)}
                  className="w-9 h-9 rounded-full bg-white hover:bg-gray-100 text-[#1a1a26] flex items-center justify-center border border-[#cfc2d2]/40 transition-colors cursor-pointer shadow-2xs"
                  title={ct.close}
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Main image viewer */}
            <div className="relative flex-1 bg-black/5 flex items-center justify-center min-h-[250px] sm:min-h-[360px] max-h-[58vh] p-3 select-none overflow-hidden">
              <img
                src={galleryPhotos[galleryActiveIndex]}
                alt={`${galleryModalService.name} - ${galleryActiveIndex + 1}`}
                className="max-h-[54vh] w-auto max-w-full object-contain rounded-xl shadow-md transition-all duration-200"
              />

              {/* Previous / Next navigation buttons */}
              {galleryPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryActiveIndex((prev) =>
                        prev > 0 ? prev - 1 : galleryPhotos.length - 1
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-[#2e004e] shadow-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-2xl font-bold">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryActiveIndex((prev) =>
                        prev < galleryPhotos.length - 1 ? prev + 1 : 0
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-[#2e004e] shadow-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-2xl font-bold">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            {/* Bottom thumbnails strip */}
            {galleryPhotos.length > 1 && (
              <div className="p-3 sm:p-4 bg-white border-t border-[#cfc2d2]/30 flex items-center justify-center gap-2.5 overflow-x-auto">
                {galleryPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGalleryActiveIndex(idx)}
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer ${
                      galleryActiveIndex === idx
                        ? 'ring-2 ring-[#2e004e] ring-offset-2 opacity-100 scale-105 shadow-sm'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photo}
                      alt={`${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && galleryModalService.imageUrl && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/65 text-[9px] font-bold text-white text-center py-0.5 leading-tight">
                        {bt.mainPhotoTag}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
