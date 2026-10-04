import React, { useState } from 'react';
import { Pet, Visit } from '../types';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pet: Pet;
  visit: Visit;
  salonName?: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  pet,
  visit,
  salonName = 'Peluquería Canina Luna'
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const defaultMsg = `🐾 *¡Hola ${pet.tutor.name}!* \n\n¡${pet.name} ya está listo/a y reluciente en *${salonName}*! ✨🐶\n\n📋 *Resumen de la visita:*\n• Servicio: ${visit.serviceName}\n• Comportamiento: ${
    visit.mood === 'tranquilo' ? '🟢 Muy tranquilo y colaborador' : visit.mood === 'inquieto' ? '🟡 Inquieto pero con excelente avance' : '🔴 Con cuidados especiales'
  }\n• Total abonado: $${visit.price.toLocaleString()} ${visit.currency}\n• Piel & Cuidados: ${pet.healthAllergies || 'Manto en excelente estado'}\n• Próxima visita sugerida: en ${visit.nextRecommendedWeeks || pet.recommendedIntervalWeeks || 6} semanas.\n\n📸 ¡Muchas gracias por confiar el cuidado de ${pet.name} en nosotros! Te esperamos pronto.`;

  const rawPhone = pet.tutor.rawPhone || pet.tutor.phone.replace(/\D/g, '');
  const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(defaultMsg)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(defaultMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-[#25D366] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">chat</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Reporte de Entrega al Tutor</h3>
              <p className="text-xs text-white/90">Envío directo a {pet.tutor.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-95 text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Card Preview */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#cfc2d2]/30 space-y-3">
            <div className="flex items-center justify-between border-b border-[#efecfd] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐶</span>
                <div>
                  <h4 className="font-bold text-sm text-[#1a1a26]">{pet.name}</h4>
                  <p className="text-xs text-[#7e7482]">{pet.breed} • {pet.weightKg} kg</p>
                </div>
              </div>
              <span className="bg-[#f9b900] text-[#261900] text-[10px] font-bold px-2 py-0.5 rounded-full">
                Listo para retirar
              </span>
            </div>

            {/* Before / After comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative rounded-xl overflow-hidden aspect-square bg-[#efecfd]">
                {visit.photos.beforeUrl ? (
                  <img
                    src={visit.photos.beforeUrl}
                    alt="Antes"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#7e7482]">Sin foto antes</div>
                )}
                <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Antes
                </span>
              </div>
              <div className="relative rounded-xl overflow-hidden aspect-square bg-[#efecfd]">
                {visit.photos.afterUrl ? (
                  <img
                    src={visit.photos.afterUrl}
                    alt="Después"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#7e7482]">Sin foto después</div>
                )}
                <span className="absolute top-1.5 left-1.5 bg-[#4b0878] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                  Después ✨
                </span>
              </div>
            </div>

            {/* Details snippet */}
            <div className="bg-[#f5f2ff] rounded-xl p-3 text-xs space-y-1.5 text-[#1a1a26]">
              <div className="flex justify-between">
                <span className="text-[#4c4451]">Salón:</span>
                <span className="font-bold text-[#2e004e]">{salonName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4c4451]">Servicio:</span>
                <span className="font-semibold">{visit.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4c4451]">Importe:</span>
                <span className="font-bold text-[#2e004e]">${visit.price.toLocaleString()} {visit.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4c4451]">Próximo turno recomendado:</span>
                <span className="font-bold text-[#7a5900]">{visit.nextRecommendedWeeks || pet.recommendedIntervalWeeks || 6} semanas</span>
              </div>
            </div>
          </div>

          {/* Photo attachment note */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-[#7a5900] flex items-start gap-2">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">info</span>
            <p className="leading-tight">
              Al abrir WhatsApp, el mensaje se enviará con todos los datos y recomendaciones. Podrás adjuntar las fotos de Antes/Después desde tu galería directamente en el chat.
            </p>
          </div>

          {/* Text preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#4c4451] uppercase tracking-wider">
                Mensaje preconfigurado
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-[#4b0878] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'done' : 'content_copy'}
                </span>
                {copied ? '¡Copiado!' : 'Copiar texto'}
              </button>
            </div>
            <textarea
              readOnly
              rows={5}
              value={defaultMsg}
              className="w-full p-3 bg-white text-xs text-[#1a1a26] rounded-xl border border-[#cfc2d2]/40 outline-none resize-none font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#cfc2d2]/40 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-[#cfc2d2] text-[#4c4451] font-semibold text-sm hover:bg-[#f5f2ff] cursor-pointer"
          >
            Cerrar
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] text-white font-bold text-sm shadow-md hover:bg-[#20ba59] active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">chat</span>
            <span>Enviar por WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
