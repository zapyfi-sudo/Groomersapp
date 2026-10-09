import React, { useState, useEffect, useMemo } from 'react';
import {
  SalonConfig,
  StaffMember,
  Appointment,
  ClientReview,
  SalonService,
  MedicationProduct,
  StaffScheduleConfig,
  UserAccount
} from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { ServiceManager } from './ServiceManager';
import { MedicationManager } from './MedicationManager';
import { StaffShiftScheduleManager } from './StaffShiftScheduleManager';
import { COUNTRIES, CURRENCIES } from '../utils/countries';
import { AppLanguage, TRANSLATIONS } from '../utils/translations';
import { compressImage } from '../utils/storage';
import { slugify, cleanSlugInput, extractSlugOnly, generateStableBusinessId, buildPublicBookingUrl, buildPublicReviewUrl } from '../utils/slugUtils';
import { syncBusinessToServer, updateReviewRequestStateInFirestore } from '../utils/api';
import { persistActiveConfig } from '../utils/saasDb';
import { checkSlugAvailabilityInFirestore } from '../utils/firebase';
import { normalizePhoneForWhatsApp, openWhatsAppUrl } from '../utils/phoneUtils';

interface AjustesViewProps {
  config: SalonConfig;
  onUpdateConfig: (updated: SalonConfig) => void;
  onPreviewClientFlow: () => void;
  appointments?: Appointment[];
  onAddNewReview?: (review: ClientReview) => void;
  currentLanguage: AppLanguage;
  onUpdateLanguage: (lang: AppLanguage) => void;
  activeAccount?: UserAccount | null;
  onOpenAccountModal?: () => void;
}

export const AjustesView: React.FC<AjustesViewProps> = ({
  config,
  onUpdateConfig,
  onPreviewClientFlow,
  appointments = [],
  currentLanguage,
  onUpdateLanguage,
  activeAccount,
  onOpenAccountModal
}) => {
  // Navigation: null shows the simplified vertical menu; or 'negocio' | 'calificaciones' | 'clientes' | 'enlace'
  const [selectedSection, setSelectedSection] = useState<'negocio' | 'calificaciones' | 'clientes' | 'enlace' | null>(null);

  // Client History Filters
  const [clientPeriodFilter, setClientPeriodFilter] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Brand data
  const [logoUrl, setLogoUrl] = useState<string>(config.logoUrl || HOTLINK_IMAGES.logo);
  const [businessName, setBusinessName] = useState<string>(config.name || 'Peluquería Canina Luna');
  const [selectedCountry, setSelectedCountry] = useState<string>(config.country || 'Argentina');
  const [selectedCity, setSelectedCity] = useState<string>(config.city || '');
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(currentLanguage);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(config.currency || 'ARS');

  useEffect(() => {
    if (config.city !== undefined) {
      setSelectedCity(config.city);
    }
  }, [config.city]);

  // Contact & Location
  const [phonePrefix, setPhonePrefix] = useState<string>(config.phonePrefix || '+54');
  const [phoneNumber, setPhoneNumber] = useState<string>(config.phone || '11 5489 3210');
  const [address, setAddress] = useState<string>(config.address || 'Av. Corrientes 4520, Almagro, CABA');

  // Schedule & Double Shift
  const [activeDays, setActiveDays] = useState<string[]>(config.activeDays || ['L', 'M', 'X', 'J', 'V', 'S']);
  const [hasDoubleShift, setHasDoubleShift] = useState<boolean>(config.hasDoubleShift ?? true);
  const [morningOpen, setMorningOpen] = useState<string>(config.morningOpen || '08:00');
  const [morningClose, setMorningClose] = useState<string>(config.morningClose || '12:30');
  const [afternoonOpen, setAfternoonOpen] = useState<string>(config.afternoonOpen || '14:00');
  const [afternoonClose, setAfternoonClose] = useState<string>(config.afternoonClose || '19:30');

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

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS['es-LA'];

  const daysList = [
    { label: 'L', key: 'L' },
    { label: 'M', key: 'M' },
    { label: 'X', key: 'X' },
    { label: 'J', key: 'J' },
    { label: 'V', key: 'V' },
    { label: 'S', key: 'S' },
    { label: 'D', key: 'D' }
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

  // Logo file upload with compression and size validation
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSavedToast('El archivo supera el tamaño máximo de 5 MB.');
        setTimeout(() => setSavedToast(null), 3000);
        return;
      }
      try {
        const compressed = await compressImage(file, 380, 0.76);
        setLogoUrl(compressed);
        setSavedToast('Logo cargado correctamente. Recuerda guardar cambios.');
        setTimeout(() => setSavedToast(null), 3000);
      } catch (err) {
        console.warn('Error compressing logo:', err);
      }
    }
  };

  // Country selection updates phone code and currency default
  const handleCountryChange = (countryName: string) => {
    setSelectedCountry(countryName);
    const countryObj = COUNTRIES.find((c) => c.name === countryName);
    if (countryObj) {
      setPhonePrefix(countryObj.callingCode);
      setSelectedCurrency(countryObj.defaultCurrency);
    }
  };

  // Copy shareable link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(realBookingUrl);
    setIsCopied(true);
    setSavedToast(t.linkCopied || '¡Enlace de reservas copiado al portapapeles!');
    setTimeout(() => {
      setIsCopied(false);
      setSavedToast(null);
    }, 2500);
  };

  // Dedicated review URL for collecting customer ratings
  const realReviewUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://groomers-app.vercel.app';
    const slug = cleanSlugInput(customSlug) || extractSlugOnly(config.bookingSlug) || slugify(businessName || 'calificar', 'calificar');
    return buildPublicReviewUrl(origin, config.id || 'biz_main', slug, config);
  }, [config.bookingSlug, config.id, customSlug, businessName]);

  const [isReviewLinkCopied, setIsReviewLinkCopied] = useState<boolean>(false);

  const handleCopyReviewLink = () => {
    navigator.clipboard.writeText(realReviewUrl);
    setIsReviewLinkCopied(true);
    setSavedToast('¡Enlace para calificar copiado al portapapeles!');
    setTimeout(() => {
      setIsReviewLinkCopied(false);
      setSavedToast(null);
    }, 2500);
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
    const petPart = item.petName?.trim() ? ` para el cuidado de ${item.petName.trim()}` : '';

    const message = `Hola, ${tutorFirstName} 👋\n\n¡Gracias por confiar en nosotros${petPart}! 🐶\n\nNos gustaría conocer tu opinión sobre tu experiencia con nuestro negocio.\n¿Podrías dedicarnos un momento para dejarnos una calificación?\n\nTu opinión nos ayuda a mejorar y a seguir ofreciendo un mejor servicio.\n\nPuedes calificarnos aquí:\n${realReviewUrl}\n\n¡Muchas gracias por tu confianza! ❤️`;

    const normalizedDigits = normalizePhoneForWhatsApp(item.phone || item.rawPhone, config);
    const waUrl = `https://wa.me/${normalizedDigits}?text=${encodeURIComponent(message)}`;

    // Open WhatsApp safely
    openWhatsAppUrl(waUrl);

    // Update request state in config & database to 'iniciada'
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
    const message = `¡Hola! 👋\n\nNos encantaría conocer tu opinión sobre nuestro servicio en ${config.name}.\n\nPuedes dejarnos tu calificación y comentarios aquí:\n${realReviewUrl}\n\n¡Muchas gracias por tu apoyo! ❤️`;
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

  // Filtered Appointments for the Excel / History view
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
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
    });
  }, [appointments, searchQuery]);

  // Export to Excel / CSV function
  const handleExportExcel = () => {
    const headers = [
      'ID Cita',
      'Fecha',
      'Horario',
      'Mascota',
      'Raza',
      'Tutor Responsable',
      'Teléfono WhatsApp',
      'Servicio',
      'Estilista a Cargo',
      'Precio',
      'Moneda',
      'Estado Cobro',
      'Observaciones'
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
      `"${apt.paymentStatusLabel || 'Cobrado'}"`,
      `"${(apt.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AgendaCan_Clientes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSavedToast('¡Planilla de clientes descargada exitosamente!');
    setTimeout(() => setSavedToast(null), 3000);
  };

  const handleSaveSlug = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setSlugSaveError(null);
    setIsSavingSlug(true);

    const persistentBizId = config.id || 'biz_main';
    const targetSlug = cleanSlugInput(customSlug);

    if (!targetSlug) {
      setSlugSaveError('Por favor ingresa un slug válido (ejemplo: pelo).');
      setIsSavingSlug(false);
      return;
    }

    try {
      // 1. Check if slug is already taken by another business
      const check = await checkSlugAvailabilityInFirestore(targetSlug, persistentBizId);
      if (!check.available) {
        setSlugSaveError(
          `El slug "${targetSlug}" ya está registrado por ${check.conflictBusinessName || 'otro negocio'}. Elige uno diferente.`
        );
        setIsSavingSlug(false);
        return;
      }

      const updatedConfig: SalonConfig = {
        ...config,
        id: persistentBizId,
        name: businessName,
        city: selectedCity.trim(),
        bookingSlug: targetSlug
      };

      const success = await syncBusinessToServer(
        persistentBizId,
        updatedConfig,
        undefined,
        appointments
      );

      if (!success) {
        throw new Error('No se pudo guardar el enlace en el servidor');
      }

      await persistActiveConfig(updatedConfig);
      onUpdateConfig(updatedConfig);
      setCustomSlug(targetSlug);

      setSavedToast('Enlace actualizado correctamente.');
      setTimeout(() => setSavedToast(null), 3500);
    } catch (err) {
      console.error('[SLUG SAVE ERROR]', err);
      const msg = err instanceof Error ? err.message : 'Error al guardar el enlace en el servidor. Por favor intenta de nuevo.';
      setSlugSaveError(msg);
      setTimeout(() => setSlugSaveError(null), 5000);
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleSaveAll = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    setIsSaving(true);
    setSlugSaveError(null);

    const persistentBizId = activeAccount?.businessId || config.id || 'biz_main';

    // 1. Validaciones de campos obligatorios (Requisito #10)
    if (!businessName || !businessName.trim()) {
      setSavedToast('El nombre del negocio es obligatorio.');
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    if (!phoneNumber || !phoneNumber.trim()) {
      setSavedToast('El número de WhatsApp o teléfono es obligatorio.');
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    if (!address || !address.trim()) {
      setSavedToast('La dirección del salón es obligatoria.');
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    // Validar servicios: verificar que todos tengan nombre asignado (Requisitos #3, #4, #5)
    const invalidService = servicesList.find((s) => !s.name || !s.name.trim());
    if (invalidService) {
      setSavedToast('Todos los servicios deben tener un nombre asignado.');
      setIsSaving(false);
      setTimeout(() => setSavedToast(null), 4000);
      return;
    }

    const safeSlug =
      cleanSlugInput(customSlug) ||
      extractSlugOnly(config.bookingSlug) ||
      slugify(businessName || 'reservas', 'reservas');

    // Normalizar servicios con businessId e IDs únicos garantizados
    const normalizedServices: SalonService[] = servicesList.map((svc, idx) => ({
      ...svc,
      id: svc.id || `svc-${Date.now()}-${idx}`,
      businessId: persistentBizId,
      name: svc.name.trim(),
      desc: (svc.desc || '').trim(),
      durationMin: Number(svc.durationMin) || 60,
      price: Number(svc.price) || 0,
      pricingType: svc.pricingType || 'unico',
      active: svc.active !== false
    }));

    // Normalizar medicamentos
    const normalizedMedications: MedicationProduct[] = medicationProducts.map((med, idx) => ({
      ...med,
      id: med.id || `med-${Date.now()}-${idx}`,
      name: med.name.trim(),
      price: Number(med.price) || 0,
      active: med.active !== false
    }));

    const updatedConfig: SalonConfig = {
      ...config,
      id: persistentBizId,
      bookingSlug: safeSlug,
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
      staffScheduleConfig,
      services: normalizedServices,
      hasMedicationProductsEnabled,
      medicationProducts: normalizedMedications,
      hasDoubleShift,
      morningOpen,
      morningClose,
      afternoonOpen,
      afternoonClose,
      activeDays
    };

    try {
      const success = await syncBusinessToServer(persistentBizId, updatedConfig, undefined, appointments);
      if (!success) {
        throw new Error('No se pudo guardar la configuración en la base de datos');
      }

      await persistActiveConfig(updatedConfig);
      onUpdateConfig(updatedConfig);
      setCustomSlug(safeSlug);

      if (selectedLanguage !== currentLanguage) {
        onUpdateLanguage(selectedLanguage);
      }

      setSavedToast('Cambios guardados correctamente.');
      setTimeout(() => setSavedToast(null), 3500);
    } catch (err) {
      console.error('[SAVE ALL ERROR]', err);
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Error al guardar en el servidor. Por favor intenta nuevamente.';
      setSavedToast(errorMsg);
      setTimeout(() => setSavedToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-32 px-4 sm:px-6 lg:px-8 pt-4 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{savedToast}</span>
        </div>
      )}

      {/* VISTA 1: PANTALLA PRINCIPAL DE AJUSTES CON LAS 4 OPCIONES */}
      {selectedSection === null && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="pb-2 border-b border-[#cfc2d2]/40">
            <div className="flex items-center gap-1.5 text-[#7a5900] text-xs font-bold uppercase tracking-wider mb-1">
              <span className="material-symbols-outlined text-base text-[#f9b900]">tune</span>
              <span>{t.settingsCenter}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a26] tracking-tight">
              {t.settingsTitle}
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
                <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                  {t.businessConfig}
                </h2>
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
                <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                  {t.ratings}
                </h2>
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
                <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors whitespace-nowrap">
                  {t.myClients}
                </h2>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#f5f2ff] group-hover:bg-[#2e004e] group-hover:text-white flex items-center justify-center text-[#2e004e] shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 4. SEPARATE OPTION: Comparte tu agenda para redes */}
            <div
              onClick={() => setSelectedSection('enlace')}
              className="bg-gradient-to-r from-white to-[#f5f2ff] hover:to-[#efeafd] rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 hover:border-[#2e004e] transition-all cursor-pointer flex items-center justify-between gap-4 group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[#2e004e] text-[#f9b900] group-hover:bg-[#4b0878] flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs">
                  <span className="material-symbols-outlined text-2xl">public</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#1a1a26] group-hover:text-[#2e004e] transition-colors">
                    {t.shareAgendaSocial}
                  </h2>
                  <span className="text-xs text-[#7e7482]">Portal online 24/7 para que tus clientes agenden directo</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#2e004e] text-white flex items-center justify-center shrink-0 transition-all shadow-xs group-hover:translate-x-1">
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>

            {/* 5. GESTIÓN DE CUENTA SAAS Y PERSISTENCIA PERMANENTE */}
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
                      Base de Datos Conectada
                    </span>
                  </div>
                  <span className="text-xs text-[#7e7482] block truncate">
                    {activeAccount?.email || 'Cuenta SaaS Persistente'} • ID: {config.id || 'biz_main'}
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
                  Gestionar / Cambiar Cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: SUB-PÁGINAS */}
      {selectedSection !== null && (
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
                <span>{t.backToSettings}</span>
              </button>

              <div className="text-xs text-[#7e7482]">
                <span>{t.settingsTitle} &gt; </span>
                <strong className="text-[#1a1a26]">
                  {selectedSection === 'negocio' && t.businessConfig}
                  {selectedSection === 'calificaciones' && t.ratings}
                  {selectedSection === 'clientes' && t.myClients}
                  {selectedSection === 'enlace' && t.shareAgendaSocial}
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
                    <span>Enlace público de reservas</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-400 text-[#1a1a26] text-xs font-black">
                    Activo 24/7
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white">Tu enlace para clientes</h2>
                  <p className="text-sm text-[#e3e0f1] mt-1.5 leading-relaxed">
                    Personaliza el enlace que compartirás con tus clientes en Instagram, TikTok, WhatsApp y Facebook.
                  </p>
                </div>

                {/* Custom Slug Editor Box (Responsive & Mobile-optimized) */}
                <div className="bg-black/30 rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-[#ffdea1] uppercase tracking-wider block mb-1">
                      Personaliza el enlace que compartirás con tus clientes:
                    </label>
                    <p className="text-xs text-[#e3e0f1]/90">
                      Escribe únicamente la palabra o identificador de tu negocio (ejemplo: <span className="font-mono text-[#f9b900] font-bold">pelo</span>).
                    </p>
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
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm font-bold">save</span>
                          <span>Guardar slug</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Live preview banner of full URL */}
                  <div className="flex items-center gap-2 text-xs bg-white/5 rounded-xl px-3 py-2 border border-white/10 font-mono break-all text-[#e3e0f1]">
                    <span className="material-symbols-outlined text-sm text-[#f9b900] shrink-0">link</span>
                    <span className="text-white/60 select-none">Enlace:</span>
                    <span className="text-white font-bold truncate">{realBookingUrl}</span>
                  </div>

                  {slugSaveError && (
                    <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                      <span className="material-symbols-outlined text-sm shrink-0">error</span>
                      <span>{slugSaveError}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-[#f2daff]/80">
                    Este slug se asocia de forma permanente al identificador único de tu negocio.
                  </p>
                </div>

                {/* Live booking link card */}
                <div className="bg-black/40 rounded-2xl p-4 border border-white/10 space-y-3">
                  <span className="text-xs font-bold text-white/80 uppercase tracking-wider block">
                    Tu enlace de reservas
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
                        title="Copiar enlace al portapapeles"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">
                          {isCopied ? 'check' : 'content_copy'}
                        </span>
                        <span>{isCopied ? '¡Copiado!' : 'Copiar enlace'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onPreviewClientFlow}
                        className="px-3.5 py-2.5 bg-white text-[#2e004e] hover:bg-[#ffdea1] text-xs font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Probar flujo completo de reservas como cliente"
                      >
                        <span className="material-symbols-outlined text-sm font-bold text-[#2e004e]">visibility</span>
                        <span>Probar flujo</span>
                      </button>

                      <a
                        href={realBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        title="Abrir en pestaña nueva"
                      >
                        <span className="material-symbols-outlined text-sm text-[#f9b900]">open_in_new</span>
                        <span>Abrir enlace</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Direct Share Button */}
                <div className="pt-1">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `🐶✨ ¡Haz tu cita online acá! Reserva el turno de tu mascota en ${businessName} en menos de 2 minutos:\n👉 ${realBookingUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">chat</span>
                    <span>Compartir directo por WhatsApp</span>
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
                        <h2 className="text-base font-extrabold text-[#1a1a26]">{t.businessInfo}</h2>
                        <p className="text-xs text-[#7e7482]">Identidad visible en la agenda y portal online</p>
                      </div>
                    </div>

                    {/* Logo con recomendación clara de 400x400 y máx 5MB */}
                    <div className="bg-[#f5f2ff] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-[#cfc2d2]/30">
                      <div className="w-16 h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-xs border border-[#cfc2d2]/30 shrink-0 overflow-hidden">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo del negocio"
                            className="w-full h-full object-contain rounded-xl"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-[#7e7482]">storefront</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[#1a1a26] block">{t.businessLogo}</span>
                        <p className="text-[11px] text-[#7e7482] mt-0.5 leading-relaxed">
                          {t.logoRecommendation} (Máx. 5 MB)
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <label className="py-1.5 px-3 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-sm">photo_camera</span>
                            <span>Subir logo</span>
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
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Nombre Comercial */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{t.businessName} *</label>
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

                    {/* País */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{t.country}</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <select
                          value={selectedCountry}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                        >
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

                    {/* Ciudad */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">Ciudad</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30 focus-within:border-[#4b0878] focus-within:ring-2 focus-within:ring-[#4b0878]/20 transition-all">
                        <input
                          type="text"
                          value={selectedCity}
                          onChange={(e) => setSelectedCity(e.target.value)}
                          placeholder="Escribe el nombre de tu ciudad"
                          className="w-full bg-transparent text-xs font-semibold text-[#1a1a26] outline-none placeholder:text-[#7e7482]/60"
                        />
                      </div>
                    </div>

                    {/* Idioma - 4 opciones globales */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{t.languageLabel}</label>
                      <div className="relative flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30">
                        <select
                          value={selectedLanguage}
                          onChange={(e) => {
                            const newLang = e.target.value as AppLanguage;
                            setSelectedLanguage(newLang);
                            onUpdateLanguage(newLang);
                          }}
                          className="w-full bg-transparent text-xs font-bold text-[#1a1a26] outline-none cursor-pointer appearance-none"
                        >
                          <option value="es-LA">Español (Latinoamérica)</option>
                          <option value="es-ES">Español (España)</option>
                          <option value="en">English</option>
                          <option value="pt">Português</option>
                        </select>
                        <span className="material-symbols-outlined text-[#7e7482] text-sm pointer-events-none absolute right-3">
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Selector explícito de Moneda */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{t.currencyLabel}</label>
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
                    </div>

                    {/* Teléfono con código de país expandido */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">{t.whatsappPhone}</label>
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
                            placeholder="Ej: 11 5489 3210"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dirección del negocio */}
                    <div>
                      <label className="text-xs font-bold text-[#4c4451] block mb-1">
                        {t.addressLabel || 'Dirección del negocio'}
                      </label>
                      <div className="flex items-center bg-[#f5f2ff] rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/30 focus-within:border-[#4b0878] focus-within:ring-2 focus-within:ring-[#4b0878]/20 transition-all">
                        <span className="material-symbols-outlined text-[#7e7482] text-base mr-2">pin_drop</span>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-[#1a1a26] outline-none"
                          placeholder="Escribe la dirección de tu negocio"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Horarios de atención */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                          <span className="material-symbols-outlined text-xl">schedule</span>
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-[#1a1a26]">{t.businessHours}</h2>
                          <p className="text-xs text-[#7e7482]">Define los días y franjas habituales de apertura</p>
                        </div>
                      </div>
                    </div>

                    {/* Días row */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#7e7482] mb-1.5">
                        <span>Días de atención en la semana:</span>
                        <button
                          type="button"
                          onClick={handleSelectWeekdays}
                          className="text-[#4b0878] font-bold hover:underline cursor-pointer"
                        >
                          Seleccionar L-V
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
                    <div className="space-y-3 pt-1">
                      <div className="bg-[#f5f2ff] rounded-2xl p-3.5 space-y-2 border border-[#cfc2d2]/30">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-[#7a5900]">
                            <span>☀️</span> {t.morningShift}
                          </span>
                          <span className="text-[11px] text-[#7e7482]">{morningOpen} - {morningClose}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                            <span className="text-[#7e7482]">Desde:</span>
                            <input
                              type="text"
                              value={morningOpen}
                              onChange={(e) => setMorningOpen(e.target.value)}
                              className="w-16 outline-none font-bold text-[#1a1a26]"
                            />
                          </div>
                          <span className="text-sm font-bold text-[#7e7482]">➔</span>
                          <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                            <span className="text-[#7e7482]">Hasta:</span>
                            <input
                              type="text"
                              value={morningClose}
                              onChange={(e) => setMorningClose(e.target.value)}
                              className="w-16 outline-none font-bold text-[#1a1a26]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Lunch break */}
                      <div className="flex items-center justify-between py-1 px-1">
                        <div>
                          <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1">
                            <span>🍔</span> {t.lunchBreak}
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

                      {/* Afternoon shift */}
                      {hasDoubleShift && (
                        <div className="bg-[#f5f2ff] rounded-2xl p-3.5 space-y-2 border border-[#cfc2d2]/30">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-[#4b0878]">
                              <span>🌙</span> {t.afternoonShift}
                            </span>
                            <span className="text-[11px] text-[#7e7482]">{afternoonOpen} - {afternoonClose}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                              <span className="text-[#7e7482]">Desde:</span>
                              <input
                                type="text"
                                value={afternoonOpen}
                                onChange={(e) => setAfternoonOpen(e.target.value)}
                                className="w-16 outline-none font-bold text-[#1a1a26]"
                              />
                            </div>
                            <span className="text-sm font-bold text-[#7e7482]">➔</span>
                            <div className="flex-1 bg-white rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border border-[#cfc2d2]/30">
                              <span className="text-[#7e7482]">Hasta:</span>
                              <input
                                type="text"
                                value={afternoonClose}
                                onChange={(e) => setAfternoonClose(e.target.value)}
                                className="w-16 outline-none font-bold text-[#1a1a26]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Capacidad, Personal, Turnos */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878] shrink-0">
                          <span className="material-symbols-outlined text-xl">groups</span>
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-[#1a1a26]">
                            {t.simultaneousStaffCapacity}
                          </h2>
                          <p className="text-xs text-[#7e7482]">
                            Control de servicios simultáneos en agenda
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f2daff] text-[#2e004e] font-black text-xs">
                        {simultaneousCapacity} a la vez
                      </span>
                    </div>

                    {/* Toggle de atención simultánea */}
                    <div className="p-3.5 bg-[#f5f2ff] rounded-2xl border border-[#cfc2d2]/30 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-[#1a1a26] block">
                          Atención simultánea
                        </span>
                        <span className="text-[11px] text-[#7e7482] block leading-tight">
                          Permite agendar turnos concurrentes si hay estilistas libres
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

                    {/* Selector de puestos simultáneos */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#4c4451]">
                        <span>Capacidad máxima en paralelo:</span>
                        <span className="text-[#2e004e] font-black">
                          {allowSimultaneousStaff ? `${simultaneousCapacity} mascotas a la vez` : '1 mascota'}
                        </span>
                      </div>

                      <div className="bg-[#f5f2ff] rounded-2xl p-3 border border-[#cfc2d2]/30 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#1a1a26] block">
                            Puestos simultáneos: {simultaneousCapacity}
                          </span>
                          <span className="text-[11px] text-[#7e7482]">
                            Límite de turnos a la misma hora en la agenda
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

                      {/* Turnos de Trabajo del Personal */}
                      <StaffShiftScheduleManager
                        schedule={staffScheduleConfig}
                        onChangeSchedule={setStaffScheduleConfig}
                      />

                      {/* Personal / Estilistas */}
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#4c4451]">
                            Personal ({staffList.length})
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {staffList.filter((s) => s.active).length} activos
                          </span>
                        </div>

                        <div className="space-y-2">
                          {staffList.map((st) => (
                            <div
                              key={st.id}
                              className="bg-[#f5f2ff] rounded-2xl p-3 flex flex-col gap-2 border border-[#cfc2d2]/30 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleStaffActive(st.id)}
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
                                      st.active ? 'bg-[#2e004e] text-white' : 'bg-[#cfc2d2] text-white'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-xs">
                                      {st.active ? 'check' : 'remove'}
                                    </span>
                                  </button>
                                  <div className="min-w-0">
                                    <span className="font-bold text-[#1a1a26] truncate block">{st.name}</span>
                                    <span className="text-[10px] text-[#7e7482] truncate block">{st.role}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaff(st.id)}
                                  className="w-7 h-7 rounded-lg text-[#7e7482] hover:text-[#ba1a1a] hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
                                  title="Eliminar"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-[#cfc2d2]/20 text-[11px]">
                                <span className="text-[#7e7482] font-semibold">Turno asignado:</span>
                                <select
                                  value={st.shiftAvailability || 'todo_el_dia'}
                                  onChange={(e) =>
                                    handleUpdateStaffShift(
                                      st.id,
                                      e.target.value as 'todo_el_dia' | 'solo_manana' | 'solo_tarde'
                                    )
                                  }
                                  className="bg-white rounded-lg px-2 py-1 font-bold text-[#2e004e] border border-[#cfc2d2]/40 outline-none cursor-pointer"
                                >
                                  <option value="todo_el_dia">☀️🌙 Todo el día</option>
                                  <option value="solo_manana">☀️ Solo mañana</option>
                                  <option value="solo_tarde">🌙 Solo en la tarde</option>
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Agregar miembro del personal */}
                        <div className="bg-[#fcf8ff] rounded-2xl p-3 border border-[#cfc2d2]/40 space-y-2 mt-2">
                          <span className="text-[11px] font-bold text-[#2e004e] block">
                            + Añadir nuevo miembro al personal
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Nombre del estilista"
                              value={newStaffName}
                              onChange={(e) => setNewStaffName(e.target.value)}
                              className="bg-white text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
                            />
                            <select
                              value={newStaffRole}
                              onChange={(e) => setNewStaffRole(e.target.value)}
                              className="bg-white text-xs px-2 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none cursor-pointer"
                            >
                              <option value="Estilista de corte">Corte y Estética</option>
                              <option value="Especialista en baño">Baño y Deslanado</option>
                              <option value="Asistente general">Asistente y Secado</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#7e7482]">
                              <span>Turno:</span>
                              <select
                                value={newStaffShift}
                                onChange={(e) =>
                                  setNewStaffShift(
                                    e.target.value as 'todo_el_dia' | 'solo_manana' | 'solo_tarde'
                                  )
                                }
                                className="bg-white text-xs px-2 py-1 rounded-lg border border-[#cfc2d2]/30 outline-none cursor-pointer"
                              >
                                <option value="todo_el_dia">Todo el día</option>
                                <option value="solo_manana">Solo mañana</option>
                                <option value="solo_tarde">Solo en la tarde</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddStaff}
                              className="px-3 py-2 bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer shrink-0"
                            >
                              + Añadir personal
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN SERVICIOS: Integrada directamente */}
              <ServiceManager
                services={servicesList}
                onChangeServices={(updated) => {
                  setServicesList(updated);
                  onUpdateConfig({ ...config, services: updated });
                }}
                currency={selectedCurrency}
              />

              {/* SECCIÓN MEDICAMENTOS: Integrada directamente */}
              <MedicationManager
                enabled={hasMedicationProductsEnabled}
                onToggleEnabled={(enabled) => {
                  setHasMedicationProductsEnabled(enabled);
                  onUpdateConfig({ ...config, hasMedicationProductsEnabled: enabled });
                }}
                products={medicationProducts}
                onChangeProducts={(updated) => {
                  setMedicationProducts(updated);
                  onUpdateConfig({ ...config, medicationProducts: updated });
                }}
                currency={selectedCurrency}
              />

              {/* Botón Guardar Todos los Cambios */}
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
                  <span>{isSaving ? 'Guardando cambios...' : t.saveAllChanges}</span>
                </button>
              </div>
            </div>
          )}

          {/* SUB-SECCIÓN 2: CALIFICACIONES (SISTEMA COMPLETO Y PERSISTENTE) */}
          {selectedSection === 'calificaciones' && (() => {
            const reviewsList = (config.reviews || []).filter(
              (r) => r && typeof r.stars === 'number' && r.stars >= 1 && r.stars <= 5
            );
            const totalReviews = reviewsList.length;

            const sumStars = reviewsList.reduce((acc, r) => acc + r.stars, 0);
            const rawAvg = totalReviews > 0 ? sumStars / totalReviews : 0;
            const avgRating = totalReviews > 0 ? (rawAvg % 1 === 0 ? rawAvg.toFixed(1) : rawAvg.toFixed(1).replace('.', ',')) : '0,0';

            const starCounts = {
              5: reviewsList.filter((r) => r.stars === 5).length,
              4: reviewsList.filter((r) => r.stars === 4).length,
              3: reviewsList.filter((r) => r.stars === 3).length,
              2: reviewsList.filter((r) => r.stars === 2).length,
              1: reviewsList.filter((r) => r.stars === 1).length
            };

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
                      Reputación y opiniones del negocio
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      Calificación del negocio
                    </h2>
                    <p className="text-xs sm:text-sm text-[#e3e0f1] max-w-xl">
                      Gestiona las opiniones de tus clientes, comparte tu enlace público y solicita calificaciones fácilmente por WhatsApp tras cada visita completada.
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
                        {totalReviews > 0 ? `${avgRating} de 5 estrellas` : 'Sin reseñas'}
                      </span>
                      <span className="text-[11px] text-[#e3e0f1] block">
                        {totalReviews === 1 ? '1 reseña recibida' : `${totalReviews} reseñas recibidas`}
                      </span>
                      <span className="text-[10px] text-emerald-300 font-bold block mt-0.5">
                        {totalReviews > 0 ? '✓ Calificaciones reales' : 'Comparte tu enlace'}
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
                        Resumen de calificaciones
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[#7e7482]">
                      {totalReviews === 1 ? '1 reseña en total' : `${totalReviews} reseñas en total`}
                    </span>
                  </div>

                  {totalReviews === 0 ? (
                    /* Estado vacío */
                    <div className="text-center py-8 px-4 space-y-3">
                      <div className="w-16 h-16 rounded-full bg-[#f5f2ff] text-[#2e004e] flex items-center justify-center mx-auto text-3xl shadow-2xs">
                        <span className="material-symbols-outlined text-3xl">star_half</span>
                      </div>
                      <h4 className="text-base font-black text-[#1a1a26]">
                        Aún no tienes calificaciones
                      </h4>
                      <p className="text-xs sm:text-sm text-[#7e7482] max-w-md mx-auto">
                        Comparte tu enlace para comenzar a recibir opiniones de tus clientes.
                      </p>
                    </div>
                  ) : (
                    /* Distribución de estrellas real */
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
                          Promedio basado en {totalReviews} {totalReviews === 1 ? 'opinión' : 'opiniones'}
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
                                {count} {count === 1 ? 'reseña' : 'reseñas'} ({percent}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECCIÓN: ENLACE PÚBLICO PARA RECIBIR CALIFICACIONES (REQUISITO 3 y 9) */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-[#2e004e]">link</span>
                      <h3 className="text-base sm:text-lg font-black text-[#1a1a26]">
                        Enlace para recibir calificaciones
                      </h3>
                    </div>
                    <p className="text-xs text-[#7e7482]">
                      Comparte este enlace con tus clientes para que puedan calificar tu negocio y dejar sus comentarios.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#fcf8ff] p-2.5 rounded-2xl border border-[#cfc2d2]/40">
                    <input
                      type="text"
                      readOnly
                      value={realReviewUrl}
                      className="bg-transparent text-xs text-[#2e004e] font-mono px-3 py-2 flex-1 outline-none truncate"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyReviewLink}
                        className="flex-1 sm:flex-none px-4 py-2 bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isReviewLinkCopied ? 'check' : 'content_copy'}
                        </span>
                        <span>{isReviewLinkCopied ? '¡Copiado!' : 'Copiar enlace'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShareGeneralReviewWhatsApp}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                        title="Compartir por WhatsApp"
                      >
                        <span className="material-symbols-outlined text-sm">chat</span>
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      <a
                        href={realReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-[#2e004e] border border-[#cfc2d2]/60 text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 shadow-xs"
                        title="Abrir formulario para probarlo"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span className="hidden sm:inline">Probar enlace</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 6 & 7: SOLICITAR CALIFICACIONES A CLIENTES CON VISITAS COMPLETADAS */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-emerald-700">outgoing_mail</span>
                      <h3 className="text-base sm:text-lg font-black text-[#1a1a26]">
                        Solicitar calificaciones
                      </h3>
                    </div>
                    <p className="text-xs text-[#7e7482]">
                      Clientes que completaron un servicio o visita en tu negocio y están listos para recibir una solicitud de opinión por WhatsApp.
                    </p>
                  </div>

                  {eligibleClients.length === 0 ? (
                    <div className="text-center py-6 px-4 bg-[#fcf8ff] rounded-2xl border border-dashed border-[#cfc2d2]/60 space-y-1.5">
                      <span className="material-symbols-outlined text-2xl text-[#7e7482]">event_available</span>
                      <p className="text-xs font-bold text-[#1a1a26]">
                        No hay solicitudes pendientes en este momento
                      </p>
                      <p className="text-[11px] text-[#7e7482] max-w-sm mx-auto">
                        A medida que completes citas en la Agenda, tus clientes aparecerán aquí para solicitarles su calificación.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {eligibleClients.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#fcf8ff] hover:bg-[#f5f2ff] rounded-2xl p-4 border border-[#cfc2d2]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#1a1a26] truncate">
                                {item.tutorName}
                              </span>
                              {item.petName && (
                                <span className="text-[11px] text-[#7e7482] bg-white px-2 py-0.5 rounded-full border border-[#cfc2d2]/30 shrink-0">
                                  🐶 {item.petName}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#7e7482]">
                              {item.phone && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">call</span>
                                  <span>{item.phone}</span>
                                </span>
                              )}
                              <span>Última visita: {item.lastVisitDate}</span>
                            </div>

                            <div className="pt-0.5">
                              {item.state === 'calificado' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <span className="material-symbols-outlined text-xs">check</span>
                                  <span>Calificación recibida</span>
                                </span>
                              ) : item.state === 'iniciada' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                  <span className="material-symbols-outlined text-xs">schedule</span>
                                  <span>Solicitud iniciada</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2e004e] bg-[#f5f2ff] px-2 py-0.5 rounded-full">
                                  <span className="material-symbols-outlined text-xs">pending</span>
                                  <span>Pendiente de solicitar</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                            {item.state !== 'calificado' && (
                              <button
                                type="button"
                                onClick={() => handleRequestReviewViaWhatsApp(item)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                                title="Abrir WhatsApp con mensaje personalizado"
                              >
                                <span className="material-symbols-outlined text-sm">chat</span>
                                <span>Solicitar por WhatsApp</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={handleCopyReviewLink}
                              className="p-2 bg-white hover:bg-gray-50 text-[#2e004e] border border-[#cfc2d2]/40 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-xs"
                              title="Copiar enlace"
                            >
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECCIÓN B: LISTA DE RESEÑAS RECIBIDAS (ORDENADAS DE RECIENTE A ANTIGUA) */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#cfc2d2]/40 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#cfc2d2]/30">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-[#2e004e]">reviews</span>
                      <h3 className="text-base sm:text-lg font-black text-[#1a1a26]">
                        Lista de reseñas recibidas
                      </h3>
                    </div>
                    <span className="text-xs text-[#7e7482]">
                      {totalReviews === 1 ? '1 opinión' : `${totalReviews} opiniones`}
                    </span>
                  </div>

                  {totalReviews === 0 ? (
                    <div className="text-center py-8 text-xs text-[#7e7482]">
                      No hay comentarios ni reseñas todavía.
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
                              <span>Servicio: <strong>{rev.serviceName}</strong></span>
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
                  <h2 className="text-xl font-black text-[#1a1a26]">{t.myClients}</h2>
                  <p className="text-xs text-[#7e7482]">
                    Directorio y registro completo de visitas de tus clientes
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  <span>Descargar Excel / CSV</span>
                </button>
              </div>

              {/* Search bar */}
              <div className="flex items-center bg-white rounded-xl px-3.5 py-2.5 border border-[#cfc2d2]/40 shadow-xs">
                <span className="material-symbols-outlined text-[#7e7482] text-base mr-2">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por cliente, mascota o servicio..."
                  className="w-full bg-transparent text-xs font-medium outline-none"
                />
              </div>

              {/* Table / List */}
              {filteredAppointments.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-xs text-[#7e7482]">
                  No se encontraron registros de clientes o visitas.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#cfc2d2]/40 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f5f2ff] text-[#4b0878] font-bold border-b border-[#cfc2d2]/30">
                        <tr>
                          <th className="p-3">Mascota</th>
                          <th className="p-3">Tutor</th>
                          <th className="p-3">Teléfono</th>
                          <th className="p-3">Servicio</th>
                          <th className="p-3">Precio</th>
                          <th className="p-3">Fecha</th>
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
                            <td className="p-3 font-bold text-[#1a1a26]">${apt.price.toLocaleString()} {apt.currency || selectedCurrency}</td>
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
