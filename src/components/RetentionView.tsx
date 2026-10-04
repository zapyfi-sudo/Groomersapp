import React, { useState } from 'react';
import { RetentionPet, Pet } from '../types';

interface RetentionViewProps {
  retentionPets: RetentionPet[];
  onSelectPetForProfile: (petId: string) => void;
  onMarkAsBooked: (id: string) => void;
  onOpenWhatsApp: (pet: RetentionPet) => void;
}

export const RetentionView: React.FC<RetentionViewProps> = ({
  retentionPets,
  onSelectPetForProfile,
  onMarkAsBooked,
  onOpenWhatsApp
}) => {
  const [filter, setFilter] = useState<'todos' | 'urgentes' | 'proxima'>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(retentionPets[0]?.id || 'ret-1');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalCount = retentionPets.length;
  const urgentCount = retentionPets.filter((p) => p.urgency === 'esta_semana' || p.urgency === 'urgente').length;
  const nextWeekCount = retentionPets.filter((p) => p.urgency === 'proxima_semana').length;

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
    setToastMessage(`¡${name} marcado como reservado! Turno agendado.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col w-full pb-28 px-4 sm:px-6 pt-3 space-y-4 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2e004e] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-[#f9b900] animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-[#f9b900] text-lg">check_circle</span>
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* MÓDULO DE FIDELIZACIÓN - Hero Card */}
      <div className="bg-gradient-to-br from-[#2e004e] via-[#35045c] to-[#4b0878] text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        {/* Glow backdrop accents */}
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#f9b900]/15 blur-2xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-36 h-36 rounded-full bg-[#7d43aa]/30 blur-xl pointer-events-none"></div>

        <div className="relative z-10 space-y-3">
          {/* Top badges */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold tracking-wide backdrop-blur-xs">
              <span className="material-symbols-outlined text-sm text-[#f9b900]">sync</span>
              <span>MÓDULO DE FIDELIZACIÓN</span>
            </div>
            <span className="px-3 py-0.5 rounded-full bg-[#f9b900] text-[#261900] text-xs font-bold shadow-xs">
              Activo
            </span>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Clientes por volver
            </h2>
            <p className="text-xs text-[#e3e0f1] mt-1.5 leading-relaxed font-normal">
              Estas mascotas están cerca de su próxima visita recomendada para mantener su manto
              saludable y libre de nudos.
            </p>
          </div>

          {/* Metrics bar */}
          <div className="pt-2 border-t border-white/10 flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-white/90">
              <span className="material-symbols-outlined text-base text-[#f9b900]">outgoing_mail</span>
              <span><strong>{totalCount + 1}</strong> por contactar</span>
            </div>
            <div className="h-3 w-px bg-white/20"></div>
            <div className="flex items-center gap-1.5 text-[#f9b900]">
              <span className="w-2 h-2 rounded-full bg-[#f9b900] animate-pulse"></span>
              <span><strong>{urgentCount}</strong> esta semana</span>
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
          <span>Todos</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              filter === 'todos' ? 'bg-[#f9b900] text-[#261900]' : 'bg-white/60 text-[#4c4451]'
            }`}
          >
            {totalCount}
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
          <span>Urgentes ({urgentCount})</span>
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
          <span>Próxima semana ({nextWeekCount})</span>
        </button>
      </div>

      {/* Retention Pet Cards List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredPets.map((pet) => {
          const isExpanded = expandedId === pet.id;

          return (
            <div
              key={pet.id}
              className={`rounded-3xl p-4 bg-white shadow-sm transition-all duration-200 ${
                pet.id === 'ret-1'
                  ? 'border-2 border-dashed border-[#5b95ff]/70 shadow-md ring-4 ring-[#5b95ff]/10'
                  : 'border border-[#cfc2d2]/40 hover:border-[#4b0878]/40'
              }`}
            >
              {/* Pet Header */}
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                  onClick={() => onSelectPetForProfile(pet.petId)}
                  title="Ver ficha completa"
                >
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-[#efecfd] shrink-0 border border-[#cfc2d2]/30">
                    <img
                      src={pet.photoUrl}
                      alt={pet.name}
                      className="w-full h-full object-cover"
                    />
                    {pet.isVip && (
                      <span className="absolute bottom-0 right-0 bg-[#f9b900] text-[#261900] text-[8px] font-bold px-1 rounded-tl">
                        VIP
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-base text-[#1a1a26] truncate">
                        {pet.name}
                      </h3>
                      <span className="text-sm">🐶</span>
                    </div>
                    <p className="text-xs text-[#7e7482] truncate">
                      {pet.breed} • <span className="text-[#4c4451] font-medium">{pet.tutorName}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="px-3 py-1 rounded-full bg-[#f9b900] text-[#261900] font-bold text-xs flex items-center gap-1 shadow-2xs">
                    {pet.urgencyLabel}
                  </span>
                </div>
              </div>

              {/* Collapsible Visit Time Summary */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : pet.id)}
                  className="w-full bg-[#f5f2ff] hover:bg-[#efecfd] text-[#1a1a26] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-[#4c4451]">
                    <span className="material-symbols-outlined text-sm text-[#7e7482]">history</span>
                    <span>
                      Última visita: <strong>{pet.lastVisitDate}</strong> (hace {pet.weeksSinceLastVisit} sem)
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-base text-[#7e7482]">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              </div>

              {/* Expandable Section: Suggested Smart Message & WhatsApp Actions */}
              {isExpanded && (
                <div className="mt-3 space-y-3 pt-1 border-t border-[#efecfd] animate-in fade-in duration-150">
                  {/* Smart Message Header */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#2e004e] uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">chat</span>
                      MENSAJE INTELIGENTE SUGERIDO
                    </span>
                    <span className="text-[#7e7482] font-medium">{pet.templateName}</span>
                  </div>

                  {/* WhatsApp Chat Bubble Card */}
                  <div className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-2xl p-3.5 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs font-bold text-[#2e004e]">
                        <span className="material-symbols-outlined text-sm">pets</span>
                        <span>AgendaCan AI Assistant</span>
                      </div>
                      <span className="text-[10px] text-[#7e7482] font-semibold bg-white px-2 py-0.5 rounded-full border border-[#cfc2d2]/30">
                        Personalizado
                      </span>
                    </div>

                    <p className="text-xs text-[#1a1a26] leading-relaxed font-normal">
                      {pet.suggestedMessage}
                    </p>

                    <div className="flex items-center justify-end gap-1 text-[10px] text-[#7e7482] pt-1">
                      <span>10:42 AM</span>
                      <span className="material-symbols-outlined text-xs text-[#4b0878]">done_all</span>
                    </div>
                  </div>

                  {/* Primary CTA: Abrir WhatsApp */}
                  <button
                    type="button"
                    onClick={() => onOpenWhatsApp(pet)}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg font-bold">send</span>
                    <span>Abrir WhatsApp</span>
                  </button>

                  {/* Secondary Actions: Copiar mensaje & Ya reservó */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(pet)}
                      className="py-3 px-3 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {copiedId === pet.id ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedId === pet.id ? '¡Copiado!' : 'Copiar mensaje'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBookedClick(pet.id, pet.name)}
                      className={`py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                        pet.alreadyBooked
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-[#e9e6f7] hover:bg-[#e3e0f1] text-[#2e004e]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {pet.alreadyBooked ? 'check_circle' : 'task_alt'}
                      </span>
                      <span>{pet.alreadyBooked ? 'Agendado' : 'Ya reservó'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
