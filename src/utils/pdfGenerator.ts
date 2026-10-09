import { jsPDF } from 'jspdf';
import { Pet, Visit, SalonConfig } from '../types';

/**
 * Converts an image URL (dataURL or HTTP URL) into a base64 data URL
 * safely handling CORS and loading errors.
 */
async function loadImageDataUrl(url?: string): Promise<string | null> {
  if (!url || typeof url !== 'string' || !url.trim()) return null;

  // Already a data URL
  if (url.startsWith('data:image/')) {
    return url;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 400;
          canvas.height = img.naturalHeight || img.height || 400;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      // Timeout fallback after 3 seconds
      setTimeout(() => resolve(null), 3000);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export interface GeneratePdfOptions {
  pet: Pet;
  visit: Visit;
  salonConfig?: SalonConfig;
  nextVisitDateStr?: string;
}

/**
 * Generates and downloads a clean, professional PDF service sheet
 * with pet details, performed services, before & after photos, and return recommendations.
 */
export async function generatePetReportPdf({
  pet,
  visit,
  salonConfig,
  nextVisitDateStr
}: GeneratePdfOptions): Promise<{ doc: jsPDF; filename: string; blob: Blob }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const purplePrimary: [number, number, number] = [46, 0, 78]; // #2e004e
  const purpleMedium: [number, number, number] = [75, 8, 120]; // #4b0878
  const goldAccent: [number, number, number] = [249, 185, 0]; // #f9b900
  const textDark: [number, number, number] = [26, 26, 38]; // #1a1a26
  const textMuted: [number, number, number] = [100, 95, 110];
  const bgLight: [number, number, number] = [250, 248, 253];
  const borderLight: [number, number, number] = [225, 218, 230];

  // 1. Preload images
  const [logoData, beforeData, afterData] = await Promise.all([
    loadImageDataUrl(salonConfig?.logoUrl),
    loadImageDataUrl(visit.photos?.beforeUrl),
    loadImageDataUrl(visit.photos?.afterUrl)
  ]);

  // Header Background Banner
  doc.setFillColor(...purplePrimary);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Gold accent strip
  doc.setFillColor(...goldAccent);
  doc.rect(0, 38, pageWidth, 2.5, 'F');

  // Salon Logo or Icon
  let headerTextLeft = margin;
  if (logoData) {
    try {
      doc.addImage(logoData, 'JPEG', margin, 5, 26, 26);
      headerTextLeft = margin + 30;
    } catch {
      headerTextLeft = margin;
    }
  }

  // Salon Name & Contact
  const salonName = salonConfig?.name || 'Peluquería Canina Luna';
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(salonName, headerTextLeft, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(230, 225, 240);

  const contactLines: string[] = [];
  if (salonConfig?.address) contactLines.push(salonConfig.address);
  if (salonConfig?.city || salonConfig?.country) {
    contactLines.push([salonConfig.city, salonConfig.country].filter(Boolean).join(', '));
  }
  if (salonConfig?.phone) {
    contactLines.push(`Tel / WhatsApp: ${salonConfig.phonePrefix ? salonConfig.phonePrefix + ' ' : ''}${salonConfig.phone}`);
  }

  const contactText = contactLines.slice(0, 2).join(' • ');
  if (contactText) {
    doc.text(contactText, headerTextLeft, 21);
  }

  // Document Badge on top right
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - margin - 52, 9, 52, 20, 2, 2, 'F');
  doc.setTextColor(...purplePrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FICHA DE ENTREGA', pageWidth - margin - 26, 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(`Fecha: ${visit.date || 'Hoy'}`, pageWidth - margin - 26, 24, { align: 'center' });

  let curY = 46;

  // Section 1: Pet & Tutor Info Card
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, curY, contentWidth, 38, 3, 3, 'FD');

  // Title of card
  doc.setTextColor(...purpleMedium);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DATOS DE LA MASCOTA Y DEL TUTOR', margin + 5, curY + 6.5);

  // Line separator
  doc.setDrawColor(...borderLight);
  doc.line(margin + 5, curY + 8.5, margin + contentWidth - 5, curY + 8.5);

  // Left col: Pet
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text('Mascota:', margin + 5, curY + 14);
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.text(`${pet.name} (${pet.id})`, margin + 24, curY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Raza:', margin + 5, curY + 20);
  doc.setTextColor(...textDark);
  doc.text(pet.breed || 'Mestizo', margin + 24, curY + 20);

  doc.setTextColor(...textMuted);
  doc.text('Edad / Sexo:', margin + 5, curY + 26);
  doc.setTextColor(...textDark);
  doc.text(`${pet.age || '1 año'} • ${pet.gender || 'Macho'}`, margin + 24, curY + 26);

  doc.setTextColor(...textMuted);
  doc.text('Peso:', margin + 5, curY + 32);
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.text(`${pet.weightKg || 10} kg`, margin + 24, curY + 32);

  // Right col: Tutor & Behavior
  const midX = margin + contentWidth / 2 + 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Tutor:', midX, curY + 14);
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.text(pet.tutor.name || 'Cliente', midX + 16, curY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Teléfono:', midX, curY + 20);
  doc.setTextColor(...textDark);
  doc.text(pet.tutor.phone || 'No registrado', midX + 16, curY + 20);

  doc.setTextColor(...textMuted);
  doc.text('Comportamiento:', midX, curY + 26);
  doc.setTextColor(...textDark);
  const moodLabel =
    visit.mood === 'tranquilo'
      ? 'Tranquilo / Colaborador'
      : visit.mood === 'inquieto'
      ? 'Inquieto'
      : 'Difícil / Cuidados especiales';
  doc.text(moodLabel, midX + 27, curY + 26);

  if (pet.healthAllergies && pet.healthAllergies !== 'Sin afecciones registradas.') {
    doc.setTextColor(...textMuted);
    doc.text('Piel / Salud:', midX, curY + 32);
    doc.setTextColor(186, 26, 26);
    doc.setFont('helvetica', 'bold');
    doc.text(pet.healthAllergies.slice(0, 36), midX + 20, curY + 32);
  }

  curY += 43;

  // Section 2: Services Performed & Price
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, curY, contentWidth, 32, 3, 3, 'FD');

  doc.setTextColor(...purpleMedium);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SERVICIO REALIZADO E IMPORTE', margin + 5, curY + 6.5);

  doc.setDrawColor(...borderLight);
  doc.line(margin + 5, curY + 8.5, margin + contentWidth - 5, curY + 8.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text('Servicio(s):', margin + 5, curY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  const fullServiceText = visit.serviceName || 'Baño + corte';
  doc.text(fullServiceText, margin + 25, curY + 15);

  // Price box
  const currency = visit.currency || salonConfig?.currency || 'ARS';
  const priceFormatted = `$${Number(visit.price || 0).toLocaleString()} ${currency}`;
  doc.setFillColor(...purplePrimary);
  doc.roundedRect(pageWidth - margin - 50, curY + 10, 45, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(priceFormatted, pageWidth - margin - 27.5, curY + 19, { align: 'center' });

  // Notes / Observations if present
  if (visit.notes || pet.handlingObservations) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text('Observaciones:', margin + 5, curY + 23);
    doc.setTextColor(...textDark);
    const obsText = visit.notes || pet.handlingObservations || 'Sin observaciones adicionales.';
    doc.text(obsText.slice(0, 75), margin + 28, curY + 23);
  }

  curY += 37;

  // Section 3: Before & After Photos (CRITICAL)
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  const photoCardHeight = 98;
  doc.roundedRect(margin, curY, contentWidth, photoCardHeight, 3, 3, 'FD');

  doc.setTextColor(...purpleMedium);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('REGISTRO FOTOGRÁFICO DEL SERVICIO', margin + 5, curY + 6.5);

  doc.setDrawColor(...borderLight);
  doc.line(margin + 5, curY + 8.5, margin + contentWidth - 5, curY + 8.5);

  const photoWidth = (contentWidth - 16) / 2;
  const photoHeight = 72;
  const photoY = curY + 13;

  // Left Photo: Antes
  const beforeX = margin + 5;
  doc.setFillColor(242, 238, 247);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(beforeX, photoY, photoWidth, photoHeight, 2, 2, 'FD');

  if (beforeData) {
    try {
      doc.addImage(beforeData, 'JPEG', beforeX + 1, photoY + 1, photoWidth - 2, photoHeight - 2);
    } catch {
      doc.setTextColor(...textMuted);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text('Fotografía no disponible', beforeX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
    }
  } else {
    doc.setTextColor(...textMuted);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('Sin fotografía de antes registrada', beforeX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
  }

  // Label "ANTES DEL SERVICIO"
  doc.setFillColor(...purplePrimary);
  doc.roundedRect(beforeX + 3, photoY + 3, 38, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('ANTES DEL SERVICIO', beforeX + 22, photoY + 7.2, { align: 'center' });

  // Right Photo: Después
  const afterX = margin + 5 + photoWidth + 6;
  doc.setFillColor(242, 238, 247);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(afterX, photoY, photoWidth, photoHeight, 2, 2, 'FD');

  if (afterData) {
    try {
      doc.addImage(afterData, 'JPEG', afterX + 1, photoY + 1, photoWidth - 2, photoHeight - 2);
    } catch {
      doc.setTextColor(...textMuted);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text('Fotografía no disponible', afterX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
    }
  } else {
    doc.setTextColor(...textMuted);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('Sin fotografía de después registrada', afterX + photoWidth / 2, photoY + photoHeight / 2, { align: 'center' });
  }

  // Label "DESPUÉS DEL SERVICIO ✨"
  doc.setFillColor(...goldAccent);
  doc.roundedRect(afterX + 3, photoY + 3, 42, 6, 1, 1, 'F');
  doc.setTextColor(38, 25, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DESPUÉS DEL SERVICIO ✨', afterX + 24, photoY + 7.2, { align: 'center' });

  // Photo card footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('Fotografías reales tomadas durante la sesión de peluquería en nuestras instalaciones.', margin + 5, curY + photoCardHeight - 4);

  curY += photoCardHeight + 5;

  // Section 4: Return Recommendation & Next Appointment
  const intervalWeeks = visit.nextRecommendedWeeks || pet.recommendedIntervalWeeks || 4;
  doc.setFillColor(255, 250, 235); // soft gold/amber bg
  doc.setDrawColor(245, 200, 100);
  doc.roundedRect(margin, curY, contentWidth, 26, 3, 3, 'FD');

  doc.setTextColor(130, 80, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('RECOMENDACIÓN DE CUIDADO Y PRÓXIMA VISITA', margin + 5, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text(
    `Para conservar la salud del manto y prevenir nudos o dermatitis, sugerimos regresar cada ${intervalWeeks} semanas.`,
    margin + 5,
    curY + 12
  );

  if (nextVisitDateStr) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...purplePrimary);
    doc.text(`Próxima visita sugerida: ${nextVisitDateStr} (en ${intervalWeeks} semanas)`, margin + 5, curY + 18);
  }

  // Footer Disclaimer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  const footerText = `¡Gracias por confiar en ${salonName}! Ficha oficial generada el ${new Date().toLocaleDateString('es-ES')}.`;
  doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });

  const safePetName = pet.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Ficha_${safePetName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = doc.output('blob');

  return { doc, filename, blob };
}

/**
 * Generates and immediately downloads the PDF file on the user's device.
 */
export async function downloadPetReportPdf(options: GeneratePdfOptions): Promise<string> {
  const { doc, filename } = await generatePetReportPdf(options);
  doc.save(filename);
  return filename;
}
