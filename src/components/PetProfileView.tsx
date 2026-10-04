import React, { useState, useRef } from 'react';
import { Pet, BehaviorMood, Visit } from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { EditPetModal } from './EditPetModal';
import { PhotoUploadModal } from './PhotoUploadModal';

interface PetProfileViewProps {
  pet: Pet;
  onUpdatePet: (updated: Pet) => void;
  onNavigateOnboarding: () => void;
}

export const PetProfileView: React.FC<PetProfileViewProps> = ({
  pet,
  onUpdatePet,
  onNavigateOnboarding
}) => {
  // New visit form state
  const [serviceName, setServiceName] = useState('Baño + corte');
  const [price, setPrice] = useState(25);
  const [currency, setCurrency] = useState('ARS');
  const [sessionMood, setSessionMood] = useState<BehaviorMood>('inquieto');
  const [beforePhoto, setBeforePhoto] = useState<string>(HOTLINK_IMAGES.photoBefore);
  const [afterPhoto, setAfterPhoto] = useState<string>(HOTLINK_IMAGES.photoAfter);
  const [sessionNotes, setSessionNotes] = useState(
    'Excelente sesión. Toby estuvo tranquilo durante el corte y se le premió con snack hipoalergénico.'
  );
  const [sessionHealthNotes, setSessionHealthNotes] = useState(
    'Aplicado champú dermoprotector avena; lomo sin irritación nueva.'
  );
  const [sessionHandlingNotes, setSessionHandlingNotes] = useState(
    'Aceptó secado facial con toalla suave y difusor mínimo. Sin quejas en pata trasera.'
  );

  // Retention interval
  const [selectedInterval, setSelectedInterval] = useState<number | 'custom'>(6);
  const [customWeeks, setCustomWeeks] = useState('10');
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

  // Save new visit
  const handleSaveVisit = () => {
    setIsSavingVisit(true);

    const newVisit: Visit = {
      id: 'v-' + Date.now(),
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
      serviceName,
      price,
      currency,
      mood: sessionMood,
      paid: true,
      notes: sessionNotes,
      healthNotes: sessionHealthNotes,
      handlingNotes: sessionHandlingNotes,
      photos: {
        beforeUrl: beforePhoto,
        afterUrl: afterPhoto
      },
      nextRecommendedWeeks: selectedInterval === 'custom' ? customWeeks : selectedInterval
    };

    setTimeout(() => {
      setIsSavingVisit(false);
      setVisitSavedToast(true);

      onUpdatePet({
        ...pet,
        lastVisit: newVisit,
        visitHistory: [newVisit, ...pet.visitHistory]
      });

      setTimeout(() => setVisitSavedToast(false), 3000);
    }, 700);
  };

  // Save retention reminder
  const handleSaveReminder = () => {
    const weeks = selectedInterval === 'custom' ? customWeeks : selectedInterval;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Number(weeks) * 7);
    const dateFormatted = targetDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    onUpdatePet({
      ...pet,
      recommendedIntervalWeeks: weeks
    });

    setReminderSavedNotice(`¡Recordatorio programado para el ${dateFormatted}! (en ${weeks} semanas)`);
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
      onUpdatePet({ ...pet, photoUrl: url });
    }
  };

  return (
    <div className="flex flex-col w-full pb-28 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {visitSavedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-xl">check_circle</span>
          <span className="font-bold text-sm">¡Visita registrada y ficha actualizada!</span>
        </div>
      )}

      {/* Cabecera Superior Perfil de Mascota */}
      <div className="bg-[#4b0878] text-white px-4 pt-6 pb-8 rounded-b-[2rem] shadow-lg relative overflow-hidden">
        {/* Glow ambient backgrounds */}
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-[#7d43aa]/20 blur-2xl pointer-events-none"></div>
        <div className="absolute -left-10 bottom-0 w-36 h-36 rounded-full bg-[#f9b900]/10 blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#2e004e] shadow-md shrink-0 relative group">
              <img
                className="w-full h-full object-cover"
                src={pet.photoUrl || HOTLINK_IMAGES.toby}
                alt={pet.name}
              />
              <button
                type="button"
                onClick={() => handleOpenPhotoModal('avatar')}
                className="absolute inset-0 bg-[#2e004e]/60 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer"
                title={`Cambiar foto de ${pet.name}`}
              >
                <span className="material-symbols-outlined text-xl">photo_camera</span>
                <span className="text-[9px] font-bold leading-tight">Cambiar</span>
              </button>
            </div>

            {pet.isVip && (
              <span className="absolute -bottom-2 -left-1 bg-[#f9b900] text-[#261900] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                VIP
              </span>
            )}

            <button
              type="button"
              onClick={() => handleOpenPhotoModal('avatar')}
              className="absolute -bottom-2 -right-1 w-7 h-7 rounded-full bg-white text-[#2e004e] shadow-md border border-[#cfc2d2]/40 flex items-center justify-center hover:bg-[#ffdea1] active:scale-95 transition-all cursor-pointer"
              title="Tomar foto o subir de galería"
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
              <p className="text-xs text-[#7e7482] truncate">{pet.tutor.phone}</p>
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
              className="w-10 h-10 rounded-xl bg-[#f9b900] text-[#261900] flex items-center justify-center font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
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
          {/* Salud, Alergias y Piel Sensible */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <span className="material-symbols-outlined text-lg">medical_services</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xs text-[#ba1a1a] font-bold uppercase tracking-wider">
                  Salud, Alergias y Piel Sensible
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#93000a] font-semibold">
                  Atención
                </span>
              </div>
              <p className="text-sm text-[#1a1a26] leading-snug">
                🩺 {pet.healthAllergies}
              </p>
            </div>
          </div>

          <div className="h-px bg-[#e3e0f1]/80"></div>

          {/* Observaciones de Manejo */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#ffdea1] text-[#261900] flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-lg">pan_tool</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs text-[#7a5900] font-bold uppercase tracking-wider mb-1">
                Observaciones de Manejo
              </h3>
              <p className="text-sm text-[#1a1a26] leading-snug">
                ⚠️ {pet.handlingObservations}
              </p>
            </div>
          </div>
        </div>

        {/* Resumen Última Visita */}
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
                ${pet.lastVisit.price}{' '}
                <span className="text-xs font-semibold text-[#4c4451]">
                  {pet.lastVisit.currency}
                </span>
              </span>
              <p className="text-xs text-[#7e7482]">(${(pet.lastVisit.price * 1000).toLocaleString()} ARS)</p>
              <p className="text-xs text-[#7a5900] font-semibold">Pagado</p>
            </div>
          </div>
        </div>

        {/* Fotos Antes / Después */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#cfc2d2]/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#2e004e] text-xl">
                photo_library
              </span>
              <h3 className="text-sm text-[#1a1a26] font-bold">Documentación Fotográfica</h3>
            </div>
            <span className="text-xs text-[#7e7482]">{pet.lastVisit.date}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => handleOpenPhotoModal('before')}
              className="relative rounded-xl overflow-hidden aspect-square bg-[#efecfd] shadow-inner cursor-pointer group"
            >
              <img
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                src={pet.lastVisit.photos.beforeUrl || HOTLINK_IMAGES.photoBefore}
                alt="Foto Antes del servicio"
              />
              <span className="absolute top-2 left-2 bg-[#2f2f3c]/80 text-[#f2efff] text-xs font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm">
                Antes
              </span>
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                Cambiar foto
              </div>
            </div>

            <div
              onClick={() => handleOpenPhotoModal('after')}
              className="relative rounded-xl overflow-hidden aspect-square bg-[#efecfd] shadow-inner cursor-pointer group"
            >
              <img
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                src={pet.lastVisit.photos.afterUrl || HOTLINK_IMAGES.photoAfter}
                alt="Foto Después del servicio"
              />
              <span className="absolute top-2 left-2 bg-[#4b0878] text-white text-xs font-semibold px-2 py-0.5 rounded-md shadow-sm">
                Después ✨
              </span>
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold">
                Cambiar foto
              </div>
            </div>
          </div>
        </div>

        {/* Botones de Acción Inmediata */}
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={scrollToNewVisit}
            className="w-full h-13 py-3.5 px-4 rounded-xl bg-[#f9b900] text-[#261900] text-base text-center font-bold shadow-md hover:bg-[#ffdea1] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
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

        {/* Módulo Expandido Interactivo: "Registrar Nueva Visita" */}
        <div
          ref={newVisitRef}
          className="bg-white rounded-3xl p-4 shadow-xl flex flex-col gap-4 mt-2 border border-[#cfc2d2]/40 transition-all duration-300"
        >
          <div className="flex items-center justify-between pb-1 border-b border-[#efecfd]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f9b900]"></span>
              <h3 className="text-lg font-bold text-[#2e004e]">Registrar Nueva Visita</h3>
            </div>
            <span className="text-[11px] bg-[#e9e6f7] text-[#2e004e] font-bold px-2.5 py-1 rounded-full">
              En Proceso
            </span>
          </div>

          {/* Campos de Entrada */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Servicio Realizado
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full bg-[#f5f2ff] text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e] transition-all border border-[#cfc2d2]/20"
                />
                <span className="material-symbols-outlined absolute right-3 top-2.5 text-[#2e004e]">
                  content_cut
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1">
                Precio Cobrado y Moneda
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-[#f5f2ff] text-[#1a1a26] text-lg font-bold px-3.5 py-2 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e] transition-all border border-[#cfc2d2]/20"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-2.5 text-[#2e004e]">
                    attach_money
                  </span>
                </div>
                <div className="relative w-32 shrink-0">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-full bg-[#f5f2ff] text-[#1a1a26] text-xs font-bold px-3 py-2 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e] transition-all appearance-none cursor-pointer border border-[#cfc2d2]/20"
                  >
                    <option value="ARS">🇦🇷 ARS ($)</option>
                    <option value="USD">🇺🇸 USD ($)</option>
                    <option value="MXN">🇲🇽 MXN ($)</option>
                    <option value="COP">🇨🇴 COP ($)</option>
                    <option value="CLP">🇨🇱 CLP ($)</option>
                    <option value="UYU">UYU ($)</option>
                    <option value="PEN">🇵🇪 PEN (S/)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[#4c4451] pointer-events-none text-lg">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Comportamiento en Sesión */}
            <div>
              <label className="text-xs font-bold text-[#4c4451] block mb-1.5">
                Comportamiento en esta Sesión
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSessionMood('tranquilo')}
                  className={`py-2.5 px-1 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                    sessionMood === 'tranquilo'
                      ? 'bg-emerald-500 text-white font-bold shadow-sm scale-[1.02]'
                      : 'bg-[#efecfd] text-[#4c4451]'
                  }`}
                >
                  <span>🟢</span>
                  <span className="text-xs">Tranquilo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionMood('inquieto')}
                  className={`py-2.5 px-1 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                    sessionMood === 'inquieto'
                      ? 'bg-[#f9b900] text-[#261900] font-bold shadow-sm scale-[1.02]'
                      : 'bg-[#efecfd] text-[#4c4451]'
                  }`}
                >
                  <span>🟡</span>
                  <span className="text-xs font-bold">Inquieto</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionMood('dificil')}
                  className={`py-2.5 px-1 rounded-xl flex flex-col items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                    sessionMood === 'dificil'
                      ? 'bg-rose-600 text-white font-bold shadow-sm scale-[1.02]'
                      : 'bg-[#efecfd] text-[#4c4451]'
                  }`}
                >
                  <span>🔴</span>
                  <span className="text-xs">Difícil</span>
                </button>
              </div>
            </div>

            {/* Notas de la Sesión */}
            <div className="flex flex-col gap-2.5">
              <div className="p-3 rounded-xl bg-[#f5f2ff]/70 border border-[#cfc2d2]/40 flex flex-col gap-2">
                <div>
                  <label className="text-xs text-[#2e004e] font-bold flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-sm text-[#ba1a1a]">
                      health_and_safety
                    </span>
                    Salud, Alergias y Piel Sensible (Esta Sesión)
                  </label>
                  <input
                    type="text"
                    value={sessionHealthNotes}
                    onChange={(e) => setSessionHealthNotes(e.target.value)}
                    className="w-full bg-white text-[#1a1a26] text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-[#2e004e] border border-[#cfc2d2]/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#7a5900] font-bold flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-sm">pan_tool</span>
                    Observaciones de Manejo de la Sesión
                  </label>
                  <input
                    type="text"
                    value={sessionHandlingNotes}
                    onChange={(e) => setSessionHandlingNotes(e.target.value)}
                    className="w-full bg-white text-[#1a1a26] text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-[#2e004e] border border-[#cfc2d2]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4c4451] block mb-1">
                  Notas Generales de la Sesión
                </label>
                <textarea
                  rows={2}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full bg-[#f5f2ff] text-[#1a1a26] text-xs p-3 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e] transition-all resize-none border border-[#cfc2d2]/20"
                />
              </div>
            </div>

            {/* Carga de Fotos del Servicio (Antes y Después) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-[#4c4451] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#2e004e] text-base">
                    photo_camera
                  </span>
                  Carga de Fotos del Servicio
                </label>
                <span className="text-xs text-[#7a5900] font-semibold">Antes y Después</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Foto Antes box */}
                <div className="bg-[#f5f2ff] rounded-2xl p-2.5 flex flex-col gap-2 border border-[#cfc2d2]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#7e7482]"></span>
                      Foto Antes
                    </span>
                    <span className="text-[10px] text-[#7e7482] font-semibold">
                      {beforePhoto ? 'Cargada' : 'Pendiente'}
                    </span>
                  </div>

                  <div
                    onClick={() => handleOpenPhotoModal('before')}
                    className="aspect-video rounded-xl bg-[#efecfd] overflow-hidden flex flex-col items-center justify-center border border-dashed border-[#cfc2d2] cursor-pointer hover:bg-[#e3e0f1]/50 transition-all relative group"
                  >
                    {beforePhoto ? (
                      <img
                        src={beforePhoto}
                        alt="Preview Antes"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-2xl text-[#7e7482] mb-0.5">
                          pets
                        </span>
                        <span className="text-[11px] text-[#7e7482]">Vista previa</span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenPhotoModal('before')}
                      className="w-full py-2 px-2 rounded-xl bg-[#2e004e] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#4b0878] active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">photo_camera</span>
                      Tomar Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenPhotoModal('before')}
                      className="w-full py-1.5 px-2 rounded-xl bg-white text-[#1a1a26] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#cfc2d2]/30 hover:bg-[#f5f2ff] active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm text-[#7e7482]">
                        photo_library
                      </span>
                      Galería
                    </button>
                  </div>
                </div>

                {/* Foto Después box */}
                <div className="bg-[#f5f2ff] rounded-2xl p-2.5 flex flex-col gap-2 border border-[#cfc2d2]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2e004e] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#f9b900]"></span>
                      Foto Después
                    </span>
                    <span className="text-[10px] text-[#7a5900] font-bold">✨ Final</span>
                  </div>

                  <div
                    onClick={() => handleOpenPhotoModal('after')}
                    className="aspect-video rounded-xl bg-[#f9b900]/10 overflow-hidden flex flex-col items-center justify-center border border-dashed border-[#f9b900]/40 cursor-pointer hover:bg-[#f9b900]/20 transition-all relative group"
                  >
                    {afterPhoto ? (
                      <img
                        src={afterPhoto}
                        alt="Preview Después"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-2xl text-[#7a5900] mb-0.5">
                          auto_awesome
                        </span>
                        <span className="text-[11px] text-[#7a5900] font-medium">
                          Vista previa
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenPhotoModal('after')}
                      className="w-full py-2 px-2 rounded-xl bg-[#f9b900] text-[#261900] text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#ffdea1] active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">photo_camera</span>
                      Tomar Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenPhotoModal('after')}
                      className="w-full py-1.5 px-2 rounded-xl bg-white text-[#1a1a26] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#cfc2d2]/30 hover:bg-[#f5f2ff] active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm text-[#7e7482]">
                        photo_library
                      </span>
                      Galería
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Upload Alt Row */}
            <div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenPhotoModal('before')}
                  className="aspect-[4/3] rounded-2xl bg-[#f5f2ff] hover:bg-[#e9e6f7] transition-colors flex flex-col items-center justify-center gap-1 text-[#2e004e] active:scale-95 cursor-pointer border border-[#cfc2d2]/20"
                >
                  <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                  <span className="text-xs font-bold">Foto Antes</span>
                  <span className="text-[11px] text-[#7e7482]">Subir archivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenPhotoModal('after')}
                  className="aspect-[4/3] rounded-2xl bg-[#f5f2ff] hover:bg-[#e9e6f7] transition-colors flex flex-col items-center justify-center gap-1 text-[#2e004e] active:scale-95 cursor-pointer border border-[#cfc2d2]/20"
                >
                  <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                  <span className="text-xs font-bold">Foto Después</span>
                  <span className="text-[11px] text-[#7e7482]">Subir archivo</span>
                </button>
              </div>
            </div>

            {/* Entrega de Mascota al Tutor */}
            <div className="p-3.5 rounded-2xl bg-[#f9b900]/15 border border-[#f9b900]/40 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#7a5900] text-xl">loyalty</span>
                  <h4 className="text-xs font-bold text-[#1a1a26]">
                    Entrega de Mascota al Tutor
                  </h4>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffdea1] text-[#261900] font-bold">
                  WhatsApp
                </span>
              </div>

              <p className="text-xs text-[#4c4451] leading-snug">
                Captura la foto final de {pet.name} listo y envía automáticamente el comparativo
                Antes/Después con el resumen de la visita a <strong>{pet.tutor.name}</strong>.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPhotoModal('after')}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#f9b900] text-[#261900] text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-[#ffdea1] active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_a_photo</span>
                  Tomar Foto de Entrega
                </button>

                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="py-2.5 px-3.5 rounded-xl bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">share</span>
                  Reporte
                </button>
              </div>
            </div>

            {/* Botón Guardar Visita */}
            <button
              type="button"
              onClick={handleSaveVisit}
              disabled={isSavingVisit}
              className="w-full py-3.5 px-4 rounded-xl bg-[#f9b900] text-[#261900] text-base font-bold shadow-md hover:bg-[#ffdea1] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              <span className={`material-symbols-outlined font-bold ${isSavingVisit ? 'animate-spin' : ''}`}>
                {isSavingVisit ? 'progress_activity' : 'check_circle'}
              </span>
              <span>{isSavingVisit ? 'Guardando Visita...' : 'Guardar Visita'}</span>
            </button>
          </div>

          {/* Separador Sutil */}
          <div className="h-px bg-[#e3e0f1] my-1"></div>

          {/* Pregunta de Retención / Próxima Visita */}
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
              Recomendación periódica para el cuidado óptimo del manto.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[4, 6, 8].map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => setSelectedInterval(weeks)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold text-center transition-all active:scale-95 cursor-pointer ${
                    selectedInterval === weeks
                      ? 'bg-[#2e004e] text-white font-bold shadow-md scale-[1.02]'
                      : 'bg-[#f5f2ff] text-[#4c4451] hover:bg-[#e9e6f7]'
                  }`}
                >
                  {weeks} semanas
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSelectedInterval('custom')}
                className={`py-3 px-2 rounded-xl text-xs font-semibold text-center transition-all active:scale-95 cursor-pointer ${
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
              <span>Guardar Recordatorio</span>
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
          date: 'Hoy',
          serviceName,
          price,
          currency,
          mood: sessionMood,
          paid: true,
          photos: {
            beforeUrl: beforePhoto,
            afterUrl: afterPhoto
          },
          nextRecommendedWeeks: selectedInterval === 'custom' ? customWeeks : selectedInterval
        }}
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
