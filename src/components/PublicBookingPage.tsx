import React, { useState, useEffect, useMemo } from 'react';
import { SalonConfig, SalonService, Appointment, Pet, BehaviorMood, ClientReview } from '../types';
import { fetchBusinessProfile, createPublicAppointment, subscribeToBusinessReviews } from '../utils/api';
import { formatDateSpanish, compressImage } from '../utils/storage';
import { normalizePhoneForWhatsApp } from '../utils/phoneUtils';
import { getSyncActiveData } from '../utils/saasDb';
import { HOTLINK_IMAGES } from '../mockData';
import { formatPrice } from '../utils/priceUtils';
import { parseTimeToMinutes, isDateMatching } from '../utils/scheduleUtils';
import { extractSlugOnly } from '../utils/slugUtils';

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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [businessData, setBusinessData] = useState<{
    businessId: string;
    config: SalonConfig;
    services: SalonService[];
    appointments: Appointment[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Load business from persistent storage using URL identifier
  useEffect(() => {
    let isMounted = true;
    setLoadError(null);

    // Eagerly initialize if previewing or if the current session matches this salon
    if (typeof window !== 'undefined') {
      try {
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

    fetchBusinessProfile(businessIdOrSlug)
      .then((result) => {
        if (!isMounted) return;
        if (result && result.config) {
          setBusinessData((prevData) => {
            // Anti-overwrite protection:
            // Only merge if this is the SAME business. If a different business is requested, use result directly!
            if (prevData && prevData.config) {
              const isSameBiz =
                prevData.businessId === result.businessId ||
                (prevData.config?.bookingSlug &&
                  result.config?.bookingSlug &&
                  extractSlugOnly(prevData.config.bookingSlug) === extractSlugOnly(result.config.bookingSlug));

              if (!isSameBiz) {
                return result;
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
                // If prevData already has the owner's custom services and result returned stale generic placeholders,
                // KEEP prevSvcs so the owner's customized services are NEVER replaced!
                mergedServices = prevSvcs;
              } else if (prevSvcs.length >= resultSvcs.length && prevSvcs.length > 0) {
                // prevData has equal or more services: keep all services from prevData,
                // merging any fresh field from result without losing photos or services!
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
                // Result has more services: merge photos from prevData by ID and name
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

                // Also keep any customized services from prevData that were not in result
                const resIdSet = new Set(resultSvcs.map((s) => s.id));
                for (const pSvc of prevSvcs) {
                  if (!resIdSet.has(pSvc.id) && !isDefaultPlaceholder(pSvc)) {
                    mergedServices.push(pSvc);
                  }
                }
              } else {
                mergedServices = prevSvcs;
              }

              const keepCustomConfig = {
                ...result.config,
                name: result.config.name || prevData.config.name,
                logoUrl: result.config.logoUrl || prevData.config.logoUrl,
                country: result.config.country || prevData.config.country,
                city: result.config.city || prevData.config.city,
                currency: result.config.currency || prevData.config.currency,
                address: result.config.address || prevData.config.address,
                phone: result.config.phone || prevData.config.phone,
                services: mergedServices
              };

              return {
                ...result,
                config: keepCustomConfig,
                services: mergedServices
              };
            }
            return result;
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
          setLoadError('No encontramos este negocio. Este enlace de reservas no es válido o ya no está disponible.');
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

  // Real-time synchronization of reviews from Cloud Firestore (Requirement #5)
  useEffect(() => {
    if (!businessData?.businessId) return;
    const unsub = subscribeToBusinessReviews(businessData.businessId, (incomingReviews) => {
      if (!incomingReviews) return;
      setBusinessData((prev) => {
        if (!prev || !prev.config) return prev;
        return {
          ...prev,
          config: {
            ...prev.config,
            reviews: incomingReviews
          }
        };
      });
    });
    return () => unsub();
  }, [businessData?.businessId]);

  const config = businessData?.config;

  // Real reviews and reputation metrics
  const reviewsList = useMemo(() => {
    return (config?.reviews || []).filter(
      (r) => r && typeof r.stars === 'number' && r.stars >= 1 && r.stars <= 5
    );
  }, [config?.reviews]);

  const totalReviews = reviewsList.length;
  const sumStars = reviewsList.reduce((acc, r) => acc + r.stars, 0);
  const rawAvg = totalReviews > 0 ? sumStars / totalReviews : 0;
  const avgRating = totalReviews > 0 ? (rawAvg % 1 === 0 ? rawAvg.toFixed(1) : rawAvg.toFixed(1).replace('.', ',')) : null;

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
      document.title = `${config.name} | Reservas Online`;
    }
  }, [config?.name]);

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
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const letter = dayIndexToLetter[d.getDay()];
      const isWorkingDay = activeDayLetters.includes(letter);
      const formatted = formatDateSpanish(d);

      dates.push({
        dateObj: d,
        formatted,
        dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString('es-ES', { month: 'short' }),
        isWorkingDay
      });
    }
    return dates;
  }, [today, activeDayLetters]);

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
      setFormError('Por favor selecciona un servicio.');
      return;
    }
    if (!selectedDate) {
      setFormError('Por favor selecciona una fecha.');
      return;
    }
    if (!selectedTime) {
      setFormError('Por favor selecciona un horario.');
      return;
    }
    if (!tutorName.trim()) {
      setFormError('Por favor indica tu nombre completo.');
      return;
    }
    if (!whatsappPhone.trim()) {
      setFormError('Por favor indica tu teléfono / WhatsApp de contacto.');
      return;
    }
    if (!petName.trim()) {
      setFormError('Por favor indica el nombre de la mascota.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const normalizedDigits = normalizePhoneForWhatsApp(whatsappPhone.trim(), config);
    const formattedTutorPhone = normalizedDigits ? `+${normalizedDigits}` : whatsappPhone.trim();

    const parsedWeight = Number(weightKg) || (selectedDogSize === 'pequeno' ? 6 : selectedDogSize === 'mediano' ? 14 : selectedDogSize === 'grande' ? 24 : 35);

    const newApt: Appointment = {
      id: `apt_pub_${Date.now()}`,
      petId: `#PET-${Math.floor(1000 + Math.random() * 9000)}`,
      petName: petName.trim(),
      breed: breed.trim() || 'Mestizo',
      tutorName: tutorName.trim(),
      tutorPhone: formattedTutorPhone,
      serviceName: activeService.name,
      time: `${selectedTime} hs`,
      date: selectedDate,
      status: 'pendiente',
      statusLabel: 'PENDIENTE DE CONFIRMACIÓN',
      groomer: config?.staffMembers?.[0]?.name || 'Peluquero asignado',
      price: totalPrice,
      currency,
      paymentStatus: 'por_cobrar',
      paymentStatusLabel: 'Por cobrar',
      subStatus: 'Reserva online (Por confirmar)',
      subStatusType: 'warning',
      hasMedication: selectedMedicationIds.length > 0,
      beforePhotoUrl: petPhoto || undefined,
      notes: [
        healthNotes ? `Salud: ${healthNotes}` : '',
        handlingNotes ? `Manejo: ${handlingNotes}` : ''
      ].filter(Boolean).join(' | ')
    };

    const petData: Partial<Pet> = {
      name: petName.trim(),
      breed: breed.trim() || 'Mestizo',
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

    try {
      await createPublicAppointment(businessData?.businessId || businessIdOrSlug, newApt, petData);
      if (onAppointmentCreated) {
        onAppointmentCreated(newApt, petData);
      }
      setCreatedAppointment(newApt);
    } catch (err) {
      console.error('Error saving appointment:', err);
      setCreatedAppointment(newApt);
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
        <p className="text-sm font-bold text-[#2e004e]">Cargando información del salón...</p>
        <p className="text-xs text-[#7e7482] mt-1">Conectando con el sistema de reservas</p>
      </div>
    );
  }

  // 2. Clean error state: NEVER substitute another business!
  if (loadError || !config) {
    return (
      <div className="min-h-screen bg-[#fcf8ff] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-[#cfc2d2]/40 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-3xl">
            <span className="material-symbols-outlined text-4xl">store</span>
          </div>
          <h2 className="text-xl font-black text-[#1a1a26]">
            No encontramos este negocio
          </h2>
          <p className="text-xs text-[#7e7482] leading-relaxed">
            Este enlace de reservas no es válido o ya no está disponible. Por favor, verifica el enlace que te compartió tu peluquería o solicita uno nuevo directamente por WhatsApp.
          </p>
          {isPreviewMode && onClosePreview && (
            <button
              type="button"
              onClick={onClosePreview}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#2e004e] text-white text-xs font-bold hover:bg-[#4b0878] transition-all cursor-pointer"
            >
              Volver al panel
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
            <span className="font-semibold">Modo Vista Previa de Cliente — Así es como ven tu salón las personas</span>
          </div>
          {onClosePreview && (
            <button
              type="button"
              onClick={onClosePreview}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Volver a la administración
            </button>
          )}
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-start">
        {/* Salon Branding Card */}
        <header className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#f5f2ff] p-2 flex items-center justify-center overflow-hidden border border-[#cfc2d2]/30 shrink-0 shadow-xs">
            <img
              src={config?.logoUrl || HOTLINK_IMAGES.logo}
              alt={config?.name || 'Groomer Aida'}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = HOTLINK_IMAGES.logo;
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-[#7a5900] uppercase tracking-wider block mb-0.5">
              Peluquería Canina & Estética
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2e004e] tracking-tight">
              {config?.name || 'Groomer Aida'}
            </h1>

            {/* Indicador compacto de reputación (Requisito 5) */}
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
                  {avgRating} de 5
                </span>
                <span className="text-xs text-[#7e7482]">
                  ({totalReviews} {totalReviews === 1 ? 'reseña' : 'reseñas'})
                </span>
              </div>
            ) : null}

            {/* Ubicación: [Ciudad], [País] y debajo [Dirección del negocio] */}
            {([config.city?.trim(), config.country?.trim()].filter(Boolean).length > 0 || config.address) && (
              <div className="flex items-start justify-center sm:justify-start gap-1.5 mt-2 text-xs text-[#7e7482]">
                <span className="material-symbols-outlined text-sm text-[#2e004e] shrink-0 mt-0.5">location_on</span>
                <div className="flex flex-col text-center sm:text-left">
                  {[config.city?.trim(), config.country?.trim()].filter(Boolean).length > 0 && (
                    <span className="font-bold text-[#1a1a26]">
                      {[config.city?.trim(), config.country?.trim()].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {config.address && (
                    <span>{config.address}</span>
                  )}
                </div>
              </div>
            )}

            {/* Teléfono */}
            {config.phone && (
              <div className="flex items-center justify-center sm:justify-start gap-1 mt-1 text-xs text-[#7e7482]">
                <span className="material-symbols-outlined text-sm text-[#2e004e]">call</span>
                <span>{config.phonePrefix} {config.phone}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <span className="inline-flex items-center gap-1 bg-[#f5f2ff] text-[#2e004e] px-2.5 py-1 rounded-full text-[11px] font-bold">
                <span className="material-symbols-outlined text-xs">schedule</span>
                <span>{config.workingDays || 'Lunes a Sábado'} ({config.morningOpen || config.openTime} - {config.afternoonClose || config.closeTime})</span>
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
                ¡Gracias por agendar!
              </h2>
              <p className="text-sm text-[#7e7482] mt-1.5 font-medium">
                Tu solicitud de cita ha sido registrada correctamente con <strong className="text-[#2e004e]">{config.name}</strong>.
              </p>
              <p className="text-xs text-[#2e004e] font-bold mt-1">
                Te confirmaremos la cita próximamente por WhatsApp.
              </p>
            </div>

            {/* Appointment Details Card */}
            <div className="bg-[#fcf8ff] rounded-2xl p-5 border border-[#cfc2d2]/40 text-left space-y-3 text-xs max-w-lg mx-auto">
              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">Mascota:</span>
                <strong className="text-[#1a1a26] font-bold text-sm">{createdAppointment.petName} ({createdAppointment.breed})</strong>
              </div>

              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">Tutor:</span>
                <strong className="text-[#1a1a26] font-bold">{createdAppointment.tutorName}</strong>
              </div>

              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">Servicio solicitado:</span>
                <strong className="text-[#2e004e] font-bold">{createdAppointment.serviceName}</strong>
              </div>

              <div className="flex justify-between items-center border-b border-[#cfc2d2]/30 pb-2.5">
                <span className="text-[#7e7482] font-semibold">Fecha y horario:</span>
                <strong className="text-[#1a1a26] font-bold">{createdAppointment.date} a las {createdAppointment.time}</strong>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[#7e7482] font-bold text-sm">Valor estimado:</span>
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
                  Tu cita será confirmada por el salón próximamente
                </strong>
                <p>
                  Te confirmaremos tu cita por WhatsApp al teléfono <strong>{createdAppointment.tutorPhone}</strong>. Te avisaremos cuando el turno quede formalmente agendado.
                </p>
              </div>
            </div>

            {/* Direct WhatsApp Contact Button */}
            {config.phone && (
              <div className="max-w-lg mx-auto">
                <a
                  href={`https://wa.me/${config.phonePrefix.replace(/\+/g, '')}${config.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `¡Hola ${config.name}! Acabo de solicitar un turno online para mi mascota ${createdAppointment.petName} el día ${createdAppointment.date} a las ${createdAppointment.time} (${createdAppointment.serviceName}).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>
                  <span>Enviar mensaje al salón por WhatsApp</span>
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
                Agendar otra cita
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

            {/* 1. Selecciona el servicio */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  Selecciona el servicio
                </h3>
              </div>

              {services.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-xs text-[#7e7482] text-center">
                  Este salón aún no tiene servicios activos configurados.
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
                                Por tamaño
                              </span>
                            )}
                          </span>

                          {/* Botón «Ver fotos» ÚNICAMENTE si tiene fotografías adicionales */}
                          {hasGallery && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGalleryModalService(svc);
                                setGalleryActiveIndex(0);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#f5f2ff] hover:bg-[#2e004e] hover:text-white text-[#2e004e] border border-[#cfc2d2]/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                              title="Ver fotos adicionales de este servicio"
                            >
                              <span className="material-symbols-outlined text-xs">photo_library</span>
                              <span>Ver fotos ({totalPhotosCount})</span>
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
                    Tamaño de la mascota:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {(['pequeno', 'mediano', 'grande', 'extraGrande'] as const).map((sz) => {
                      const labels = {
                        pequeno: 'Pequeño (<8kg)',
                        mediano: 'Mediano (8-18kg)',
                        grande: 'Grande (18-30kg)',
                        extraGrande: 'Gigante (>30kg)'
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

            {/* 2. Selecciona la fecha */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  Selecciona la fecha
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

            {/* 3. Selecciona el horario */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  Selecciona el horario
                </h3>
              </div>

              {availableTimeSlots.length === 0 ? (
                <p className="text-xs text-[#7e7482]">No hay horarios disponibles para la fecha seleccionada.</p>
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
                        {slot.time} hs
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Datos del tutor y de la mascota */}
            <div className="space-y-3 pt-2 border-t border-[#cfc2d2]/30">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <h3 className="font-extrabold text-sm text-[#1a1a26]">
                  Tus datos y los de tu mascota
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Nombre del tutor / dueño *
                  </label>
                  <input
                    type="text"
                    required
                    value={tutorName}
                    onChange={(e) => setTutorName(e.target.value)}
                    placeholder="Ej: Laura Martínez"
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Teléfono / WhatsApp de contacto *
                  </label>
                  <input
                    type="tel"
                    required
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="Ej: +54 9 11 5566-7788"
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Nombre de la mascota *
                  </label>
                  <input
                    type="text"
                    required
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="Ej: Toby"
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Raza *
                  </label>
                  <input
                    type="text"
                    required
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="Ej: Caniche / Mestizo"
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>

              {/* Edad, Sexo y Peso (Requirement #1) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Edad de la mascota
                  </label>
                  <input
                    type="text"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ej: 2 años / 8 meses"
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Sexo
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Macho' | 'Hembra')}
                    className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e] cursor-pointer"
                  >
                    <option value="Macho">Macho ♂</option>
                    <option value="Hembra">Hembra ♀</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Peso aproximado (kg)
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

              {/* Fotografía de la mascota antes del servicio (Requirement #2) */}
              <div className="p-3.5 bg-[#fcf8ff] rounded-2xl border border-[#cfc2d2]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#2e004e]">photo_camera</span>
                    <span>Foto de tu mascota (Opcional - Antes del servicio)</span>
                  </label>
                  {petPhoto && (
                    <button
                      type="button"
                      onClick={() => setPetPhoto('')}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#7e7482] leading-tight">
                  Sube una foto de tu mascota para que el peluquero pueda ver el estado de su manto antes de la cita.
                </p>

                {petPhoto ? (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#cfc2d2]/60 bg-gray-100 shrink-0 shadow-xs">
                      <img src={petPhoto} alt="Foto mascota" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      <span>Foto adjuntada correctamente</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {/* Tomar foto */}
                    <label className="flex-1 py-2.5 px-3 bg-white hover:bg-[#f5f2ff] border border-dashed border-[#cfc2d2] hover:border-[#2e004e] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#2e004e] cursor-pointer transition-all active:scale-98">
                      <span className="material-symbols-outlined text-base">photo_camera</span>
                      <span>Tomar foto</span>
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

                    {/* Elegir de galería */}
                    <label className="flex-1 py-2.5 px-3 bg-white hover:bg-[#f5f2ff] border border-dashed border-[#cfc2d2] hover:border-[#2e004e] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#4c4451] cursor-pointer transition-all active:scale-98">
                      <span className="material-symbols-outlined text-base">photo_library</span>
                      <span>Elegir de galería</span>
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
                    Procesando fotografía...
                  </p>
                )}
              </div>

              {/* Comportamiento */}
              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  Comportamiento habitual en peluquería
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'tranquilo', label: '🟢 Tranquilo' },
                    { id: 'inquieto', label: '🟡 Inquieto' },
                    { id: 'dificil', label: '🔴 Difícil' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setBehavior(m.id as BehaviorMood)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        behavior === m.id
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-gray-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas de salud y manejo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Alergias o piel sensible (opcional)
                  </label>
                  <input
                    type="text"
                    value={healthNotes}
                    onChange={(e) => setHealthNotes(e.target.value)}
                    placeholder="Ej: Champú hipoalergénico"
                    className="w-full bg-[#fcf8ff] text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Observaciones de manejo (opcional)
                  </label>
                  <input
                    type="text"
                    value={handlingNotes}
                    onChange={(e) => setHandlingNotes(e.target.value)}
                    placeholder="Ej: Cuidado con pata trasera"
                    className="w-full bg-[#fcf8ff] text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Medicamentos adicionales (ONLY if configured by this salon) */}
            {availableMedications.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#cfc2d2]/30">
                <h4 className="font-extrabold text-xs text-[#2e004e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">medication</span>
                  <span>Tratamientos adicionales disponibles</span>
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
                <span className="text-xs text-[#7e7482] block font-semibold">Total a abonar en el salón:</span>
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
                <span>{isSubmitting ? 'Procesando solicitud...' : 'Solicitar Turno'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[#7e7482] border-t border-[#cfc2d2]/30 bg-white">
        <p>Sistema de Reservas Online para Peluquerías Caninas</p>
      </footer>

      {/* Modal de Galería de Fotos del Servicio */}
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
            {/* Cabecera del modal */}
            <div className="p-4 sm:p-5 border-b border-[#cfc2d2]/30 flex items-center justify-between gap-3 bg-[#fcf8ff]">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7a5900] block">
                  Galería del servicio
                </span>
                <h3 className="font-black text-base sm:text-lg text-[#1a1a26] truncate">
                  {galleryModalService.name}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-[#7e7482] bg-white px-2.5 py-1 rounded-full border border-[#cfc2d2]/40 shadow-2xs">
                  {galleryActiveIndex + 1} de {galleryPhotos.length}
                </span>
                <button
                  type="button"
                  onClick={() => setGalleryModalService(null)}
                  className="w-9 h-9 rounded-full bg-white hover:bg-gray-100 text-[#1a1a26] flex items-center justify-center border border-[#cfc2d2]/40 transition-colors cursor-pointer shadow-2xs"
                  title="Cerrar galería"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Visor principal de la imagen */}
            <div className="relative flex-1 bg-black/5 flex items-center justify-center min-h-[250px] sm:min-h-[360px] max-h-[58vh] p-3 select-none overflow-hidden">
              <img
                src={galleryPhotos[galleryActiveIndex]}
                alt={`${galleryModalService.name} - Foto ${galleryActiveIndex + 1}`}
                className="max-h-[54vh] w-auto max-w-full object-contain rounded-xl shadow-md transition-all duration-200"
              />

              {/* Botones de navegación Anterior / Siguiente (si hay más de 1 imagen) */}
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
                    title="Foto anterior"
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
                    title="Siguiente foto"
                  >
                    <span className="material-symbols-outlined text-2xl font-bold">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            {/* Tira inferior de miniaturas */}
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
                      alt={`Miniatura ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && galleryModalService.imageUrl && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/65 text-[9px] font-bold text-white text-center py-0.5 leading-tight">
                        Principal
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
