import React, { useState, useMemo } from 'react';
import { Appointment, SalonConfig, ClientReview, Pet } from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { formatDateSpanish } from '../utils/storage';

interface NewAppointmentViewProps {
  onClose: () => void;
  onAppointmentCreated: (newApt: Appointment, newPetData?: Partial<Pet>) => void;
  salonName?: string;
  salonAddress?: string;
  salonPhone?: string;
  simultaneousCapacity?: number;
  existingAppointments?: Appointment[];
  isOnlineClientPortal?: boolean;
  salonConfig?: SalonConfig;
  onAddReview?: (review: ClientReview) => void;
}

export const NewAppointmentView: React.FC<NewAppointmentViewProps> = ({
  onClose,
  onAppointmentCreated,
  salonName = 'Peluquería Canina Luna',
  salonAddress = 'Av. Corrientes 4520, Almagro, CABA',
  salonPhone = '+54 9 11 5566-7788',
  simultaneousCapacity = 2,
  existingAppointments = [],
  isOnlineClientPortal = false,
  salonConfig,
  onAddReview
}) => {
  const currency = salonConfig?.currency || 'ARS';
  const logoUrl = salonConfig?.logoUrl || HOTLINK_IMAGES.logo;

  // Real configured services
  const services = useMemo(() => {
    const list = salonConfig?.services?.filter((s) => s.active) || [];
    if (list.length > 0) return list;
    return salonConfig?.services || [];
  }, [salonConfig]);

  // Step 1: Services
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    services[0]?.id || ''
  );
  const [selectedDogSize, setSelectedDogSize] = useState<'pequeno' | 'mediano' | 'grande' | 'extraGrande'>('mediano');

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
  const [medicationInstructions, setMedicationInstructions] = useState('');

  const selectedMedicationsList = useMemo(() => {
    return availableMedications.filter((m) => selectedMedicationIds.includes(m.id));
  }, [availableMedications, selectedMedicationIds]);

  const totalMedicationCost = useMemo(() => {
    return selectedMedicationsList.reduce((acc, m) => acc + (m.price || 0), 0);
  }, [selectedMedicationsList]);

  const totalPrice = serviceBasePrice + totalMedicationCost;

  // Step 2: Calendar & Date (ALWAYS begins from current real date)
  const today = useMemo(() => new Date(), []);

  // Map JS getDay() (0: Sunday, 1: Monday, ...) to ActiveDays letter
  const dayIndexToLetter = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const activeDayLetters = salonConfig?.activeDays || ['L', 'M', 'X', 'J', 'V', 'S'];

  // Generate 21 upcoming days starting strictly from today
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

  // Default to first working day from today
  const defaultSelectedDate = useMemo(() => {
    const firstWorking = availableDates.find((d) => d.isWorkingDay);
    return firstWorking ? firstWorking.formatted : availableDates[0]?.formatted || formatDateSpanish(today);
  }, [availableDates, today]);

  const [selectedDate, setSelectedDate] = useState<string>(defaultSelectedDate);

  // Step 3: Dynamic Time Slot Generation respecting business hours, duration & capacity
  const timeSlots = useMemo(() => {
    const morningOpen = salonConfig?.morningOpen || '08:00';
    const morningClose = salonConfig?.morningClose || '12:30';
    const hasDoubleShift = salonConfig?.hasDoubleShift ?? true;
    const afternoonOpen = salonConfig?.afternoonOpen || '14:00';
    const afternoonClose = salonConfig?.afternoonClose || '19:30';

    // Parse HH:mm to minutes
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

    // Morning shift slots
    const mStart = parseMins(morningOpen);
    const mEnd = parseMins(morningClose);
    const step = 60; // slot intervals

    for (let current = mStart; current + duration <= mEnd; current += step) {
      const timeStr = formatMins(current);
      // Count existing bookings for this date and time
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

  // Select first available time slot
  const [selectedTime, setSelectedTime] = useState<string>('');

  React.useEffect(() => {
    const firstAvail = timeSlots.find((s) => s.available);
    if (firstAvail) {
      setSelectedTime(firstAvail.time);
    } else if (timeSlots[0]) {
      setSelectedTime(timeSlots[0].time);
    }
  }, [timeSlots, selectedDate]);

  // Step 4: Tutor & Pet Info (Removed "Tipo de manto", kept "Raza", real Behavior options)
  const [tutorName, setTutorName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [petName, setPetName] = useState('');
  const [breed, setBreed] = useState('');
  const [behavior, setBehavior] = useState<'tranquilo' | 'inquieto' | 'dificil' | 'sensible'>('tranquilo');
  const [healthNotes, setHealthNotes] = useState('');
  const [handlingNotes, setHandlingNotes] = useState('');

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  // Review state
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isReviewSubmitted, setIsReviewSubmitted] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeService) {
      setFormError('Por favor selecciona un servicio.');
      return;
    }
    if (!selectedTime) {
      setFormError('Por favor selecciona un horario disponible.');
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

    const newAptId = 'apt-' + Date.now();
    const newPetId = `#PET-${Math.floor(1000 + Math.random() * 9000)}`;

    const newApt: Appointment = {
      id: newAptId,
      petId: newPetId,
      petName: petName.trim(),
      breed: breed.trim(),
      tutorName: tutorName.trim(),
      tutorPhone: whatsappPhone.trim(),
      serviceName: activeService.name,
      time: selectedTime,
      date: selectedDate,
      status: 'confirmada',
      statusLabel: 'CONFIRMADA',
      groomer: 'Estilista de turno',
      price: totalPrice,
      currency,
      paymentStatus: 'por_cobrar',
      paymentStatusLabel: 'Por cobrar',
      subStatus: 'Reserva online',
      subStatusType: 'tag',
      hasMedication: selectedMedicationIds.length > 0,
      notes: `${healthNotes ? 'Salud: ' + healthNotes + '. ' : ''}${handlingNotes ? 'Manejo: ' + handlingNotes : ''}`.trim() || undefined
    };

    const newPetData: Partial<Pet> = {
      id: newPetId,
      name: petName.trim(),
      breed: breed.trim(),
      age: 'Adulto',
      gender: 'Macho',
      weightKg: selectedDogSize === 'pequeno' ? 6 : selectedDogSize === 'mediano' ? 14 : selectedDogSize === 'grande' ? 24 : 34,
      isVip: false,
      photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
      tutor: {
        name: tutorName.trim(),
        phone: whatsappPhone.trim(),
        rawPhone: whatsappPhone.replace(/\D/g, '')
      },
      habitualMood: behavior === 'sensible' ? 'inquieto' : behavior,
      healthAllergies: healthNotes.trim() || 'Sin alergias conocidas.',
      handlingObservations: handlingNotes.trim() || 'Manejo habitual sin restricciones.',
      recommendedIntervalWeeks: 6
    };

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setCreatedAppointment(newApt);
      onAppointmentCreated(newApt, newPetData);
    }, 600);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddReview && createdAppointment) {
      const review: ClientReview = {
        id: 'rev-' + Date.now(),
        clientName: tutorName || 'Cliente Online',
        petName: petName || 'Mascota',
        serviceName: activeService?.name || 'Servicio de Peluquería',
        stars: reviewRating,
        comment: reviewComment.trim() || 'Excelente servicio y puntualidad.',
        date: formatDateSpanish(today),
        verified: true
      };
      onAddReview(review);
      setIsReviewSubmitted(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col my-auto max-h-[95vh]">
        {/* Header with Business Identity */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              <img
                src={logoUrl}
                alt={salonName}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-base leading-tight text-white truncate">
                {salonName}
              </h3>
              <p className="text-xs text-[#f2daff] truncate">{salonAddress}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 text-white/90 hover:text-white cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {isSuccess && createdAppointment ? (
            /* Success confirmation screen */
            <div className="text-center py-6 space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-3xl shadow-sm">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-[#1a1a26]">
                  ¡Cita reservada con éxito!
                </h3>
                <p className="text-xs text-[#7e7482] mt-1">
                  Hemos registrado el turno en la agenda de {salonName}.
                </p>
              </div>

              {/* Booking Summary Card */}
              <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 text-left space-y-2 text-xs max-w-md mx-auto shadow-xs">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[#7e7482]">Mascota:</span>
                  <strong className="text-[#1a1a26]">{createdAppointment.petName} ({createdAppointment.breed})</strong>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[#7e7482]">Tutor:</span>
                  <strong className="text-[#1a1a26]">{createdAppointment.tutorName}</strong>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[#7e7482]">Servicio:</span>
                  <strong className="text-[#2e004e]">{createdAppointment.serviceName}</strong>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-[#7e7482]">Fecha y horario:</span>
                  <strong className="text-[#1a1a26]">{createdAppointment.date} a las {createdAppointment.time} hs</strong>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-[#7e7482] font-bold">Total a abonar:</span>
                  <strong className="text-[#2e004e] text-sm font-black">
                    ${createdAppointment.price.toLocaleString()} {createdAppointment.currency}
                  </strong>
                </div>
              </div>

              {/* Review section if applicable */}
              {!isReviewSubmitted ? (
                <form onSubmit={handleReviewSubmit} className="bg-[#f5f2ff] rounded-2xl p-4 border border-[#cfc2d2]/40 max-w-md mx-auto space-y-3 text-left">
                  <h4 className="text-xs font-bold text-[#2e004e]">
                    ¿Cómo fue tu experiencia agendando?
                  </h4>
                  <div className="flex items-center gap-1 text-[#f9b900] text-xl cursor-pointer">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="hover:scale-110 transition-transform"
                      >
                        {star <= reviewRating ? '★' : '☆'}
                      </span>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Deja un comentario para el salón (opcional)..."
                    className="w-full bg-white text-xs p-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />
                  <button
                    type="submit"
                    className="py-2 px-4 rounded-xl bg-[#2e004e] text-white text-xs font-bold cursor-pointer"
                  >
                    Enviar valoración
                  </button>
                </form>
              ) : (
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 p-3 rounded-xl max-w-md mx-auto">
                  ✓ ¡Gracias por tu valoración!
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-6 rounded-2xl bg-[#2e004e] text-white font-bold text-sm shadow-md hover:bg-[#4b0878] active:scale-95 transition-all cursor-pointer"
              >
                Cerrar y ver agenda
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                  {formError}
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
                                ${svc.price.toLocaleString()} {currency}
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
                                : 'bg-white text-[#4c4451] border border-[#cfc2d2]/30'
                            }`}
                          >
                            <span className="block text-[11px]">{labels[sz]}</span>
                            <span className="block text-[10px] opacity-90 mt-0.5">
                              ${priceForSize.toLocaleString()} {currency}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Selecciona la fecha (Starts strictly from today, respects working days) */}
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

              {/* 3. Selecciona el horario disponible (NO internal capacity counters shown to customer) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h4 className="font-extrabold text-sm text-[#1a1a26]">
                    Horarios disponibles ({selectedDate})
                  </h4>
                </div>

                {timeSlots.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-xs text-[#7e7482] text-center">
                    No hay turnos disponibles para este día según el horario de atención.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {timeSlots.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => {
                            if (slot.available) {
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
                  </div>
                )}
              </div>

              {/* 4. Datos del tutor y de la mascota (Removed coat type, kept breed) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center">
                    4
                  </span>
                  <h4 className="font-extrabold text-sm text-[#1a1a26]">
                    Datos del tutor y de la mascota
                  </h4>
                </div>

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
                      placeholder="Ej: Golden Retriever / Mestizo"
                      className="w-full bg-white text-xs font-semibold px-3 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:border-[#2e004e]"
                    />
                  </div>
                </div>

                {/* Comportamiento */}
                <div>
                  <label className="text-xs font-bold text-[#4c4451] block mb-1">
                    Comportamiento habitual en la peluquería
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'tranquilo', label: '🟢 Tranquilo' },
                      { id: 'inquieto', label: '🟡 Inquieto' },
                      { id: 'dificil', label: '🔴 Difícil' },
                      { id: 'sensible', label: '🟣 Sensible' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setBehavior(m.id as any)}
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
                      Salud, alergias o piel sensible (opcional)
                    </label>
                    <input
                      type="text"
                      value={healthNotes}
                      onChange={(e) => setHealthNotes(e.target.value)}
                      placeholder="Ej: Piel sensible, usar champú hipoalergénico"
                      className="w-full bg-white text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
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
                      placeholder="Ej: Cuidado con pata trasera, secador suave"
                      className="w-full bg-white text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none"
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
                            +${med.price.toLocaleString()} {currency}
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
                  <span>{isSubmitting ? 'Agendando turno...' : 'Confirmar Reserva'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
