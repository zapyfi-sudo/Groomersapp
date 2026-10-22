import React, { useState, useMemo, useRef } from 'react';
import { Appointment, SalonConfig, Pet, BehaviorMood } from '../types';
import { formatDateSpanish, compressImage } from '../utils/storage';
import { formatPrice } from '../utils/priceUtils';
import { TimeSelectPicker } from './TimeSelectPicker';
import { validateCustomAppointmentTime } from '../utils/scheduleUtils';

interface NewAppointmentViewProps {
  onClose: () => void;
  onAppointmentCreated: (newApt: Appointment, newPetData?: Partial<Pet>) => Promise<boolean | void> | boolean | void;
  salonName?: string;
  salonAddress?: string;
  salonPhone?: string;
  simultaneousCapacity?: number;
  existingAppointments?: Appointment[];
  existingPets?: Pet[];
  isOnlineClientPortal?: boolean;
  salonConfig?: SalonConfig;
  initialPet?: Pet;
  initialDate?: string;
}

export const NewAppointmentView: React.FC<NewAppointmentViewProps> = ({
  onClose,
  onAppointmentCreated,
  simultaneousCapacity = 2,
  existingAppointments = [],
  existingPets = [],
  salonConfig,
  initialPet,
  initialDate
}) => {
  const currency = salonConfig?.currency || 'ARS';

  // Real configured services
  const services = useMemo(() => {
    const list = salonConfig?.services?.filter((s) => s.active) || [];
    if (list.length > 0) return list;
    return salonConfig?.services || [];
  }, [salonConfig]);

  // Determine initial service from initialPet's last visit or first service
  const preloadedServiceId = useMemo(() => {
    if (initialPet?.lastVisit?.serviceName) {
      const match = services.find(
        (s) => s.name.trim().toLowerCase() === initialPet.lastVisit?.serviceName?.trim().toLowerCase()
      );
      if (match) return match.id;
    }
    return services[0]?.id || '';
  }, [initialPet, services]);

  // Step 1: Services
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preloadedServiceId
  );

  // Requirement #2: Tamaño de la mascota con las mismas 3 opciones que el enlace público (Pequeño, Mediano, Grande)
  const initialDogSize: 'pequeno' | 'mediano' | 'grande' =
    initialPet?.size === 'pequeno' || initialPet?.size === 'mediano' || initialPet?.size === 'grande'
      ? initialPet.size
      : 'mediano';
  const [selectedDogSize, setSelectedDogSize] = useState<'pequeno' | 'mediano' | 'grande'>(initialDogSize);

  const activeService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0];
  }, [services, selectedServiceId]);

  // Base service price (accounting for dog size if service has size-based pricing)
  const serviceBasePrice = useMemo(() => {
    if (!activeService) return 0;
    if (activeService.pricingType === 'tamano' && activeService.priceBySize) {
      return activeService.priceBySize[selectedDogSize] || activeService.price;
    }
    return activeService.price;
  }, [activeService, selectedDogSize]);

  // Available medications configured by the business
  const availableMedications = useMemo(() => {
    if (salonConfig?.hasMedicationProductsEnabled === false) {
      return [];
    }
    return salonConfig?.medicationProducts?.filter((p) => p.active) || [];
  }, [salonConfig?.hasMedicationProductsEnabled, salonConfig?.medicationProducts]);

  const [selectedMedicationIds, setSelectedMedicationIds] = useState<string[]>([]);

  const selectedMedicationsList = useMemo(() => {
    return availableMedications.filter((m) => selectedMedicationIds.includes(m.id));
  }, [availableMedications, selectedMedicationIds]);

  const totalMedicationCost = useMemo(() => {
    return selectedMedicationsList.reduce((acc, m) => acc + (m.price || 0), 0);
  }, [selectedMedicationsList]);

  const totalPrice = serviceBasePrice + totalMedicationCost;

  // Step 2: Calendar & Date (ALWAYS begins from current real date)
  const today = useMemo(() => new Date(), []);
  const dayIndexToLetter = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const activeDayLetters = salonConfig?.activeDays || ['L', 'M', 'X', 'J', 'V', 'S'];

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
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString('es-ES', { month: 'short' }),
        weekdayShort: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        isToday: i === 0,
        isWorkingDay
      });
    }
    return dates;
  }, [today, activeDayLetters]);

  const defaultSelectedDate = useMemo(() => {
    if (initialDate) {
      const match = availableDates.find((d) => d.formatted === initialDate);
      if (match) return match.formatted;
    }
    const firstWorking = availableDates.find((d) => d.isWorkingDay);
    return firstWorking ? firstWorking.formatted : availableDates[0]?.formatted || formatDateSpanish(today);
  }, [availableDates, today, initialDate]);

  const [selectedDate, setSelectedDate] = useState<string>(defaultSelectedDate);

  // Step 3: Dynamic Time Slot Generation
  const timeSlots = useMemo(() => {
    const morningOpen = salonConfig?.morningOpen || '08:00';
    const morningClose = salonConfig?.morningClose || '12:30';
    const hasDoubleShift = salonConfig?.hasDoubleShift ?? true;
    const afternoonOpen = salonConfig?.afternoonOpen || '14:00';
    const afternoonClose = salonConfig?.afternoonClose || '19:30';

    const parseMins = (tStr: string) => {
      const [h, m] = tStr.split(':').map((v) => parseInt(v, 10) || 0);
      return h * 60 + m;
    };

    const formatMins = (mTotal: number) => {
      const h = Math.floor(mTotal / 60);
      const m = mTotal % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const slots: { time: string; available: boolean; bookedCount: number }[] = [];
    const capacityLimit = salonConfig?.allowSimultaneousStaff === false ? 1 : simultaneousCapacity || 2;
    const duration = activeService?.durationMin || 60;
    const intervalSetting = salonConfig?.appointmentIntervalMinutes;
    const step = intervalSetting === -1
      ? Math.max(duration, 15)
      : (Number(intervalSetting) > 0 ? Number(intervalSetting) : 30);

    // Morning shift slots
    const mStart = parseMins(morningOpen);
    const mEnd = parseMins(morningClose);

    for (let current = mStart; current + duration <= mEnd; current += step) {
      const timeStr = formatMins(current);
      const booked = existingAppointments.filter(
        (a) => a.date === selectedDate && (a.time === timeStr || a.time.startsWith(timeStr))
      ).length;

      slots.push({
        time: timeStr,
        available: booked < capacityLimit,
        bookedCount: booked
      });
    }

    // Afternoon shift slots
    if (hasDoubleShift) {
      const aStart = parseMins(afternoonOpen);
      const aEnd = parseMins(afternoonClose);
      for (let current = aStart; current + duration <= aEnd; current += step) {
        const timeStr = formatMins(current);
        const booked = existingAppointments.filter(
          (a) => a.date === selectedDate && (a.time === timeStr || a.time.startsWith(timeStr))
        ).length;

        slots.push({
          time: timeStr,
          available: booked < capacityLimit,
          bookedCount: booked
        });
      }
    }

    return slots;
  }, [salonConfig, simultaneousCapacity, activeService, selectedDate, existingAppointments]);

  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isCustomTime, setIsCustomTime] = useState<boolean>(false);
  const [customTimeVal, setCustomTimeVal] = useState<string>('09:15 AM');

  // Real-time custom time validation against business hours, lunch break, capacity and overlaps
  const customValidation = useMemo(() => {
    if (!salonConfig) {
      return {
        isValid: true,
        isOutsideHours: false,
        isConflict: false,
        formattedTime12: customTimeVal,
        formattedTime24: customTimeVal
      };
    }
    return validateCustomAppointmentTime({
      config: salonConfig,
      selectedDate,
      timeStr: customTimeVal,
      serviceDurationMin: activeService?.durationMin || 60,
      existingAppointments
    });
  }, [salonConfig, selectedDate, customTimeVal, activeService, existingAppointments]);

  React.useEffect(() => {
    const firstAvail = timeSlots.find((s) => s.available);
    if (firstAvail) {
      setSelectedTime(firstAvail.time);
    } else if (timeSlots[0]) {
      setSelectedTime(timeSlots[0].time);
    }
  }, [timeSlots, selectedDate]);

  // Step 4: Tutor & Pet Info (Unified fields matching public booking)
  const [tutorName, setTutorName] = useState(initialPet?.tutor?.name || '');
  const [whatsappPhone, setWhatsappPhone] = useState(initialPet?.tutor?.phone || '');
  const [petName, setPetName] = useState(initialPet?.name || '');
  const [breed, setBreed] = useState(initialPet?.breed || '');
  const [age, setAge] = useState(initialPet?.age || '');
  const [gender, setGender] = useState<'Macho' | 'Hembra'>(initialPet?.gender || 'Macho');
  // Requirement #2: Peso aproximado como campo independiente
  const [weightKg, setWeightKg] = useState(initialPet?.weightKg ? String(initialPet.weightKg) : '10');
  // Requirement #4: Fotografía de la mascota
  const [petPhoto, setPetPhoto] = useState<string>(initialPet?.photoUrl || '');
  const [isPhotoCompressing, setIsPhotoCompressing] = useState<boolean>(false);
  // Requirement #3: Exactamente 3 opciones (Tranquilo, Inquieto, Difícil)
  const [behavior, setBehavior] = useState<BehaviorMood>(initialPet?.habitualMood || 'tranquilo');
  // Requirement #1: Salud o alergias de la piel
  const [healthNotes, setHealthNotes] = useState(initialPet?.healthAllergies || '');
  const [handlingNotes, setHandlingNotes] = useState(initialPet?.handlingObservations || '');

  // Selected existing pet linking (Requirement #6: reutilizar registro correcto si ya existe)
  const [selectedExistingPetId, setSelectedExistingPetId] = useState<string | null>(initialPet?.id || null);

  const matchedExistingPet = useMemo(() => {
    if (selectedExistingPetId) {
      return existingPets.find((p) => p.id === selectedExistingPetId) || null;
    }
    if (!petName.trim() && !tutorName.trim()) return null;
    return (
      existingPets.find(
        (p) =>
          p.name.toLowerCase() === petName.trim().toLowerCase() &&
          p.tutor.name.toLowerCase() === tutorName.trim().toLowerCase()
      ) || null
    );
  }, [existingPets, selectedExistingPetId, petName, tutorName]);

  const handleSelectExistingPet = (p: Pet) => {
    setSelectedExistingPetId(p.id);
    setPetName(p.name);
    setBreed(p.breed);
    if (p.size === 'pequeno' || p.size === 'mediano' || p.size === 'grande') {
      setSelectedDogSize(p.size);
    }
    if (p.age) setAge(p.age);
    if (p.gender) setGender(p.gender);
    if (p.weightKg) setWeightKg(String(p.weightKg));
    if (p.photoUrl) setPetPhoto(p.photoUrl);
    if (p.habitualMood) setBehavior(p.habitualMood);
    if (p.healthAllergies) setHealthNotes(p.healthAllergies);
    if (p.handlingObservations) setHandlingNotes(p.handlingObservations);
    if (p.tutor.name) setTutorName(p.tutor.name);
    if (p.tutor.phone) setWhatsappPhone(p.tutor.phone);
  };

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const activeAptIdRef = useRef<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate in-flight submissions if user clicks repeatedly
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    if (!activeService) {
      setFormError('Por favor selecciona un servicio.');
      return;
    }
    if (!selectedDate) {
      setFormError('Por favor selecciona una fecha.');
      return;
    }

    const effectiveTime = isCustomTime ? customValidation.formattedTime12 : selectedTime;

    if (!effectiveTime) {
      setFormError('Por favor selecciona un horario disponible.');
      return;
    }
    if (isCustomTime && !customValidation.isValid) {
      setFormError(customValidation.reason || 'El horario personalizado no está dentro de la jornada de atención del salón.');
      return;
    }
    if (!tutorName.trim()) {
      setFormError('Por favor ingresa el nombre del tutor.');
      return;
    }
    if (!whatsappPhone.trim()) {
      setFormError('Por favor ingresa el teléfono / WhatsApp de contacto.');
      return;
    }
    if (!petName.trim()) {
      setFormError('Por favor ingresa el nombre de la mascota.');
      return;
    }
    if (!breed.trim()) {
      setFormError('Por favor ingresa la raza de la mascota.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    const parsedWeight =
      parseFloat(weightKg) ||
      (selectedDogSize === 'pequeno' ? 6 : selectedDogSize === 'mediano' ? 14 : 24);

    const resolvedPetId =
      matchedExistingPet?.id ||
      selectedExistingPetId ||
      `#PET-${Math.floor(1000 + Math.random() * 9000)}`;

    // Keep stable appointment ID if retrying the same appointment to prevent duplicates
    if (!activeAptIdRef.current) {
      activeAptIdRef.current = `apt-${Date.now()}`;
    }
    const newAptId = activeAptIdRef.current;

    const newApt: Appointment = {
      id: newAptId,
      petId: resolvedPetId,
      petName: petName.trim(),
      breed: breed.trim(),
      size: selectedDogSize,
      tutorName: tutorName.trim(),
      tutorPhone: whatsappPhone.trim(),
      serviceName: activeService.name,
      time: effectiveTime,
      date: selectedDate,
      status: 'confirmada',
      statusLabel: 'CONFIRMADA',
      groomer: salonConfig?.staffMembers?.[0]?.name || 'Estilista de turno',
      price: totalPrice,
      currency,
      paymentStatus: 'por_cobrar',
      paymentStatusLabel: 'Por cobrar',
      subStatus: 'Cita en agenda',
      subStatusType: 'tag',
      hasMedication: selectedMedicationIds.length > 0,
      beforePhotoUrl: petPhoto || undefined,
      notes: [
        healthNotes ? `Salud: ${healthNotes}` : '',
        handlingNotes ? `Manejo: ${handlingNotes}` : ''
      ]
        .filter(Boolean)
        .join(' | ') || undefined
    };

    const newPetData: Partial<Pet> = {
      id: resolvedPetId,
      name: petName.trim(),
      breed: breed.trim(),
      size: selectedDogSize,
      age: age.trim() || '1 año',
      gender,
      weightKg: parsedWeight,
      photoUrl: petPhoto || (matchedExistingPet?.photoUrl || undefined),
      tutor: {
        name: tutorName.trim(),
        phone: whatsappPhone.trim(),
        rawPhone: whatsappPhone.replace(/\D/g, '')
      },
      habitualMood: behavior,
      healthAllergies: healthNotes.trim() || 'Sin alergias conocidas.',
      handlingObservations: handlingNotes.trim() || 'Manejo habitual sin restricciones.',
      recommendedIntervalWeeks: 4
    };

    try {
      const res = await onAppointmentCreated(newApt, newPetData);
      if (res === false) {
        setFormError('Hubo un error al guardar la cita en la base de datos persistente. Por favor, intenta de nuevo.');
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      } else {
        activeAptIdRef.current = null;
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        onClose();
      }
    } catch (err) {
      console.error('Error al guardar cita interna:', err);
      setFormError('No se pudo guardar la cita de forma persistente. Intente nuevamente.');
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col my-auto max-h-[95vh]">
        {/* Header adaptado al panel administrativo (Requirement #5: sin logo público, estrellas ni dirección pública) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/20">
              <span className="material-symbols-outlined text-2xl text-[#f9b900]">event_available</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base leading-tight text-white truncate">
                Nueva cita
              </h3>
              <p className="text-xs text-[#e3e0f1] truncate">
                Agendar turno y registrar información en agenda
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 text-white/90 hover:text-white cursor-pointer shrink-0"
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Selector rápido de mascota existente (si hay registradas) */}
            {existingPets.length > 0 && (
              <div className="p-3.5 bg-white rounded-2xl border border-[#cfc2d2]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#4b0878]">pets</span>
                    <span>¿Es una mascota ya registrada en el salón? (Opcional)</span>
                  </label>
                  {selectedExistingPetId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExistingPetId(null);
                        setPetName('');
                        setBreed('');
                        setTutorName('');
                        setWhatsappPhone('');
                        setPetPhoto('');
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      Limpiar selección
                    </button>
                  )}
                </div>

                <select
                  value={selectedExistingPetId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      setSelectedExistingPetId(null);
                      return;
                    }
                    const found = existingPets.find((p) => p.id === id);
                    if (found) handleSelectExistingPet(found);
                  }}
                  className="w-full bg-[#fcf8ff] text-xs font-semibold px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e] cursor-pointer"
                >
                  <option value="">-- Seleccionar cliente / mascota existente --</option>
                  {existingPets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.breed}) - Tutor: {p.tutor.name} ({p.tutor.phone})
                    </option>
                  ))}
                </select>

                {matchedExistingPet && (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 pt-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Mascota vinculada: {matchedExistingPet.name} (ID {matchedExistingPet.id})</span>
                  </div>
                )}
              </div>
            )}

            {/* 1. Selecciona el servicio */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h4 className="font-extrabold text-sm text-[#1a1a26]">
                  Selecciona el servicio
                </h4>
              </div>

              {services.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-xs text-[#7e7482] text-center">
                  No hay servicios configurados actualmente en el salón.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc) => {
                    const isSelected = svc.id === selectedServiceId;
                    const priceForSize =
                      svc.pricingType === 'tamano' && svc.priceBySize
                        ? svc.priceBySize[selectedDogSize] || svc.price
                        : svc.price;

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
                          <div className="flex items-center justify-between gap-1">
                            <h5 className="font-bold text-xs text-[#1a1a26]">{svc.name}</h5>
                            <span className="font-black text-xs text-[#2e004e]">
                              {formatPrice(priceForSize, currency, { includeCode: true })}
                            </span>
                          </div>
                          {svc.desc && (
                            <p className="text-[11px] text-[#7e7482] mt-1 line-clamp-2 leading-tight">
                              {svc.desc}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-[#7e7482] font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">schedule</span>
                          {svc.durationMin} min
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Si el servicio depende del tamaño de la mascota */}
              {activeService?.pricingType === 'tamano' && (
                <div className="p-3 bg-[#f5f2ff] rounded-2xl border border-[#cfc2d2]/40 space-y-2">
                  <span className="text-xs font-bold text-[#4c4451] block">
                    Tarifa según tamaño de la mascota:
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['pequeno', 'mediano', 'grande'] as const).map((sz) => {
                      const labels = {
                        pequeno: 'Pequeño',
                        mediano: 'Mediano',
                        grande: 'Grande'
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
                          <span className="block text-[11px]">{labels[sz]}</span>
                          <span className="block text-[10px] opacity-90 mt-0.5">
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
                <h4 className="font-extrabold text-sm text-[#1a1a26]">
                  Selecciona el día
                </h4>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {availableDates.map((item) => {
                  const isSelected = selectedDate === item.formatted;
                  return (
                    <button
                      key={item.formatted}
                      type="button"
                      disabled={!item.isWorkingDay}
                      onClick={() => {
                        if (item.isWorkingDay) {
                          setSelectedDate(item.formatted);
                        }
                      }}
                      className={`py-2 px-3 rounded-2xl min-w-[70px] text-center transition-all shrink-0 cursor-pointer ${
                        !item.isWorkingDay
                          ? 'bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed border border-gray-200'
                          : isSelected
                          ? 'bg-[#2e004e] text-white shadow-sm ring-2 ring-[#2e004e]/20'
                          : 'bg-white text-[#1a1a26] border border-[#cfc2d2]/40 hover:bg-[#f5f2ff]'
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase">
                        {item.weekdayShort}
                      </span>
                      <span className="block text-base font-black my-0.5">
                        {item.dayNum}
                      </span>
                      <span className="block text-[10px] opacity-80">
                        {item.isWorkingDay ? item.monthShort : 'Cerrado'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Selecciona el horario disponible */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h4 className="font-extrabold text-sm text-[#1a1a26]">
                    Horarios disponibles ({selectedDate})
                  </h4>
                </div>
                {isCustomTime && (
                  <span className="text-[11px] font-bold text-[#4b0878] bg-[#f5f2ff] px-2 py-0.5 rounded-full border border-[#cfc2d2]/40 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">edit_calendar</span>
                    <span>Modo personalizado</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {timeSlots.map((slot) => {
                  const isSelected = !isCustomTime && selectedTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => {
                        if (slot.available) {
                          setIsCustomTime(false);
                          setSelectedTime(slot.time);
                        }
                      }}
                      className={`py-2.5 px-2 rounded-xl text-center font-bold text-xs transition-all ${
                        !slot.available
                          ? 'bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed line-through'
                          : isSelected
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-white text-[#1a1a26] border border-[#cfc2d2]/40 hover:bg-[#f5f2ff] cursor-pointer'
                      }`}
                    >
                      {slot.time} hs
                    </button>
                  );
                })}

                {/* Opción claramente identificada: Personalizado */}
                <button
                  type="button"
                  onClick={() => setIsCustomTime(true)}
                  className={`py-2.5 px-2 rounded-xl text-center font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    isCustomTime
                      ? 'bg-[#2e004e] text-white shadow-xs ring-2 ring-[#2e004e]/20'
                      : 'bg-white text-[#4b0878] border border-dashed border-[#4b0878]/60 hover:bg-[#f5f2ff]'
                  }`}
                  title="Elegir hora y minutos específicos (ej: 9:15 AM, 4:20 PM)"
                >
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  <span>Personalizado</span>
                </button>
              </div>

              {timeSlots.length === 0 && !isCustomTime && (
                <div className="p-3 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-xs text-[#7e7482] text-center">
                  No hay intervalos automáticos disponibles para este día según el horario de atención. Puedes pulsar en <strong>Personalizado</strong> para seleccionar una hora exacta.
                </div>
              )}

              {/* Panel de Horario Personalizado con los 3 selectores */}
              {isCustomTime && (
                <div className="p-4 bg-gradient-to-br from-[#fcf8ff] to-[#f5f2ff] rounded-2xl border border-[#4b0878]/30 space-y-3 animate-in fade-in duration-150 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-extrabold text-xs text-[#2e004e] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#4b0878]">edit_calendar</span>
                        <span>Horario personalizado para la cita:</span>
                      </h5>
                      <p className="text-[11px] text-[#7e7482]">
                        Selecciona la hora, los minutos exactos (00 a 59) y el período AM/PM.
                      </p>
                    </div>

                    <div className="bg-white px-2.5 py-1 rounded-xl border border-[#cfc2d2]/60 shadow-2xs font-mono font-black text-xs text-[#2e004e]">
                      {customValidation.formattedTime12}
                    </div>
                  </div>

                  <TimeSelectPicker
                    value={customTimeVal}
                    onChange={(val12) => setCustomTimeVal(val12)}
                  />

                  {/* Feedback de validación en tiempo real contra horarios de negocio y superposiciones */}
                  {!customValidation.isValid ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-start gap-2 leading-relaxed">
                      <span className="material-symbols-outlined text-base text-rose-600 shrink-0 mt-0.5">warning</span>
                      <div>
                        <strong className="block font-bold text-rose-900">Horario no disponible:</strong>
                        <span>{customValidation.reason}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-emerald-600 shrink-0">check_circle</span>
                      <span>Horario válido: dentro de la jornada de atención del salón y con cupo disponible.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Datos del tutor y de la mascota (Unificados con el enlace público) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <h4 className="font-extrabold text-sm text-[#1a1a26]">
                  Datos del tutor y de la mascota
                </h4>
              </div>

              {/* Nombre y teléfono del tutor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Nombre del tutor *
                  </label>
                  <input
                    type="text"
                    required
                    value={tutorName}
                    onChange={(e) => setTutorName(e.target.value)}
                    placeholder="Ej: Ana Gómez"
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
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
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>

              {/* Nombre de la mascota y Raza */}
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
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
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
                    placeholder="Ej: Caniche / Golden / Mestizo"
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>

              {/* Requirement #2: Tamaño de la mascota (Pequeño, Mediano, Grande) */}
              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  Tamaño de la mascota *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pequeno', label: 'Pequeño' },
                    { id: 'mediano', label: 'Mediano' },
                    { id: 'grande', label: 'Grande' }
                  ].map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setSelectedDogSize(sz.id as 'pequeno' | 'mediano' | 'grande')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedDogSize === sz.id
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-gray-50'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edad, Sexo y Peso aproximado (Requirement #1 y #2) */}
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
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Sexo
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Macho' | 'Hembra')}
                    className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e] cursor-pointer"
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
                      className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-[#7e7482] font-bold">
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirement #4: Fotografía de la mascota */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#cfc2d2]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#2e004e]">photo_camera</span>
                    <span>Fotografía de la mascota (Perfil / Identificación)</span>
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
                  Toma una foto con la cámara o selecciona una imagen desde la galería. Quedará guardada de forma persistente en la ficha de Clientes.
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
                    {/* Tomar foto con cámara */}
                    <label className="flex-1 py-2.5 px-3 bg-[#fcf8ff] hover:bg-[#f5f2ff] border border-dashed border-[#cfc2d2] hover:border-[#2e004e] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#2e004e] cursor-pointer transition-all active:scale-98">
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
                    <label className="flex-1 py-2.5 px-3 bg-[#fcf8ff] hover:bg-[#f5f2ff] border border-dashed border-[#cfc2d2] hover:border-[#2e004e] rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-[#4c4451] cursor-pointer transition-all active:scale-98">
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

              {/* Requirement #3: Exactamente 3 opciones de Comportamiento Habitual */}
              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  Comportamiento habitual en la peluquería *
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

              {/* Requirement #1: Salud, alergias y observaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Salud, alergias o piel sensible (opcional)
                  </label>
                  <input
                    type="text"
                    value={healthNotes}
                    onChange={(e) => setHealthNotes(e.target.value)}
                    placeholder="Ej: Champú hipoalergénico / piel sensible"
                    className="w-full bg-white text-xs px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
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
                    placeholder="Ej: Cuidado con pata trasera / secador suave"
                    className="w-full bg-white text-xs px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                  />
                </div>
              </div>
            </div>

            {/* 5. Medicamentos adicionales (ONLY if configured by the salon) */}
            {availableMedications.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#cfc2d2]/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-[#2e004e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">medication</span>
                    <span>Medicamentos o productos adicionales durante el turno</span>
                  </h4>
                </div>

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
            <div className="pt-3 border-t border-[#cfc2d2]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-[#7e7482] block font-semibold">Total a abonar en el salón:</span>
                <strong className="text-xl font-black text-[#2e004e]">
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
                <span>{isSubmitting ? 'Agendando turno...' : 'Confirmar Cita'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
