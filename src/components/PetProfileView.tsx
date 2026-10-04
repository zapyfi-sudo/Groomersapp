import React, { useState, useRef, useMemo } from 'react';
import { Pet, BehaviorMood, Visit, SalonConfig } from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { EditPetModal } from './EditPetModal';
import { PhotoUploadModal } from './PhotoUploadModal';
import { formatDateSpanish } from '../utils/storage';

interface PetProfileViewProps {
  pet: Pet;
  onUpdatePet: (updated: Pet) => void;
  onNavigateOnboarding: () => void;
  salonConfig?: SalonConfig;
}

export const PetProfileView: React.FC<PetProfileViewProps> = ({
  pet,
  onUpdatePet,
  onNavigateOnboarding,
  salonConfig
}) => {
  const currency = salonConfig?.currency || pet.lastVisit?.currency || 'ARS';
  const salonServices = salonConfig?.services || [];

  // Default to first configured service
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    salonServices[0]?.id || ''
  );

  const currentSelectedService = useMemo(() => {
    return salonServices.find((s) => s.id === selectedServiceId) || salonServices[0];
  }, [salonServices, selectedServiceId]);

  const [serviceName, setServiceName] = useState<string>(
    currentSelectedService?.name || pet.lastVisit?.serviceName || 'Baño + corte'
  );
  const [price, setPrice] = useState<number>(
    currentSelectedService?.price || pet.lastVisit?.price || 25000
  );

  const handleServiceChange = (svcId: string) => {
    setSelectedServiceId(svcId);
    const svc = salonServices.find((s) => s.id === svcId);
    if (svc) {
      setServiceName(svc.name);
      setPrice(svc.price);
    }
  };

  const [sessionMood, setSessionMood] = useState<BehaviorMood>(pet.habitualMood || 'tranquilo');
  const [beforePhoto, setBeforePhoto] = useState<string>(pet.lastVisit?.photos?.beforeUrl || '');
  const [afterPhoto, setAfterPhoto] = useState<string>(pet.lastVisit?.photos?.afterUrl || '');

  // NO fake prefilled session notes: clean empty initial state
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [sessionHealthNotes, setSessionHealthNotes] = useState<string>('');
  const [sessionHandlingNotes, setSessionHandlingNotes] = useState<string>('');

  // Retention interval
  const [selectedInterval, setSelectedInterval] = useState<number | 'custom'>(
    typeof pet.recommendedIntervalWeeks === 'number' ? pet.recommendedIntervalWeeks : 6
  );
  const [customWeeks, setCustomWeeks] = useState('8');
  const [reminderSavedNotice, setReminderSavedNotice] = useState<string | null>(null);

  // UI state & Modals
  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [visitSavedToast, setVisitSavedToast] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [photoModalConfig, setPhotoModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    targetType: 'before' | 'after' | 'avatar';
  }>({
    isOpen: false,
    title: '',
    targetType: 'before'
  });

  // Refs for smooth scroll
  const newVisitRef = useRef<HTMLDivElement>(null);
  const retentionRef = useRef<HTMLDivElement>(null);

  const scrollToNewVisit = () => {
    newVisitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToRetention = () => {
    retentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Change habitual behavior
  const handleHabitualMoodChange = (mood: BehaviorMood) => {
    onUpdatePet({
      ...pet,
      habitualMood: mood
    });
  };

  // Save new visit using actual visit date
  const handleSaveVisit = () => {
    setIsSavingVisit(true);
    const visitDateStr = formatDateSpanish(new Date());
    const weeksToReturn = selectedInterval === 'custom' ? Number(customWeeks) || 6 : selectedInterval;

    const newVisit: Visit = {
      id: 'v-' + Date.now(),
      date: visitDateStr,
      serviceName,
      price: Number(price) || 0,
      currency,
      mood: sessionMood,
      paid: true,
      notes: sessionNotes.trim() || undefined,
      healthNotes: sessionHealthNotes.trim() || undefined,
      handlingNotes: sessionHandlingNotes.trim() || undefined,
      photos: {
        beforeUrl: beforePhoto || undefined,
        afterUrl: afterPhoto || undefined
      },
      nextRecommendedWeeks: weeksToReturn
    };

    setTimeout(() => {
      setIsSavingVisit(false);
      setVisitSavedToast(true);

      const updatedHistory = [newVisit, ...(pet.visitHistory || [])];
      onUpdatePet({
        ...pet,
        lastVisit: newVisit,
        visitHistory: updatedHistory,
        recommendedIntervalWeeks: weeksToReturn
      });

      setTimeout(() => setVisitSavedToast(false), 3000);
    }, 500);
  };

  // Save retention reminder with actual date calculation
  const handleSaveReminder = () => {
    const weeks = selectedInterval === 'custom' ? Number(customWeeks) || 6 : selectedInterval;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Number(weeks) * 7);
    const dateFormatted = formatDateSpanish(targetDate);

    onUpdatePet({
      ...pet,
      recommendedIntervalWeeks: weeks
    });

    setReminderSavedNotice(`¡Próxima visita sugerida calculada para el ${dateFormatted}! (en ${weeks} semanas)`);
    setTimeout(() => setReminderSavedNotice(null), 4000);
  };

  const handleOpenPhotoModal = (target: 'before' | 'after' | 'avatar') => {
    const titles = {
      before: 'Foto Antes del Servicio',
      after: 'Foto Después del Servicio ✨',
      avatar: `Foto de Perfil de ${pet.name}`
    };
    setPhotoModalConfig({
      isOpen: true,
      title: titles[target],
      targetType: target
    });
  };

  const handleSelectPhoto = (url: string) => {
    if (photoModalConfig.targetType === 'before') {
      setBeforePhoto(url);
    } else if (photoModalConfig.targetType === 'after') {
      setAfterPhoto(url);
    } else if (photoModalConfig.targetType === 'avatar') {
      onUpdatePet({
        ...pet,
        photoUrl: url
      });
    }
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {visitSavedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">¡Visita registrada y guardada con éxito!</span>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="relative bg-[#2e004e] text-white px-4 pt-6 pb-12 rounded-b-3xl shadow-lg overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white/10 border-2 border-white/30 shrink-0 shadow-md">
            <img
              src={pet.photoUrl || HOTLINK_IMAGES.toby}
              alt={pet.name}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleOpenPhotoModal('avatar')}
              className="absolute bottom-1 right-1 bg-[#2e004e] text-[#f9b900] p-1 rounded-lg shadow-md cursor-pointer hover:scale-105 transition-transform"
              title="Cambiar foto de perfil"
            >
              <span className="material-symbols-outlined text-sm font-bold">add_a_photo</span>
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xl">🐶</span>
              <h2 className="text-2xl font-bold text-white truncate tracking-tight">
                {pet.name}
              </h2>
            </div>
            <p className="text-sm text-[#e3e0f1] truncate">
              {pet.breed} • {pet.age} • {pet.gender}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/15 text-[#f2daff] font-semibold tracking-wide">
                ID {pet.id}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f9b900] text-[#261900] font-bold">
                {pet.weightKg} kg
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 -mt-5 flex flex-col gap-4 z-20">
        {/* Tarjeta del Tutor */}
        <div className="bg-white rounded-2xl p-4 shadow-md flex items-center justify-between gap-3 border border-[#cfc2d2]/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[#e9e6f7] flex items-center justify-center text-[#2e004e] text-xl shrink-0">
              <span className="material-symbols-outlined text-[#2e004e] text-2xl">person</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#4c4451] uppercase tracking-wider font-bold">
                Tutor Responsable
              </p>
              <p className="font-semibold text-sm text-[#1a1a26] truncate">{pet.tutor.name}</p>
              <p className="text-xs text-[#7e7482] truncate font-mono">{pet.tutor.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              className="w-10 h-10 rounded-xl bg-[#efecfd] flex items-center justify-center text-[#2e004e] hover:bg-[#e3e0f1] transition-colors active:scale-95"
              href={`tel:${pet.tutor.phone}`}
              title="Llamar al tutor"
            >
              <span className="material-symbols-outlined text-xl">call</span>
            </a>
            <a
              className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
              href={`https://wa.me/${pet.tutor.rawPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir chat de WhatsApp"
            >
              <span className="material-symbols-outlined text-xl">chat</span>
            </a>
          </div>
        </div>

        {/* Semáforo de Comportamiento Habitual */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#cfc2d2]/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#7a5900] text-xl">pets</span>
              <span className="font-semibold text-sm text-[#1a1a26]">
                Comportamiento Habitual
              </span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#ffdea1] text-[#261900] font-bold flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  pet.habitualMood === 'tranquilo'
                    ? 'bg-emerald-500'
                    : pet.habitualMood === 'inquieto'
                    ? 'bg-[#7a5900]'
                    : 'bg-rose-500'
                }`}
              ></span>
              <span className="capitalize">{pet.habitualMood}</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleHabitualMoodChange('tranquilo')}
              className={`py-2.5 px-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                pet.habitualMood === 'tranquilo'
                  ? 'bg-emerald-500 text-white font-bold shadow-md scale-[1.02]'
                  : 'bg-[#f5f2ff] text-[#4c4451] opacity-70 hover:opacity-100'
              }`}
              type="button"
            >
              <span className="text-base">🟢</span>
              <span className="text-xs font-semibold">Tranquilo</span>
            </button>

            <button
              onClick={() => handleHabitualMoodChange('inquieto')}
              className={`py-2.5 px-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                pet.habitualMood === 'inquieto'
                  ? 'bg-[#f9b900] text-[#261900] font-bold shadow-md scale-[1.02]'
                  : 'bg-[#f5f2ff] text-[#4c4451] opacity-70 hover:opacity-100'
              }`}
              type="button"
            >
              <span className="text-base">🟡</span>
              <span className="text-xs font-bold">Inquieto</span>
            </button>

            <button
              onClick={() => handleHabitualMoodChange('dificil')}
              className={`py-2.5 px-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                pet.habitualMood === 'dificil'
                  ? 'bg-rose-600 text-white font-bold shadow-md scale-[1.02]'
                  : 'bg-[#f5f2ff] text-[#4c4451] opacity-70 hover:opacity-100'
              }`}
              type="button"
            >
              <span className="text-base">🔴</span>
              <span className="text-xs font-semibold">Difícil</span>
            </button>
          </div>
        </div>

        {/* Observaciones Críticas y Cuidados */}
        <div className="bg-[#f5f2ff] rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col gap-3 border border-[#cfc2d2]/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <span className="material-symbols-outlined text-lg">medical_services</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs text-[#ba1a1a] font-bold uppercase tracking-wider mb-1">
                Salud, Alergias y Piel Sensible
              </h3>
              <p className="text-sm text-[#1a1a26] leading-snug">
                {pet.healthAllergies || 'Sin afecciones registradas.'}
              </p>
            </div>
          </div>

          <div className="h-px bg-[#e3e0f1]/80"></div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#ffdea1] text-[#261900] flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-lg">pan_tool</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs text-[#7a5900] font-bold uppercase tracking-wider mb-1">
                Observaciones de Manejo
              </h3>
              <p className="text-sm text-[#1a1a26] leading-snug">
                {pet.handlingObservations || 'Manejo habitual sin restricciones.'}
              </p>
            </div>
          </div>
        </div>

        {/* Resumen Última Visita */}
        {pet.lastVisit && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#cfc2d2]/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#4c4451] uppercase tracking-wider">
                Última Visita Registrada
              </span>
              <span className="material-symbols-outlined text-[#2e004e] text-lg">history</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[#1a1a26]">{pet.lastVisit.date}</p>
                <p className="text-xs text-[#4c4451]">{pet.lastVisit.serviceName}</p>
              </div>
              <div className="text-right">
                <span className="text-lg text-[#2e004e] font-bold">
                  ${pet.lastVisit.price.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-[#4c4451]">
                    {pet.lastVisit.currency || currency}
                  </span>
                </span>
                <p className="text-xs text-[#7a5900] font-semibold">Pagado</p>
              </div>
            </div>
          </div>
        )}

        {/* Botones de Acción Inmediata */}
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={scrollToNewVisit}
            className="w-full py-3.5 px-4 rounded-xl bg-[#f9b900] text-[#261900] text-base text-center font-bold shadow-md hover:bg-[#ffdea1] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined font-bold text-2xl">add_circle</span>
            <span>+ Registrar Visita</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="py-3 px-2 rounded-xl bg-[#e9e6f7] text-[#2e004e] text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-[#e3e0f1] active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              <span>Editar Ficha</span>
            </button>

            <button
              type="button"
              onClick={scrollToRetention}
              className="py-3 px-2 rounded-xl bg-[#e9e6f7] text-[#2e004e] text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-[#e3e0f1] active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">event_repeat</span>
              <span>Próxima Visita</span>
            </button>
          </div>
        </div>

        {/* Módulo: "Registrar Nueva Visita" (CON FOTOS DEL SERVICIO Y RECOMENDACIÓN DE RETORNO) */}
        <div
          ref={newVisitRef}
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col gap-4 mt-2 border border-[#cfc2d2]/40 transition-all duration-300"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f9b900]"></span>
              <h3 className="text-base sm:text-lg font-bold text-[#2e004e]">Registrar Nueva Visita</h3>
            </div>
            <span className="text-[11px] bg-[#e9e6f7] text-[#2e004e] font-bold px-2.5 py-1 rounded-full">
              Sesión Actual
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {/* Selección de Servicio */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Servicio Realizado
              </label>
              {salonServices.length > 0 ? (
                <div className="relative">
                  <select
                    value={selectedServiceId}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    className="w-full bg-[#f5f2ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl outline-none border border-[#cfc2d2]/20 font-semibold cursor-pointer appearance-none"
                  >
                    {salonServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (${s.price.toLocaleString()} {currency})
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-3 text-[#2e004e] pointer-events-none">
                    expand_more
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Ej: Baño + corte"
                  className="w-full bg-[#f5f2ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl outline-none border border-[#cfc2d2]/20 font-semibold"
                />
              )}
            </div>

            {/* Precio Cobrado */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Precio Cobrado ({currency})
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-[#f5f2ff] text-[#1a1a26] text-lg font-bold px-3.5 py-2 rounded-xl outline-none border border-[#cfc2d2]/20"
                />
                <span className="absolute right-3 top-3 text-xs text-[#7e7482] font-bold font-mono">
                  {currency}
                </span>
              </div>
            </div>

            {/* Comportamiento en Sesión */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1.5">
                Comportamiento en esta Sesión
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['tranquilo', 'inquieto', 'dificil'] as const).map((m) => {
                  const icons = { tranquilo: '🟢', inquieto: '🟡', dificil: '🔴' };
                  const labels = { tranquilo: 'Tranquilo', inquieto: 'Inquieto', dificil: 'Difícil' };
                  const isSelected = sessionMood === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSessionMood(m)}
                      className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? m === 'tranquilo'
                            ? 'bg-emerald-500 text-white font-bold shadow-xs'
                            : m === 'inquieto'
                            ? 'bg-[#f9b900] text-[#261900] font-bold shadow-xs'
                            : 'bg-rose-600 text-white font-bold shadow-xs'
                          : 'bg-[#efecfd] text-[#4c4451]'
                      }`}
                    >
                      <span>{icons[m]}</span>
                      <span className="text-xs">{labels[m]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notas Generales (SIN texto falso por defecto) */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Notas de la Sesión
              </label>
              <textarea
                rows={2}
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Escribe aquí observaciones sobre el estado del pelo, nudos o notas del estilista..."
                className="w-full bg-[#f5f2ff] text-[#1a1a26] text-xs p-3 rounded-xl outline-none resize-none border border-[#cfc2d2]/20"
              />
            </div>

            {/* Carga de Fotos del Servicio (ÚNICO módulo de fotos) */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#2e004e] text-base">photo_camera</span>
                <span>Foto del servicio (Antes y Después)</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Foto Antes */}
                <div className="bg-[#f5f2ff] rounded-2xl p-2.5 flex flex-col gap-2 border border-[#cfc2d2]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1a1a26]">Foto Antes</span>
                    <span className="text-[10px] text-[#7e7482]">{beforePhoto ? 'Cargada' : 'Pendiente'}</span>
                  </div>

                  <div
                    onClick={() => handleOpenPhotoModal('before')}
                    className="aspect-video rounded-xl bg-[#efecfd] overflow-hidden flex flex-col items-center justify-center border border-dashed border-[#cfc2d2] cursor-pointer hover:bg-[#e3e0f1]/50 transition-all relative"
                  >
                    {beforePhoto ? (
                      <img src={beforePhoto} alt="Antes" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-[#7e7482]">pets</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPhotoModal('before')}
                    className="w-full py-1.5 rounded-xl bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">add_a_photo</span>
                    <span>{beforePhoto ? 'Cambiar foto' : 'Subir antes'}</span>
                  </button>
                </div>

                {/* Foto Después */}
                <div className="bg-[#f5f2ff] rounded-2xl p-2.5 flex flex-col gap-2 border border-[#cfc2d2]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2e004e]">Foto Después</span>
                    <span className="text-[10px] text-[#7a5900] font-bold">✨ Final</span>
                  </div>

                  <div
                    onClick={() => handleOpenPhotoModal('after')}
                    className="aspect-video rounded-xl bg-[#f9b900]/10 overflow-hidden flex flex-col items-center justify-center border border-dashed border-[#f9b900]/40 cursor-pointer hover:bg-[#f9b900]/20 transition-all relative"
                  >
                    {afterPhoto ? (
                      <img src={afterPhoto} alt="Después" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-[#7a5900]">auto_awesome</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPhotoModal('after')}
                    className="w-full py-1.5 rounded-xl bg-[#f9b900] text-[#261900] text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">add_a_photo</span>
                    <span>{afterPhoto ? 'Cambiar foto' : 'Subir después'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Entrega de Mascota al Tutor (Reporte WhatsApp) */}
            <div className="p-3.5 rounded-2xl bg-[#f9b900]/15 border border-[#f9b900]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1">
                  <span className="material-symbols-outlined text-base text-[#7a5900]">loyalty</span>
                  <span>Entrega de Mascota al Tutor</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffdea1] text-[#261900] font-bold">
                  WhatsApp
                </span>
              </div>

              <p className="text-xs text-[#4c4451] leading-snug">
                Envía el reporte final de la sesión y recomendación de retorno directamente a <strong>{pet.tutor.name}</strong>.
              </p>

              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>Generar reporte y enviar por WhatsApp</span>
              </button>
            </div>

            {/* Botón Guardar Visita */}
            <button
              type="button"
              onClick={handleSaveVisit}
              disabled={isSavingVisit}
              className="w-full py-3.5 px-4 rounded-xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] text-base font-bold shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              <span className={`material-symbols-outlined font-bold ${isSavingVisit ? 'animate-spin' : ''}`}>
                {isSavingVisit ? 'progress_activity' : 'check_circle'}
              </span>
              <span>{isSavingVisit ? 'Guardando Visita...' : 'Guardar Visita'}</span>
            </button>
          </div>

          <div className="h-px bg-[#e3e0f1] my-1"></div>

          {/* Recomendación de Próxima Visita (Feeds Por volver) */}
          <div ref={retentionRef} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#2e004e] text-xl">
                auto_schedule
              </span>
              <h4 className="text-sm text-[#1a1a26] font-bold">
                ¿Cuándo debería volver {pet.name}?
              </h4>
            </div>

            <p className="text-xs text-[#4c4451] -mt-1 leading-relaxed">
              Recomendación periódica para el cuidado óptimo del manto. Esta recomendación alimentará automáticamente el módulo "Por volver".
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[4, 6, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setSelectedInterval(w)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                    selectedInterval === w
                      ? 'bg-[#2e004e] text-white font-bold shadow-md scale-[1.02]'
                      : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#e9e6f7]'
                  }`}
                >
                  {w} semanas
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSelectedInterval('custom')}
                className={`py-3 px-2 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                  selectedInterval === 'custom'
                    ? 'bg-[#2e004e] text-white font-bold shadow-md scale-[1.02]'
                    : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#e9e6f7]'
                }`}
              >
                Personalizado
              </button>
            </div>

            {selectedInterval === 'custom' && (
              <div className="flex items-center gap-2 bg-[#f5f2ff] p-2 rounded-xl border border-[#cfc2d2]/40">
                <span className="text-xs text-[#4c4451]">Cada</span>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={customWeeks}
                  onChange={(e) => setCustomWeeks(e.target.value)}
                  className="w-16 bg-white text-center font-bold text-xs p-1.5 rounded-lg border border-[#cfc2d2]"
                />
                <span className="text-xs text-[#4c4451]">semanas</span>
              </div>
            )}

            {reminderSavedNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-semibold flex items-center gap-2 border border-emerald-300">
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>{reminderSavedNotice}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveReminder}
              className="w-full mt-1 py-3 px-4 rounded-xl bg-[#4b0878] text-white text-sm font-bold shadow-md hover:bg-[#2e004e] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">notifications_active</span>
              <span>Guardar Recomendación de Retorno</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <WhatsAppShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        pet={pet}
        visit={{
          id: 'temp',
          date: formatDateSpanish(new Date()),
          serviceName,
          price: Number(price) || 0,
          currency,
          mood: sessionMood,
          paid: true,
          photos: {
            beforeUrl: beforePhoto,
            afterUrl: afterPhoto
          },
          nextRecommendedWeeks: selectedInterval === 'custom' ? customWeeks : selectedInterval
        }}
        salonName={salonConfig?.name}
      />

      <EditPetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        pet={pet}
        onSavePet={onUpdatePet}
      />

      <PhotoUploadModal
        isOpen={photoModalConfig.isOpen}
        onClose={() => setPhotoModalConfig((prev) => ({ ...prev, isOpen: false }))}
        title={photoModalConfig.title}
        targetType={photoModalConfig.targetType}
        onSelectPhoto={handleSelectPhoto}
      />
    </div>
  );
};
