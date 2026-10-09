import React, { useState } from 'react';
import { Pet, Visit, SalonConfig } from '../types';
import { downloadPetReportPdf, generatePetReportPdf } from '../utils/pdfGenerator';
import { formatDateSpanish } from '../utils/storage';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pet: Pet;
  visit: Visit;
  salonConfig?: SalonConfig;
  salonName?: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  pet,
  visit,
  salonConfig,
  salonName
}) => {
  const currentSalonName = salonName || salonConfig?.name || 'Peluquería Canina Luna';
  const currency = visit.currency || salonConfig?.currency || 'ARS';
  const returnWeeks = visit.nextRecommendedWeeks || pet.recommendedIntervalWeeks || 4;

  // Calculate return date
  const returnDate = new Date();
  returnDate.setDate(returnDate.getDate() + Number(returnWeeks) * 7);
  const nextVisitFormatted = formatDateSpanish(returnDate);

  const initialMsg = `🐾 *¡Hola ${pet.tutor.name}!* \n\n¡${pet.name} ya terminó su sesión y está listo/a para volver a casa en *${currentSalonName}*! ✨🐶\n\n📋 *Resumen del servicio realizado:*\n• Servicio: ${visit.serviceName}\n• Total: $${Number(visit.price || 0).toLocaleString()} ${currency}\n• Estado del manto: ${pet.healthAllergies || 'En excelentes condiciones'}\n• Próximo turno recomendado: cada ${returnWeeks} semanas (alrededor del ${nextVisitFormatted}).\n\n📄 *Ficha Oficial en PDF:* Te adjunto la ficha técnica completa con las fotografías del ANTES y DESPUÉS de la sesión.\n\n¡Muchas gracias por confiar el cuidado de ${pet.name} en nosotros! Te esperamos pronto.`;

  const [messageText, setMessageText] = useState<string>(initialMsg);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [downloadedFilename, setDownloadedFilename] = useState<string | null>(null);

  if (!isOpen) return null;

  const rawPhone = pet.tutor.rawPhone || pet.tutor.phone.replace(/\D/g, '');
  const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(messageText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const filename = await downloadPetReportPdf({
        pet,
        visit,
        salonConfig,
        nextVisitDateStr: nextVisitFormatted
      });
      setDownloadedFilename(filename);
      setPdfDownloaded(true);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleNativeSharePdf = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    setIsGeneratingPdf(true);
    try {
      const { blob, filename } = await generatePetReportPdf({
        pet,
        visit,
        salonConfig,
        nextVisitDateStr: nextVisitFormatted
      });
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Ficha de ${pet.name}`,
          text: messageText,
          files: [file]
        });
      } else {
        await handleDownloadPdf();
      }
    } catch (err) {
      console.error('Error compartiendo PDF nativo:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-[#25D366] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-2xl">loyalty</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Entrega de Mascota al Tutor</h3>
              <p className="text-xs text-white/90">Envío de reporte y ficha técnica a {pet.tutor.name}</p>
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
          {/* Card Preview with Pet Data and Photos */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#cfc2d2]/30 space-y-3">
            <div className="flex items-center justify-between border-b border-[#efecfd] pb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🐶</span>
                <div>
                  <h4 className="font-bold text-sm text-[#1a1a26]">{pet.name}</h4>
                  <p className="text-xs text-[#7e7482]">
                    {pet.breed} • {pet.age} • {pet.gender} • {pet.weightKg} kg
                  </p>
                </div>
              </div>
              <span className="bg-[#f9b900] text-[#261900] text-[10px] font-bold px-2.5 py-1 rounded-full">
                Listo para entrega
              </span>
            </div>

            {/* Before / After comparison */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative rounded-xl overflow-hidden aspect-video bg-[#efecfd] border border-[#cfc2d2]/40">
                {visit.photos.beforeUrl ? (
                  <img
                    src={visit.photos.beforeUrl}
                    alt="Antes"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[11px] text-[#7e7482] p-2 text-center">
                    <span className="material-symbols-outlined text-xl mb-0.5">pets</span>
                    <span>Sin foto antes</span>
                  </div>
                )}
                <span className="absolute top-1.5 left-1.5 bg-[#2e004e] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                  Antes
                </span>
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-video bg-[#f9b900]/10 border border-[#f9b900]/40">
                {visit.photos.afterUrl ? (
                  <img
                    src={visit.photos.afterUrl}
                    alt="Después"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[11px] text-[#7a5900] p-2 text-center">
                    <span className="material-symbols-outlined text-xl mb-0.5">auto_awesome</span>
                    <span>Sin foto después</span>
                  </div>
                )}
                <span className="absolute top-1.5 left-1.5 bg-[#f9b900] text-[#261900] text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                  Después ✨
                </span>
              </div>
            </div>

            {/* Details snippet */}
            <div className="bg-[#f5f2ff] rounded-xl p-3 text-xs space-y-1.5 text-[#1a1a26]">
              <div className="flex justify-between">
                <span className="text-[#4c4451]">Servicio:</span>
                <span className="font-bold text-[#2e004e]">{visit.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4c4451]">Importe total:</span>
                <span className="font-bold text-[#2e004e]">
                  ${Number(visit.price || 0).toLocaleString()} {currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4c4451]">Próximo turno sugerido:</span>
                <span className="font-bold text-[#7a5900]">
                  Cada {returnWeeks} semanas ({nextVisitFormatted})
                </span>
              </div>
            </div>
          </div>

          {/* PDF GENERATION ACTION (Requirement #5 & #6) */}
          <div className="p-3.5 bg-gradient-to-r from-[#2e004e]/5 to-[#4b0878]/10 rounded-2xl border border-[#4b0878]/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4b0878] text-xl">picture_as_pdf</span>
                <span className="text-xs font-bold text-[#2e004e]">Ficha Técnica Oficial en PDF</span>
              </div>
              {pdfDownloaded && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-xs">done</span>
                  Descargado
                </span>
              )}
            </div>

            <p className="text-xs text-[#4c4451] leading-relaxed">
              Genera un documento PDF profesional con el logotipo de tu peluquería, datos de la mascota, servicios realizados y las fotografías de antes y después.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex-1 py-2.5 px-3 bg-[#4b0878] hover:bg-[#2e004e] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base ${isGeneratingPdf ? 'animate-spin' : ''}`}>
                  {isGeneratingPdf ? 'progress_activity' : 'download'}
                </span>
                <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar Ficha en PDF'}</span>
              </button>

              {canShareFiles && (
                <button
                  type="button"
                  onClick={handleNativeSharePdf}
                  disabled={isGeneratingPdf}
                  className="py-2.5 px-3 bg-[#e9e6f7] hover:bg-[#dfdbf5] text-[#2e004e] text-xs font-bold rounded-xl border border-[#cfc2d2]/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Compartir archivo directamente mediante el menú del sistema"
                >
                  <span className="material-symbols-outlined text-base">share</span>
                  <span>Compartir PDF</span>
                </button>
              )}
            </div>

            {downloadedFilename && (
              <p className="text-[11px] text-emerald-700 font-semibold">
                ✓ Guardado en tu dispositivo como: <strong>{downloadedFilename}</strong>
              </p>
            )}
          </div>

          {/* Workflow Guide Notice */}
          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs text-[#7a5900] flex items-start gap-2">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">help_outline</span>
            <div className="space-y-1">
              <p className="font-bold">Cómo entregar la ficha a tu cliente por WhatsApp:</p>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-[#4c4451]">
                <li>Descarga la ficha en PDF pulsando el botón morado de arriba.</li>
                <li>Pulsa <strong>«Abrir WhatsApp con mensaje preparado»</strong> para abrir el chat con tu cliente.</li>
                <li>Dentro de WhatsApp, pulsa el botón de adjuntar (📎) y selecciona el archivo PDF descargado.</li>
              </ol>
            </div>
          </div>

          {/* Editable WhatsApp Text Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#4c4451] uppercase tracking-wider">
                Mensaje a enviar (Totalmente editable)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-[#4b0878] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'done' : 'content_copy'}
                </span>
                <span>{copied ? '¡Copiado!' : 'Copiar texto'}</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3 bg-white text-xs text-[#1a1a26] rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]/30 font-sans leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#cfc2d2]/40 flex flex-col sm:flex-row items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-3 rounded-xl border border-[#cfc2d2] text-[#4c4451] font-bold text-xs hover:bg-[#f5f2ff] cursor-pointer text-center"
          >
            Cerrar
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#25D366] text-white font-bold text-xs shadow-md hover:bg-[#20ba59] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <span className="material-symbols-outlined text-lg">chat</span>
            <span>Abrir WhatsApp con mensaje preparado</span>
          </a>
        </div>
      </div>
    </div>
  );
};
