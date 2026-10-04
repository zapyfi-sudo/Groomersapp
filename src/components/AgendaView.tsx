import React, { useState, useMemo } from 'react';
import { Appointment, Pet, SalonConfig } from '../types';
import { NewAppointmentView } from './NewAppointmentView';
import { ShareLinkModal } from './ShareLinkModal';
import { HOTLINK_IMAGES } from '../mockData';
import { AppLanguage, TRANSLATIONS } from '../utils/translations';
import { formatDateSpanish } from '../utils/storage';

interface AgendaViewProps {
  appointments: Appointment[];
  pets: Pet[];
  onSelectPet: (pet: Pet) => void;
  onNavigateToRetention: () => void;
  onAddNewAppointment: (newApt: Appointment) => void;
  onUpdateAppointmentStatus?: (appointmentId: string, status: string, statusLabel: string) => void;
  salonConfig: SalonConfig;
  urgentRetentionCount?: number;
  totalRetentionCount?: number;
  currentLanguage?: AppLanguage;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  appointments,
  pets,
  onSelectPet,
  onNavigateToRetention,
  onAddNewAppointment,
  onUpdateAppointmentStatus,
  salonConfig,
  urgentRetentionCount = 0,
  totalRetentionCount = 0,
  currentLanguage = 'es-LA'
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNewAptModalOpen, setIsNewAptModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'por_confirmar' | 'en_salon' | 'confirmada' | 'completado'>('todos');

  const today = useMemo(() => new Date(), []);
  const todayFormatted = useMemo(() => formatDateSpanish(today), [today]);

  const [selectedDateFormatted, setSelectedDateFormatted] = useState<string>(todayFormatted);

  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS['es-LA'];

  // Generate the current week days dynamically from real system date
  const weekDays = useMemo(() => {
    const list = [];
    const curr = new Date(today);
    // Start from Monday of this week
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() + distanceToMonday);

    const dayLetters = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === today.toDateString();
      const formatted = formatDateSpanish(d);
      const countForDay = appointments.filter((a) => a.date === formatted).length;

      list.push({
        dayName: dayLetters[i],
        dayNum: d.getDate(),
        formatted,
        isToday,
        count: countForDay
      });
    }
    return list;
  }, [today, appointments]);

  // Today's specific appointments
  const todayAppointments = useMemo(() => {
    return appointments.filter((a) => a.date === todayFormatted);
  }, [appointments, todayFormatted]);

  const totalAppointmentsToday = todayAppointments.length;
  const inSalonCount = todayAppointments.filter(
    (a) => a.status === 'en_salon' || a.status === 'en_corte'
  ).length;
  const pickupCount = todayAppointments.filter((a) => a.status === 'completado').length;

  // Selected date's appointments
  const selectedDayAppointments = useMemo(() => {
    return appointments.filter((a) => a.date === selectedDateFormatted);
  }, [appointments, selectedDateFormatted]);

  const pendingConfirmationCount = useMemo(() => {
    return appointments.filter(
      (a) => a.status === 'pendiente' || a.status === 'pendiente_confirmacion' || a.statusLabel === 'POR CONFIRMAR'
    ).length;
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return selectedDayAppointments.filter((apt) => {
      if (filterStatus === 'por_confirmar') {
        return (
          apt.status === 'pendiente' ||
          apt.status === 'pendiente_confirmacion' ||
          apt.statusLabel === 'POR CONFIRMAR'
        );
      }
      if (filterStatus === 'en_salon') {
        return apt.status === 'en_salon' || apt.status === 'en_corte';
      }
      if (filterStatus === 'confirmada') {
        return apt.status === 'confirmada';
      }
      if (filterStatus === 'completado') {
        return apt.status === 'completado';
      }
      return true;
    });
  }, [selectedDayAppointments, filterStatus]);

  const handleAppointmentCreated = (newApt: Appointment) => {
    onAddNewAppointment(newApt);
    setToastMessage(`¡Turno de ${newApt.petName} agendado con éxito!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePetCardClick = (apt: Appointment) => {
    const matchedPet =
      pets.find((p) => p.name.toLowerCase() === apt.petName.toLowerCase() || p.id === apt.petId) || pets[0];
    if (matchedPet) {
      onSelectPet(matchedPet);
    }
  };

  // Capacity display
  const effectiveCapacity = salonConfig.allowSimultaneousStaff === false ? 1 : salonConfig.simultaneousCapacity || 1;

  return (
    <div className="flex flex-col w-full pb-32 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-4 sm:px-6 pt-2">
        {/* LEFT COLUMN: Hero, Mini Calendar, Capacity Status, Action Buttons */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Hero Card (Deep Purple with real Business Logo & Name) */}
          <section className="bg-gradient-to-br from-[#2e004e] via-[#37065e] to-[#4b0878] text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center text-[#261900] shadow-sm shrink-0 overflow-hidden">
                  <img
                    src={salonConfig.logoUrl || HOTLINK_IMAGES.logo}
                    alt={salonConfig.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-sm text-white leading-tight truncate">
                    {salonConfig.name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#e3e0f1]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{t.openToday}</span>
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white text-xs font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Abierto</span>
              </div>
            </div>

            {/* Dynamic Date & Capacity Row */}
            <div className="flex items-center justify-between pt-1 pb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#f2daff] text-xs font-semibold backdrop-blur-xs">
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                <span>{todayFormatted}</span>
              </div>

              <span className="text-[11px] text-[#f9b900] font-bold">
                {t.simultaneousCapacity}: {effectiveCapacity}
              </span>
            </div>

            {/* Greeting Headline - Fully Dynamic Calculation */}
            <div className="pt-1 pb-4">
              <h1 className="text-2xl font-black text-white tracking-tight">{t.goodMorning}</h1>
              <p className="text-xs text-[#e3e0f1] mt-0.5">
                Hoy tienes <strong className="text-[#f9b900] font-extrabold">{totalAppointmentsToday} {t.todayAppointmentsCount}</strong> programadas.
              </p>
            </div>

            {/* 3 Metric Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* Citas Hoy */}
              <div className="bg-[#3e066a] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-white/10">
                <span className="text-2xl font-black text-white leading-tight">{totalAppointmentsToday}</span>
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
                  {t.inSalon}
                </span>
              </div>

              {/* Por Retirar */}
              <div className="bg-[#3e066a] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-white/10">
                <span className="text-2xl font-black text-white leading-tight">{pickupCount}</span>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider mt-0.5">
                  {t.pickupReady}
                </span>
              </div>
            </div>
          </section>

          {/* Action Buttons Row */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setIsNewAptModalOpen(true)}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl font-bold">add_circle</span>
              <span>{t.newAppointment}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-[#efebfa] hover:bg-[#e4ddfa] text-[#2e004e] font-extrabold text-sm shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">share</span>
              <span>{t.shareLink}</span>
            </button>
          </div>

          {/* Dynamic Week Bar & Mini Calendar Widget */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#cfc2d2]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1a1a26] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#4b0878]">calendar_today</span>
                <span>{selectedDateFormatted === todayFormatted ? 'Hoy en tu salón' : selectedDateFormatted}</span>
              </span>
              <span className="text-[11px] font-bold text-[#4b0878]">
                {selectedDayAppointments.length} citas
              </span>
            </div>

            {/* Quick days row generated dynamically */}
            <div className="grid grid-cols-6 gap-1.5">
              {weekDays.map((d) => {
                const isSelected = selectedDateFormatted === d.formatted;
                return (
                  <button
                    key={d.formatted}
                    type="button"
                    onClick={() => setSelectedDateFormatted(d.formatted)}
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
                    {d.count > 0 ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f9b900] mt-0.5"></span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner: Clientes por volver (Derived dynamically) */}
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
                  {t.clientsToReturnBanner}
                </h3>
                <p className="text-xs text-[#5c4300] leading-tight truncate">
                  {totalRetentionCount > 0
                    ? `${totalRetentionCount} ${t.clientsNeedRebooking}`
                    : t.noRetentionDue}
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#261900] shrink-0 group-hover:translate-x-0.5 transition-transform shadow-2xs">
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Appointments List */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Chips Bar */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus('todos')}
                className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'todos'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-[#f5f2ff]'
                }`}
              >
                Todos ({selectedDayAppointments.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('por_confirmar')}
                className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === 'por_confirmar'
                    ? 'bg-[#f9b900] text-[#261900] shadow-xs'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-[#f5f2ff]'
                }`}
              >
                <span>Por Confirmar</span>
                {pendingConfirmationCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#2e004e] text-white text-[10px] flex items-center justify-center font-black">
                    {pendingConfirmationCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('en_salon')}
                className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'en_salon'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-[#f5f2ff]'
                }`}
              >
                En Salón ({selectedDayAppointments.filter((a) => a.status === 'en_salon' || a.status === 'en_corte').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('confirmada')}
                className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'confirmada'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-[#f5f2ff]'
                }`}
              >
                Confirmadas ({selectedDayAppointments.filter((a) => a.status === 'confirmada').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('completado')}
                className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'completado'
                    ? 'bg-[#2e004e] text-white shadow-xs'
                    : 'bg-white text-[#4c4451] border border-[#cfc2d2]/40 hover:bg-[#f5f2ff]'
                }`}
              >
                Completadas ({selectedDayAppointments.filter((a) => a.status === 'completado').length})
              </button>
            </div>
          </div>

          {/* List of Appointments for the selected day */}
          {filteredAppointments.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-300 space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-full bg-[#f5f2ff] text-[#4b0878] flex items-center justify-center mx-auto text-2xl font-bold">
                <span className="material-symbols-outlined text-3xl">event_busy</span>
              </div>
              <h3 className="text-sm font-bold text-[#1a1a26]">{t.noAppointmentsToday}</h3>
              <p className="text-xs text-[#7e7482] max-w-sm mx-auto">
                No hay turnos registrados con este filtro para {selectedDateFormatted}. Haz clic en "+ Nueva cita" para agendar un turno.
              </p>
              <button
                type="button"
                onClick={() => setIsNewAptModalOpen(true)}
                className="py-2 px-4 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] text-xs font-black rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span>
                <span>{t.newAppointment}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => handlePetCardClick(apt)}
                  className="bg-white hover:bg-[#fcf8ff] rounded-2xl p-4 shadow-sm border border-[#cfc2d2]/30 hover:border-[#4b0878]/50 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#f5f2ff] text-[#4b0878] flex flex-col items-center justify-center shrink-0 border border-[#cfc2d2]/30 font-mono text-xs font-black">
                      <span>{apt.time.slice(0, 5)}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-[#1a1a26] truncate">{apt.petName}</h4>
                        <span className="text-[11px] text-[#7e7482]">({apt.breed})</span>
                      </div>
                      <p className="text-xs text-[#4c4451] font-medium mt-0.5">
                        {apt.serviceName} • <span className="text-[#2e004e] font-bold">${apt.price.toLocaleString()} {apt.currency || salonConfig.currency}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#7e7482]">
                        <span>Tutor: {apt.tutorName}</span>
                        {apt.groomer && <span>• Estilista: {apt.groomer}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        apt.status === 'completado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : apt.status === 'en_salon' || apt.status === 'en_corte'
                          ? 'bg-[#f9b900] text-[#261900]'
                          : apt.status === 'pendiente' || apt.status === 'pendiente_confirmacion' || apt.statusLabel === 'POR CONFIRMAR'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-[#efecfd] text-[#2e004e]'
                      }`}
                    >
                      {apt.statusLabel || (apt.status === 'pendiente' ? 'POR CONFIRMAR' : apt.status)}
                    </span>

                    {/* Quick Confirm Action for Public Appointments (Requirement #13) */}
                    {(apt.status === 'pendiente' || apt.status === 'pendiente_confirmacion' || apt.statusLabel === 'POR CONFIRMAR') && onUpdateAppointmentStatus && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateAppointmentStatus(apt.id, 'confirmada', 'CONFIRMADA');
                          setToastMessage(`¡Cita de ${apt.petName} confirmada exitosamente!`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">check</span>
                        <span>Confirmar cita</span>
                      </button>
                    )}

                    <span className="text-[11px] text-[#7e7482] font-semibold flex items-center gap-1 group-hover:text-[#4b0878]">
                      <span>Ver ficha</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Appointment Modal */}
      {isNewAptModalOpen && (
        <NewAppointmentView
          onClose={() => setIsNewAptModalOpen(false)}
          onAppointmentCreated={(newApt) => {
            handleAppointmentCreated(newApt);
            setIsNewAptModalOpen(false);
          }}
          salonName={salonConfig.name}
          salonAddress={salonConfig.address}
          salonPhone={salonConfig.phone}
          simultaneousCapacity={effectiveCapacity}
          existingAppointments={appointments}
          isOnlineClientPortal={false}
          salonConfig={salonConfig}
        />
      )}

      {/* Share Link Modal */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        salonName={salonConfig.name}
        bookingSlug={salonConfig.bookingSlug}
        businessId={salonConfig.id && salonConfig.id !== 'biz_main' && salonConfig.id !== 'biz_default' ? salonConfig.id : salonConfig.bookingSlug}
        salonConfig={salonConfig}
        onOpenClientPortal={() => {
          setIsShareModalOpen(false);
          setIsNewAptModalOpen(true);
        }}
      />
    </div>
  );
};
