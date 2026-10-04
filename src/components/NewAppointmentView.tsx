import React, { useState, useMemo } from 'react';
import { Appointment, SalonConfig, ClientReview } from '../types';

interface NewAppointmentViewProps {
  onClose: () => void;
  onAppointmentCreated: (newApt: Appointment) => void;
  salonName?: string;
  salonAddress?: string;
  salonPhone?: string;
  simultaneousCapacity?: number;
  existingAppointments?: Appointment[];
  isOnlineClientPortal?: boolean;
  salonConfig?: Partial<SalonConfig>;
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
  // Step 1: Services
  const [selectedServiceId, setSelectedServiceId] = useState<string>('bano_corte');

  // Step 2: Calendar & Date
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(9); // 9 = Octubre
  const [currentYear, setCurrentYear] = useState<number>(2024);
  const [selectedDay, setSelectedDay] = useState<number>(15);

  // Step 3: Time
  const [selectedTime, setSelectedTime] = useState<string>('10:00 hs');

  // Step 4: Tutor & Pet Info
  const [tutorName, setTutorName] = useState(isOnlineClientPortal ? '' : 'Ana Gómez');
  const [whatsappPhone, setWhatsappPhone] = useState(isOnlineClientPortal ? '' : '+54 9 11 4455-6677');
  const [petName, setPetName] = useState(isOnlineClientPortal ? '' : 'Toby');
  const [breedSize, setBreedSize] = useState(isOnlineClientPortal ? '' : 'Golden Retriever - Grande');
  const [behavior, setBehavior] = useState<'tranquilo' | 'inquieto' | 'dificil'>('inquieto');
  const [healthNotes, setHealthNotes] = useState(isOnlineClientPortal ? '' : 'Ninguna alergia conocida');
  const [handlingNotes, setHandlingNotes] = useState(isOnlineClientPortal ? '' : 'Sensible al secador en la cabeza');

  // Add-on: Medication & Dog Size Pricing
  const [selectedDogSize, setSelectedDogSize] = useState<'pequeno' | 'mediano' | 'grande' | 'extraGrande'>('mediano');
  const [selectedMedicationIds, setSelectedMedicationIds] = useState<string[]>([]);
  const [medicationInstructions, setMedicationInstructions] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  // Rating & Review state for customer
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isReviewSubmitted, setIsReviewSubmitted] = useState<boolean>(false);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const services = useMemo(() => {
    return (
      salonConfig?.services || [
        {
          id: 's-1',
          name: 'Baño + corte',
          badge: 'Popular',
          desc: 'Corte higiénico, estética de raza y spa',
          price: 25000,
          durationMin: 90,
          pricingType: 'tamano',
          priceBySize: {
            pequeno: 20000,
            mediano: 25000,
            grande: 30000,
            extraGrande: 35000
          },
          icon: 'content_cut',
          active: true,
          rating: 5.0,
          reviewCount: 64
        },
        {
          id: 's-2',
          name: 'Baño completo',
          desc: 'Higiene profunda, secado y perfume',
          price: 18000,
          durationMin: 45,
          pricingType: 'unico',
          icon: 'bathtub',
          active: true,
          rating: 4.9,
          reviewCount: 42
        },
        {
          id: 's-3',
          name: 'Deslanado premium',
          desc: 'Eliminación de manto muerto y cepillado',
          price: 22000,
          durationMin: 75,
          pricingType: 'unico',
          icon: 'pets',
          active: true,
          rating: 4.9,
          reviewCount: 28
        }
      ]
    );
  }, [salonConfig]);

  const activeService = services.find((s) => s.id === selectedServiceId) || services[0];

  // Base service price (accounting for dog size if service has size-based pricing)
  const serviceBasePrice = useMemo(() => {
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

  const selectedMedicationsList = useMemo(() => {
    return availableMedications.filter((m) => selectedMedicationIds.includes(m.id));
  }, [availableMedications, selectedMedicationIds]);

  const totalMedicationCost = useMemo(() => {
    return selectedMedicationsList.reduce((acc, m) => acc + (m.price || 0), 0);
  }, [selectedMedicationsList]);

  const totalPrice = serviceBasePrice + totalMedicationCost;

  // Effective capacity: if allowSimultaneousStaff is disabled, capacity is 1; otherwise configured capacity
  const effectiveCapacity = useMemo(() => {
    if (salonConfig?.allowSimultaneousStaff === false) {
      return 1;
    }
    return salonConfig?.simultaneousCapacity || simultaneousCapacity || 2;
  }, [salonConfig?.allowSimultaneousStaff, salonConfig?.simultaneousCapacity, simultaneousCapacity]);

  // Calendar calculations
  const totalDaysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  }, [currentYear, currentMonthIndex]);

  const firstDayOfWeek = useMemo(() => {
    const raw = new Date(currentYear, currentMonthIndex, 1).getDay();
    return raw === 0 ? 6 : raw - 1; // Mon = 0, Sun = 6
  }, [currentYear, currentMonthIndex]);

  const calendarCells = useMemo(() => {
    const cells: ({ dayNum: number; isClosed: boolean; appointmentCount: number } | null)[] = [];
    
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
      const isSunday = dayOfWeek === 6;
      const appointmentCount = day === 15 ? existingAppointments.length : (day % 3 === 0 ? 2 : 0);
      
      cells.push({
        dayNum: day,
        isClosed: isSunday,
        appointmentCount
      });
    }

    return cells;
  }, [firstDayOfWeek, totalDaysInMonth, existingAppointments]);

  // Slots calculation based on shifts, simultaneous capacity, AND service duration overlap
  const generatedSlots = useMemo(() => {
    const baseSlots = [
      { time: '08:00 hs', shift: 'mañana', hour: 8, minute: 0 },
      { time: '09:00 hs', shift: 'mañana', hour: 9, minute: 0 },
      { time: '10:00 hs', shift: 'mañana', hour: 10, minute: 0 },
      { time: '11:00 hs', shift: 'mañana', hour: 11, minute: 0 },
      { time: '11:30 hs', shift: 'mañana', hour: 11, minute: 30 },
      { time: '14:00 hs', shift: 'tarde', hour: 14, minute: 0 },
      { time: '15:00 hs', shift: 'tarde', hour: 15, minute: 0 },
      { time: '16:00 hs', shift: 'tarde', hour: 16, minute: 0 },
      { time: '17:00 hs', shift: 'tarde', hour: 17, minute: 0 },
      { time: '18:00 hs', shift: 'tarde', hour: 18, minute: 0 },
      { time: '18:30 hs', shift: 'tarde', hour: 18, minute: 30 }
    ];

    const currentDuration = activeService.durationMin || 60;

    return baseSlots.map((slot) => {
      const slotStartMin = slot.hour * 60 + slot.minute;
      const slotEndMin = slotStartMin + currentDuration;

      // Check overlapping appointments across the duration of this slot
      let maxOverlap = 0;

      if (selectedDay === 15) {
        const aptsOnDay = existingAppointments.map((apt) => {
          let h = 9;
          let m = 0;
          const match = apt.time.match(/(\d+):(\d+)/);
          if (match) {
            h = parseInt(match[1], 10);
            m = parseInt(match[2], 10);
            if (apt.time.includes('PM') && h < 12) h += 12;
          }
          const start = h * 60 + m;
          const dur = apt.serviceName.includes('corte') ? 90 : apt.serviceName.includes('Deslanado') ? 75 : 60;
          return { start, end: start + dur };
        });

        // Test checkpoints every 15 minutes within [slotStartMin, slotEndMin)
        for (let t = slotStartMin; t < slotEndMin; t += 15) {
          const concurrent = aptsOnDay.filter((a) => t >= a.start && t < a.end).length;
          if (concurrent > maxOverlap) {
            maxOverlap = concurrent;
          }
        }
      } else if (selectedDay % 2 === 0 && (slot.hour === 9 || slot.hour === 15)) {
        maxOverlap = 1;
      }

      const remainingSpots = Math.max(0, effectiveCapacity - maxOverlap);
      const isAvailable = remainingSpots > 0;

      return {
        ...slot,
        countBooked: maxOverlap,
        remainingSpots,
        available: isAvailable
      };
    });
  }, [selectedDay, effectiveCapacity, existingAppointments, activeService.durationMin]);

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonthIndex(currentMonthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonthIndex(currentMonthIndex + 1);
    }
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorName.trim() || !petName.trim()) {
      alert('Por favor completa el nombre del tutor y de la mascota.');
      return;
    }

    setIsSubmitting(true);

    const hasMedication = selectedMedicationsList.length > 0;

    const newAppointment: Appointment = {
      id: 'apt-' + Date.now(),
      petId: '#PET-' + Math.floor(1000 + Math.random() * 9000),
      petName: petName.trim(),
      breed: breedSize.trim() || 'Mestizo',
      tutorName: tutorName.trim(),
      tutorPhone: whatsappPhone.trim(),
      serviceName: activeService.name,
      time: selectedTime,
      date: `${selectedDay} de ${monthNames[currentMonthIndex]} 2024`,
      status: 'confirmada',
      statusLabel: isOnlineClientPortal ? 'ONLINE' : 'CONFIRMADA',
      groomer: effectiveCapacity > 1 ? 'Equipo de Estilistas' : 'Estilista Principal',
      price: totalPrice,
      currency: 'ARS',
      paymentStatus: 'por_cobrar',
      paymentStatusLabel: 'Por cobrar',
      subStatus: hasMedication ? 'Con medicación' : (isOnlineClientPortal ? 'Reserva desde Redes' : 'Agendado en local'),
      subStatusType: 'tag',
      hasMedication,
      notes: handlingNotes.trim()
    };

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setCreatedAppointment(newAppointment);
      onAppointmentCreated(newAppointment);
    }, 700);
  };

  const handleSubmitCustomerReview = () => {
    if (onAddReview && createdAppointment) {
      const newReview: ClientReview = {
        id: 'rev-' + Date.now(),
        clientName: tutorName.trim() || 'Cliente',
        petName: petName.trim() || 'Mascota',
        serviceName: activeService.name,
        stars: reviewRating,
        comment: reviewComment.trim() || `Excelente atención con ${petName.trim()}`,
        date: `${selectedDay} de ${monthNames[currentMonthIndex]} 2024`,
        verified: true
      };
      onAddReview(newReview);
    }
    setIsReviewSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fcf8ff] flex flex-col animate-in fade-in duration-200">
      {/* Top Header */}
      <header className="bg-[#2e004e] text-white px-4 py-3 sm:px-6 shadow-md shrink-0">
        <div className="max-w-5xl mx-auto space-y-2">
          {/* Row 1: Brand & Online Portal Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Volver"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </button>

              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#2e004e] font-black text-sm shadow-xs shrink-0">
                <span>LUNA</span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-base text-white leading-tight">
                    {salonName}
                  </h1>
                  {isOnlineClientPortal && (
                    <span className="px-2 py-0.5 rounded-full bg-[#f9b900] text-[#261900] text-[10px] font-black tracking-wide uppercase shadow-xs">
                      PORTAL DE RESERVAS ONLINE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#f2daff]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Turnos disponibles en tiempo real</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs">
                <span className="text-[#f9b900]">★</span>
                <span>4.9 (120+ reseñas)</span>
              </div>
            </div>
          </div>

          {/* Row 2: Location & WhatsApp */}
          <div className="text-xs text-[#e3e0f1] space-y-1 pt-1.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm text-[#f9b900]">location_on</span>
              <span className="truncate">{salonAddress}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-400">chat</span>
              <span>WhatsApp: <strong className="text-white">{salonPhone}</strong></span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* SUCCESS & RATING SCREEN (If appointment was confirmed) */}
        {isSuccess ? (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-[#cfc2d2]/40 max-w-2xl mx-auto my-6 space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-[#f2daff] text-[#2e004e] flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                ¡Turno Confirmado con Éxito!
              </span>
              <h2 className="text-2xl font-black text-[#1a1a26] mt-2">
                ¡Gracias {tutorName}, te esperamos con {petName}!
              </h2>
              <p className="text-xs sm:text-sm text-[#4c4451] mt-1">
                La cita ha quedado registrada en la agenda de <strong>{salonName}</strong>.
              </p>
            </div>

            {/* Appointment Ticket Details */}
            <div className="bg-[#f5f2ff] rounded-2xl p-4 text-left border border-[#cfc2d2]/40 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#cfc2d2]/30">
                <span className="font-bold text-[#7e7482]">Servicio:</span>
                <span className="font-black text-[#1a1a26] text-sm">{activeService.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#7e7482]">Fecha y Hora:</span>
                <span className="font-bold text-[#2e004e]">
                  {selectedDay} de {monthNames[currentMonthIndex]} a las {selectedTime}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#7e7482]">Mascota:</span>
                <span className="font-semibold text-[#1a1a26]">{petName} ({breedSize})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#7e7482]">Total a abonar:</span>
                <span className="font-black text-[#2e004e] text-base">${totalPrice.toLocaleString()} ARS</span>
              </div>
            </div>

            {/* CUSTOMER RATING / REVIEW SECTION (Requested by user) */}
            <div className="bg-gradient-to-br from-[#fcf8ff] to-[#f5f2ff] rounded-2xl p-5 border border-[#4b0878]/20 space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#7a5900] block">
                  OPINIÓN Y CALIFICACIÓN DEL CLIENTE
                </span>
                <h3 className="font-black text-base text-[#1a1a26]">
                  ¿Cómo calificarías este servicio de {activeService.name}?
                </h3>
                <p className="text-xs text-[#7e7482]">
                  Tu opinión nos ayuda a mantener 5 estrellas en Peluquería Canina Luna
                </p>
              </div>

              {!isReviewSubmitted ? (
                <div className="space-y-3">
                  {/* Interactive Star Picker */}
                  <div className="flex items-center justify-center gap-2 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="text-3xl transition-transform hover:scale-125 active:scale-95 cursor-pointer text-[#f9b900]"
                      >
                        {star <= reviewRating ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-[#2e004e] block">
                    {reviewRating === 5 && '⭐⭐⭐⭐⭐ ¡Excelente atención y cuidado!'}
                    {reviewRating === 4 && '⭐⭐⭐⭐ Muy bueno'}
                    {reviewRating === 3 && '⭐⭐⭐ Bueno'}
                    {reviewRating < 3 && 'Aceptable'}
                  </span>

                  {/* Optional Review Comment */}
                  <input
                    type="text"
                    placeholder="Deja un breve comentario sobre la atención o tu mascota..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full bg-white text-xs px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none"
                  />

                  <button
                    type="button"
                    onClick={handleSubmitCustomerReview}
                    className="w-full py-2.5 px-4 bg-[#2e004e] hover:bg-[#4b0878] text-white text-xs font-black rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    Publicar Calificación ({reviewRating} Estrellas)
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>¡Gracias! Tu calificación de {reviewRating} estrellas fue enviada con éxito.</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Volver a la Agenda
              </button>
            </div>
          </div>
        ) : (
          /* BOOKING FORM */
          <form onSubmit={handleConfirm} className="space-y-6">
            {/* Notice of Capacity for Clients & Salon */}
            <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/40 shadow-xs flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f5f2ff] text-[#2e004e] flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-lg">groups</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1a1a26] block">
                    Capacidad de atención: {effectiveCapacity} {effectiveCapacity === 1 ? 'mascota' : 'mascotas'} por turno simultáneo
                  </span>
                  <p className="text-[11px] text-[#7e7482]">
                    {effectiveCapacity > 1
                      ? `Contamos con personal para atender hasta ${effectiveCapacity} turnos a la vez. Cuando se llenen los cupos de una hora, se bloqueará automáticamente.`
                      : 'Atención exclusiva de 1 estilista por turno. Sin superposiciones de turnos.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Step 1: Elegir Servicio (With Star Ratings Display) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-[#1a1a26] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs flex items-center justify-center font-black">
                    1
                  </span>
                  Selecciona el servicio para tu mascota
                </h2>
                <span className="text-xs text-[#7e7482] font-semibold">Paso 1 de 4</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {services.map((svc) => {
                  const isSelected = selectedServiceId === svc.id;

                  return (
                    <div
                      key={svc.id}
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`p-4 rounded-2xl bg-white transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-xs border relative overflow-hidden ${
                        isSelected
                          ? 'border-[#2e004e] ring-2 ring-[#2e004e]/20 shadow-md bg-[#fcf8ff]'
                          : 'border-[#cfc2d2]/40 hover:border-[#4b0878]/50'
                      }`}
                    >
                      {/* Top color indicator */}
                      {isSelected && (
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#f9b900]"></div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-[#2e004e] text-[#f9b900]'
                                : 'bg-[#f5f2ff] text-[#4b0878]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-xl">{svc.icon || 'pets'}</span>
                          </div>
                          {svc.badge && (
                            <span className="bg-[#f9b900] text-[#261900] text-[10px] font-black px-2 py-0.5 rounded-full">
                              {svc.badge}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-extrabold text-sm text-[#1a1a26]">{svc.name}</h3>
                          </div>
                          {/* Star Rating Display requested by user */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[#f9b900] text-xs">★</span>
                            <span className="text-[11px] font-black text-[#1a1a26]">
                              {svc.rating || 5.0}
                            </span>
                            <span className="text-[10px] text-[#7e7482]">
                              ({svc.reviewCount || 48} reseñas)
                            </span>
                          </div>
                          <p className="text-xs text-[#7e7482] mt-1 leading-snug">{svc.desc || 'Higiene profesional y spa canino'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#f5f2ff]">
                        <span className="font-black text-sm text-[#2e004e]">
                          ${svc.price.toLocaleString()} ARS
                        </span>
                        <span className="text-[11px] text-[#7e7482] font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">schedule</span>
                          {svc.durationMin} min
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dog Size Pricing Selector (when service supports pricing by size) */}
              {activeService.pricingType === 'tamano' && activeService.priceBySize && (
                <div className="bg-[#fcf8ff] rounded-2xl p-4 border border-[#cfc2d2]/40 space-y-2.5 mt-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#4b0878]">straighten</span>
                      <span>Selecciona el tamaño de tu perro para calcular el precio exacto:</span>
                    </span>
                    <span className="text-xs font-black text-[#2e004e] bg-[#f2daff] px-2.5 py-1 rounded-full">
                      ${serviceBasePrice.toLocaleString()} ARS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'pequeno', label: 'Pequeño', desc: 'Hasta 10 kg', price: activeService.priceBySize.pequeno },
                      { key: 'mediano', label: 'Mediano', desc: '10 a 25 kg', price: activeService.priceBySize.mediano },
                      { key: 'grande', label: 'Grande', desc: '25 a 40 kg', price: activeService.priceBySize.grande },
                      { key: 'extraGrande', label: 'Extra grande', desc: '+40 kg', price: activeService.priceBySize.extraGrande }
                    ].map((size) => (
                      <button
                        key={size.key}
                        type="button"
                        onClick={() => setSelectedDogSize(size.key as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedDogSize === size.key
                            ? 'bg-[#2e004e] text-white border-[#2e004e] shadow-xs'
                            : 'bg-white hover:bg-[#f5f2ff] text-[#1a1a26] border-[#cfc2d2]/40'
                        }`}
                      >
                        <span className="text-xs font-bold block">{size.label}</span>
                        <span className={`text-[10px] block ${selectedDogSize === size.key ? 'text-[#f9b900]' : 'text-[#7e7482]'}`}>
                          {size.desc}
                        </span>
                        <span className="text-xs font-black block mt-1">
                          ${size.price.toLocaleString()} ARS
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Step 2: Calendario Completo Interactivo con Días y Horarios */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-[#1a1a26] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs flex items-center justify-center font-black">
                    2
                  </span>
                  Elige el día y horario en el calendario
                </h2>
                <div className="flex items-center gap-2 text-xs font-bold text-[#4b0878]">
                  <span className="material-symbols-outlined text-base">calendar_month</span>
                  <span>{monthNames[currentMonthIndex]} {currentYear}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Interactive Calendar Month Grid */}
                <div className="lg:col-span-6 bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-[#cfc2d2]/40 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#efecfd]">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#f5f2ff] text-[#2e004e] font-bold border border-[#cfc2d2]/30 active:scale-95 transition-all cursor-pointer"
                      title="Mes anterior"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <div className="text-center">
                      <h3 className="font-extrabold text-base text-[#1a1a26]">
                        {monthNames[currentMonthIndex]} {currentYear}
                      </h3>
                      <span className="text-[11px] text-[#7e7482] block">
                        Días con disponibilidad abierta
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#f5f2ff] text-[#2e004e] font-bold border border-[#cfc2d2]/30 active:scale-95 transition-all cursor-pointer"
                      title="Mes siguiente"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dHead) => (
                      <span
                        key={dHead}
                        className="text-[10px] font-bold text-[#7e7482] uppercase py-1"
                      >
                        {dHead}
                      </span>
                    ))}

                    {/* Day Cells */}
                    {calendarCells.map((cell, idx) => {
                      if (!cell) {
                        return <div key={'empty-' + idx} className="h-10"></div>;
                      }

                      const isSelected = selectedDay === cell.dayNum;
                      const isClosed = cell.isClosed;

                      if (isClosed) {
                        return (
                          <div
                            key={'day-' + cell.dayNum}
                            className="h-10 rounded-xl flex flex-col items-center justify-center text-xs text-[#7e7482]/40 bg-[#f5f2ff]/30 cursor-not-allowed select-none"
                            title="Domingo cerrado"
                          >
                            <span className="text-[11px] font-medium">{cell.dayNum}</span>
                            <span className="text-[8px] uppercase tracking-tighter">Cerrado</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={'day-' + cell.dayNum}
                          type="button"
                          onClick={() => setSelectedDay(cell.dayNum)}
                          className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                            isSelected
                              ? 'bg-[#2e004e] text-white shadow-md font-black scale-105'
                              : 'hover:bg-[#f5f2ff] text-[#1a1a26] border border-[#cfc2d2]/20'
                          }`}
                        >
                          <span className="leading-none">{cell.dayNum}</span>
                          {cell.appointmentCount > 0 && !isSelected && (
                            <div className="flex gap-0.5 mt-1">
                              <span className="w-1 h-1 rounded-full bg-[#f9b900]"></span>
                              {cell.appointmentCount > 2 && (
                                <span className="w-1 h-1 rounded-full bg-[#4b0878]"></span>
                              )}
                            </div>
                          )}
                          {isSelected && (
                            <span className="w-1 h-1 rounded-full bg-[#f9b900] mt-0.5"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-[#efecfd] flex items-center justify-between text-[11px] text-[#7e7482]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#2e004e]"></span>
                      <span>Seleccionado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#f9b900]"></span>
                      <span>Con turnos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#cfc2d2]/40"></span>
                      <span>Cerrado</span>
                    </div>
                  </div>
                </div>

                {/* Time Slot Picker */}
                <div className="lg:col-span-6 bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-[#cfc2d2]/40 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#1a1a26]">
                          Horarios para el {selectedDay} de {monthNames[currentMonthIndex]}
                        </h3>
                        <p className="text-[11px] text-[#7e7482]">
                          Servicio: {activeService.name} ({activeService.durationMin} min)
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-[#4b0878] bg-[#f2daff] px-2 py-0.5 rounded-full">
                        {effectiveCapacity} {effectiveCapacity === 1 ? 'puesto' : 'puestos'}
                      </span>
                    </div>

                    <div className="space-y-3 mt-3">
                      {/* Turno Mañana */}
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#7a5900] flex items-center gap-1 mb-1.5">
                          <span>☀️</span> Turno Mañana (08:00 a 12:30)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {generatedSlots
                            .filter((s) => s.shift === 'mañana')
                            .map((slot, idx) => {
                              const isSelected = selectedTime === slot.time;

                              if (!slot.available) {
                                return (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-xl bg-[#f5f2ff]/60 border border-[#cfc2d2]/30 text-center cursor-not-allowed select-none opacity-60 flex flex-col items-center justify-center"
                                    title="Horario sin cupos disponibles"
                                  >
                                    <span className="text-xs font-bold line-through text-[#7e7482]">
                                      {slot.time}
                                    </span>
                                    <span className="text-[9px] font-bold text-[#ba1a1a]">
                                      Ocupado
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTime(slot.time)}
                                  className={`p-2.5 rounded-xl text-xs transition-all cursor-pointer flex flex-col items-center justify-center border ${
                                    isSelected
                                      ? 'bg-[#2e004e] text-white shadow-sm border-[#2e004e] font-black'
                                      : 'bg-[#fcf8ff] hover:bg-[#f5f2ff] text-[#1a1a26] border-[#cfc2d2]/40'
                                  }`}
                                >
                                  <span className="font-extrabold">{slot.time}</span>
                                  <span
                                    className={`text-[9px] font-bold mt-0.5 ${
                                      isSelected
                                        ? 'text-[#f9b900]'
                                        : slot.remainingSpots === 1
                                        ? 'text-[#7a5900]'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {effectiveCapacity > 1
                                      ? `${slot.remainingSpots} de ${effectiveCapacity} cupos`
                                      : 'Disponible'}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>

                      {/* Turno Tarde */}
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#4b0878] flex items-center gap-1 mb-1.5">
                          <span>🌙</span> Turno Tarde (14:00 a 19:30)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {generatedSlots
                            .filter((s) => s.shift === 'tarde')
                            .map((slot, idx) => {
                              const isSelected = selectedTime === slot.time;

                              if (!slot.available) {
                                return (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-xl bg-[#f5f2ff]/60 border border-[#cfc2d2]/30 text-center cursor-not-allowed select-none opacity-60 flex flex-col items-center justify-center"
                                    title="Horario sin cupos disponibles"
                                  >
                                    <span className="text-xs font-bold line-through text-[#7e7482]">
                                      {slot.time}
                                    </span>
                                    <span className="text-[9px] font-bold text-[#ba1a1a]">
                                      Ocupado
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTime(slot.time)}
                                  className={`p-2.5 rounded-xl text-xs transition-all cursor-pointer flex flex-col items-center justify-center border ${
                                    isSelected
                                      ? 'bg-[#2e004e] text-white shadow-sm border-[#2e004e] font-black'
                                      : 'bg-[#fcf8ff] hover:bg-[#f5f2ff] text-[#1a1a26] border-[#cfc2d2]/40'
                                  }`}
                                >
                                  <span className="font-extrabold">{slot.time}</span>
                                  <span
                                    className={`text-[9px] font-bold mt-0.5 ${
                                      isSelected
                                        ? 'text-[#f9b900]'
                                        : slot.remainingSpots === 1
                                        ? 'text-[#7a5900]'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {effectiveCapacity > 1
                                      ? `${slot.remainingSpots} de ${effectiveCapacity} cupos`
                                      : 'Disponible'}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f5f2ff] p-3 rounded-2xl border border-[#cfc2d2]/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4b0878] text-base">check_circle</span>
                      <span className="text-[#1a1a26] font-bold">
                        Turno elegido: {selectedDay} de {monthNames[currentMonthIndex]} a las {selectedTime}
                      </span>
                    </div>
                    <span className="text-emerald-700 font-black text-[11px]">Disponible</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 3: Datos del Tutor y Mascota */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-[#1a1a26] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2e004e] text-white text-xs flex items-center justify-center font-black">
                    3
                  </span>
                  Datos del tutor y de la mascota
                </h2>
                <span className="text-xs text-[#7e7482] font-semibold">Paso 3 de 4</span>
              </div>

              <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xs border border-[#cfc2d2]/40 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-sm text-[#4b0878]">person</span>
                      Nombre y Apellido del Tutor
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Ana Gómez"
                      value={tutorName}
                      onChange={(e) => setTutorName(e.target.value)}
                      className="w-full bg-[#f5f2ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/30 outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-sm text-emerald-600">call</span>
                      Teléfono WhatsApp para recordatorio
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="+54 9 11 4455-6677"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        className="w-full bg-[#f5f2ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/30 outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e]"
                        required
                      />
                      <span className="material-symbols-outlined absolute right-3 text-emerald-600 text-lg">
                        verified
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-sm text-[#4b0878]">pets</span>
                      Nombre de la mascota
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Toby"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      className="w-full bg-[#f5f2ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/30 outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-sm text-[#4b0878]">badge</span>
                      Raza o tipo de manto
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Golden Retriever / Caniche"
                      value={breedSize}
                      onChange={(e) => setBreedSize(e.target.value)}
                      className="w-full bg-[#f5f2ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/30 outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e]"
                      required
                    />
                  </div>
                </div>

                {/* Comportamiento habitual */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#7a5900]">mood</span>
                      Comportamiento habitual en peluquería
                    </label>
                    <span className="text-[10px] text-[#7e7482]">Selecciona uno</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBehavior('tranquilo')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        behavior === 'tranquilo'
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#efecfd]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Tranquilo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBehavior('inquieto')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        behavior === 'inquieto'
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#efecfd]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#f9b900]"></span>
                      <span>Inquieto</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBehavior('dificil')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        behavior === 'dificil'
                          ? 'bg-[#2e004e] text-white shadow-xs'
                          : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#efecfd]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Difícil / Sensible</span>
                    </button>
                  </div>
                </div>

                {/* Salud y Manejo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-[#ba1a1a] flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-sm">health_and_safety</span>
                      Salud, alergias o piel sensible
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Piel atópica / sensible en lomo"
                      value={healthNotes}
                      onChange={(e) => setHealthNotes(e.target.value)}
                      className="w-full bg-[#f5f2ff] text-[#1a1a26] text-xs px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/30 outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#7a5900] flex items-center gap-1.5 mb-1">
                      <span className="material-symbols-outlined text-sm">info</span>
                      Observaciones de manejo
                    </label>
                    <input
                      type="text"
                      placeholder="ej. No le gusta el secador directo en la cara"
                      value={handlingNotes}
                      onChange={(e) => setHandlingNotes(e.target.value)}
                      className="w-full bg-[#f5f2ff] text-[#1a1a26] text-xs px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/30 outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e]"
                    />
                  </div>
                </div>

                {/* Medicamentos y productos antiparasitarios configurados por el negocio */}
                {availableMedications.length === 0 ? (
                  <div className="bg-[#f5f2ff] rounded-2xl p-4 border border-[#cfc2d2]/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#1a1a26]">
                      <span className="material-symbols-outlined text-sm text-[#4b0878]">medication</span>
                      <span>Medicamentos y productos antiparasitarios</span>
                    </div>
                    <p className="text-xs text-[#7e7482]">
                      Este negocio no ha configurado productos.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#f5f2ff] rounded-2xl p-4 border border-[#cfc2d2]/40 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#cfc2d2]/30">
                      <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#4b0878]">medication</span>
                        <span>Medicamentos y productos antiparasitarios</span>
                      </span>
                      <span className="text-[10px] text-[#7e7482] font-semibold">
                        Selección opcional
                      </span>
                    </div>

                    <div className="space-y-2">
                      {availableMedications.map((prod) => {
                        const isSelected = selectedMedicationIds.includes(prod.id);
                        return (
                          <label
                            key={prod.id}
                            className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-white border-[#2e004e] ring-1 ring-[#2e004e]/20 shadow-xs'
                                : 'bg-white/70 hover:bg-white border-[#cfc2d2]/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMedicationIds([...selectedMedicationIds, prod.id]);
                                  } else {
                                    setSelectedMedicationIds(
                                      selectedMedicationIds.filter((id) => id !== prod.id)
                                    );
                                  }
                                }}
                                className="w-4 h-4 accent-[#2e004e] rounded cursor-pointer shrink-0"
                              />
                              {prod.photoUrl && (
                                <img
                                  src={prod.photoUrl}
                                  alt={prod.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-[#cfc2d2]/30 shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-[#1a1a26] block truncate">
                                  {prod.name}
                                </span>
                                <span className="text-[10px] text-[#7e7482] block truncate">
                                  {prod.type} • {prod.purpose}
                                </span>
                              </div>
                            </div>

                            <span className="text-xs font-black text-[#2e004e] shrink-0">
                              +${prod.price.toLocaleString()} ARS
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {selectedMedicationIds.length > 0 && (
                      <div className="pt-2 border-t border-[#cfc2d2]/30 space-y-1">
                        <span className="text-[11px] font-semibold text-[#4c4451] block">
                          Instrucciones u observaciones de dosificación:
                        </span>
                        <input
                          type="text"
                          value={medicationInstructions}
                          onChange={(e) => setMedicationInstructions(e.target.value)}
                          placeholder="ej. Aplicar pipeta tras el secado completo"
                          className="w-full bg-white text-[#1a1a26] text-xs px-3 py-2 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#2e004e]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Step 4: RESUMEN Y BOTÓN CONFIRMAR EN EL FLUJO NORMAL */}
            <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#efecfd]">
                <div>
                  <span className="text-[10px] font-black text-[#7a5900] uppercase tracking-wider block">
                    PASO FINAL
                  </span>
                  <h3 className="text-base font-black text-[#1a1a26]">
                    Resumen de la cita y confirmación
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#7e7482] block">Total estimado</span>
                  <span className="text-xl font-black text-[#2e004e]">
                    ${totalPrice.toLocaleString()} ARS
                  </span>
                </div>
              </div>

              {/* Breakdown cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-[#f5f2ff] p-3 rounded-2xl border border-[#cfc2d2]/30">
                  <span className="text-[10px] font-bold text-[#7e7482] uppercase block">Servicio</span>
                  <span className="font-extrabold text-[#1a1a26] block mt-0.5">{activeService.name}</span>
                  <span className="text-[11px] text-[#7e7482]">
                    ${serviceBasePrice.toLocaleString()} ARS • {activeService.durationMin} min
                    {activeService.pricingType === 'tamano' && ` (${selectedDogSize})`}
                  </span>
                </div>

                <div className="bg-[#f5f2ff] p-3 rounded-2xl border border-[#cfc2d2]/30">
                  <span className="text-[10px] font-bold text-[#7e7482] uppercase block">Productos</span>
                  <span className="font-extrabold text-[#1a1a26] block mt-0.5">
                    {selectedMedicationsList.length > 0
                      ? selectedMedicationsList.map((m) => m.name).join(', ')
                      : 'Ninguno'}
                  </span>
                  <span className="text-[11px] text-[#7e7482]">
                    {selectedMedicationsList.length > 0
                      ? `+$${totalMedicationCost.toLocaleString()} ARS`
                      : 'Sin cargo adicional'}
                  </span>
                </div>

                <div className="bg-[#f5f2ff] p-3 rounded-2xl border border-[#cfc2d2]/30">
                  <span className="text-[10px] font-bold text-[#7e7482] uppercase block">Día y Horario</span>
                  <span className="font-extrabold text-[#2e004e] block mt-0.5">
                    {selectedDay} de {monthNames[currentMonthIndex]}
                  </span>
                  <span className="text-[11px] text-[#7e7482] font-semibold">{selectedTime}</span>
                </div>

                <div className="bg-[#f5f2ff] p-3 rounded-2xl border border-[#cfc2d2]/30">
                  <span className="text-[10px] font-bold text-[#7e7482] uppercase block">Mascota & Tutor</span>
                  <span className="font-extrabold text-[#1a1a26] block mt-0.5">
                    {petName || 'Mascota'}
                  </span>
                  <span className="text-[11px] text-[#7e7482] truncate block">{tutorName || 'Tutor'}</span>
                </div>
              </div>

              {/* Big Primary Confirm CTA Button */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-2xl font-black text-base shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900]"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                      <span>Procesando reserva...</span>
                    </>
                  ) : (
                    <>
                      <span>{isOnlineClientPortal ? 'Confirmar mi turno online' : 'Confirmar cita'}</span>
                      <span className="material-symbols-outlined text-xl font-black">arrow_forward</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-[#7e7482] text-center">
                  <span className="material-symbols-outlined text-sm text-emerald-600">verified_user</span>
                  <span>Confirmación directa e instantánea sin costo extra en {salonName}</span>
                </div>
              </div>
            </section>
          </form>
        )}
      </div>
    </div>
  );
};
