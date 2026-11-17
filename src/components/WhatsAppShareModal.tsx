import React, { useState, useEffect } from 'react';
import { Pet, Visit, SalonConfig } from '../types';
import { downloadPetReportPdf, generatePetReportPdf, cleanPetDisplayName, formatDeliveryDate } from '../utils/pdfGenerator';
import { formatDateSpanish } from '../utils/storage';
import { HOTLINK_IMAGES } from '../mockData';
import { formatPrice } from '../utils/priceUtils';
import { useTranslation } from '../utils/i18n/I18nContext';
import { formatTemplate, formatDisplayDate, translateGenderLabel } from '../utils/i18n/helpers';

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
  const { t, lang } = useTranslation();
  const mt = t.modals;
  const pt = t.petProfile;
  const ct = t.common;

  const currentSalonName = salonName || salonConfig?.name || 'Peluquería Canina Luna';
  const currency = visit.currency || salonConfig?.currency || 'ARS';
  const returnWeeks = visit.nextRecommendedWeeks || pet.recommendedIntervalWeeks || 4;

  // Delivery data
  const rawDeliveryDate = visit.deliveryDate || pet.deliveryDate;
  const deliveryDateFormatted = formatDeliveryDate(rawDeliveryDate, lang) || formatDisplayDate(visit.date, lang) || ct.today;
  const deliveryTimeFormatted = visit.deliveryTime || pet.deliveryTime;
  const serviceResponsible = visit.serviceResponsible || pet.serviceResponsible;
  const salonBusinessPhone = salonConfig?.phone
    ? `${salonConfig.phonePrefix ? salonConfig.phonePrefix + ' ' : ''}${salonConfig.phone}`
    : '';

  // Calculate return date
  const returnDate = new Date();
  returnDate.setDate(returnDate.getDate() + Number(returnWeeks) * 7);
  const nextVisitFormatted = formatDisplayDate(returnDate, lang) || formatDateSpanish(returnDate);

  const customRecommendations = (visit.careRecommendations || pet.careRecommendations || '').trim();
  const recLine = customRecommendations
    ? `\n• ${pt.careRecommendationsLabel}: ${customRecommendations}`
    : '';

  const petDisplayName = cleanPetDisplayName(pet.name);

  const deliveryLines = [
    `• ${mt.deliveryDateLabel}: ${deliveryDateFormatted}`,
    deliveryTimeFormatted ? `• ${mt.deliveryTimeLabel}: ${deliveryTimeFormatted}` : '',
    serviceResponsible ? `• ${mt.serviceInChargeLabel} ${serviceResponsible}` : ''
  ].filter(Boolean).join('\n');

  const formattedVisitPrice = formatPrice(visit.price, currency, { includeCode: true });
  const initialMsg = formatTemplate(mt.whatsappDeliveryTemplate, {
    tutorName: pet.tutor.name,
    petName: petDisplayName,
    salonName: currentSalonName,
    serviceName: visit.serviceName,
    price: formattedVisitPrice,
    deliveryLines,
    coatCondition: pet.healthAllergies || pt.noAllergiesDefault,
    recLine,
    returnWeeks: String(returnWeeks),
    nextVisitFormatted
  });

  const [messageText, setMessageText] = useState<string>(initialMsg);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [downloadedFilename, setDownloadedFilename] = useState<string | null>(null);

  // Sync initial message if visit recommendations or language change
  useEffect(() => {
    setMessageText(initialMsg);
  }, [initialMsg]);

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
        nextVisitDateStr: nextVisitFormatted,
        language: lang
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
        nextVisitDateStr: nextVisitFormatted,
        language: lang
      });
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${pt.petProfileTitle} - ${pet.name}`,
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
              <h3 className="font-bold text-base leading-tight">{mt.deliveryTitle}</h3>
              <p className="text-xs text-white/90">{formatTemplate(mt.deliverySubtitle, { tutorName: pet.tutor.name })}</p>
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
            {/* Encabezado Oficial Ficha de Entrega */}
            <div className="bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              {/* Lado izquierdo: Logo, Nombre, Dirección, Teléfono Comercial del Negocio, Responsable */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  <img
                    src={salonConfig?.logoUrl || HOTLINK_IMAGES.logo}
                    alt={currentSalonName}
                    className="w-full h-full object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = HOTLINK_IMAGES.logo;
                    }}
                  />
                </div>
                <div className="min-w-0 text-xs">
                  <h5 className="font-extrabold text-white text-sm truncate">{currentSalonName}</h5>
                  {salonConfig?.address && (
                    <p className="text-[11px] text-[#e3e0f1] truncate">{salonConfig.address}</p>
                  )}
                  {salonBusinessPhone && (
                    <p className="text-[11px] text-[#e3e0f1] font-semibold">
                      {mt.businessPhoneLabel} <strong className="text-white">{salonBusinessPhone}</strong>
                    </p>
                  )}
                  {serviceResponsible && (
                    <p className="text-[11px] text-[#ffdea1] font-bold">
                      {mt.serviceInChargeLabel} <span className="text-[#f9b900]">{serviceResponsible}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Lado derecho: Ficha de entrega, Fecha de entrega y Hora de entrega */}
              <div className="bg-white text-[#2e004e] px-3.5 py-2 rounded-xl text-center self-start sm:self-auto shrink-0 shadow-sm border border-white/20">
                <span className="text-[10px] font-black uppercase tracking-wider block text-[#2e004e]">{mt.deliverySheetLabel}</span>
                <span className="text-[11px] font-bold text-[#7e7482] block">{ct.date}: {deliveryDateFormatted}</span>
                {deliveryTimeFormatted && (
                  <span className="text-[11px] font-black text-[#2e004e] block">{mt.deliveryTimeLabel}: {deliveryTimeFormatted}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-[#efecfd] pb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🐶</span>
                <div>
                  <h4 className="font-bold text-sm text-[#1a1a26]">{pet.name}</h4>
                  <p className="text-xs text-[#7e7482]">
                    {pet.breed} • {pet.age} • {translateGenderLabel(pet.gender, lang)} • {pet.weightKg} kg
                  </p>
                </div>
              </div>
              <span className="bg-[#f9b900] text-[#261900] text-[10px] font-bold px-2.5 py-1 rounded-full">
                {mt.readyForDeliveryBadge}
              </span>
            </div>

            {/* Before / After comparison */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative rounded-xl overflow-hidden aspect-video bg-[#efecfd] border border-[#cfc2d2]/40">
                {visit.photos.beforeUrl ? (
                  <img
                    src={visit.photos.beforeUrl}
                    alt={mt.beforeTag}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[11px] text-[#7e7482] p-2 text-center">
                    <span className="material-symbols-outlined text-xl mb-0.5">pets</span>
                    <span>{mt.noBeforePhoto}</span>
                  </div>
                )}
                <span className="absolute top-1.5 left-1.5 bg-[#2e004e] text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-xs">
                  {mt.beforeTag}
                </span>
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-video bg-[#f9b900]/10 border border-[#f9b900]/40">
                {visit.photos.afterUrl ? (
                  <img
                    src={visit.photos.afterUrl}
                    alt={mt.afterTag}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[11px] text-[#7a5900] p-2 text-center">
                    <span className="material-symbols-outlined text-xl mb-0.5">auto_awesome</span>
                    <span>{mt.noAfterPhoto}</span>
                  </div>
                )}
                <span className="absolute top-1.5 left-1.5 bg-[#f9b900] text-[#261900] text-[9px] font-bold px-2 py-0.5 rounded shadow-xs">
                  {mt.afterTag}
                </span>
              </div>
            </div>

            {/* Details snippet */}
            <div className="bg-[#f5f2ff] rounded-xl p-3 text-xs space-y-1.5 text-[#1a1a26]">
              <div className="flex justify-between">
                <span className="text-[#4c4451]">{ct.service}:</span>
                <span className="font-bold text-[#2e004e]">{visit.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4c4451]">{mt.totalAmountLabel}</span>
                <span className="font-bold text-[#2e004e]">
                  {formatPrice(visit.price, currency, { includeCode: true })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4c4451]">{mt.deliveryDateLabel}:</span>
                <span className="font-bold text-[#2e004e]">{deliveryDateFormatted}</span>
              </div>
              {deliveryTimeFormatted && (
                <div className="flex justify-between">
                  <span className="text-[#4c4451]">{mt.deliveryTimeLabel}:</span>
                  <span className="font-bold text-[#2e004e]">{deliveryTimeFormatted}</span>
                </div>
              )}
              {serviceResponsible && (
                <div className="flex justify-between">
                  <span className="text-[#4c4451]">{mt.serviceInChargeLabel}</span>
                  <span className="font-bold text-[#2e004e]">{serviceResponsible}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#4c4451]">{mt.suggestedNextTurn}</span>
                <span className="font-bold text-[#7a5900]">
                  {formatTemplate(mt.everyWeeksPattern, { weeks: String(returnWeeks), date: nextVisitFormatted })}
                </span>
              </div>

              {/* Groomer care recommendations */}
              {customRecommendations && (
                <div className="pt-1 border-t border-[#cfc2d2]/30 flex flex-col gap-0.5">
                  <span className="text-[#7a5900] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">tips_and_updates</span>
                    <span>{pt.careRecommendationsLabel}:</span>
                  </span>
                  <span className="text-[#1a1a26] text-[11px] leading-relaxed italic bg-white/60 p-2 rounded-lg border border-[#cfc2d2]/20">
                    {customRecommendations}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* PDF GENERATION ACTION (Requirement #5 & #6) */}
          <div className="p-3.5 bg-gradient-to-r from-[#2e004e]/5 to-[#4b0878]/10 rounded-2xl border border-[#4b0878]/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4b0878] text-xl">picture_as_pdf</span>
                <span className="text-xs font-bold text-[#2e004e]">{mt.pdfSectionTitle}</span>
              </div>
              {pdfDownloaded && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-xs">done</span>
                  {mt.downloadedBadge}
                </span>
              )}
            </div>

            <p className="text-xs text-[#4c4451] leading-relaxed">
              {mt.pdfSectionDesc}
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
                <span>{isGeneratingPdf ? pt.generatingPdf : mt.downloadPdfBtn}</span>
              </button>

              {canShareFiles && (
                <button
                  type="button"
                  onClick={handleNativeSharePdf}
                  disabled={isGeneratingPdf}
                  className="py-2.5 px-3 bg-[#e9e6f7] hover:bg-[#dfdbf5] text-[#2e004e] text-xs font-bold rounded-xl border border-[#cfc2d2]/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title={mt.sharePdfTitle}
                >
                  <span className="material-symbols-outlined text-base">share</span>
                  <span>{mt.sharePdfBtn}</span>
                </button>
              )}
            </div>

            {downloadedFilename && (
              <p className="text-[11px] text-emerald-700 font-semibold">
                {mt.savedDeviceAs} <strong>{downloadedFilename}</strong>
              </p>
            )}
          </div>

          {/* Workflow Guide Notice */}
          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs text-[#7a5900] flex items-start gap-2">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">help_outline</span>
            <div className="space-y-1">
              <p className="font-bold">{mt.workflowGuideTitle}</p>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-[#4c4451]">
                <li>{mt.workflowStep1}</li>
                <li>{mt.workflowStep2}</li>
                <li>{mt.workflowStep3}</li>
              </ol>
            </div>
          </div>

          {/* Editable WhatsApp Text Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#4c4451] uppercase tracking-wider">
                {mt.editableMsgLabel}
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-[#4b0878] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'done' : 'content_copy'}
                </span>
                <span>{copied ? ct.copied : mt.copyTextBtn}</span>
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
            {ct.close}
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#25D366] text-white font-bold text-xs shadow-md hover:bg-[#20ba59] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <span className="material-symbols-outlined text-lg">chat</span>
            <span>{mt.openWaPreparedBtn}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
