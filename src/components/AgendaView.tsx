import React, { useState, useMemo } from 'react';
import { Appointment, Pet, SalonConfig, WhatsAppTemplate } from '../types';
import { NewAppointmentView } from './NewAppointmentView';
import { ShareLinkModal } from './ShareLinkModal';
import { ConfirmWhatsAppModal } from './ConfirmWhatsAppModal';
import { HOTLINK_IMAGES } from '../mockData';
import { useTranslation } from '../utils/i18n/I18nContext';
import {
  AppLanguage,
  formatDisplayDate,
  formatTemplate,
  getWeekdayShortNames,
  translateStatusLabel
} from '../utils/i18n/helpers';
import { formatPrice } from '../utils/priceUtils';
import { formatDateSpanish } from '../utils/storage';
import { isDateMatching } from '../utils/scheduleUtils';
import {
  normalizeAppointmentStatus,
  mergeAppointments,
  doesAppointmentMatchPet
} from '../utils/syncHelpers';

interface AgendaViewProps {
  appointments: Appointment[];
  pets: Pet[];
  onSelectPet: (pet: Pet) => void;
  onNavigateToRetention: () => void;
  onAddNewAppointment: (newApt: Appointment, newPetData?: Partial<Pet>) => Promise<boolean | void> | boolean | void;
  onUpdateAppointmentStatus?: (
    appointmentId: string,
    status: string,
    statusLabel: string,
    extraPatch?: Partial<Appointment>
  ) => Promise<boolean> | void;
  salonConfig: SalonConfig;
  onSaveWhatsAppTemplate?: (template: WhatsAppTemplate) => Promise<void> | void;
  urgentRetentionCount?: number;
  totalRetentionCount?: number;
  currentLanguage?: AppLanguage;
  onNavigateToInSalon?: () => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  appointments,
  pets,
  onSelectPet,
  onNavigateToRetention,
  onAddNewAppointment,
  onUpdateAppointmentStatus,
  salonConfig,
  onSaveWhatsAppTemplate,
  urgentRetentionCount = 0,
  totalRetentionCount = 0,
  currentLanguage = 'es-LA',
  onNavigateToInSalon
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isNewAptModalOpen, setIsNewAptModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [whatsAppModalApt, setWhatsAppModalApt] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'por_confirmar' | 'en_salon' | 'confirmada' | 'completado'>('todos');
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const today = useMemo(() => new Date(), []);
  const todayFormatted = useMemo(() => formatDateSpanish(today), [today]);

  const [selectedDateFormatted, setSelectedDateFormatted] = useState<string>(todayFormatted);

  const { t, lang } = useTranslation();
  const at = t.agenda;
  const ct = t.common;

  const dedupedAppointments = useMemo(() => {
    return mergeAppointments(appointments);
  }, [appointments]);

  // Generate week days dynamically from real system date with offset support
  const weekDays = useMemo(() => {
    const list = [];
    const curr = new Date(today);
    curr.setDate(curr.getDate() + weekOffset * 7);
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() + distanceToMonday);

    const dayLetters = getWeekdayShortNames(lang, true);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === today.toDateString();
      const formatted = formatDateSpanish(d);
      const dayApts = dedupedAppointments.filter(
        (a) =>
          isDateMatching(a.date, formatted) &&
          normalizeAppointmentStatus(a.status, a.statusLabel) !== 'cancelada'
      );
      const countForDay = dayApts.length;
      const pendingCount = dayApts.filter(
        (a) => normalizeAppointmentStatus(a.status, a.statusLabel) === 'pendiente'
      ).length;

      list.push({
        dayName: dayLetters[i],
        dayNum: d.getDate(),
        formatted,
        isToday,
        count: countForDay,
        pendingCount
      });
    }
    return list;
  }, [today, dedupedAppointments, weekOffset, lang]);

  // Today's specific appointments (excluding cancelled)
  const todayAppointments = useMemo(() => {
    return dedupedAppointments.filter(
      (a) =>
        isDateMatching(a.date, todayFormatted) &&
        normalizeAppointmentStatus(a.status, a.statusLabel) !== 'cancelada'
    );
  }, [dedupedAppointments, todayFormatted]);

  const totalAppointmentsToday = todayAppointments.length;
  const inSalonCount = todayAppointments.filter(
    (a) => normalizeAppointmentStatus(a.status, a.statusLabel) === 'en_salon'
  ).length;
  const pickupCount = todayAppointments.filter(
    (a) => normalizeAppointmentStatus(a.status, a.statusLabel) === 'por_retirar'
  ).length;

  // Selected date's appointments
  const selectedDayAppointments = useMemo(() => {
    return dedupedAppointments.filter((a) => isDateMatching(a.date, selectedDateFormatted));
  }, [dedupedAppointments, selectedDateFormatted]);

  // All pending confirmation appointments across any date
  const allPendingAppointments = useMemo(() => {
    return dedupedAppointments.filter(
      (a) => normalizeAppointmentStatus(a.status, a.statusLabel) === 'pendiente'
    );
  }, [dedupedAppointments]);

  const pendingConfirmationCount = allPendingAppointments.length;

  // Filtered appointments list: When "Por Confirmar" is selected, ALWAYS show all pending reservations across any date
  const filteredAppointments = useMemo(() => {
    if (filterStatus === 'por_confirmar') {
      return allPendingAppointments;
    }

    return selectedDayAppointments.filter((apt) => {
      const canon = normalizeAppointmentStatus(apt.status, apt.statusLabel);
      if (filterStatus === 'en_salon') {
        return canon === 'en_salon' || canon === 'por_retirar';
      }
      if (filterStatus === 'confirmada') {
        return canon === 'confirmada';
      }
      if (filterStatus === 'completado') {
        return canon === 'completado';
      }
      return true;
    });
  }, [selectedDayAppointments, allPendingAppointments, filterStatus]);

  const handleAppointmentCreated = async (
    newApt: Appointment,
    newPetData?: Partial<Pet>
  ): Promise<boolean> => {
    const res = await onAddNewAppointment(newApt, newPetData);
    if (res !== false) {
      // Auto-navigate to appointment date so it immediately displays on the calendar
      if (newApt.date) {
        setSelectedDateFormatted(newApt.date);
        const offset = findWeekOffsetForDate(newApt.date);
        setWeekOffset(offset);
      }
      setFilterStatus('todos');
      setToastMessage(`${newApt.petName} — ${t.modals.appointmentCreatedToast}`);
      setTimeout(() => setToastMessage(null), 3500);
      return true;
    }
    return false;
  };

  // Helper to find the week offset corresponding to a given formatted date
  const findWeekOffsetForDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    try {
      for (let offset = -4; offset <= 12; offset++) {
        const curr = new Date(today);
        curr.setDate(curr.getDate() + offset * 7);
        const dayOfWeek = curr.getDay();
        const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(curr);
        monday.setDate(curr.getDate() + distanceToMonday);

        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          if (isDateMatching(formatDateSpanish(d), dateStr)) {
            return offset;
          }
        }
      }
    } catch {}
    return 0;
  };

  const handleConfirmViaWhatsApp = (apt: Appointment) => {
    // Open modal to review, edit, and personalize WhatsApp message before confirming and sending
    setWhatsAppModalApt(apt);
  };

  const handleModalConfirmAndSend = async (
    apt: Appointment,
    _finalMessage: string,
    templateToSave?: { title: string; content: string }
  ) => {
    // 1. If user opted to save current message as template, persist it
    if (templateToSave && onSaveWhatsAppTemplate) {
      await onSaveWhatsAppTemplate({
        id: `tmpl-${Date.now()}`,
        title: templateToSave.title,
        content: templateToSave.content
      });
    }

    // 2. Confirm internally and guarantee persistence in database FIRST (Step 1 & 2 requirement)
    if (onUpdateAppointmentStatus) {
      await onUpdateAppointmentStatus(apt.id, 'confirmada', 'CONFIRMADA');
    }

    // 3. Adjust agenda view so user sees the confirmed appointment right away in the agenda!
    if (apt.date) {
      const offset = findWeekOffsetForDate(apt.date);
      setWeekOffset(offset);
      setSelectedDateFormatted(apt.date);
    }
    setFilterStatus('todos');
    setToastMessage(`${apt.petName} — ${at.aptConfirmedToast}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleModalSaveTemplateOnly = async (title: string, content: string) => {
    if (onSaveWhatsAppTemplate) {
      await onSaveWhatsAppTemplate({
        id: `tmpl-${Date.now()}`,
        title,
        content
      });
      setToastMessage(formatTemplate(t.modals.templateSavedNotice, { title }));
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleConfirmSystemOnly = async (apt: Appointment) => {
    // 1. Confirm internally and guarantee persistence in database
    if (onUpdateAppointmentStatus) {
      await onUpdateAppointmentStatus(apt.id, 'confirmada', 'CONFIRMADA');
    }
    // 2. Switch to that appointment's date so the user sees it confirmed in Agenda
    if (apt.date) {
      const offset = findWeekOffsetForDate(apt.date);
      setWeekOffset(offset);
      setSelectedDateFormatted(apt.date);
    }
    setFilterStatus('todos');
    setToastMessage(`${apt.petName} — ${at.aptConfirmedToast}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeclineAppointment = (apt: Appointment) => {
    if (onUpdateAppointmentStatus) {
      onUpdateAppointmentStatus(apt.id, 'cancelada', 'CANCELADA');
      setToastMessage(`${apt.petName} — ${at.aptCancelledToast}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handlePetCardClick = (apt: Appointment) => {
    const matchedPet = pets.find((p) => doesAppointmentMatchPet(apt, p));
    if (matchedPet) {
      onSelectPet(matchedPet);
    } else {
      setToastMessage(`${apt.petName}: ${t.inSalonView.emptyDesc}`);
      setTimeout(() => setToastMessage(null), 3500);
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
                    <span>{t.nav.openToday}</span>
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white text-xs font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>{at.openBadge}</span>
              </div>
            </div>

            {/* Dynamic Date & Capacity Row */}
            <div className="flex items-center justify-between pt-1 pb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#f2daff] text-xs font-semibold backdrop-blur-xs">
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                <span>{formatDisplayDate(today, lang)}</span>
              </div>

              <span className="text-[11px] text-[#f9b900] font-bold">
                {at.simultaneousCapacity}: {effectiveCapacity}
              </span>
            </div>

            {/* Mensaje dinámico de citas programadas para hoy */}
            <div className="pt-1 pb-4">
              <p className="text-sm font-semibold text-white/90">
                {at.todaySummaryPrefix}{' '}
                <strong className="text-[#f9b900] font-black text-base">
                  {totalAppointmentsToday} {totalAppointmentsToday === 1 ? at.todaySummarySingular : at.todaySummaryPlural}
                </strong>{' '}
                {at.todaySummarySuffix}
              </p>
            </div>

            {/* 3 Metric Stats Cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* Citas Hoy */}
              <div className="bg-[#3e066a] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-white/10">
                <span className="text-2xl font-black text-white leading-tight">{totalAppointmentsToday}</span>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider mt-0.5">
                  {at.todayAppointmentsCount}
                </span>
              </div>

              {/* En Salón */}
              <div className="bg-[#56003d] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-[#f9b900]/30 relative overflow-hidden">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#f9b900]"></span>
                  <span className="text-2xl font-black text-[#f9b900] leading-tight">{inSalonCount}</span>
                </div>
                <span className="text-[9px] font-bold text-[#ffdea1] uppercase tracking-wider mt-0.5">
                  {at.inSalonStat}
                </span>
              </div>

              {/* Por Retirar */}
              <div className="bg-[#3e066a] rounded-2xl p-2.5 text-center flex flex-col items-center justify-center shadow-xs border border-white/10">
                <span className="text-2xl font-black text-white leading-tight">{pickupCount}</span>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider mt-0.5">
                  {at.pickupReadyStat}
                </span>
              </div>
            </div>
          </section>

          {/* Action Buttons Row */}
          <div>
            <button
              type="button"
              onClick={() => setIsNewAptModalOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-black text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl font-bold">add_circle</span>
              <span>{at.newAppointment}</span>
            </button>
          </div>

          {/* Dynamic Week Bar & Mini Calendar Widget */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#cfc2d2]/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1a1a26] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#4b0878]">calendar_today</span>
                <span>{selectedDateFormatted === todayFormatted ? at.todayInSalon : formatDisplayDate(selectedDateFormatted, lang)}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title={at.prevWeek}
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="w-7 h-7 rounded-lg bg-[#f5f2ff] hover:bg-[#efecfd] text-[#2e004e] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                {weekOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setWeekOffset(0);
                      setSelectedDateFormatted(todayFormatted);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#f5f2ff] hover:bg-[#efecfd] text-[#2e004e] text-[10px] font-black cursor-pointer"
                  >
                    {t.retention.filterThisWeek}
                  </button>
                )}
                <button
                  type="button"
                  title={at.nextWeek}
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="w-7 h-7 rounded-lg bg-[#f5f2ff] hover:bg-[#efecfd] text-[#2e004e] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Quick days row generated dynamically */}
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d) => {
                const isSelected = selectedDateFormatted === d.formatted;
                return (
                  <button
                    key={d.formatted}
                    type="button"
                    onClick={() => setSelectedDateFormatted(d.formatted)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#2e004e] text-white shadow-sm'
                        : 'bg-[#f5f2ff] hover:bg-[#efecfd] text-[#1a1a26]'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-[#7e7482]">
                      {d.dayName}
                    </span>
                    <span className="text-sm font-extrabold">{d.dayNum}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {d.count > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#f9b900]' : 'bg-[#2e004e]'}`}></span>
                      )}
                      {d.pendingCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title={`${d.pendingCount} ${at.filterToConfirm.toLowerCase()}`}></span>
                      )}
                    </div>
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
                  {at.clientsToReturnBanner}
                </h3>
                <p className="text-xs text-[#5c4300] leading-tight truncate">
                  {totalRetentionCount > 0
                    ? `${totalRetentionCount} ${totalRetentionCount === 1 ? at.clientsNeedRebookingSingular : at.clientsNeedRebookingPlural}`
                    : t.retention.noRetentionDue}
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
          {/* Incoming Online Reservations Alert Banner */}
          {pendingConfirmationCount > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <span className="material-symbols-outlined text-xl">notifications_active</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider">
                      {at.onlineBadge}
                    </span>
                    <span className="text-xs font-black text-amber-950">
                      {at.onlineBookingsAlertTitle} ({pendingConfirmationCount})
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                    {at.onlineBookingsAlertDesc}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterStatus('por_confirmar')}
                className={`px-4 py-2 rounded-xl font-black text-xs transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  filterStatus === 'por_confirmar'
                    ? 'bg-[#2e004e] text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white active:scale-95'
                }`}
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>{filterStatus === 'por_confirmar' ? at.filterToConfirm : `${at.reviewPendingBtn} (${pendingConfirmationCount})`}</span>
              </button>
            </div>
          )}

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
                {at.filterAll} ({selectedDayAppointments.length})
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
                <span>{at.filterToConfirm}</span>
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
                {at.filterInSalon} ({selectedDayAppointments.filter((a) => {
                  const canon = normalizeAppointmentStatus(a.status, a.statusLabel);
                  return canon === 'en_salon' || canon === 'por_retirar';
                }).length})
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
                {at.filterConfirmed} ({selectedDayAppointments.filter((a) => normalizeAppointmentStatus(a.status, a.statusLabel) === 'confirmada').length})
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
                {at.filterCompleted} ({selectedDayAppointments.filter((a) => normalizeAppointmentStatus(a.status, a.statusLabel) === 'completado').length})
              </button>
            </div>
          </div>

          {/* Banner when viewing Por Confirmar across all dates */}
          {filterStatus === 'por_confirmar' && (
            <div className="bg-[#f5f2ff] rounded-2xl px-4 py-2.5 text-xs text-[#2e004e] font-semibold flex items-center justify-between border border-[#cfc2d2]/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#f9b900]">info</span>
                <span>{at.reviewPendingBtn}: {at.filterToConfirm} ({allPendingAppointments.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setFilterStatus('todos')}
                className="text-[11px] font-bold text-[#4b0878] hover:underline cursor-pointer"
              >
                {ct.back} ({ct.today})
              </button>
            </div>
          )}

          {/* List of Appointments */}
          {filteredAppointments.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-300 space-y-3 shadow-xs">
              <div className="w-14 h-14 rounded-full bg-[#f5f2ff] text-[#4b0878] flex items-center justify-center mx-auto text-2xl font-bold">
                <span className="material-symbols-outlined text-3xl">event_busy</span>
              </div>
              <h3 className="text-sm font-bold text-[#1a1a26]">
                {filterStatus === 'por_confirmar'
                  ? at.filterToConfirm + ' (0)'
                  : at.noAppointmentsToday}
              </h3>
              <p className="text-xs text-[#7e7482] max-w-sm mx-auto">
                {filterStatus === 'por_confirmar'
                  ? at.onlineBookingsAlertDesc
                  : `${at.noAppointmentsFilteredDesc} ${formatDisplayDate(selectedDateFormatted, lang)}. ${at.clickNewAppointmentHint}`}
              </p>
              {filterStatus !== 'por_confirmar' && (
                <button
                  type="button"
                  onClick={() => setIsNewAptModalOpen(true)}
                  className="py-2 px-4 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] text-xs font-black rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                  <span>{at.newAppointment}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((apt) => {
                const canon = normalizeAppointmentStatus(apt.status, apt.statusLabel);
                const isPending = canon === 'pendiente';
                const hasFicha = pets.some((p) => doesAppointmentMatchPet(apt, p));

                return (
                  <div
                    key={apt.id}
                    onClick={() => handlePetCardClick(apt)}
                    className={`bg-white hover:bg-[#fcf8ff] rounded-2xl p-4 shadow-sm border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group ${
                      isPending
                        ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
                        : 'border-[#cfc2d2]/30 hover:border-[#4b0878]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className={`w-14 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border font-mono text-[11px] font-black px-1 text-center ${
                        isPending
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-[#f5f2ff] text-[#4b0878] border-[#cfc2d2]/30'
                      }`}>
                        <span className="leading-tight">{apt.time}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-[#1a1a26] truncate">{apt.petName}</h4>
                          <span className="text-[11px] text-[#7e7482]">({apt.breed})</span>
                          {/* Date badge if viewing all pending appointments or not today */}
                          {(filterStatus === 'por_confirmar' || !isDateMatching(apt.date, todayFormatted)) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2e004e] text-[#f9b900] text-[10px] font-black">
                              <span className="material-symbols-outlined text-xs">calendar_month</span>
                              <span>{formatDisplayDate(apt.date, lang)}</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#4c4451] font-medium mt-0.5">
                          {apt.serviceName} • <span className="text-[#2e004e] font-bold">{formatPrice(apt.price, apt.currency || salonConfig.currency, { includeCode: true })}</span>
                        </p>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[#7e7482] flex-wrap">
                          <span>{at.tutorLabel} <strong className="text-[#1a1a26]">{apt.tutorName}</strong></span>
                          {apt.tutorPhone && (
                            <span className="text-[#2e004e] font-semibold flex items-center gap-0.5">
                              • 📱 {apt.tutorPhone}
                            </span>
                          )}
                          {apt.groomer && <span>• {at.stylistLabel} {apt.groomer}</span>}
                        </div>

                        {apt.notes && (
                          <p className="text-[11px] text-[#7e7482] mt-1 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 italic">
                            📝 {apt.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end justify-between gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                      <span
                        className={`self-start md:self-end px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          canon === 'completado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : canon === 'por_retirar'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : canon === 'en_salon'
                            ? 'bg-[#f9b900] text-[#261900]'
                            : isPending
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-[#efecfd] text-[#2e004e]'
                        }`}
                      >
                        {translateStatusLabel(canon, lang)}
                      </span>

                      {/* Paso 1: Comenzar servicio para citas confirmadas */}
                      {canon === 'confirmada' && onUpdateAppointmentStatus && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onUpdateAppointmentStatus(apt.id, 'en_salon', 'EN SALÓN');
                              setToastMessage(`${apt.petName} — ${at.serviceStartedToast}`);
                              setTimeout(() => setToastMessage(null), 3500);
                            }}
                            className="px-3 py-1.5 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                            title={at.startServiceBtn}
                          >
                            <span className="material-symbols-outlined text-sm font-bold">content_cut</span>
                            <span>{at.startServiceBtn}</span>
                          </button>
                        </div>
                      )}

                      {/* Botón rápido si ya está en salón */}
                      {(canon === 'en_salon' || canon === 'por_retirar') && onNavigateToInSalon && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToInSalon();
                            }}
                            className="px-2.5 py-1 bg-[#2e004e] hover:bg-[#4b0878] text-[#f9b900] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            title={t.nav.inSalonNav}
                          >
                            <span className="material-symbols-outlined text-xs">storefront</span>
                            <span>{t.nav.inSalonNav}</span>
                          </button>
                        </div>
                      )}

                      {/* Quick Confirm Actions for Public Appointments */}
                      {isPending && onUpdateAppointmentStatus && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {/* Confirm & Open WhatsApp */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmViaWhatsApp(apt);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                            title={at.notifyWhatsAppBtn}
                          >
                            <span className="material-symbols-outlined text-xs">chat</span>
                            <span>{at.notifyWhatsAppBtn}</span>
                          </button>

                          {/* Confirm System Only */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmSystemOnly(apt);
                            }}
                            className="px-2.5 py-1 bg-[#2e004e] hover:bg-[#4b0878] text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                            title={at.confirmBtn}
                          >
                            <span className="material-symbols-outlined text-xs">check</span>
                            <span>{at.confirmBtn}</span>
                          </button>

                          {/* Decline */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeclineAppointment(apt);
                            }}
                            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title={at.cancelAptBtn}
                          >
                            {at.cancelAptBtn}
                          </button>
                        </div>
                      )}

                      {hasFicha && (
                        <span className="text-[11px] text-[#7e7482] font-semibold flex items-center gap-1 group-hover:text-[#4b0878] self-end mt-1">
                          <span>{at.viewProfileBtn}</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Appointment Modal */}
      {isNewAptModalOpen && (
        <NewAppointmentView
          onClose={() => setIsNewAptModalOpen(false)}
          onAppointmentCreated={async (newApt, newPetData) => {
            const success = await handleAppointmentCreated(newApt, newPetData);
            if (success !== false) {
              setIsNewAptModalOpen(false);
            }
            return success;
          }}
          salonName={salonConfig.name}
          salonAddress={salonConfig.address}
          salonPhone={salonConfig.phone}
          simultaneousCapacity={effectiveCapacity}
          existingAppointments={dedupedAppointments}
          existingPets={pets}
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

      {/* WhatsApp Custom Message & Confirmation Modal */}
      <ConfirmWhatsAppModal
        isOpen={!!whatsAppModalApt}
        appointment={whatsAppModalApt}
        salonConfig={salonConfig}
        onClose={() => setWhatsAppModalApt(null)}
        onConfirmAndSend={handleModalConfirmAndSend}
        onSaveTemplateOnly={handleModalSaveTemplateOnly}
      />
    </div>
  );
};
