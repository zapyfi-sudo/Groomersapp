import React, { useState } from 'react';
import { Appointment, Pet } from '../types';
import { NewAppointmentView } from './NewAppointmentView';
import { ShareLinkModal } from './ShareLinkModal';

interface AgendaViewProps {
  appointments: Appointment[];
  pets: Pet[];
  onSelectPet: (pet: Pet) => void;
  onNavigateToRetention: () => void;
  onAddNewAppointment: (newApt: Appointment) => void;
  salonName?: string;
  salonAddress?: string;
  salonPhone?: string;
  bookingSlug?: string;
  simultaneousCapacity?: number;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  appointments,
  pets,
  onSelectPet,
  onNavigateToRetention,
  onAddNewAppointment,
  salonName = 'Peluquería Canina Luna',
  salonAddress = 'Av. Corrientes 4520, Almagro, CABA',
  salonPhone = '+54 9 11 5566-7788',
  bookingSlug = 'agendacan.app/peluquerialuna',
  simultaneousCapacity = 2
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNewAptModalOpen, setIsNewAptModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isOnlineClientPortalActive, setIsOnlineClientPortalActive] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'en_salon' | 'confirmada' | 'completado'>('todos');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(15);

  const totalAppointments = appointments.length;
  const inSalonCount = appointments.filter(
    (a) => a.status === 'en_salon' || a.status === 'en_corte'
  ).length;
  const pickupCount = appointments.filter((a) => a.status === 'completado').length;

  const filteredAppointments = appointments.filter((apt) => {
    if (filterStatus === 'en_salon') {
      return apt.status === 'en_salon' || apt.status === 'en_corte';
    }
    if (filterStatus === 'confirmada') {
      return apt.status === 'confirmada' || apt.status === 'pendiente';
    }
    if (filterStatus === 'completado') {
      return apt.status === 'completado';
    }
    return true;
  });

  const handleAppointmentCreated = (newApt: Appointment) => {
    onAddNewAppointment(newApt);
    setToastMessage(`¡Turno de ${newApt.petName} agendado con éxito!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePetCardClick = (apt: Appointment) => {
    const matchedPet =
      pets.find((p) => p.name.toLowerCase() === apt.petName.toLowerCase()) || pets[0];
    onSelectPet(matchedPet);
  };

  // Week days for quick horizontal switcher
  const weekDays = [
    { dayName: 'Lun', dayNum: 14 },
    { dayName: 'Mar', dayNum: 15, isToday: true, count: totalAppointments },
    { dayName: 'Mié', dayNum: 16, count: 2 },
    { dayName: 'Jue', dayNum: 17, count: 3 },
    { dayName: 'Vie', dayNum: 18, count: 4 },
    { dayName: 'Sáb', dayNum: 19, count: 5 }
  ];

  return (
    <div className="flex flex-col w-full pb-32 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Main Responsive Grid Layout (Single column on mobile, 2 columns on PC) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-4 sm:px-6 pt-2">
        {/* LEFT COLUMN: Hero, Mini Calendar, Capacity Status, Action Buttons (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Hero Card (Deep Purple) */}
          <section className="bg-gradient-to-br from-[#2e004e] via-[#37065e] to-[#4b0878] text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
            {/* Header Bar */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#f9b900] flex items-center justify-center text-[#261900] shadow-sm font-black text-sm">
                  <span>🐕</span>
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-white leading-tight">{salonName}</h2>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#e3e0f1]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Turnos abiertos hoy</span>
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Abierto</span>
              </div>
            </div>

            {/* Date Row */}
            <div className="flex items-center justify-between pt-1 pb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#f2daff] text-xs font-semibold backdrop-blur-xs">
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                <span>Martes, 15 de Octubre 2024</span>
              </div>

              <span className="text-[11px] text-[#f9b900] font-bold">
                Capacidad: {simultaneousCapacity} estilistas
              </span>
            </div>

            {/* Greeting Headline */}
            <div className="pt-1 pb-4">
              <h1 className="text-2xl font-black text-white tracking-tight">Buenos días 👋</h1>
              <p className="text-xs text-[#e3e0f1] mt-0.5">
                Hoy tienes <strong className="text-[#f9b900] font-extrabold">{totalAppointments} citas</strong> programadas.
              </p>
            </div>

            {/* 3 Metric Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* Citas Hoy */}
              <div className="bg-[#3e066a] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-white/10">
                <span className="text-2xl font-black text-white leading-tight">{totalAppointments}</span>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider mt-0.5">
                  CITAS HOY
                </span>
              </div>

              {/* En Salón */}
              <div className="bg-[#56003d] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-[#f9b900]/30 relative overflow-hidden">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#f9b900]"></span>
                  <span className="text-2xl font-black text-[#f9b900] leading-tight">{inSalonCount}</span>
                </div>
                <span className="text-[9px] font-bold text-[#ffdea1] uppercase tracking-wider mt-0.5">
                  EN SALÓN
                </span>
              </div>

              {/* Por Retirar */}
              <div className="bg-[#3e066a] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-white/10">
                <span className="text-2xl font-black text-white leading-tight">{pickupCount}</span>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider mt-0.5">
                  POR RETIRAR
                </span>
              </div>
            </div>
          </section>

          {/* Action Buttons Row */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsOnlineClientPortalActive(false);
                setIsNewAptModalOpen(true);
              }}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl font-bold">add_circle</span>
              <span>Nueva cita</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-[#efebfa] hover:bg-[#e4ddfa] text-[#2e004e] font-extrabold text-sm shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">share</span>
              <span>Compartir enlace</span>
            </button>
          </div>

          {/* Interactive Date Bar & Mini Calendar Widget */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#cfc2d2]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1a1a26] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#4b0878]">calendar_today</span>
                <span>Semana de Octubre 2024</span>
              </span>
              <span className="text-[11px] font-bold text-[#4b0878]">
                Día {selectedCalendarDay}
              </span>
            </div>

            {/* Quick days row */}
            <div className="grid grid-cols-6 gap-1.5">
              {weekDays.map((d) => {
                const isSelected = selectedCalendarDay === d.dayNum;
                return (
                  <button
                    key={d.dayNum}
                    type="button"
                    onClick={() => setSelectedCalendarDay(d.dayNum)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2e004e] text-white shadow-sm'
                        : 'bg-[#f5f2ff] hover:bg-[#efecfd] text-[#1a1a26]'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-[#7e7482]">
                      {d.dayName}
                    </span>
                    <span className="text-sm font-extrabold">{d.dayNum}</span>
                    {d.count ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f9b900] mt-0.5"></span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner: Clientes por volver */}
          <div
            onClick={onNavigateToRetention}
            className="bg-[#ffea9f] hover:bg-[#ffe380] transition-colors rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 cursor-pointer border border-[#f9b900]/40 group active:scale-[0.99]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#f9b900] flex items-center justify-center text-[#261900] shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-xl">notifications_active</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-[#261900] leading-snug">
                  Clientes por volver
                </h3>
                <p className="text-xs text-[#5c4300] leading-tight truncate">
                  6 mascotas necesitan una nueva cita de mantenimiento.
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#261900] shrink-0 group-hover:translate-x-0.5 transition-transform shadow-2xs">
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Cronograma de Hoy / Timeline & Filter (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Section Title & Filter Tabs */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#cfc2d2]/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#1a1a26]">
                  Cronograma del Día • {selectedCalendarDay} de Octubre
                </h2>
                <p className="text-xs text-[#7e7482]">
                  {filteredAppointments.length} citas programadas para hoy
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#7e7482] hidden sm:inline">
                  Capacidad simultánea: {simultaneousCapacity}
                </span>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('todos')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filterStatus === 'todos'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#efecfd]'
                }`}
              >
                Todos ({totalAppointments})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('en_salon')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filterStatus === 'en_salon'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#efecfd]'
                }`}
              >
                En Salón ({inSalonCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('confirmada')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filterStatus === 'confirmada'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#efecfd]'
                }`}
              >
                Confirmados
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('completado')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  filterStatus === 'completado'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#efecfd]'
                }`}
              >
                Listos ({pickupCount})
              </button>
            </div>
          </div>

          {/* Appointment Cards List */}
          <div className="space-y-3">
            {filteredAppointments.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-[#cfc2d2]/40 text-[#7e7482] space-y-2">
                <span className="material-symbols-outlined text-3xl text-[#4b0878]">event_busy</span>
                <p className="text-sm font-bold text-[#1a1a26]">No hay citas en este filtro</p>
                <p className="text-xs">Usa el botón "Nueva cita" para agregar una reserva.</p>
              </div>
            ) : (
              filteredAppointments.map((apt) => {
                const isCompleted = apt.status === 'completado';
                const isInSalon = apt.status === 'en_salon' || apt.status === 'en_corte';
                const isConfirmed = apt.status === 'confirmada';

                // Stripe color
                const stripeColor = isCompleted
                  ? 'bg-emerald-500'
                  : isInSalon
                  ? 'bg-[#f9b900]'
                  : isConfirmed
                  ? 'bg-[#4b0878]'
                  : 'bg-[#7e7482]';

                // Status Badge
                const statusBadgeStyle = isCompleted
                  ? 'bg-emerald-100 text-emerald-800'
                  : isInSalon
                  ? 'bg-[#fff1b8] text-[#7a5900]'
                  : isConfirmed
                  ? 'bg-[#f2daff] text-[#2e004e]'
                  : 'bg-[#f5f2ff] text-[#4c4451]';

                return (
                  <div
                    key={apt.id}
                    onClick={() => handlePetCardClick(apt)}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-[#cfc2d2]/30 relative overflow-hidden flex flex-col gap-2.5 cursor-pointer hover:border-[#4b0878]/50 hover:shadow-md transition-all active:scale-[0.99]"
                  >
                    {/* Left colored stripe */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripeColor}`}></div>

                    {/* Top Row: Time, Name, Status & Price */}
                    <div className="flex items-start justify-between pl-1">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Time Box */}
                        <div className="bg-[#f5f2ff] rounded-xl px-2.5 py-1.5 text-center shrink-0 border border-[#cfc2d2]/30">
                          <span className="text-xs font-black text-[#1a1a26] block leading-tight">
                            {apt.time.split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-[#7e7482] uppercase font-bold block leading-tight">
                            {apt.time.split(' ')[1] || 'HS'}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base text-[#1a1a26] truncate">
                              {apt.petName}
                            </h3>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusBadgeStyle}`}
                            >
                              {apt.statusLabel}
                            </span>
                          </div>
                          <p className="text-xs text-[#7e7482] truncate mt-0.5">
                            {apt.breed} • <span className="text-[#4c4451] font-semibold">{apt.serviceName}</span>
                          </p>
                        </div>
                      </div>

                      {/* Price & Payment Status */}
                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-[#1a1a26] block">
                          ${apt.price.toLocaleString()} <span className="text-xs font-bold text-[#7e7482]">{apt.currency}</span>
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            isCompleted ? 'text-emerald-700' : 'text-[#7e7482]'
                          }`}
                        >
                          {apt.paymentStatusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Groomer & Substatus */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#f5f2ff] pl-1 text-xs">
                      <div className="flex items-center gap-1.5 text-[#4c4451] font-medium truncate">
                        <span className="material-symbols-outlined text-sm text-[#7e7482]">person</span>
                        <span className="truncate">{apt.groomer}</span>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {apt.subStatusType === 'action_pill' ? (
                          <span className="bg-[#2e004e] text-white text-[11px] font-bold px-3 py-1 rounded-xl inline-flex items-center gap-1 shadow-xs">
                            <span className="material-symbols-outlined text-xs text-[#f9b900]">bathtub</span>
                            <span>{apt.subStatus}</span>
                          </span>
                        ) : apt.subStatusType === 'warning' ? (
                          <span className="text-[#7e7482] flex items-center gap-1 text-xs">
                            <span className="material-symbols-outlined text-xs text-[#f9b900]">chat</span>
                            <span>{apt.subStatus}</span>
                          </span>
                        ) : apt.subStatusType === 'tag' ? (
                          <span className="text-[#4b0878] font-bold flex items-center gap-1 text-xs">
                            <span className="material-symbols-outlined text-xs">history</span>
                            <span>{apt.subStatus}</span>
                          </span>
                        ) : (
                          <span className="text-[#7e7482] flex items-center gap-1 text-xs">
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            <span>{apt.subStatus}</span>
                          </span>
                        )}
                        <span className="text-[#4b0878] font-bold text-xs hover:underline flex items-center gap-0.5">
                          Ver Ficha &gt;
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal: Compartir Enlace para Redes Sociales */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        salonName={salonName}
        bookingSlug={bookingSlug}
        onOpenClientPortal={() => {
          setIsOnlineClientPortalActive(true);
          setIsNewAptModalOpen(true);
        }}
      />

      {/* Modal/Pantalla: Nueva Cita (Flujo completo interactivo con calendario y capacidad) */}
      {isNewAptModalOpen && (
        <NewAppointmentView
          onClose={() => setIsNewAptModalOpen(false)}
          onAppointmentCreated={(newApt) => {
            handleAppointmentCreated(newApt);
            setIsNewAptModalOpen(false);
          }}
          salonName={salonName}
          salonAddress={salonAddress}
          salonPhone={salonPhone}
          simultaneousCapacity={simultaneousCapacity}
          existingAppointments={appointments}
          isOnlineClientPortal={isOnlineClientPortalActive}
        />
      )}
    </div>
  );
};
