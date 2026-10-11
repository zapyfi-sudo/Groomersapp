import React, { useState } from 'react';
import { RetentionPet } from '../types';
import { AppLanguage, TRANSLATIONS } from '../utils/translations';

interface RetentionViewProps {
  retentionPets: RetentionPet[];
  onSelectPetForProfile: (petId: string) => void;
  onMarkAsBooked: (id: string) => void;
  onOpenWhatsApp: (pet: RetentionPet) => void;
  currentLanguage?: AppLanguage;
}

export const RetentionView: React.FC<RetentionViewProps> = ({
  retentionPets,
  onSelectPetForProfile,
  onMarkAsBooked,
  onOpenWhatsApp,
  currentLanguage = 'es-LA'
}) => {
  const [filter, setFilter] = useState<'todos' | 'urgentes' | 'proxima'>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS['es-LA'];

  const unbookedPets = retentionPets.filter((p) => !p.alreadyBooked);
  const totalCount = unbookedPets.length;
  const urgentCount = unbookedPets.filter((p) => p.urgency === 'esta_semana' || p.urgency === 'urgente').length;
  const nextWeekCount = unbookedPets.filter((p) => p.urgency === 'proxima_semana').length;

  const filteredPets = retentionPets.filter((p) => {
    if (filter === 'urgentes') {
      return p.urgency === 'esta_semana' || p.urgency === 'urgente';
    }
    if (filter === 'proxima') {
      return p.urgency === 'proxima_semana';
    }
    return true;
  });

  const handleCopyMessage = (pet: RetentionPet) => {
    navigator.clipboard.writeText(pet.suggestedMessage);
    setCopiedId(pet.id);
    setToastMessage(`Mensaje para ${pet.tutorName} copiado al portapapeles`);
    setTimeout(() => {
      setCopiedId(null);
      setToastMessage(null);
    }, 2500);
  };

  const handleBookedClick = (id: string, name: string) => {
    onMarkAsBooked(id);
    setToastMessage(`¡${name} marcado como agendado!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col w-full pb-32 px-4 sm:px-6 pt-3 space-y-4 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* MÓDULO DE FIDELIZACIÓN - Hero Card */}
      <div className="bg-gradient-to-br from-[#2e004e] via-[#35045c] to-[#4b0878] text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold tracking-wide backdrop-blur-xs">
              <span className="material-symbols-outlined text-sm text-[#f9b900]">sync</span>
              <span>{t.fidelizationModule}</span>
            </div>
            <span className="px-3 py-0.5 rounded-full bg-[#f9b900] text-[#261900] text-xs font-bold shadow-xs">
              Activo
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {t.retentionTitle}
            </h2>
            <p className="text-xs text-[#e3e0f1] mt-1.5 leading-relaxed font-normal">
              {t.retentionSubtitle}
            </p>
          </div>

          {/* Metrics bar dynamically calculated */}
          <div className="pt-2 border-t border-white/10 flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-white/90">
              <span className="material-symbols-outlined text-base text-[#f9b900]">outgoing_mail</span>
              <span><strong>{totalCount}</strong> {t.toContact}</span>
            </div>
            <div className="h-3 w-px bg-white/20"></div>
            <div className="flex items-center gap-1.5 text-[#f9b900]">
              <span className="w-2 h-2 rounded-full bg-[#f9b900] animate-pulse"></span>
              <span><strong>{urgentCount}</strong> {t.thisWeek}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setFilter('todos')}
          className={`py-2 px-3.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            filter === 'todos'
              ? 'bg-[#2e004e] text-white shadow-sm'
              : 'bg-[#e9e6f7] text-[#4c4451] hover:bg-[#e3e0f1]'
          }`}
        >
          <span>{t.filterAll}</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              filter === 'todos' ? 'bg-[#f9b900] text-[#261900]' : 'bg-white/60 text-[#4c4451]'
            }`}
          >
            {retentionPets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('urgentes')}
          className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            filter === 'urgentes'
              ? 'bg-[#2e004e] text-white shadow-sm'
              : 'bg-[#e9e6f7] text-[#4c4451] hover:bg-[#e3e0f1]'
          }`}
        >
          <span>{t.filterUrgent} ({urgentCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('proxima')}
          className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            filter === 'proxima'
              ? 'bg-[#2e004e] text-white shadow-sm'
              : 'bg-[#e9e6f7] text-[#4c4451] hover:bg-[#e3e0f1]'
          }`}
        >
          <span>{t.filterNextWeek} ({nextWeekCount})</span>
        </button>
      </div>

      {/* Retention Cards List */}
      {filteredPets.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-300 space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#f5f2ff] text-[#4b0878] flex items-center justify-center mx-auto text-2xl font-bold">
            <span className="material-symbols-outlined text-3xl">done_all</span>
          </div>
          <h3 className="text-sm font-bold text-[#1a1a26]">{t.noRetentionDue}</h3>
          <p className="text-xs text-[#7e7482] max-w-sm mx-auto">
            Cuando registres visitas para tus mascotas y asignes una recomendación de retorno (4, 6 u 8 semanas), aparecerán automáticamente aquí cuando sea momento de recordarles su próximo turno.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPets.map((pet) => {
            return (
              <div
                key={pet.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all ${
                  pet.alreadyBooked
                    ? 'border-gray-200 opacity-60 bg-gray-50'
                    : pet.urgency === 'urgente'
                    ? 'border-[#ba1a1a]/30 ring-1 ring-[#ba1a1a]/20'
                    : 'border-[#cfc2d2]/40'
                }`}
              >
                {/* Pet Header */}
                <div className="pb-3.5 border-b border-gray-100">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Pet Photo on the left */}
                    <div
                      onClick={() => onSelectPetForProfile(pet.petId)}
                      className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden bg-[#f5f2ff] shrink-0 border border-[#cfc2d2]/40 shadow-2xs cursor-pointer group"
                    >
                      {pet.photoUrl ? (
                        <img
                          src={pet.photoUrl}
                          alt={pet.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl sm:text-2xl text-[#7e7482]">
                          🐶
                        </div>
                      )}
                    </div>

                    {/* Information Column to the right of the photo */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: Name & Urgency Badge */}
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
                          {/* 1. Nombre de la mascota */}
                          <h4
                            onClick={() => onSelectPetForProfile(pet.petId)}
                            className="font-extrabold text-base sm:text-lg text-[#1a1a26] hover:text-[#2e004e] transition-colors cursor-pointer leading-tight truncate"
                            title={pet.name}
                          >
                            {pet.name}
                          </h4>

                          {/* 2. Raza, si está disponible */}
                          {pet.breed && (
                            <p
                              className="text-xs sm:text-[13px] text-[#7e7482] font-medium leading-tight mt-0.5 truncate"
                              title={pet.breed}
                            >
                              {pet.breed}
                            </p>
                          )}
                        </div>

                        {/* Urgency Badge & Countdown */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span
                            className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider whitespace-nowrap shadow-2xs ${
                              pet.alreadyBooked
                                ? 'bg-gray-200 text-gray-700'
                                : pet.urgency === 'urgente'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : pet.urgency === 'esta_semana'
                                ? 'bg-[#f9b900] text-[#261900] shadow-xs'
                                : pet.urgency === 'proxima_semana'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {pet.alreadyBooked ? t.alreadyBooked : pet.urgencyLabel}
                          </span>

                          {pet.countdownText && !pet.alreadyBooked && (
                            <span
                              className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border whitespace-nowrap ${
                                pet.urgency === 'urgente'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : pet.urgency === 'esta_semana'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-[#f5f2ff] text-[#4b0878] border-[#cfc2d2]/40'
                              }`}
                            >
                              <span className="material-symbols-outlined text-xs">
                                {pet.daysRemaining !== undefined && pet.daysRemaining <= 0 ? 'warning' : 'hourglass_top'}
                              </span>
                              <span>{pet.countdownText}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Secondary Information Hierarchy: Última visita, Tutor, Teléfono */}
                      <div className="mt-2 space-y-1 text-xs">
                        {/* 3. Última visita */}
                        <div className="flex items-center gap-1.5 text-[#5c5462] leading-relaxed">
                          <span className="material-symbols-outlined text-[15px] text-[#7e7482] shrink-0">
                            calendar_today
                          </span>
                          <span className="break-normal">
                            <span className="font-medium text-[#4c4451]">{t.lastVisit}:</span>{' '}
                            <strong className="font-semibold text-[#1a1a26] whitespace-nowrap">{pet.lastVisitDate}</strong>
                            {pet.weeksSinceLastVisit ? (
                              <span className="text-[#7e7482] ml-1.5 whitespace-nowrap inline-block">
                                (Hace {pet.weeksSinceLastVisit} {t.weeksAgo})
                              </span>
                            ) : null}
                          </span>
                        </div>

                        {/* Próxima visita recomendada (si existe) */}
                        {pet.nextRecommendedDate && (
                          <div className="flex items-center gap-1.5 text-[#2e004e] leading-relaxed">
                            <span className="material-symbols-outlined text-[15px] text-[#7a5900] shrink-0">
                              event_upcoming
                            </span>
                            <span className="break-normal">
                              <span className="font-medium text-[#4c4451]">Próxima visita:</span>{' '}
                              <strong className="font-bold text-[#2e004e] whitespace-nowrap">{pet.nextRecommendedDate}</strong>
                            </span>
                          </div>
                        )}

                        {/* 4. Nombre del tutor */}
                        <div className="flex items-center gap-1.5 text-[#5c5462] leading-relaxed">
                          <span className="material-symbols-outlined text-[15px] text-[#7e7482] shrink-0">
                            person
                          </span>
                          <span className="break-normal">
                            <span className="text-[#5c5462]">Tutor:</span>{' '}
                            <strong className="font-semibold text-[#1a1a26]">{pet.tutorName}</strong>
                          </span>
                        </div>

                        {/* 5. Teléfono */}
                        {pet.tutorPhone && (
                          <div className="flex items-center gap-1.5 text-[#5c5462] leading-relaxed">
                            <span className="material-symbols-outlined text-[15px] text-[#7e7482] shrink-0">
                              call
                            </span>
                            <span className="font-mono text-xs font-semibold text-[#1a1a26] whitespace-nowrap tracking-tight select-all">
                              {pet.tutorPhone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Suggested Smart Message */}
                <div className="pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#4b0878] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      <span>{t.suggestedMessageTitle} ({pet.templateName})</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopyMessage(pet)}
                      className="text-[11px] font-bold text-[#4b0878] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedId === pet.id ? 'done' : 'content_copy'}
                      </span>
                      <span>{copiedId === pet.id ? '¡Copiado!' : t.copyMessage}</span>
                    </button>
                  </div>

                  <div className="bg-[#f5f2ff] p-3 rounded-xl border border-[#cfc2d2]/30 text-xs text-[#1a1a26] leading-relaxed">
                    {pet.suggestedMessage}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => handleBookedClick(pet.id, pet.name)}
                      className={`w-full sm:w-auto py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        pet.alreadyBooked
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-[#efecfd] text-[#2e004e] hover:bg-[#e3e0f1]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {pet.alreadyBooked ? 'undo' : 'check_circle'}
                      </span>
                      <span>{pet.alreadyBooked ? 'Desmarcar agendado' : t.markBooked}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenWhatsApp(pet)}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                      <span>{t.sendWhatsApp}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
