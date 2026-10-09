import { jsPDF } from 'jspdf';
import { Pet, Visit, SalonConfig } from '../types';

/**
 * Strips technical IDs, hashtags and database identifiers from display names
 */
export function cleanPetDisplayName(name?: string): string {
  if (!name || !name.trim()) return 'Mascota';
  return name
    .replace(/\s*[\(\[]\s*#?[A-Za-z0-9_-]+\s*[\)\]]/g, '')
    .replace(/\s*#[A-Za-z0-9_-]+/g, '')
    .trim() || name.trim() || 'Mascota';
}

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

  // Section 1: Pet & Tutor Info Card (with Session Mood Traffic Light)
  const petDisplayName = cleanPetDisplayName(pet.name);
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, curY, contentWidth, 40, 3, 3, 'FD');

  // Title of card
  doc.setTextColor(...purpleMedium);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DATOS DE LA MASCOTA Y DEL TUTOR', margin + 5, curY + 6.5);

  // Line separator
  doc.setDrawColor(...borderLight);
  doc.line(margin + 5, curY + 8.5, margin + contentWidth - 5, curY + 8.5);

  // Left col: Pet (Requirement #2: ONLY real name, NO technical identifiers like #pet-5959)
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text('Mascota:', margin + 5, curY + 14);
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.text(petDisplayName, margin + 24, curY + 14);

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

  // Right col: Tutor & Session Mood (Requirement #1: Semáforo del comportamiento de la sesión)
  const midX = margin + contentWidth / 2 + 3;
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

  // SEMÁFORO DE COMPORTAMIENTO EN ESTA SESIÓN (Requirement #1)
  doc.setTextColor(...textMuted);
  doc.text('Comportamiento:', midX, curY + 26);

  const sessionMood = visit.mood;
  let moodLabel = 'Sin registrar';
  let dotColor: [number, number, number] = [150, 150, 160];
  let badgeBg: [number, number, number] = [240, 240, 245];
  let badgeTextColor: [number, number, number] = [90, 90, 100];

  if (sessionMood === 'tranquilo') {
    moodLabel = 'Tranquilo';
    dotColor = [22, 163, 74]; // Verde
    badgeBg = [220, 252, 231];
    badgeTextColor = [21, 128, 61];
  } else if (sessionMood === 'inquieto') {
    moodLabel = 'Inquieto';
    dotColor = [217, 119, 6]; // Amarillo / Ámbar
    badgeBg = [254, 243, 199];
    badgeTextColor = [180, 83, 9];
  } else if (sessionMood === 'dificil') {
    moodLabel = 'Difícil';
    dotColor = [220, 38, 38]; // Rojo
    badgeBg = [254, 226, 226];
    badgeTextColor = [185, 28, 28];
  }

  // Draw pill badge for traffic light
  const badgeX = midX + 27;
  const badgeY = curY + 22.2;
  const badgeWidth = 27;
  const badgeHeight = 5.4;
  doc.setFillColor(...badgeBg);
  doc.setDrawColor(...dotColor);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.4, 1.4, 'FD');

  // Traffic light circle
  doc.setFillColor(...dotColor);
  doc.circle(badgeX + 3.5, badgeY + badgeHeight / 2, 1.5, 'F');

  // Badge text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...badgeTextColor);
  doc.text(moodLabel, badgeX + 7.2, badgeY + 3.9);

  // Salud / Piel si existe
  if (pet.healthAllergies && pet.healthAllergies !== 'Sin afecciones registradas.') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    doc.text('Piel / Salud:', midX, curY + 33);
    doc.setTextColor(186, 26, 26);
    doc.setFont('helvetica', 'bold');
    doc.text(pet.healthAllergies.slice(0, 38), midX + 20, curY + 33);
  }

  curY += 45;

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

  // Session Notes
  if (visit.notes || pet.handlingObservations) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text('Notas sesión:', margin + 5, curY + 23);
    doc.setTextColor(...textDark);
    const obsText = visit.notes || pet.handlingObservations || 'Sin observaciones adicionales.';
    doc.text(obsText.slice(0, 75), margin + 26, curY + 23);
  }

  curY += 37;

  // Section 3: Before & After Photos (Requirement #3: Corregir posicionamiento y márgenes de etiquetas)
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

  // Label "ANTES DEL SERVICIO" (Requirement #3: margen interior adecuado, sin desbordamiento)
  const beforeLabelWidth = 42;
  const beforeLabelHeight = 6.4;
  doc.setFillColor(...purplePrimary);
  doc.roundedRect(beforeX + 3, photoY + 3, beforeLabelWidth, beforeLabelHeight, 1.4, 1.4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('ANTES DEL SERVICIO', beforeX + 3 + beforeLabelWidth / 2, photoY + 3 + beforeLabelHeight / 2 + 1, { align: 'center' });

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

  // Label "DESPUÉS DEL SERVICIO" (Requirement #3: ancho suficiente, centrado, con margen interior adecuado)
  const afterLabelWidth = 46;
  const afterLabelHeight = 6.4;
  doc.setFillColor(...goldAccent);
  doc.roundedRect(afterX + 3, photoY + 3, afterLabelWidth, afterLabelHeight, 1.4, 1.4, 'F');
  doc.setTextColor(38, 25, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('DESPUÉS DEL SERVICIO', afterX + 3 + afterLabelWidth / 2, photoY + 3 + afterLabelHeight / 2 + 1, { align: 'center' });

  // Photo card footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('Fotografías reales tomadas durante la sesión de peluquería en nuestras instalaciones.', margin + 5, curY + photoCardHeight - 4);

  curY += photoCardHeight + 5;

  // Section 4: Return Recommendation & Groomer Care Recommendations (Requirement #4 & #5)
  const intervalWeeks = visit.nextRecommendedWeeks || pet.recommendedIntervalWeeks || 4;
  const customRecommendations = (visit.careRecommendations || pet.careRecommendations || '').trim();

  // Split custom recommendations into lines if present
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const recLines = customRecommendations
    ? doc.splitTextToSize(customRecommendations, contentWidth - 10)
    : [];

  const recBoxHeight = Math.max(26, 16 + (recLines.length > 0 ? recLines.length * 4.2 : 5) + (nextVisitDateStr ? 6 : 0));

  doc.setFillColor(255, 250, 235); // soft gold/amber bg
  doc.setDrawColor(245, 200, 100);
  doc.roundedRect(margin, curY, contentWidth, recBoxHeight, 3, 3, 'FD');

  doc.setTextColor(130, 80, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('RECOMENDACIONES DE CUIDADO Y PRÓXIMA VISITA', margin + 5, curY + 6);

  let currentTextY = curY + 12;

  // Requirement #5: Show real groomer recommendations, NOT generic fixed text
  if (recLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    doc.text(recLines, margin + 5, currentTextY);
    currentTextY += recLines.length * 4.2 + 2;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    const defaultAdvice = 'Para conservar la salud del manto y prevenir nudos o dermatitis sugerimos cepillado frecuente y seguir las pautas de higiene.';
    doc.text(defaultAdvice, margin + 5, currentTextY);
    currentTextY += 5.5;
  }

  // Next recommended appointment calculation
  if (nextVisitDateStr) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...purplePrimary);
    doc.text(`Próxima visita sugerida: ${nextVisitDateStr} (en ${intervalWeeks} semanas)`, margin + 5, currentTextY);
  }

  // Footer Disclaimer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  const footerText = `¡Gracias por confiar en ${salonName}! Ficha oficial generada el ${new Date().toLocaleDateString('es-ES')}.`;
  doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });

  const safePetName = petDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_');
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
