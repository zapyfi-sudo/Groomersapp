import React, { useState, useMemo } from 'react';
import { SalonConfig } from '../types';
import { slugify, generateStableBusinessId, buildPublicBookingUrl } from '../utils/slugUtils';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName: string;
  bookingSlug?: string;
  businessId?: string;
  salonConfig?: SalonConfig;
  onOpenClientPortal: () => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  salonName,
  bookingSlug,
  businessId,
  salonConfig,
  onOpenClientPortal
}) => {
  const [copiedType, setCopiedType] = useState<'link' | 'bio' | null>(null);

  const realBookingUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://groomers-app.vercel.app';
    const bId = businessId && businessId !== 'biz_main' && businessId !== 'biz_default'
      ? businessId
      : (salonConfig?.id || generateStableBusinessId(salonName));
    const slug = slugify(bookingSlug || salonConfig?.bookingSlug || salonName);
    return buildPublicBookingUrl(origin, bId, slug, salonConfig);
  }, [businessId, bookingSlug, salonName, salonConfig]);

  const socialBioText = `🐶✨ ¡Haz tu cita online acá! Reserva el turno de tu mascota en ${salonName} en menos de 2 minutos:\n👉 ${realBookingUrl}`;

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(realBookingUrl);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
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
                <span className="truncate">{realBookingUrl}</span>
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

          {/* Bio copy text */}
          <div className="bg-[#f5f2ff] rounded-2xl p-3.5 border border-[#cfc2d2]/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2e004e] flex items-center gap-1">
                <span>📱</span> Texto sugerido para tu perfil de Instagram / TikTok:
              </span>
              <button
                type="button"
                onClick={handleCopyBioText}
                className="text-xs text-[#4b0878] font-bold hover:underline cursor-pointer"
              >
                {copiedType === 'bio' ? '✓ Copiado' : 'Copiar texto'}
              </button>
            </div>
            <p className="text-xs text-[#4c4451] bg-white p-2.5 rounded-xl border border-[#cfc2d2]/20 font-mono leading-relaxed whitespace-pre-line">
              {socialBioText}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Compartir directo por WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onOpenClientPortal}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] font-bold text-xs border border-[#cfc2d2]/40 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base text-[#f9b900]">open_in_new</span>
              <span>Probar flujo como cliente online</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
