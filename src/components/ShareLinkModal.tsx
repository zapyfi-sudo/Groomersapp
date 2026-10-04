import React, { useState } from 'react';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName: string;
  bookingSlug: string;
  onOpenClientPortal: () => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  salonName,
  bookingSlug,
  onOpenClientPortal
}) => {
  const [copiedType, setCopiedType] = useState<'link' | 'bio' | null>(null);

  if (!isOpen) return null;

  const fullUrl = `https://${bookingSlug}`;
  const socialBioText = `🐶✨ ¡Haz tu cita online acá! Reserva el baño o corte de tu mascota en ${salonName} en menos de 2 minutos:\n👉 ${fullUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopiedType('link');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyBioText = () => {
    navigator.clipboard.writeText(socialBioText);
    setCopiedType('bio');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(socialBioText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f9b900] text-[#261900] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">share</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Enlace Público de Reservas</h3>
              <p className="text-[11px] text-[#f2daff]">Para compartir en redes sociales y bio de WhatsApp</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Salon Identification Card */}
          <div className="bg-white rounded-2xl p-4 border border-[#cfc2d2]/30 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f5f2ff] flex items-center justify-center text-[#4b0878]">
                <span className="material-symbols-outlined text-xl">storefront</span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#1a1a26]">{salonName}</h4>
                <p className="text-xs text-[#7e7482]">Portal de agendamiento 24/7 activo</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              En línea
            </span>
          </div>

          {/* Direct URL Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#4c4451] uppercase tracking-wider block">
              Tu enlace directo para clientes
            </label>
            <div className="flex items-center justify-between bg-white rounded-2xl p-2 pl-3.5 border border-[#cfc2d2]/40 shadow-xs">
              <div className="flex items-center gap-2 min-w-0 text-xs font-mono font-bold text-[#2e004e]">
                <span className="material-symbols-outlined text-base text-[#f9b900]">link</span>
                <span className="truncate">{fullUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900] text-xs font-black rounded-xl shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-xs font-bold">
                  {copiedType === 'link' ? 'check' : 'content_copy'}
                </span>
                <span>{copiedType === 'link' ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Social Media Bio Ready-Made Copy */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#4c4451] uppercase tracking-wider">
                Texto para Bio de Instagram / TikTok / Facebook
              </label>
              <button
                type="button"
                onClick={handleCopyBioText}
                className="text-xs font-bold text-[#4b0878] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs">
                  {copiedType === 'bio' ? 'check' : 'content_copy'}
                </span>
                <span>{copiedType === 'bio' ? '¡Texto copiado!' : 'Copiar texto para bio'}</span>
              </button>
            </div>

            <div className="p-3 bg-[#f5f2ff] rounded-2xl border border-[#cfc2d2]/30 text-xs text-[#1a1a26] leading-relaxed font-sans relative">
              <p>{socialBioText}</p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-3 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenClientPortal();
              }}
              className="py-3 px-3 rounded-xl bg-[#2e004e] hover:bg-[#4b0878] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              <span>Probar como cliente</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#cfc2d2]/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl border border-[#cfc2d2] text-[#4c4451] font-bold text-xs hover:bg-[#f5f2ff] cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
