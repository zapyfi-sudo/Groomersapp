import React, { useState, useEffect, useMemo } from 'react';
import { SalonConfig, SalonService, Appointment, Pet, BehaviorMood } from '../types';
import { fetchBusinessProfile, createPublicAppointment } from '../utils/api';
import { formatDateSpanish } from '../utils/storage';

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
  const [behavior, setBehavior] = useState<BehaviorMood>('tranquilo');
  const [healthNotes, setHealthNotes] = useState<string>('');
  const [handlingNotes, setHandlingNotes] = useState<string>('');

  const [selectedMedicationIds, setSelectedMedicationIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  // Load business from persistent storage using URL identifier
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    fetchBusinessProfile(businessIdOrSlug)
      .then((result) => {
        if (!isMounted) return;
        if (result && result.config) {
          setBusinessData(result);
          if (result.services && result.services.length > 0) {
            setSelectedServiceId(result.services[0].id);
          }
        } else {
          setLoadError('No encontramos este negocio. Este enlace de reservas no es válido o ya no está disponible.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error loading public business:', err);
        setLoadError('No encontramos este negocio. Este enlace de reservas no es válido o ya no está disponible.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [businessIdOrSlug]);

  const config = businessData?.config;
  const services = useMemo(() => {
    return businessData?.services || [];
  }, [businessData]);

  const activeService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0];
  }, [services, selectedServiceId]);

  const currency = config?.currency || 'ARS';

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

  // Time slots generation
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !config) return [];

    const slots: { time: string; available: boolean }[] = [];
    const capacityLimit = config.allowSimultaneousStaff === false ? 1 : config.simultaneousCapacity || 2;
    const existing = businessData?.appointments || [];

    const addRangeSlots = (startStr: string, endStr: string) => {
      const [startH, startM] = startStr.split(':').map(Number);
      const [endH, endM] = endStr.split(':').map(Number);

      let currentH = startH;
      let currentM = startM;

      while (currentH < endH || (currentH === endH && currentM < endM)) {
        const timeLabel = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
        const booked = existing.filter(
          (apt) => apt.date === selectedDate && apt.time?.includes(timeLabel)
        ).length;

        slots.push({
          time: timeLabel,
          available: booked < capacityLimit
        });

        currentM += 60; // 1-hour slots
        if (currentM >= 60) {
          currentH += Math.floor(currentM / 60);
          currentM = currentM % 60;
        }
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
  }, [selectedDate, config, businessData]);

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

    setIsSubmitting(true);

    const newApt: Appointment = {
      id: `apt_pub_${Date.now()}`,
      petId: `#PET-${Math.floor(1000 + Math.random() * 9000)}`,
      petName: petName.trim(),
      breed: breed.trim() || 'Mestizo',
      tutorName: tutorName.trim(),
      tutorPhone: whatsappPhone.trim(),
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
      notes: [
        healthNotes ? `Salud: ${healthNotes}` : '',
        handlingNotes ? `Manejo: ${handlingNotes}` : ''
      ].filter(Boolean).join(' | ')
    };

    const petData: Partial<Pet> = {
      name: petName.trim(),
      breed: breed.trim() || 'Mestizo',
      gender: 'Macho',
      weightKg: selectedDogSize === 'pequeno' ? 6 : selectedDogSize === 'mediano' ? 14 : selectedDogSize === 'grande' ? 24 : 35,
      tutor: {
        name: tutorName.trim(),
        phone: whatsappPhone.trim(),
        rawPhone: whatsappPhone.trim()
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
              src={config.logoUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200&auto=format&fit=crop&q=80'}
              alt={config.name}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-[#7a5900] uppercase tracking-wider block mb-0.5">
              Peluquería Canina & Estética
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2e004e] tracking-tight">
              {config.name}
            </h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-xs text-[#7e7482]">
              {config.address && (
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#2e004e]">location_on</span>
                  <span>{config.address}</span>
                </div>
              )}
              {config.phone && (
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#2e004e]">call</span>
                  <span>{config.phonePrefix} {config.phone}</span>
                </div>
              )}
            </div>

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
                ¡Cita reservada con éxito!
              </h2>
              <p className="text-sm text-[#7e7482] mt-1.5 font-medium">
                Hemos registrado tu solicitud de cita con <strong className="text-[#2e004e]">{config.name}</strong>.
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
                  ${createdAppointment.price.toLocaleString()} {createdAppointment.currency}
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
                Solicitar otro turno para otra mascota
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
                    return (
                      <div
                        key={svc.id}
                        onClick={() => setSelectedServiceId(svc.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'border-[#2e004e] ring-2 ring-[#2e004e]/20 bg-[#f5f2ff]'
                            : 'border-[#cfc2d2]/40 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-xs text-[#1a1a26]">{svc.name}</h4>
                            <span className="font-black text-xs text-[#2e004e] shrink-0">
                              ${svc.price.toLocaleString()} {currency}
                            </span>
                          </div>
                          {svc.desc && (
                            <p className="text-[11px] text-[#7e7482] mt-1 line-clamp-2 leading-tight">
                              {svc.desc}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-[#7e7482] font-semibold flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-xs">schedule</span>
                          {svc.durationMin} min
                        </span>
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
                            ${priceForSize.toLocaleString()} {currency}
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
                          +${med.price.toLocaleString()} {currency}
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
                  ${totalPrice.toLocaleString()} {currency}
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
    </div>
  );
};
