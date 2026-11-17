import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SalonConfig,
  StaffMember,
  Appointment,
  ClientReview,
  SalonService,
  MedicationProduct,
  StaffScheduleConfig,
  UserAccount,
  SaleRecord
} from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { ServiceManager } from './ServiceManager';
import { MedicationManager } from './MedicationManager';
import { StaffShiftScheduleManager } from './StaffShiftScheduleManager';
import { VentasView } from './VentasView';
import { COUNTRIES, CURRENCIES } from '../utils/countries';
import { AppLanguage, LANGUAGE_OPTIONS } from '../utils/translations';
import { compressImage } from '../utils/storage';
import { slugify, cleanSlugInput, extractSlugOnly, buildPublicReviewUrl } from '../utils/slugUtils';
import { syncBusinessToServer, updateReviewRequestStateInFirestore } from '../utils/api';
import { persistActiveConfig } from '../utils/saasDb';
import { checkSlugAvailabilityInFirestore, uploadImageToStorage } from '../utils/firebase';
import { normalizePhoneForWhatsApp, openWhatsAppUrl } from '../utils/phoneUtils';
import { formatPrice } from '../utils/priceUtils';
import { getAppointmentTimestamp } from '../utils/petSorting';
import { TimeSelectPicker } from './TimeSelectPicker';
import { timeTo12H, timeTo24H } from '../utils/scheduleUtils';
import { normalizeAndMergeReviews, calculateReviewStats } from '../utils/syncHelpers';
import { useTranslation } from '../utils/i18n/I18nContext';
import { getDayLetters, formatTemplate } from '../utils/i18n/helpers';

interface AjustesViewProps {
  config: SalonConfig;
  onUpdateConfig: (updated: SalonConfig) => void;
  onPreviewClientFlow: () => void;
  onPreviewReviewFlow?: () => void;
  appointments?: Appointment[];
  sales?: SaleRecord[];
  initialSection?: 'negocio' | 'calificaciones' | 'clientes' | 'enlace' | 'ventas' | null;
  onAddNewReview?: (review: ClientReview) => void;
  onRefreshReviews?: () => Promise<void> | void;
  currentLanguage?: AppLanguage;
  onUpdateLanguage?: (lang: AppLanguage) => void;
  activeAccount?: UserAccount | null;
  onOpenAccountModal?: () => void;
}

export const AjustesView: React.FC<AjustesViewProps> = ({
  config,
  onUpdateConfig,
  onPreviewClientFlow,
  onPreviewReviewFlow,
  appointments = [],
  sales = [],
  initialSection = null,
  onRefreshReviews,
  currentLanguage,
  onUpdateLanguage,
  activeAccount,
  onOpenAccountModal
}) => {
  const { t, lang, setLanguage } = useTranslation();
  const st = t.settings;
  const ct = t.common;

  // Navigation: null shows the simplified vertical menu; or 'negocio' | 'calificaciones' | 'clientes' | 'enlace' | 'ventas'
  const [selectedSection, setSelectedSection] = useState<'negocio' | 'calificaciones' | 'clientes' | 'enlace' | 'ventas' | null>(initialSection);

  const onRefreshReviewsRef = useRef(onRefreshReviews);
  onRefreshReviewsRef.current = onRefreshReviews;

  useEffect(() => {
    if (initialSection !== undefined) {
      setSelectedSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    if (selectedSection === 'calificaciones') {
      onRefreshReviewsRef.current?.();
    }
  }, [selectedSection, config.id]);

  // Client History Filters
  const [clientPeriodFilter, setClientPeriodFilter] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Brand data (never force hardcoded demo country or address onto unconfigured businesses)
  const [logoUrl, setLogoUrl] = useState<string>(config.logoUrl || '');
  const [businessName, setBusinessName] = useState<string>(config.name || 'Groomer Aida');
  const [selectedCountry, setSelectedCountry] = useState<string>(config.country || '');
  const [selectedCity, setSelectedCity] = useState<string>(config.city || '');
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(currentLanguage || lang);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(config.currency || 'USD');

  useEffect(() => {
    setSelectedLanguage(currentLanguage || lang);
  }, [currentLanguage, lang]);

  // Contact & Location
  const [phonePrefix, setPhonePrefix] = useState<string>(config.phonePrefix || '+54');
  const [phoneNumber, setPhoneNumber] = useState<string>(config.phone || '11 5489 3210');
  const [address, setAddress] = useState<string>(config.address || '');

  const syncedSnapshotRef = useRef<{
    id?: string;
    updatedAt?: string;
    country?: string;
    city?: string;
    address?: string;
    name?: string;
  } | null>(
    config
      ? {
          id: config.id,
          updatedAt: config.updatedAt,
          country: config.country,
          city: config.city,
          address: config.address,
          name: config.name
        }
      : null
  );

  useEffect(() => {
    if (!config) return;
    const prevSnap = syncedSnapshotRef.current;
    const isAccountSwitch = !prevSnap || prevSnap.id !== config.id;
    const isTimestampOrLocationUpdate =
      isAccountSwitch ||
      prevSnap.updatedAt !== config.updatedAt ||
      prevSnap.country !== config.country ||
      prevSnap.city !== config.city ||
      prevSnap.address !== config.address ||
      prevSnap.name !== config.name;

    if (isAccountSwitch) {
      setBusinessName(config.name || '');
      setLogoUrl(config.logoUrl || '');
      setSelectedCountry(config.country || '');
      setSelectedCity(config.city || '');
      setAddress(config.address || '');
      setSelectedCurrency(config.currency || 'USD');
      setPhonePrefix(config.phonePrefix || '+54');
      setPhoneNumber(config.phone || '');
      setActiveDays(config.activeDays || ['L', 'M', 'X', 'J', 'V', 'S']);
      setHasDoubleShift(config.hasDoubleShift ?? true);
      setMorningOpen(config.morningOpen || '08:00');
      setMorningClose(config.morningClose || '12:30');
      setLunchStart(config.lunchStart || config.morningClose || '12:30');
      setLunchEnd(config.lunchEnd || config.afternoonOpen || '13:30');
      setAfternoonOpen(config.afternoonOpen || '14:00');
      setAfternoonClose(config.afternoonClose || '19:30');
      if (config.staffScheduleConfig !== undefined) setStaffScheduleConfig(config.staffScheduleConfig);
      setAllowSimultaneousStaff(config.allowSimultaneousStaff ?? true);
      setSimultaneousCapacity(config.simultaneousCapacity || 2);
      setStaffList(config.staffMembers || []);
      setServicesList(config.services || []);
      setHasMedicationProductsEnabled(config.hasMedicationProductsEnabled ?? true);
      setMedicationProducts(config.medicationProducts || []);
      setAppointmentIntervalMinutes(
        config.appointmentIntervalMinutes !== undefined ? config.appointmentIntervalMinutes : 30
      );
      if (config.bookingSlug) setCustomSlug(extractSlugOnly(config.bookingSlug));
      setReviewSlug(
        extractSlugOnly(config.reviewSlug) ||
          extractSlugOnly(config.bookingSlug) ||
          slugify(config.name || 'calificar', 'calificar')
      );
    } else if (isTimestampOrLocationUpdate) {
      if (config.name !== undefined && config.name !== prevSnap?.name) setBusinessName(config.name);
      if (config.logoUrl !== undefined) setLogoUrl(config.logoUrl);
      if (config.country !== prevSnap?.country) setSelectedCountry(config.country || '');
      if (config.city !== prevSnap?.city) setSelectedCity(config.city || '');
      if (config.address !== prevSnap?.address) setAddress(config.address || '');
      if (config.currency !== undefined) setSelectedCurrency(config.currency);
      if (config.phonePrefix !== undefined) setPhonePrefix(config.phonePrefix);
      if (config.phone !== undefined) setPhoneNumber(config.phone);
      if (config.activeDays !== undefined) setActiveDays(config.activeDays);
      if (config.hasDoubleShift !== undefined) setHasDoubleShift(config.hasDoubleShift);
      if (config.morningOpen !== undefined) setMorningOpen(config.morningOpen);
      if (config.morningClose !== undefined) setMorningClose(config.morningClose);
      if (config.lunchStart !== undefined) setLunchStart(config.lunchStart);
      if (config.lunchEnd !== undefined) setLunchEnd(config.lunchEnd);
      if (config.afternoonOpen !== undefined) setAfternoonOpen(config.afternoonOpen);
      if (config.afternoonClose !== undefined) setAfternoonClose(config.afternoonClose);
      if (config.staffScheduleConfig !== undefined) setStaffScheduleConfig(config.staffScheduleConfig);
      if (config.allowSimultaneousStaff !== undefined) setAllowSimultaneousStaff(config.allowSimultaneousStaff);
      if (config.simultaneousCapacity !== undefined) setSimultaneousCapacity(config.simultaneousCapacity);
      if (config.staffMembers !== undefined) setStaffList(config.staffMembers);
      if (config.services !== undefined) setServicesList(config.services);
      if (config.hasMedicationProductsEnabled !== undefined) setHasMedicationProductsEnabled(config.hasMedicationProductsEnabled);
      if (config.medicationProducts !== undefined) setMedicationProducts(config.medicationProducts);
      if (config.appointmentIntervalMinutes !== undefined) setAppointmentIntervalMinutes(config.appointmentIntervalMinutes);
      if (config.bookingSlug) setCustomSlug(extractSlugOnly(config.bookingSlug));
      if (config.reviewSlug !== undefined) setReviewSlug(extractSlugOnly(config.reviewSlug));
    }

    syncedSnapshotRef.current = {
      id: config.id,
      updatedAt: config.updatedAt,
      country: config.country,
      city: config.city,
      address: config.address,
      name: config.name
    };
  }, [config]);

  // Schedule & Double Shift & Interval
  const [activeDays, setActiveDays] = useState<string[]>(config.activeDays || ['L', 'M', 'X', 'J', 'V', 'S']);
  const [hasDoubleShift, setHasDoubleShift] = useState<boolean>(config.hasDoubleShift ?? true);
  const [morningOpen, setMorningOpen] = useState<string>(config.morningOpen || '08:00');
  const [morningClose, setMorningClose] = useState<string>(config.morningClose || '12:30');
  const [lunchStart, setLunchStart] = useState<string>(config.lunchStart || config.morningClose || '12:30');
  const [lunchEnd, setLunchEnd] = useState<string>(config.lunchEnd || config.afternoonOpen || '13:30');
  const [afternoonOpen, setAfternoonOpen] = useState<string>(config.afternoonOpen || '14:00');
  const [afternoonClose, setAfternoonClose] = useState<string>(config.afternoonClose || '19:30');
  const [appointmentIntervalMinutes, setAppointmentIntervalMinutes] = useState<number>(
    config.appointmentIntervalMinutes !== undefined ? config.appointmentIntervalMinutes : 30
  );

  // Today revenue for financial indicator
  const todayRevenue = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = new Map<string, number>();

    // 1. Check sales state
    for (const s of sales) {
      const dStr = s.date || (s.serviceStartedAt ? s.serviceStartedAt.split('T')[0] : (s.createdAt ? s.createdAt.split('T')[0] : ''));
      if (dStr === todayStr || (s.date && s.date.toLowerCase().includes('hoy'))) {
        const amt = Number(s.amount) || Number(s.servicePrice) || 0;
        if (amt > 0) {
          todaySales.set(s.appointmentId || s.id, amt);
        }
      }
    }

    // 2. Also check appointments that started today
    for (const apt of appointments) {
      const isStarted =
        apt.status === 'en_salon' ||
        apt.status === 'en_corte' ||
        apt.status === 'por_retirar' ||
        apt.status === 'completado';
      if (!isStarted) continue;

      const aptDate = apt.date || (apt.serviceStartedAt ? apt.serviceStartedAt.split('T')[0] : '');
      if (aptDate === todayStr || (apt.date && apt.date.toLowerCase().includes('hoy'))) {
        let priceVal = Number(apt.salesRecordedAmount);
        if (!priceVal || isNaN(priceVal) || priceVal <= 0) {
          priceVal = Number(String(apt.price).replace(/[^0-9.,]/g, '').replace(',', '.'));
        }
        if (priceVal > 0 && !todaySales.has(apt.id)) {
          todaySales.set(apt.id, priceVal);
        }
      }
    }

    return Array.from(todaySales.values()).reduce((sum, val) => sum + val, 0);
  }, [sales, appointments]);

  // Staff Schedules
  const [staffScheduleConfig, setStaffScheduleConfig] = useState<StaffScheduleConfig>(
    config.staffScheduleConfig || {
      allDay: { start: '08:00', end: '18:00' },
      morning: { start: '08:00', end: '13:00' },
      afternoon: { start: '14:00', end: '19:30' }
    }
  );

  // Staff & Simultaneous Capacity Configuration
  const [allowSimultaneousStaff, setAllowSimultaneousStaff] = useState<boolean>(
    config.allowSimultaneousStaff ?? true
  );
  const [simultaneousCapacity, setSimultaneousCapacity] = useState<number>(
    config.simultaneousCapacity || 2
  );
  const [staffList, setStaffList] = useState<StaffMember[]>(config.staffMembers || []);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<string>('Estilista de corte');
  const [newStaffShift, setNewStaffShift] = useState<'todo_el_dia' | 'solo_manana' | 'solo_tarde'>('todo_el_dia');

  // Services Configuration
  const [servicesList, setServicesList] = useState<SalonService[]>(config.services || []);

  // Medications Configuration
  const [hasMedicationProductsEnabled, setHasMedicationProductsEnabled] = useState<boolean>(
    config.hasMedicationProductsEnabled ?? true
  );
  const [medicationProducts, setMedicationProducts] = useState<MedicationProduct[]>(
    config.medicationProducts || []
  );

  // Custom booking slug state (allows pure editing of only the slug)
  const [customSlug, setCustomSlug] = useState<string>(() => {
    return extractSlugOnly(config.bookingSlug) || slugify(config.name || 'salon', 'salon');
  });

  useEffect(() => {
    if (config.bookingSlug) {
      setCustomSlug(extractSlugOnly(config.bookingSlug));
    }
  }, [config.bookingSlug]);

  // Active saved slug for shareable URL
  const activeSlug = useMemo(() => {
    return extractSlugOnly(config.bookingSlug) || cleanSlugInput(customSlug) || slugify(businessName || 'pelo', 'pelo');
  }, [config.bookingSlug, customSlug, businessName]);

  // Clean, short shareable booking URL (Architecture: URL -> slug/id -> persistent data -> public booking)
  const realBookingUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://groomers-app.vercel.app';
    return `${origin.replace(/\/+$/, '')}/reservas/${activeSlug}`;
  }, [activeSlug]);

  const [isSavingSlug, setIsSavingSlug] = useState<boolean>(false);
  const [slugSaveError, setSlugSaveError] = useState<string | null>(null);

  // Custom review link slug state (isolated from bookingSlug once customized, falls back cleanly)
  const [reviewSlug, setReviewSlug] = useState<string>(() => {
    return (
      extractSlugOnly(config.reviewSlug) ||
      extractSlugOnly(config.bookingSlug) ||
      slugify(config.name || 'calificar', 'calificar')
    );
  });

  useEffect(() => {
    if (config.reviewSlug) {
      setReviewSlug(extractSlugOnly(config.reviewSlug));
    }
  }, [config.reviewSlug]);

  const activeReviewSlug = useMemo(() => {
    return (
      extractSlugOnly(config.reviewSlug) ||
      cleanSlugInput(reviewSlug) ||
      extractSlugOnly(config.bookingSlug) ||
      slugify(businessName || 'calificar', 'calificar')
    );
  }, [config.reviewSlug, reviewSlug, config.bookingSlug, businessName]);

  const [isSavingReviewSlug, setIsSavingReviewSlug] = useState<boolean>(false);
  const [reviewSlugSaveError, setReviewSlugSaveError] = useState<string | null>(null);

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const dayLettersMap = getDayLetters(lang);
  const daysList = [
    { label: dayLettersMap.L, key: 'L' },
    { label: dayLettersMap.M, key: 'M' },
    { label: dayLettersMap.X, key: 'X' },
    { label: dayLettersMap.J, key: 'J' },
    { label: dayLettersMap.V, key: 'V' },
    { label: dayLettersMap.S, key: 'S' },
    { label: dayLettersMap.D, key: 'D' }
  ];

  const toggleDay = (key: string) => {
    if (activeDays.includes(key)) {
      setActiveDays(activeDays.filter((d) => d !== key));
    } else {
      setActiveDays([...activeDays, key]);
    }
  };

  const handleSelectWeekdays = () => {
    setActiveDays(['L', 'M', 'X', 'J', 'V']);
  };

  // Logo file upload with compression, size validation, and immediate persistent save
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSavedToast(t.managers.errMaxFileSize);
        setTimeout(() => setSavedToast(null), 3500);
        return;
      }
      try {
        const compressed = await compressImage(file, 380, 0.76);
        setLogoUrl(compressed);

        // Instantly persist logo in local database & sync to cloud so it never disappears on refresh
        const persistentBizId = activeAccount?.businessId || config.id || 'biz_main';
        const safeSlug =
          cleanSlugInput(customSlug) ||
          extractSlugOnly(config.bookingSlug) ||
          slugify(businessName || config.name || persistentBizId, persistentBizId);
        const safeReviewSlug =
          cleanSlugInput(reviewSlug) ||
          extractSlugOnly(config.reviewSlug) ||
          safeSlug;

        const updatedConfig: SalonConfig = {
          ...config,
          id: persistentBizId,
          bookingSlug: safeSlug,
          reviewSlug: safeReviewSlug,
          language: selectedLanguage,
          name: businessName.trim() || config.name,
          logoUrl: compressed,
          country: selectedCountry,
          city: selectedCity.trim(),
          address: address.trim(),
          services: servicesList,
          medicationProducts: medicationProducts,
          updatedAt: new Date().toISOString()
        };

        // 1. Persist locally to IndexedDB & sync mirror
        await persistActiveConfig(updatedConfig);
        onUpdateConfig(updatedConfig);

        // Upload to Firebase Cloud Storage in background
        uploadImageToStorage(
          `businesses/${persistentBizId}/branding/logo_${Date.now()}.jpg`,
          compressed
        ).then((storageUrl) => {
          if (storageUrl && storageUrl.startsWith('http')) {
            setLogoUrl(storageUrl);
            const cloudConfig: SalonConfig = {
              ...updatedConfig,
              logoUrl: storageUrl
            };
            persistActiveConfig(cloudConfig);
            onUpdateConfig(cloudConfig);
            syncBusinessToServer(persistentBizId, cloudConfig, undefined, appointments).catch(() => {});
          }
        }).catch(() => {});

        // 2. Cache locally for public booking page
        if (typeof window !== 'undefined') {
          try {
            const cachedPublicData = {
              businessId: persistentBizId,
              config: updatedConfig,
              services: updatedConfig.services || [],
              appointments: appointments || []
            };
            const serialized = JSON.stringify(cachedPublicData);
            localStorage.setItem(`agendacan_public_biz_${persistentBizId}`, serialized);
            if (safeSlug) {
              localStorage.setItem(`agendacan_public_biz_${safeSlug}`, serialized);
            }
          } catch {}
        }

        // 3. Sync to Cloud Firestore and Server in background
        syncBusinessToServer(persistentBizId, updatedConfig, undefined, appointments).catch(() => {});

        setSavedToast(st.changesSavedSuccess);
        setTimeout(() => setSavedToast(null), 3000);
      } catch (err) {
        console.warn('Error compressing logo:', err);
        setSavedToast(t.managers.errImageProcess);
        setTimeout(() => setSavedToast(null), 3000);
      }
    }
  };

  // Country selection updates phone calling code while keeping currency independent
  const handleCountryChange = (countryName: string) => {
    setSelectedCountry(countryName);
    const countryObj = COUNTRIES.find((c) => c.name === countryName);
    if (countryObj) {
      setPhonePrefix(countryObj.callingCode);
      // Currency and country are completely independent - do not overwrite user's chosen currency!
    }
  };

  // Copy shareable link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(realBookingUrl);
    setIsCopied(true);
    setSavedToast(st.linkCopied);
    setTimeout(() => {
      setIsCopied(false);
      setSavedToast(null);
    }, 2500);
  };

  // Dedicated review URL for collecting customer ratings
  const realReviewUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://groomers-app.vercel.app';
    return buildPublicReviewUrl(origin, config.id || 'biz_main', activeReviewSlug, config);
  }, [config, activeReviewSlug]);

  const [isReviewLinkCopied, setIsReviewLinkCopied] = useState<boolean>(false);

  const handleCopyReviewLink = () => {
    navigator.clipboard.writeText(realReviewUrl);
    setIsReviewLinkCopied(true);
    setSavedToast(st.reviewLinkCopied);
    setTimeout(() => {
      setIsReviewLinkCopied(false);
      setSavedToast(null);
    }, 2500);
  };

  // Save custom review slug safely (without changing bookingSlug or losing existing reviews)
  const handleSaveReviewSlug = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setReviewSlugSaveError(null);
    setIsSavingReviewSlug(true);

    const persistentBizId = activeAccount?.businessId || config.id || 'biz_main';
    const targetReviewSlug = cleanSlugInput(reviewSlug);

    if (!targetReviewSlug) {
      setReviewSlugSaveError(st.reviewSlugInvalidError);
      setIsSavingReviewSlug(false);
      return;
    }

    try {
      const checkPromise = checkSlugAvailabilityInFirestore(targetReviewSlug, persistentBizId);
      const checkTimeout = new Promise<{ available: boolean; conflictBusinessName?: string }>((resolve) =>
        setTimeout(() => resolve({ available: true }), 2000)
      );
      const check = await Promise.race([checkPromise, checkTimeout]);

      if (!check.available) {
        setReviewSlugSaveError(st.reviewSlugUnavailableError);
        setIsSavingReviewSlug(false);
        return;
      }

      const safeBookingSlug =
        cleanSlugInput(customSlug) ||
        extractSlugOnly(config.bookingSlug) ||
        slugify(businessName || config.name || persistentBizId, persistentBizId);

      const updatedConfig: SalonConfig = {
        ...config,
        id: persistentBizId,
        name: businessName.trim() || config.name,
        logoUrl: logoUrl || config.logoUrl || '',
        country: selectedCountry,
        city: selectedCity.trim(),
        address: address.trim(),
        bookingSlug: safeBookingSlug,
        reviewSlug: targetReviewSlug,
        language: selectedLanguage,
        services: servicesList,
        medicationProducts: medicationProducts,
        updatedAt: new Date().toISOString()
      };

      await persistActiveConfig(updatedConfig);
      onUpdateConfig(updatedConfig);
      setReviewSlug(targetReviewSlug);

      if (typeof window !== 'undefined') {
        try {
          const cachedPublicData = {
            businessId: persistentBizId,
            config: updatedConfig,
            services: updatedConfig.services || [],
            appointments: appointments || []
          };
          const serialized = JSON.stringify(cachedPublicData);
          localStorage.setItem(`agendacan_public_biz_${persistentBizId}`, serialized);
          localStorage.setItem(`agendacan_public_biz_${targetReviewSlug}`, serialized);
          if (safeBookingSlug) {
            localStorage.setItem(`agendacan_public_biz_${safeBookingSlug}`, serialized);
          }
        } catch {}
      }

      try {
        const syncPromise = syncBusinessToServer(
          persistentBizId,
          updatedConfig,
          undefined,
          appointments
        );
        await Promise.race([
          syncPromise,
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
      } catch (syncErr) {
        console.warn('[REVIEW SLUG BACKGROUND SYNC NOTICE]', syncErr);
      }

      setSavedToast(st.reviewSlugSavedSuccess);
      setTimeout(() => setSavedToast(null), 3500);
    } catch (err) {
      console.error('[REVIEW SLUG SAVE ERROR]', err);
      const msg = err instanceof Error ? err.message : st.reviewSlugInvalidError;
      setReviewSlugSaveError(msg);
      setTimeout(() => setReviewSlugSaveError(null), 5000);
    } finally {
      setIsSavingReviewSlug(false);
    }
  };

  // WhatsApp review request to a completed client visit
  const handleRequestReviewViaWhatsApp = async (item: {
    id: string;
    tutorName: string;
    petName?: string;
    phone: string;
    rawPhone: string;
  }) => {
    const tutorFirstName = item.tutorName.trim().split(' ')[0] || item.tutorName.trim();
    const message = formatTemplate(st.reviewRequestWhatsAppMsg, {
      tutorName: tutorFirstName,
      petName: item.petName?.trim() || ct.pet,
      salonName: config.name,
      url: realReviewUrl
    });

    const normalizedDigits = normalizePhoneForWhatsApp(item.phone || item.rawPhone, config);
    const waUrl = `https://wa.me/${normalizedDigits}?text=${encodeURIComponent(message)}`;

    openWhatsAppUrl(waUrl);

    const currentRequests = { ...(config.reviewRequests || {}) };
    currentRequests[item.id] = {
      state: 'iniciada',
      requestedAt: new Date().toISOString()
    };
    const updatedConfig = {
      ...config,
      reviewRequests: currentRequests
    };
    onUpdateConfig(updatedConfig);
    await persistActiveConfig(updatedConfig);
    try {
      await updateReviewRequestStateInFirestore(config.id || 'biz_main', item.id, 'iniciada');
    } catch (err) {
      console.warn('Error updating review request state:', err);
    }
  };

  // General share review link via WhatsApp (to anyone)
  const handleShareGeneralReviewWhatsApp = () => {
    const message = formatTemplate(st.reviewWhatsAppInvite, {
      salonName: config.name,
      url: realReviewUrl
    });
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    openWhatsAppUrl(waUrl);
  };

  const handleAddStaff = () => {
    if (!newStaffName.trim()) return;
    const newMember: StaffMember = {
      id: 'st-' + Date.now(),
      name: newStaffName.trim(),
      role: newStaffRole,
      active: true,
      shiftAvailability: newStaffShift
    };
    setStaffList((prev) => [...prev, newMember]);
    setNewStaffName('');
  };

  const toggleStaffActive = (id: string) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const handleUpdateStaffShift = (id: string, shift: 'todo_el_dia' | 'solo_manana' | 'solo_tarde') => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, shiftAvailability: shift } : s))
    );
  };

  const handleRemoveStaff = (id: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== id));
  };

  // Filtered Appointments for the Excel / History view sorted chronologically
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((apt) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesPet = apt.petName?.toLowerCase().includes(q);
          const matchesTutor = apt.tutorName?.toLowerCase().includes(q);
          const matchesBreed = apt.breed?.toLowerCase().includes(q);
          const matchesPhone = apt.tutorPhone?.toLowerCase().includes(q);
          const matchesService = apt.serviceName?.toLowerCase().includes(q);
          if (!matchesPet && !matchesTutor && !matchesBreed && !matchesPhone && !matchesService) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => getAppointmentTimestamp(b) - getAppointmentTimestamp(a));
  }, [appointments, searchQuery]);

  // Export to Excel / CSV function
  const handleExportExcel = () => {
    const headers = [
      'ID',
      t.sales.dateCol,
      st.colVisits,
      st.csvColPet,
      st.csvColBreed,
      st.csvColTutor,
      st.csvColWhatsapp,
      t.sales.serviceCol,
      t.sales.stylistCol,
      st.csvColLastAmount,
      st.csvColCurrency,
      st.csvColPayment,
      st.csvColNotes
    ];

    const rows = filteredAppointments.map((apt) => [
      `"${apt.id}"`,
      `"${apt.date || ''}"`,
      `"${apt.time || ''}"`,
      `"${apt.petName || ''}"`,
      `"${apt.breed || ''}"`,
      `"${apt.tutorName || ''}"`,
      `"${apt.tutorPhone || ''}"`,
      `"${apt.serviceName || ''}"`,
      `"${apt.groomer || ''}"`,
      apt.price || 0,
      `"${apt.currency || selectedCurrency}"`,
      `"${apt.paymentStatusLabel || st.csvFallbackPaid}"`,
      `"${(apt.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AgendaCan_${st.csvFilePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSavedToast(st.exportSuccessToast);
    setTimeout(() => setSavedToast(null), 3000);
  };

  const handleSaveSlug = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setSlugSaveError(null);
    setIsSavingSlug(true);

    const persistentBizId = activeAccount?.businessId || config.id || 'biz_main';
    const targetSlug = cleanSlugInput(customSlug);

    if (!targetSlug) {
      setSlugSaveError(st.linkInvalidError);
      setIsSavingSlug(false);
      return;
    }

    try {
      // 1. Fast availability check (with 2s timeout guard so slow network never hangs the user)
      const checkPromise = checkSlugAvailabilityInFirestore(targetSlug, persistentBizId);
      const checkTimeout = new Promise<{ available: boolean; conflictBusinessName?: string }>((resolve) =>
        setTimeout(() => resolve({ available: true }), 2000)
      );
      const check = await Promise.race([checkPromise, checkTimeout]);

      if (!check.available) {
        setSlugSaveError(st.linkUnavailableError);
        setIsSavingSlug(false);
        return;
      }

      const safeReviewSlug =
        cleanSlugInput(reviewSlug) ||
        extractSlugOnly(config.reviewSlug) ||
        targetSlug;

      const updatedConfig: SalonConfig = {
        ...config,
        id: persistentBizId,
        name: businessName.trim() || config.name,
        logoUrl: logoUrl || config.logoUrl || '',
        country: selectedCountry,
        city: selectedCity.trim(),
        address: address.trim(),
        bookingSlug: targetSlug,
        reviewSlug: safeReviewSlug,
        language: selectedLanguage,
        services: servicesList,
        medicationProducts: medicationProducts,
        updatedAt: new Date().toISOString()
      };

      // 2. Persist locally first so UI is immediately responsive and active link reflects the new slug
      await persistActiveConfig(updatedConfig);
      onUpdateConfig(updatedConfig);
      setCustomSlug(targetSlug);

      // Cache locally for public booking page instant resolution
      if (typeof window !== 'undefined') {
        try {
          const cachedPublicData = {
            businessId: persistentBizId,
            config: updatedConfig,
            services: updatedConfig.services || [],
            appointments: appointments || []
          };
          localStorage.setItem(`agendacan_public_biz_${persistentBizId}`, JSON.stringify(cachedPublicData));
          localStorage.setItem(`agendacan_public_biz_${targetSlug}`, JSON.stringify(cachedPublicData));
        } catch {}
      }

      // 3. Sync to Server and Firestore (non-blocking for instant responsiveness)
      try {
        const syncPromise = syncBusinessToServer(
          persistentBizId,
          updatedConfig,
          undefined,
          appointments
        );
        await Promise.race([
          syncPromise,
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
      } catch (syncErr) {
        console.warn('[SLUG BACKGROUND SYNC NOTICE]', syncErr);
      }

      setSavedToast(st.linkSavedSuccess);
      setTimeout(() => setSavedToast(null), 3500);
    } catch (err) {
      console.error('[SLUG SAVE ERROR]', err);
      const msg = err instanceof Error ? err.message : st.linkInvalidError;
      setSlugSaveError(msg);
      setTimeout(() => setSlugSaveError(null), 5000);
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleServicesChange = (updatedServices: SalonService[]) => {
    setServicesList(updatedServices);
    const persistentBizId = activeAccount?.businessId || config.id || 'biz_main';
    const safeSlug =
      cleanSlugInput(customSlug) ||
      extractSlugOnly(config.bookingSlug) ||
      slugify(businessName || config.name || persistentBizId, persistentBizId);
    const safeReviewSlug =
      cleanSlugInput(reviewSlug) ||
      extractSlugOnly(config.reviewSlug) ||
      safeSlug;

    const updatedConfig: SalonConfig = {
      ...config,
      id: persistentBizId,
      bookingSlug: safeSlug,
      reviewSlug: safeReviewSlug,
      language: selectedLanguage,
      name: businessName.trim() || config.name,
      logoUrl: logoUrl || config.logoUrl || '',
      country: selectedCountry,
      city: selectedCity.trim(),
      address: address.trim(),
      currency: selectedCurrency,
      services: updatedServices,
      medicationProducts: medicationProducts,
      updatedAt: new Date().toISOString()
    };

    // 1. Immediately persist locally (IndexedDB + local sync mirror)
    persistActiveConfig(updatedConfig);
    onUpdateConfig(updatedConfig);

    // 2. Cache locally for public booking page instant resolution
    if (typeof window !== 'undefined') {
      try {
        const cachedPublicData = {
          businessId: persistentBizId,
          config: updatedConfig,
          services: updatedServices,
          appointments: appointments || []
        };
        const serialized = JSON.stringify(cachedPublicData);
        localStorage.setItem(`agendacan_public_biz_${persistentBizId}`, serialized);
        if (safeSlug) {
          localStorage.setItem(`agendacan_public_biz_${safeSlug}`, serialized);
        }
      } catch {}
    }

    // 3. Sync to Cloud Firestore and Server in background
    syncBusinessToServer(persistentBizId, updatedConfig, undefined, appointments).catch(() => {});
  };

  const handleSaveAll = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    setIsSaving(true);
    setSlugSaveError(null);

    const persistentBizId = activeAccount?.businessId || config.id || 'biz_main';

    // 1. Required fields validation
    if (!businessName || !businessName.trim()) {
      setSavedToast(t.auth.errEmptyBusinessName);
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    if (!phoneNumber || !phoneNumber.trim()) {
      setSavedToast(t.modals.errMissingPhone);
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    if (!address || !address.trim()) {
      setSavedToast(st.addressLabel);
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    const invalidService = servicesList.find((s) => !s.name || !s.name.trim());
    if (invalidService) {
      setSavedToast(t.managers.errServiceName);
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    // Preserve existing bookingSlug & reviewSlug cleanly
    const safeSlug =
      cleanSlugInput(customSlug) ||
      extractSlugOnly(config.bookingSlug) ||
      slugify(businessName || config.name || persistentBizId, persistentBizId);
    const safeReviewSlug =
      cleanSlugInput(reviewSlug) ||
      extractSlugOnly(config.reviewSlug) ||
      safeSlug;

    const normalizedServices: SalonService[] = servicesList.map((svc, idx) => ({
      ...svc,
      id: svc.id || `svc-${Date.now()}-${idx}`,
      businessId: persistentBizId,
      name: svc.name.trim(),
      desc: (svc.desc || '').trim(),
      durationMin: Number(svc.durationMin) || 60,
      price: Number(svc.price) || 0,
      pricingType: svc.pricingType || 'unico',
      imageUrl: svc.imageUrl?.trim() || undefined,
      galleryUrls: Array.isArray(svc.galleryUrls) ? svc.galleryUrls.filter(Boolean).slice(0, 4) : undefined,
      active: svc.active !== false
    }));

    const normalizedMedications: MedicationProduct[] = medicationProducts.map((med, idx) => ({
      ...med,
      id: med.id || `med-${Date.now()}-${idx}`,
      name: med.name.trim(),
      price: Number(med.price) || 0,
      active: med.active !== false
    }));

    const nowIso = new Date().toISOString();
    const updatedConfig: SalonConfig = {
      ...config,
      id: persistentBizId,
      bookingSlug: safeSlug,
      reviewSlug: safeReviewSlug,
      name: businessName.trim(),
      logoUrl: logoUrl || '',
      country: selectedCountry,
      city: selectedCity.trim(),
      language: selectedLanguage,
      phonePrefix,
      phone: phoneNumber.trim(),
      address: address.trim(),
      allowSimultaneousStaff,
      maxSimultaneousAppointments: simultaneousCapacity,
      currency: selectedCurrency,
      simultaneousCapacity,
      staffMembers: staffList,
      staffScheduleConfig: {
        allDay: { start: timeTo24H(morningOpen), end: hasDoubleShift ? timeTo24H(afternoonClose) : timeTo24H(morningClose) },
        morning: { start: timeTo24H(morningOpen), end: timeTo24H(morningClose) },
        afternoon: { start: timeTo24H(afternoonOpen), end: timeTo24H(afternoonClose) }
      },
      services: normalizedServices,
      hasMedicationProductsEnabled,
      medicationProducts: normalizedMedications,
      hasDoubleShift,
      morningOpen: timeTo24H(morningOpen),
      morningClose: timeTo24H(morningClose),
      lunchStart: timeTo24H(lunchStart),
      lunchEnd: timeTo24H(lunchEnd),
      afternoonOpen: timeTo24H(afternoonOpen),
      afternoonClose: timeTo24H(afternoonClose),
      appointmentIntervalMinutes,
      activeDays,
      reviews: normalizeAndMergeReviews(persistentBizId, config.reviews),
      updatedAt: nowIso
    };

    try {
      await persistActiveConfig(updatedConfig);

      if (typeof window !== 'undefined') {
        try {
          const cachedPublicData = {
            businessId: persistentBizId,
            config: updatedConfig,
            services: updatedConfig.services || [],
            appointments: appointments || []
          };
          const serialized = JSON.stringify(cachedPublicData);
          localStorage.setItem(`agendacan_public_biz_${persistentBizId}`, serialized);
          if (safeSlug) {
            localStorage.setItem(`agendacan_public_biz_${safeSlug}`, serialized);
          }
          if (safeReviewSlug) {
            localStorage.setItem(`agendacan_public_biz_${safeReviewSlug}`, serialized);
          }
        } catch {}
      }

      const remoteSuccess = await syncBusinessToServer(persistentBizId, updatedConfig, undefined, appointments);
      if (!remoteSuccess) {
        console.warn('[SAVE NOTICE] Server/cloud sync returned false, but local database persistence succeeded.');
      }

      onUpdateConfig(updatedConfig);
      setCustomSlug(safeSlug);
      setReviewSlug(safeReviewSlug);

      setLanguage(selectedLanguage);
      if (selectedLanguage !== currentLanguage) {
        onUpdateLanguage?.(selectedLanguage);
      }

      setSavedToast(st.changesSavedSuccess);
      setTimeout(() => setSavedToast(null), 3500);
    } catch (err) {
      console.error('[SAVE ALL ERROR]', err);
      const errorMsg = err instanceof Error ? err.message : t.common.errorOccurred;
      setSavedToast(errorMsg);
      setTimeout(() => setSavedToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full pb-32 px-4 sm:px-6 lg:px-8 pt-4 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{savedToast}</span>
        </div>
      )}

      {/* VISTA 1: PANTALLA PRINCIPAL DE AJUSTES */}
      {selectedSection === null && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="pb-2 border-b border-[#cfc2d2]/40">
            <div className="flex items-center gap-1.5 text-[#7a5900] text-xs font-bold uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-base text-[#f9b900]">tune</span>
              <span>{st.settingsCenter}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a26] tracking-tight">
              {st.settingsTitle}
            </h1>
          </div>

          <div className="flex flex-col space-y-4 max-w-4xl">
            {/* 1. Configuración del negocio */}
            <div
              onClick={() => setSelectedSection('negocio')}
              className="bg-white hover:bg-[#fcf8ff] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#f5f2ff] text-[#2e004e] group-hover:bg-[#2e004e] group-hover:text-[#f9b900] flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="material-symbols-outlined text-2xl">storefront</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                    {st.businessConfigTitle}
                  </h2>
                  <span className="text-xs text-[#7e7482] block truncate">{st.businessConfigDesc}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 2. Calificaciones */}
            <div
              onClick={() => setSelectedSection('calificaciones')}
              className="bg-white hover:bg-[#fcf8ff] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#fff8e1] text-[#7a5900] group-hover:bg-[#f9b900] group-hover:text-[#261900] flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="text-2xl">★</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                    {st.ratingsTitle}
                  </h2>
                  <span className="text-xs text-[#7e7482] block truncate">{st.ratingsDesc}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 3. Mis clientes */}
            <div
              onClick={() => setSelectedSection('clientes')}
              className="bg-white hover:bg-[#fcf8ff] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#e8f5e9] text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="material-symbols-outlined text-2xl">table_view</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                    {st.myClientsTitle}
                  </h2>
                  <span className="text-xs text-[#7e7482] block truncate">{st.myClientsDesc}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 4. Ventas */}
            <div
              onClick={() => setSelectedSection('ventas')}
              className="bg-white hover:bg-[#fcf8ff] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 group-hover:bg-[#2e004e] group-hover:text-[#f9b900] flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="material-symbols-outlined text-2xl">payments</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                      {st.salesTitle}
                    </h2>
                    {todayRevenue > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] shadow-xs">
                        {formatPrice(todayRevenue, config.currency, { includeCode: true })} {ct.today}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#7e7482] block truncate">
                    {st.salesDesc}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 5. Enlace para clientes */}
            <div
              onClick={() => setSelectedSection('enlace')}
              className="bg-gradient-to-r from-white to-[#f5f2ff] hover:to-[#efeafd] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-white p-1.5 flex items-center justify-center shrink-0 border border-[#cfc2d2]/40 overflow-hidden shadow-xs">
                  <img
                    src={logoUrl || config.logoUrl || HOTLINK_IMAGES.logo}
                    alt={businessName}
                    className="w-full h-full object-contain rounded-xl"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = HOTLINK_IMAGES.logo;
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors">
                    {st.shareAgendaTitle}
                  </h2>
                  <span className="text-xs text-[#7e7482] block truncate">{st.shareAgendaDesc}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#2e004e] text-white flex items-center justify-center shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 6. Account management */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#f5f0fb] text-[#2e004e] flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-2xl">shield_person</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-[#1a1a26] truncate">
                      {activeAccount?.name || config.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wide">
                      {t.auth.currentAccountBadge}
                    </span>
                  </div>
                  <span className="text-xs text-[#7e7482] block truncate">
                    {activeAccount?.email || st.settingsCenter} • ID: {config.id || 'biz_main'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={onOpenAccountModal}
                  className="px-4 py-2.5 rounded-xl bg-[#2e004e] text-white hover:bg-[#4b0878] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">manage_accounts</span>
                  {t.nav.manageAccounts}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA VENTAS */}
      {selectedSection === 'ventas' && (
        <VentasView
          sales={sales}
          appointments={appointments}
          salonConfig={config}
          onBack={() => setSelectedSection(null)}
        />
      )}

      {/* VISTA 2: SUB-PÁGINAS */}
      {selectedSection !== null && selectedSection !== 'ventas' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Top Bar with Back Button */}
          <div className="flex items-center justify-between pb-3 border-b border-[#cfc2d2]/40">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedSection(null)}
                className="py-2 px-3.5 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-black text-xs shadow-xs border border-[#cfc2d2]/40 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span>{st.backToSettings}</span>
              </button>

              <div className="text-xs text-[#7e7482]">
                <span>{st.settingsTitle} &gt; </span>
                <strong className="text-[#1a1a26]">
                  {selectedSection === 'negocio' && st.businessConfigTitle}
                  {selectedSection === 'calificaciones' && st.ratingsTitle}
                  {selectedSection === 'clientes' && st.myClientsTitle}
                  {selectedSection === 'enlace' && st.shareAgendaTitle}
                </strong>
              </div>
            </div>
          </div>

          {/* DEDICATED SECTION 4: ENLACE PÚBLICO DE RESERVAS */}
          {selectedSection === 'enlace' && (
            <div className="max-w-3xl space-y-6">
              <div className="bg-[#2e004e] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#f9b900] tracking-wider uppercase">
                    <span className="material-symbols-outlined text-base">public</span>
                    <span>{st.shareLinkBadge}</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-400 text-[#1a1a26] text-xs font-black">
                    {st.online247}
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white">{st.shareLinkTitle}</h2>
                  <p className="text-sm text-[#e3e0f1] mt-1.5 leading-relaxed">
                    {st.shareLinkSubtitle}
                  </p>
                </div>

                {/* Preview Card with Business Logo */}
                <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/20 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center shadow-md shrink-0 overflow-hidden border border-white/30">
                      <img
                        src={logoUrl || config.logoUrl || HOTLINK_IMAGES.logo}
                        alt={businessName}
                        className="w-full h-full object-contain rounded-xl"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = HOTLINK_IMAGES.logo;
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-lg text-white truncate">{businessName}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-[#1a1a26] text-[10px] font-black uppercase">
                          {st.online247}
                        </span>
                      </div>
                      <p className="text-xs text-[#e3e0f1] truncate mt-0.5">
                        {[selectedCity?.trim(), selectedCountry?.trim()].filter(Boolean).join(', ') || address || st.shareAgendaDesc}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onPreviewClientFlow}
                    className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-[#f9b900]">visibility</span>
                    <span>{st.testClientFlow}</span>
                  </button>
                </div>

                {/* Custom Slug Editor Box */}
                <div className="bg-black/30 rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-[#ffdea1] uppercase tracking-wider block mb-1">
                      {st.customSlugLabel}
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="flex-1 flex items-center bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/20 focus-within:border-[#f9b900] focus-within:ring-1 focus-within:ring-[#f9b900] transition-all">
                      <span className="text-xs sm:text-sm text-[#ffdea1]/90 font-mono font-bold select-none shrink-0 pr-1.5 border-r border-white/20 mr-2">
                        /reservas/
                      </span>
                      <input
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(cleanSlugInput(e.target.value))}
                        placeholder={slugify(businessName || 'pelo', 'pelo')}
                        className="w-full bg-transparent text-white font-mono font-bold text-sm outline-none px-1 placeholder:text-white/40"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveSlug}
                      disabled={isSavingSlug}
                      className="px-5 py-3 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {isSavingSlug ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#261900] border-t-transparent rounded-full animate-spin"></span>
                          <span>{st.savingLink}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm font-bold">save</span>
                          <span>{st.saveLinkBtn}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Live preview banner of full URL */}
                  <div className="flex items-center gap-2 text-xs bg-white/5 rounded-xl px-3 py-2 border border-white/10 font-mono break-all text-[#e3e0f1]">
                    <span className="material-symbols-outlined text-sm text-[#f9b900] shrink-0">link</span>
                    <span className="text-white font-bold truncate">{realBookingUrl}</span>
                  </div>

                  {slugSaveError && (
                    <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                      <span className="material-symbols-outlined text-sm shrink-0">error</span>
                      <span>{slugSaveError}</span>
                    </div>
                  )}
                </div>

                {/* Live booking link card */}
                <div className="bg-black/40 rounded-2xl p-4 border border-white/10 space-y-3">
                  <span className="text-xs font-bold text-white/80 uppercase tracking-wider block">
                    {st.directLinkForClients}
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-mono text-white/95">
                      <span className="material-symbols-outlined text-lg text-[#f9b900] shrink-0">link</span>
                      <span className="truncate">{realBookingUrl}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="px-3.5 py-2.5 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">
                          {isCopied ? 'check' : 'content_copy'}
                        </span>
                        <span>{isCopied ? ct.copied : st.copyLink}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onPreviewClientFlow}
                        className="px-3.5 py-2.5 bg-white text-[#2e004e] hover:bg-[#ffdea1] text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm font-bold text-[#2e004e]">visibility</span>
                        <span>{st.testClientFlow}</span>
                      </button>

                      <a
                        href={realBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm text-[#f9b900]">open_in_new</span>
                        <span>{st.openPublicLink}</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Direct Share Button */}
                <div className="pt-1">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      formatTemplate(st.bookingWhatsAppInvite, {
                        salonName: businessName,
                        url: realBookingUrl
                      })
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">chat</span>
                    <span>{st.shareDirectWhatsApp}</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* SUB-SECCIÓN 1: CONFIGURACIÓN DEL NEGOCIO */}
          {selectedSection === 'negocio' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Izquierda: Información del salón, país, idioma, dirección y horarios */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Card 1: Datos de la Peluquería */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-[#efecfd]">
                      <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                        <span className="material-symbols-outlined text-xl">storefront</span>
                      </div>
                      <div>
                        <h2 className="text-base font-extrabold text-[#1a1a26]">{st.businessInfo}</h2>
                        <p className="text-xs text-[#7e7482]">{st.businessConfigDesc}</p>
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="bg-[#f5f2ff] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-[#cfc2d2]/30">
                      <div className="w-16 h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-xs border border-[#cfc2d2]/30 shrink-0 overflow-hidden">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={st.businessLogo}
                            className="w-full h-full object-contain rounded-xl"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-[#7e7482]">storefront</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[#1a1a26] block">{st.businessLogo}</span>
                        <p className="text-[11px] text-[#7e7482] mt-0.5 leading-relaxed">
                          {st.logoRecommendation}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <label className="py-1.5 px-3 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-sm">photo_camera</span>
                            <span>{logoUrl ? st.changeLogo : st.uploadLogo}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoUpload}
                            />
                          </label>

                          {logoUrl && (
                            <button
                              type="button"
                              onClick={() => setLogoUrl('')}
                              className="py-1.5 px-2.5 rounded-xl text-xs font-bold text-[#7e7482] hover:text-[#ba1a1a] hover:bg-white transition-colors"
                            >
                              {ct.delete}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Business Name */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{st.businessName} *</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <span className="material-symbols-outlined text-[#4b0878] text-base mr-2">storefront</span>
                        <input
                          type="text"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-[#1a1a26] outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Country */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{st.country}</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <select
                          value={selectedCountry}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                        >
                          <option value="">-- {st.country} --</option>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined text-[#7e7482] text-sm pointer-events-none absolute right-3">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* City */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{st.cityLabel}</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30 focus-within:border-[#4b0878] focus-within:ring-2 focus-within:ring-[#4b0878]/20 transition-all">
                        <input
                          type="text"
                          value={selectedCity}
                          onChange={(e) => setSelectedCity(e.target.value)}
                          placeholder={st.cityPlaceholder}
                          className="w-full bg-transparent text-xs font-semibold text-[#1a1a26] outline-none placeholder:text-[#7e7482]/60"
                        />
                      </div>
                    </div>

                    {/* Language - 4 global options */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{st.languageLabel}</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <select
                          value={selectedLanguage}
                          onChange={(e) => {
                            const newLang = e.target.value as AppLanguage;
                            setSelectedLanguage(newLang);
                            setLanguage(newLang);
                            onUpdateLanguage?.(newLang);
                          }}
                          className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                        >
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined text-[#7e7482] text-sm pointer-events-none absolute right-3">
                          expand_more
                        </span>
                      </div>
                      <span className="text-[11px] text-[#7e7482] mt-1 block">{st.languageImmediateHint}</span>
                    </div>

                    {/* Currency selector */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{st.currencyLabel}</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <select
                          value={selectedCurrency}
                          onChange={(e) => setSelectedCurrency(e.target.value)}
                          className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                        >
                          {CURRENCIES.map((cur) => (
                            <option key={cur.code} value={cur.code}>
                              {cur.name}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined text-[#7e7482] text-sm pointer-events-none absolute right-3">
                          expand_more
                        </span>
                      </div>
                      <span className="text-[11px] text-[#7e7482] mt-1 block">{st.currencyHint}</span>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{st.whatsappPhone}</label>
                      <div className="flex gap-2">
                        <div className="w-28 relative flex items-center bg-[#f5f2ff] rounded-xl px-2 py-2 border border-[#cfc2d2]/30">
                          <select
                            value={phonePrefix}
                            onChange={(e) => setPhonePrefix(e.target.value)}
                            className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.callingCode}>
                                {c.code} {c.callingCode}
                              </option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined text-[#7e7482] text-xs pointer-events-none absolute right-1.5">
                            expand_more
                          </span>
                        </div>

                        <div className="flex-1 relative flex items-center bg-[#f5f2ff] rounded-xl px-3 py-2 border border-[#cfc2d2]/30">
                          <input
                            type="text"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full bg-transparent text-xs font-semibold text-[#1a1a26] outline-none"
                            placeholder="11 5489 3210"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Business address */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">
                        {st.addressLabel}
                      </label>
                      <div className="flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30 focus-within:border-[#4b0878] focus-within:ring-2 focus-within:ring-[#4b0878]/20 transition-all">
                        <span className="material-symbols-outlined text-[#7e7482] text-base mr-2">pin_drop</span>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-[#1a1a26] outline-none"
                          placeholder={st.addressPlaceholder}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Business Hours */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                          <span className="material-symbols-outlined text-xl">schedule</span>
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-[#1a1a26]">{st.businessHours}</h2>
                        </div>
                      </div>
                    </div>

                    {/* Days row */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#7e7482] mb-1.5">
                        <span>{st.activeDaysLabel}:</span>
                        <button
                          type="button"
                          onClick={handleSelectWeekdays}
                          className="text-[#4b0878] font-bold hover:underline cursor-pointer"
                        >
                          {dayLettersMap.L}-{dayLettersMap.V}
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {daysList.map((d) => {
                          const isActive = activeDays.includes(d.key);
                          return (
                            <button
                              key={d.key}
                              type="button"
                              onClick={() => toggleDay(d.key)}
                              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-[#2e004e] text-white shadow-sm'
                                  : 'bg-[#f5f2ff] text-[#7e7482] hover:bg-[#efecfd]'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Shifts pickers */}
                    <div className="space-y-4 pt-1">
                      {/* Morning shift */}
                      <div className="bg-[#f5f2ff] rounded-2xl p-4 space-y-3 border border-[#cfc2d2]/30">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-[#7a5900]">
                            <span>☀️</span> {st.morningShift}
                          </span>
                          <span className="text-[11px] font-extrabold text-[#2e004e] bg-white px-2.5 py-0.5 rounded-lg border border-[#cfc2d2]/40">
                            {timeTo12H(morningOpen)} - {timeTo12H(morningClose)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-white rounded-xl p-2.5 border border-[#cfc2d2]/30 space-y-1">
                            <span className="text-[11px] font-bold text-[#7e7482] block">{t.managers.startLabel}:</span>
                            <TimeSelectPicker
                              value={morningOpen}
                              onChange={(_, v24) => setMorningOpen(v24)}
                            />
                          </div>
                          <div className="bg-white rounded-xl p-2.5 border border-[#cfc2d2]/30 space-y-1">
                            <span className="text-[11px] font-bold text-[#7e7482] block">{t.managers.endLabel}:</span>
                            <TimeSelectPicker
                              value={morningClose}
                              onChange={(_, v24) => setMorningClose(v24)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Lunch break switch */}
                      <div className="flex items-center justify-between py-1 px-1">
                        <div>
                          <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1.5">
                            <span>🍔</span> {st.doubleShiftLabel}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasDoubleShift}
                            onChange={(e) => setHasDoubleShift(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-[#cfc2d2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2e004e]"></div>
                        </label>
                      </div>

                      {/* Lunch pause */}
                      {hasDoubleShift && (
                        <div className="bg-[#fff9ed] rounded-2xl p-4 space-y-3 border border-[#f9b900]/30 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-[#b27b00]">
                              <span>🍔</span> {st.lunchBreak}
                            </span>
                            <span className="text-[11px] font-extrabold text-[#7a5900] bg-white px-2.5 py-0.5 rounded-lg border border-[#f9b900]/40">
                              {timeTo12H(lunchStart)} - {timeTo12H(lunchEnd)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl p-2.5 border border-[#cfc2d2]/30 space-y-1">
                              <span className="text-[11px] font-bold text-[#7e7482] block">{t.managers.startLabel}:</span>
                              <TimeSelectPicker
                                value={lunchStart}
                                onChange={(_, v24) => setLunchStart(v24)}
                              />
                            </div>
                            <div className="bg-white rounded-xl p-2.5 border border-[#cfc2d2]/30 space-y-1">
                              <span className="text-[11px] font-bold text-[#7e7482] block">{t.managers.endLabel}:</span>
                              <TimeSelectPicker
                                value={lunchEnd}
                                onChange={(_, v24) => setLunchEnd(v24)}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Afternoon shift */}
                      {hasDoubleShift && (
                        <div className="bg-[#f5f2ff] rounded-2xl p-4 space-y-3 border border-[#cfc2d2]/30 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-[#4b0878]">
                              <span>🌙</span> {st.afternoonShift}
                            </span>
                            <span className="text-[11px] font-extrabold text-[#2e004e] bg-white px-2.5 py-0.5 rounded-lg border border-[#cfc2d2]/40">
                              {timeTo12H(afternoonOpen)} - {timeTo12H(afternoonClose)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl p-2.5 border border-[#cfc2d2]/30 space-y-1">
                              <span className="text-[11px] font-bold text-[#7e7482] block">{t.managers.startLabel}:</span>
                              <TimeSelectPicker
                                value={afternoonOpen}
                                onChange={(_, v24) => setAfternoonOpen(v24)}
                              />
                            </div>
                            <div className="bg-white rounded-xl p-2.5 border border-[#cfc2d2]/30 space-y-1">
                              <span className="text-[11px] font-bold text-[#7e7482] block">{t.managers.endLabel}:</span>
                              <TimeSelectPicker
                                value={afternoonClose}
                                onChange={(_, v24) => setAfternoonClose(v24)}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Appointment interval */}
                      <div className="pt-3 border-t border-[#efecfd] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-[#1a1a26] flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-[#4b0878]">schedule</span>
                            <span>{st.slotIntervalLabel}</span>
                          </label>
                          <span className="text-[11px] font-black text-[#2e004e] bg-[#f5f2ff] px-2 py-0.5 rounded-lg border border-[#cfc2d2]/40">
                            {appointmentIntervalMinutes === -1
                              ? st.intervalByService
                              : `${appointmentIntervalMinutes} min`}
                          </span>
                        </div>
                        <select
                          value={appointmentIntervalMinutes}
                          onChange={(e) => setAppointmentIntervalMinutes(Number(e.target.value))}
                          className="w-full bg-[#f5f2ff] hover:bg-[#efeafd] border border-[#cfc2d2]/40 rounded-xl px-3 py-2 text-xs font-extrabold text-[#1a1a26] outline-none cursor-pointer transition-colors"
                        >
                          <option value={15}>15 min</option>
                          <option value={30}>30 min</option>
                          <option value={60}>60 min</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Capacity, Staff, Shifts */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                          <span className="material-symbols-outlined text-xl">groups</span>
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-[#1a1a26]">
                            {st.simultaneousStaffCapacity}
                          </h2>
                          <p className="text-xs text-[#7e7482]">
                            {st.maxSimultaneousAppointments}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f2daff] text-[#2e004e] font-black text-xs">
                        {simultaneousCapacity}
                      </span>
                    </div>

                    {/* Simultaneous toggle */}
                    <div className="p-3.5 bg-[#f5f2ff] rounded-2xl border border-[#cfc2d2]/30 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-[#1a1a26] block">
                          {st.simultaneousStaffCapacity}
                        </span>
                        <span className="text-[11px] text-[#7e7482] block leading-tight">
                          {st.maxSimultaneousAppointments}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={allowSimultaneousStaff}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setAllowSimultaneousStaff(val);
                            if (!val) {
                              setSimultaneousCapacity(1);
                            } else {
                              setSimultaneousCapacity(2);
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#cfc2d2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2e004e]"></div>
                      </label>
                    </div>

                    {/* Simultaneous capacity stepper */}
                    <div className="space-y-2.5">
                      <div className="bg-[#f5f2ff] rounded-2xl p-3 border border-[#cfc2d2]/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#1a1a26] block">
                            {st.maxSimultaneousAppointments}: {simultaneousCapacity}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(1, simultaneousCapacity - 1);
                              setSimultaneousCapacity(next);
                              if (next === 1) setAllowSimultaneousStaff(false);
                            }}
                            className="w-8 h-8 rounded-xl bg-white text-[#2e004e] font-bold flex items-center justify-center shadow-xs border border-[#cfc2d2]/40 hover:bg-[#efecfd] active:scale-95 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-black text-sm text-[#1a1a26]">
                            {simultaneousCapacity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(8, simultaneousCapacity + 1);
                              setSimultaneousCapacity(next);
                              setAllowSimultaneousStaff(true);
                            }}
                            className="w-8 h-8 rounded-xl bg-white text-[#2e004e] font-bold flex items-center justify-center shadow-xs border border-[#cfc2d2]/40 hover:bg-[#efecfd] active:scale-95 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Staff shift schedule */}
                      <StaffShiftScheduleManager
                        schedule={staffScheduleConfig}
                        onChangeSchedule={setStaffScheduleConfig}
                      />

                      {/* Staff members */}
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#4c4451]">
                            {st.staffManagerTitle} ({staffList.length})
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {staffList.filter((s) => s.active).length} {ct.active}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {staffList.map((stMember) => (
                            <div
                              key={stMember.id}
                              className="bg-[#f5f2ff] rounded-2xl p-3 flex flex-col gap-2 border border-[#cfc2d2]/30 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleStaffActive(stMember.id)}
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
                                      stMember.active ? 'bg-[#2e004e] text-white' : 'bg-[#cfc2d2] text-white'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-xs">
                                      {stMember.active ? 'check' : 'remove'}
                                    </span>
                                  </button>
                                  <div className="min-w-0">
                                    <span className="font-bold text-[#1a1a26] truncate block">{stMember.name}</span>
                                    <span className="text-[10px] text-[#7e7482] truncate block">{stMember.role}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaff(stMember.id)}
                                  className="w-7 h-7 rounded-lg text-[#7e7482] hover:text-[#ba1a1a] hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
                                  title={ct.delete}
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-[#cfc2d2]/20 text-[11px]">
                                <span className="text-[#7e7482] font-semibold">{st.staffManagerTitle}:</span>
                                <select
                                  value={stMember.shiftAvailability || 'todo_el_dia'}
                                  onChange={(e) =>
                                    handleUpdateStaffShift(
                                      stMember.id,
                                      e.target.value as 'todo_el_dia' | 'solo_manana' | 'solo_tarde'
                                    )
                                  }
                                  className="bg-white rounded-lg px-2 py-1 font-bold text-[#2e004e] border border-[#cfc2d2]/40 outline-none cursor-pointer"
                                >
                                  <option value="todo_el_dia">☀️🌙 {st.shiftAllDay}</option>
                                  <option value="solo_manana">☀️ {st.shiftMorningOnly}</option>
                                  <option value="solo_tarde">🌙 {st.shiftAfternoonOnly}</option>
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add staff member */}
                        <div className="bg-[#fcf8ff] rounded-2xl p-3 border border-[#cfc2d2]/40 space-y-2 mt-2">
                          <span className="text-[11px] font-bold text-[#2e004e] block">
                            {st.addStaffBtn}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder={st.staffNamePlaceholder}
                              value={newStaffName}
                              onChange={(e) => setNewStaffName(e.target.value)}
                              className="bg-white text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                            />
                            <select
                              value={newStaffRole}
                              onChange={(e) => setNewStaffRole(e.target.value)}
                              className="bg-white text-xs px-2 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none cursor-pointer"
                            >
                              <option value="Estilista de corte">{st.staffRoleStylist}</option>
                              <option value="Especialista en baño">{st.staffRoleBather}</option>
                              <option value="Asistente general">{st.staffRoleAssistant}</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#7e7482]">
                              <select
                                value={newStaffShift}
                                onChange={(e) =>
                                  setNewStaffShift(
                                    e.target.value as 'todo_el_dia' | 'solo_manana' | 'solo_tarde'
                                  )
                                }
                                className="bg-white text-xs px-2 py-1 rounded-lg border border-[#cfc2d2]/30 outline-none cursor-pointer"
                              >
                                <option value="todo_el_dia">{st.shiftAllDay}</option>
                                <option value="solo_manana">{st.shiftMorningOnly}</option>
                                <option value="solo_tarde">{st.shiftAfternoonOnly}</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddStaff}
                              className="px-3 py-2 bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer shrink-0"
                            >
                              {st.addStaffBtn}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SERVICES */}
              <ServiceManager
                services={servicesList}
                onChangeServices={handleServicesChange}
                currency={selectedCurrency}
                businessId={config.id || activeAccount?.businessId || 'biz_main'}
              />

              {/* MEDICATIONS */}
              <MedicationManager
                enabled={hasMedicationProductsEnabled}
                onToggleEnabled={(enabled) => {
                  setHasMedicationProductsEnabled(enabled);
                }}
                products={medicationProducts}
                onChangeProducts={(updated) => {
                  setMedicationProducts(updated);
                }}
                currency={selectedCurrency}
              />

              {/* Save All Changes Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="w-full py-4 px-6 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-base shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined font-black ${isSaving ? 'animate-spin' : ''}`}>
                    {isSaving ? 'progress_activity' : 'check_circle'}
                  </span>
                  <span>{isSaving ? st.savingChanges : st.saveAllChanges}</span>
                </button>
              </div>
            </div>
          )}

          {/* SUB-SECCIÓN 2: CALIFICACIONES (SISTEMA COMPLETO Y PERSISTENTE) */}
          {selectedSection === 'calificaciones' && (() => {
            const reviewStats = calculateReviewStats(config.reviews, activeAccount?.businessId || config.id);
            const reviewsList = reviewStats.reviews;
            const totalReviews = reviewStats.totalReviews;
            const rawAvg = reviewStats.rawAverage;
            const avgRating = reviewStats.formattedAverage || '0,0';
            const starCounts = reviewStats.starCounts;

            // Eligible completed clients for review requests
            const requestStateMap = config.reviewRequests || {};
            const completedApts = appointments.filter(
              (a) =>
                a.status === 'completado' ||
                (a.status as any) === 'completed' ||
                (a.paymentStatus === 'cobrado' && a.status !== 'cancelada')
            );

            // Group by tutor phone/name so we show unique clients with their latest completed visit
            const eligibleClientsMap = new Map<
              string,
              {
                id: string;
                tutorName: string;
                petName: string;
                phone: string;
                rawPhone: string;
                lastVisitDate: string;
                state: 'pendiente' | 'iniciada' | 'calificado';
              }
            >();

            for (const apt of completedApts) {
              const tutorPhone = apt.tutorPhone || '';
              const key = (tutorPhone.trim() || apt.tutorName.trim().toLowerCase()) || apt.id;
              const existing = eligibleClientsMap.get(key);

              // Check if client has already left a review matching their name or phone
              const hasReviewed = reviewsList.some(
                (r) =>
                  (tutorPhone && r.tutorPhone === tutorPhone) ||
                  r.clientName.trim().toLowerCase() === apt.tutorName.trim().toLowerCase()
              );

              const stateEntry = requestStateMap[apt.id]?.state || (hasReviewed ? 'calificado' : 'pendiente');

              if (!existing) {
                eligibleClientsMap.set(key, {
                  id: apt.id,
                  tutorName: apt.tutorName,
                  petName: apt.petName,
                  phone: tutorPhone,
                  rawPhone: tutorPhone.replace(/\D/g, ''),
                  lastVisitDate: apt.date || 'Reciente',
                  state: hasReviewed ? 'calificado' : stateEntry
                });
              }
            }

            const eligibleClients = Array.from(eligibleClientsMap.values());

            return (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header Banner */}
                <div className="bg-gradient-to-br from-[#2e004e] via-[#3b0361] to-[#4b0878] text-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#f9b900] uppercase tracking-wider block">
                      {st.ratingsTitle}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      {st.ratingsSectionTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#e3e0f1] max-w-xl">
                      {st.ratingsSectionSubtitle}
                    </p>
                  </div>

                  {/* Summary Score Card */}
                  <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/20 shrink-0 self-start sm:self-auto">
                    <div className="text-center">
                      <span className="text-4xl sm:text-5xl font-black text-[#f9b900] block leading-none">
                        {totalReviews > 0 ? avgRating : '—'}
                      </span>
                      <div className="flex items-center justify-center text-[#f9b900] text-sm mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={s <= Math.round(rawAvg) ? 'text-[#f9b900]' : 'text-white/30'}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="border-l border-white/20 pl-4 text-left">
                      <span className="text-xs font-bold block text-white">
                        {totalReviews > 0 ? `${avgRating} ${st.outOf5}` : st.noReviewsYet}
                      </span>
                      <span className="text-[11px] text-[#e3e0f1] block">
                        {totalReviews === 1
                          ? st.ratingsTotalReviewsSingular
                          : formatTemplate(st.ratingsTotalReviewsPlural, { count: totalReviews })}
                      </span>
                      <span className="text-[10px] text-emerald-300 font-bold block mt-0.5">
                        {totalReviews > 0 ? st.ratingsRealVerified : st.ratingsShareHint}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN A: RESUMEN DE CALIFICACIONES Y DISTRIBUCIÓN */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#cfc2d2]/40 space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-[#cfc2d2]/30">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-[#fff8e1] text-[#7a5900] flex items-center justify-center font-black text-sm">
                        ★
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-[#1a1a26]">
                        {st.ratingsSummaryTitle}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[#7e7482]">
                      {totalReviews} {totalReviews === 1 ? st.ratingsReviewWordSingular : st.ratingsReviewWordPlural}
                    </span>
                  </div>

                  {totalReviews === 0 ? (
                    <div className="text-center py-8 px-4 space-y-3">
                      <div className="w-16 h-16 rounded-full bg-[#f5f2ff] text-[#2e004e] flex items-center justify-center mx-auto text-3xl shadow-2xs">
                        <span className="material-symbols-outlined text-3xl">star_half</span>
                      </div>
                      <h4 className="text-base font-black text-[#1a1a26]">
                        {st.ratingsNoReviewsHeadline}
                      </h4>
                      <p className="text-xs sm:text-sm text-[#7e7482] max-w-md mx-auto">
                        {st.noReviewsYet}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="text-center p-4 bg-[#fcf8ff] rounded-2xl border border-[#cfc2d2]/30">
                        <span className="text-5xl font-black text-[#2e004e] block leading-none">
                          {avgRating}
                        </span>
                        <div className="text-[#f9b900] text-xl my-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span key={s} className={s <= Math.round(rawAvg) ? 'text-[#f9b900]' : 'text-gray-300'}>
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-xs font-bold text-[#7e7482]">
                          {formatTemplate(st.ratingsAverageBasedOn, { count: totalReviews })}
                        </span>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = starCounts[star as 1 | 2 | 3 | 4 | 5];
                          const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                          return (
                            <div key={star} className="flex items-center gap-3 text-xs">
                              <span className="font-bold text-[#1a1a26] w-12 flex items-center gap-0.5">
                                <span>{star}</span>
                                <span className="text-[#f9b900]">★</span>
                              </span>
                              <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full bg-[#f9b900] rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-[#7e7482] w-24 text-right">
                                {count} {count === 1 ? st.ratingsReviewWordSingular : st.ratingsReviewWordPlural} ({percent}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECCIÓN: ENLACE PÚBLICO PARA RECIBIR CALIFICACIONES (FEATURE A: PARIDAD CON ENLACE PARA CLIENTES) */}
                <div className="bg-[#2e004e] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#f9b900] tracking-wider uppercase">
                      <span className="material-symbols-outlined text-base">reviews</span>
                      <span>{st.reviewLinkBadge}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-400 text-[#1a1a26] text-xs font-black">
                      {st.reviewLinkActiveStatus}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-white">{st.reviewLinkTitle}</h2>
                    <p className="text-sm text-[#e3e0f1] mt-1.5 leading-relaxed">
                      {st.reviewLinkSubtitle}
                    </p>
                  </div>

                  {/* Business Preview Sub-Card */}
                  <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/20 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center shadow-md shrink-0 overflow-hidden border border-white/30">
                        <img
                          src={logoUrl || config.logoUrl || HOTLINK_IMAGES.logo}
                          alt={businessName}
                          className="w-full h-full object-contain rounded-xl"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = HOTLINK_IMAGES.logo;
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-lg text-white truncate">{businessName}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-[#1a1a26] text-[10px] font-black uppercase">
                            {st.online247}
                          </span>
                        </div>
                        <p className="text-xs text-[#e3e0f1] truncate mt-0.5">
                          {[selectedCity?.trim(), selectedCountry?.trim()].filter(Boolean).join(', ') || address || st.reviewLinkSubtitle}
                        </p>
                      </div>
                    </div>

                    {onPreviewReviewFlow && (
                      <button
                        type="button"
                        onClick={onPreviewReviewFlow}
                        className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm text-[#f9b900]">visibility</span>
                        <span>{st.testReviewFlow}</span>
                      </button>
                    )}
                  </div>

                  {/* Custom Review Slug Editor */}
                  <div className="bg-black/30 rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5">
                    <div>
                      <label className="text-xs font-bold text-[#ffdea1] uppercase tracking-wider block mb-1">
                        {st.reviewSlugLabel}
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="flex-1 flex items-center bg-white/10 rounded-xl px-3.5 py-2.5 border border-white/20 focus-within:border-[#f9b900] focus-within:ring-1 focus-within:ring-[#f9b900] transition-all">
                        <span className="text-xs sm:text-sm text-[#ffdea1]/90 font-mono font-bold select-none shrink-0 pr-1.5 border-r border-white/20 mr-2">
                          /calificar/
                        </span>
                        <input
                          type="text"
                          value={reviewSlug}
                          onChange={(e) => setReviewSlug(cleanSlugInput(e.target.value))}
                          placeholder={st.reviewSlugPlaceholder}
                          className="w-full bg-transparent text-white font-mono font-bold text-sm outline-none px-1 placeholder:text-white/40"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveReviewSlug}
                        disabled={isSavingReviewSlug}
                        className="px-5 py-3 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-60 flex items-center justify-center gap-1.5"
                      >
                        {isSavingReviewSlug ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-[#261900] border-t-transparent rounded-full animate-spin"></span>
                            <span>{st.savingLink}</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm font-bold">save</span>
                            <span>{st.saveLinkBtn}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Live Preview URL */}
                    <div className="flex items-center gap-2 text-xs bg-white/5 rounded-xl px-3 py-2 border border-white/10 font-mono break-all text-[#e3e0f1]">
                      <span className="material-symbols-outlined text-sm text-[#f9b900] shrink-0">link</span>
                      <span className="text-white font-bold truncate">{realReviewUrl}</span>
                    </div>

                    {reviewSlugSaveError && (
                      <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                        <span className="material-symbols-outlined text-sm shrink-0">error</span>
                        <span>{reviewSlugSaveError}</span>
                      </div>
                    )}
                  </div>

                  {/* Live Review Link Card & Share Actions */}
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/10 space-y-3">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-wider block">
                      {st.reviewLinkBadge}
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-mono text-white/95">
                        <span className="material-symbols-outlined text-lg text-[#f9b900] shrink-0">link</span>
                        <span className="truncate">{realReviewUrl}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyReviewLink}
                          className="px-3.5 py-2.5 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">
                            {isReviewLinkCopied ? 'check' : 'content_copy'}
                          </span>
                          <span>{isReviewLinkCopied ? ct.copied : st.copyReviewLink}</span>
                        </button>

                        {onPreviewReviewFlow && (
                          <button
                            type="button"
                            onClick={onPreviewReviewFlow}
                            className="px-3.5 py-2.5 bg-white text-[#2e004e] hover:bg-[#ffdea1] text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm font-bold text-[#2e004e]">visibility</span>
                            <span>{st.testReviewFlow}</span>
                          </button>
                        )}

                        <a
                          href={realReviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm text-[#f9b900]">open_in_new</span>
                          <span>{st.openReviewLink}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Full-width WhatsApp Direct Share Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleShareGeneralReviewWhatsApp}
                      className="w-full py-3.5 px-5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">chat</span>
                      <span>{st.shareReviewWhatsApp}</span>
                    </button>
                  </div>
                </div>

                {/* SECCIÓN: SOLICITAR CALIFICACIÓN A CLIENTES ATENDIDOS */}
                {eligibleClients.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="pb-3 border-b border-[#cfc2d2]/30">
                      <h3 className="text-base sm:text-lg font-black text-[#1a1a26]">
                        {st.reviewRequestsTitle}
                      </h3>
                      <p className="text-xs text-[#7e7482]">{st.reviewRequestsSubtitle}</p>
                    </div>

                    <div className="space-y-2.5">
                      {eligibleClients.slice(0, 12).map((client) => (
                        <div
                          key={client.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#fcf8ff] border border-[#cfc2d2]/30"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-[#1a1a26]">
                                {client.tutorName}
                              </span>
                              <span className="text-[11px] text-[#7e7482] font-semibold">
                                ({client.petName})
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  client.state === 'calificado'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : client.state === 'iniciada'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {client.state === 'calificado'
                                  ? st.statusRated
                                  : client.state === 'iniciada'
                                  ? st.statusInviteSent
                                  : st.statusPendingInvite}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#7e7482]">{client.lastVisitDate}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRequestReviewViaWhatsApp(client)}
                            className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-sm">chat</span>
                            <span>{st.requestReviewWhatsAppBtn}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECCIÓN B: LISTA DE RESEÑAS RECIBIDAS */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#cfc2d2]/30">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-[#2e004e]">reviews</span>
                      <h3 className="text-base sm:text-lg font-black text-[#1a1a26]">
                        {st.receivedReviewsTitle}
                      </h3>
                    </div>
                    <span className="text-xs text-[#7e7482]">
                      {totalReviews} {totalReviews === 1 ? st.ratingsOpinionWordSingular : st.ratingsOpinionWordPlural}
                    </span>
                  </div>

                  {totalReviews === 0 ? (
                    <div className="text-center py-8 text-xs text-[#7e7482]">
                      {st.ratingsReceivedListEmpty}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviewsList.map((rev) => (
                        <div
                          key={rev.id}
                          className="bg-[#fcf8ff] rounded-2xl p-4 sm:p-5 border border-[#cfc2d2]/30 space-y-2 hover:border-[#2e004e]/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-black text-[#1a1a26]">
                                  {rev.clientName}
                                </span>
                                {rev.petName && (
                                  <span className="text-[11px] text-[#7e7482] font-semibold">
                                    ({rev.petName})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-[#7e7482] block mt-0.5">
                                {rev.date}
                              </span>
                            </div>

                            <div className="flex items-center text-[#f9b900] text-sm shrink-0">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <span key={s} className={s <= rev.stars ? 'text-[#f9b900]' : 'text-gray-300'}>
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>

                          {rev.comment ? (
                            <p className="text-xs text-[#4c4451] leading-relaxed italic bg-white p-3 rounded-xl border border-[#cfc2d2]/20">
                              "{rev.comment}"
                            </p>
                          ) : null}

                          {rev.serviceName && (
                            <div className="flex items-center text-[10px] text-[#7e7482] pt-1">
                              <span>{st.ratingsServicePrefix} <strong>{rev.serviceName}</strong></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SUB-SECCIÓN 3: MIS CLIENTES */}
          {selectedSection === 'clientes' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#cfc2d2]/40">
                <div>
                  <h2 className="text-xl font-black text-[#1a1a26]">{st.myClientsDbTitle}</h2>
                  <p className="text-xs text-[#7e7482]">
                    {st.myClientsDbSubtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  <span>{st.exportCsvBtn}</span>
                </button>
              </div>

              {/* Search bar */}
              <div className="flex items-center bg-white rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/40 shadow-xs">
                <span className="material-symbols-outlined text-[#7e7482] text-base mr-2">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={st.searchClientsPlaceholder}
                  className="w-full bg-transparent text-xs font-medium outline-none"
                />
              </div>

              {/* Table / List */}
              {filteredAppointments.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-xs text-[#7e7482]">
                  {ct.noData}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#cfc2d2]/40 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f5f2ff] text-[#4b0878] font-bold border-b border-[#cfc2d2]/30">
                        <tr>
                          <th className="p-3">{st.colPet}</th>
                          <th className="p-3">{st.colTutor}</th>
                          <th className="p-3">{st.colWhatsapp}</th>
                          <th className="p-3">{t.sales.serviceCol}</th>
                          <th className="p-3">{t.sales.amountCol}</th>
                          <th className="p-3">{t.sales.dateCol}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#efecfd]">
                        {filteredAppointments.map((apt) => (
                          <tr key={apt.id} className="hover:bg-[#fcf8ff]">
                            <td className="p-3 font-bold text-[#1a1a26]">
                              {apt.petName} <span className="font-normal text-[11px] text-[#7e7482]">({apt.breed})</span>
                            </td>
                            <td className="p-3 text-[#4c4451]">{apt.tutorName}</td>
                            <td className="p-3 text-[#7e7482] font-mono">{apt.tutorPhone || '-'}</td>
                            <td className="p-3 font-semibold text-[#2e004e]">{apt.serviceName}</td>
                            <td className="p-3 font-bold text-[#1a1a26]">{formatPrice(apt.price, apt.currency || selectedCurrency, { includeCode: true })}</td>
                            <td className="p-3 text-[#7e7482]">{apt.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
