import React, { useState, useEffect } from 'react';
import { Appointment, SalonConfig, WhatsAppTemplate } from '../types';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  renderWhatsAppTemplate,
  convertMessageToTemplate,
  buildCustomWhatsAppUrl,
  openWhatsAppUrl
} from '../utils/phoneUtils';

interface ConfirmWhatsAppModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  salonConfig: SalonConfig;
  onClose: () => void;
  onConfirmAndSend: (
    appointment: Appointment,
    finalMessage: string,
    templateToSave?: { title: string; content: string }
  ) => Promise<void> | void;
  onSaveTemplateOnly?: (title: string, content: string) => Promise<void> | void;
}

export const ConfirmWhatsAppModal: React.FC<ConfirmWhatsAppModalProps> = ({
  isOpen,
  appointment,
  salonConfig,
  onClose,
  onConfirmAndSend,
  onSaveTemplateOnly
}) => {
  // Combine custom templates saved on salonConfig with default templates
  const allTemplates = React.useMemo<WhatsAppTemplate[]>(() => {
    const custom = salonConfig.whatsappTemplates || [];
    if (custom.length === 0) return DEFAULT_WHATSAPP_TEMPLATES;

    // Merge: custom templates first, then any default templates not yet created
    const customTitles = new Set(custom.map((t) => t.title.toLowerCase().trim()));
    const remainingDefaults = DEFAULT_WHATSAPP_TEMPLATES.filter(
      (dt) => !customTitles.has(dt.title.toLowerCase().trim())
    );
    return [...custom, ...remainingDefaults];
  }, [salonConfig.whatsappTemplates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tmpl-confirmacion');
  const [messageText, setMessageText] = useState<string>('');
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // When modal opens or appointment changes, initialize message from default / active template
  useEffect(() => {
    if (!isOpen || !appointment) return;

    // Default template to load
    const activeTmpl = allTemplates.find((t) => t.id === selectedTemplateId) || allTemplates[0];
    const initialText = renderWhatsAppTemplate(
      activeTmpl ? activeTmpl.content : DEFAULT_WHATSAPP_TEMPLATES[0].content,
      {
        tutorName: appointment.tutorName,
        petName: appointment.petName,
        serviceName: appointment.serviceName,
        date: appointment.date,
        time: appointment.time,
        tutorPhone: appointment.tutorPhone
      },
      salonConfig.name
    );

    setMessageText(initialText);
    setSaveAsTemplate(false);
    setNewTemplateTitle('');
    setFeedbackNotice(null);
    setIsSubmitting(false);
  }, [isOpen, appointment]);

  if (!isOpen || !appointment) return null;

  // Handle template selection change
  const handleTemplateChange = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = allTemplates.find((t) => t.id === tmplId);
    if (tmpl) {
      const rendered = renderWhatsAppTemplate(
        tmpl.content,
        {
          tutorName: appointment.tutorName,
          petName: appointment.petName,
          serviceName: appointment.serviceName,
          date: appointment.date,
          time: appointment.time,
          tutorPhone: appointment.tutorPhone
        },
        salonConfig.name
      );
      setMessageText(rendered);
      setFeedbackNotice(`Plantilla "${tmpl.title}" cargada`);
      setTimeout(() => setFeedbackNotice(null), 2500);
    }
  };

  // Helper to insert a dynamic tag at cursor or end of text
  const handleInsertTag = (tag: string) => {
    setMessageText((prev) => `${prev} ${tag}`);
  };

  // Action: Guardar plantilla sin enviar
  const handleSaveTemplateSecondary = async () => {
    if (!messageText.trim()) return;

    // If user hasn't typed a title yet, open the title field and propose a default title
    if (!newTemplateTitle.trim()) {
      setSaveAsTemplate(true);
      const proposedTitle = `Plantilla personalizada ${allTemplates.length + 1}`;
      setNewTemplateTitle(proposedTitle);
      setFeedbackNotice('Asigna un nombre a la plantilla y vuelve a pulsar "Guardar plantilla"');
      setTimeout(() => setFeedbackNotice(null), 4000);
      return;
    }

    const titleToUse = newTemplateTitle.trim();

    const templatedContent = convertMessageToTemplate(
      messageText,
      {
        tutorName: appointment.tutorName,
        petName: appointment.petName,
        serviceName: appointment.serviceName,
        date: appointment.date,
        time: appointment.time
      },
      salonConfig.name
    );

    if (onSaveTemplateOnly) {
      await onSaveTemplateOnly(titleToUse, templatedContent);
    }
    setFeedbackNotice(`¡Plantilla "${titleToUse}" guardada exitosamente!`);
    setSaveAsTemplate(false);
    setNewTemplateTitle('');
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Action: Enviar por WhatsApp (Main Action)
  const handleSendAndConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Pre-open blank tab within the synchronous user gesture event to bypass browser popup blockers
    let popupWin: Window | null = null;
    try {
      popupWin = window.open('about:blank', '_blank');
    } catch {}

    try {
      let templatePayload: { title: string; content: string } | undefined;

      if (saveAsTemplate) {
        const titleToUse = newTemplateTitle.trim() || 'Confirmación personalizada';
        const templatedContent = convertMessageToTemplate(
          messageText,
          {
            tutorName: appointment.tutorName,
            petName: appointment.petName,
            serviceName: appointment.serviceName,
            date: appointment.date,
            time: appointment.time
          },
          salonConfig.name
        );
        templatePayload = {
          title: titleToUse,
          content: templatedContent
        };
      }

      // Step 1 & 2: Update internal database & save template FIRST
      await onConfirmAndSend(appointment, messageText, templatePayload);

      // Step 4 & 5: Open WhatsApp with final message
      const waUrl = buildCustomWhatsAppUrl(
        appointment.tutorPhone || '',
        messageText,
        salonConfig
      );
      openWhatsAppUrl(waUrl, popupWin);

      // Close modal
      onClose();
    } catch (err) {
      if (popupWin && !popupWin.closed) {
        popupWin.close();
      }
      console.error('Error during WhatsApp confirmation flow:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#2e004e] text-white p-5 pb-4 relative shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">chat</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                  Confirmar cita por WhatsApp
                </h3>
                <p className="text-xs text-[#d8cce4] mt-0.5 leading-relaxed font-medium">
                  Revisa y personaliza el mensaje antes de enviarlo al cliente.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Cerrar modal"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Appointment summary pill */}
          <div className="mt-3.5 bg-white/10 backdrop-blur-xs rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs border border-white/10">
            <div className="flex items-center gap-2 font-bold text-white">
              <span>🐶 {appointment.petName}</span>
              <span className="text-white/40">•</span>
              <span className="text-[#f9b900]">{appointment.serviceName}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 font-medium text-[11px]">
              <span>📅 {appointment.date || 'Hoy'}</span>
              <span>⏰ {appointment.time}</span>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Template Selector dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="template-select" className="text-xs font-extrabold text-[#1a1a26] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#4b0878]">auto_awesome</span>
                <span>Plantilla de mensaje</span>
              </label>

              {feedbackNotice && (
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md animate-fadeIn">
                  {feedbackNotice}
                </span>
              )}
            </div>

            <div className="relative">
              <select
                id="template-select"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full bg-[#fcf8ff] border border-[#cfc2d2]/50 hover:border-[#4b0878] rounded-xl px-3.5 py-2.5 text-xs text-[#1a1a26] font-semibold appearance-none cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#4b0878]/30 transition-all pr-8"
              >
                {allTemplates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.title} {tmpl.isDefault ? '(Recomendada)' : ''}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[#7e7482] text-sm absolute right-3 top-3 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Editable Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-[#1a1a26]">Mensaje a enviar</span>
              <span className="text-[11px] text-[#7e7482]">Totalmente editable</span>
            </div>

            <div className="relative">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={7}
                placeholder="Escribe el mensaje para el cliente..."
                className="w-full bg-white border border-[#cfc2d2]/60 focus:border-[#4b0878] rounded-2xl p-3.5 text-xs sm:text-sm text-[#1a1a26] leading-relaxed resize-y focus:outline-hidden focus:ring-2 focus:ring-[#4b0878]/30 shadow-2xs font-sans transition-all"
              />
            </div>
          </div>

          {/* Quick-insert dynamic variable chips */}
          <div className="bg-[#f5f2ff] rounded-2xl p-3 border border-[#cfc2d2]/30 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#2e004e] flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#f9b900]">data_object</span>
                <span>Datos dinámicos disponibles</span>
              </span>
              <span className="text-[#7e7482] text-[10px]">Toca para insertar</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { tag: '{{cliente}}', label: 'Tutor', val: appointment.tutorName },
                { tag: '{{mascota}}', label: 'Mascota', val: appointment.petName },
                { tag: '{{servicio}}', label: 'Servicio', val: appointment.serviceName },
                { tag: '{{fecha}}', label: 'Fecha', val: appointment.date },
                { tag: '{{hora}}', label: 'Hora', val: appointment.time },
                { tag: '{{salon}}', label: 'Salón', val: salonConfig.name }
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleInsertTag(item.tag)}
                  className="px-2.5 py-1 bg-white hover:bg-[#efecfd] text-[#2e004e] border border-[#cfc2d2]/40 rounded-lg text-[10px] font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95"
                  title={`Insertar ${item.tag} (actual: ${item.val || 'N/A'})`}
                >
                  <span className="text-[#f9b900]">+</span>
                  <span>{item.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save as template options */}
          <div className="border-t border-gray-100 pt-3 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-[#1a1a26]">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="w-4 h-4 rounded text-[#2e004e] focus:ring-[#2e004e] border-gray-300 cursor-pointer accent-[#2e004e]"
              />
              <span>Guardar este mensaje como plantilla reutilizable</span>
            </label>

            {saveAsTemplate && (
              <div className="pl-6 animate-fadeIn space-y-1">
                <input
                  type="text"
                  placeholder="Nombre de la nueva plantilla (ej. Confirmación VIP)"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  className="w-full bg-[#fcf8ff] border border-[#cfc2d2]/60 rounded-xl px-3 py-2 text-xs text-[#1a1a26] focus:outline-hidden focus:ring-2 focus:ring-[#4b0878]/30"
                />
                <p className="text-[10px] text-[#7e7482]">
                  Se guardará con variables dinámicas para que sirva con cualquier cliente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          {/* Secondary Left Action: Cancel */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-[#7e7482] hover:text-[#1a1a26] hover:bg-gray-200/50 rounded-xl transition-all cursor-pointer text-center"
          >
            Cancelar
          </button>

          {/* Right Group: Guardar plantilla & Enviar por WhatsApp */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Guardar plantilla (sin obligar a enviar) */}
            <button
              type="button"
              onClick={handleSaveTemplateSecondary}
              disabled={isSubmitting || !messageText.trim()}
              className="px-3.5 py-2.5 border border-[#cfc2d2]/60 hover:bg-white text-[#2e004e] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
              title="Guardar el mensaje actual como plantilla para usar después"
            >
              <span className="material-symbols-outlined text-sm">bookmark_add</span>
              <span>Guardar plantilla</span>
            </button>

            {/* Main Action: Enviar por WhatsApp */}
            <button
              type="button"
              onClick={handleSendAndConfirm}
              disabled={isSubmitting || !messageText.trim()}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Confirmar cita en el sistema y abrir WhatsApp para enviar el mensaje"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>{isSubmitting ? 'Confirmando...' : 'Enviar por WhatsApp'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
