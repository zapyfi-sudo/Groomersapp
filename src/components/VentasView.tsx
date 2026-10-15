import React, { useState, useMemo } from 'react';
import { SaleRecord, SalonConfig, Appointment } from '../types';
import { parseSpanishOrIsoDate } from '../utils/storage';

interface VentasViewProps {
  sales: SaleRecord[];
  appointments?: Appointment[];
  salonConfig: SalonConfig;
  onBack: () => void;
}

export type PeriodOption = '7_dias' | '14_dias' | '30_dias' | 'personalizado';

// Helper to format Date into local YYYY-MM-DD (safe from UTC timezone shifts)
export function formatLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to parse any date format (ISO, YYYY-MM-DD, Spanish text, "Hoy") into a reliable Date
export function parseAnyRecordDate(val?: string | number | Date | null): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const str = String(val).trim();

  if (str.toLowerCase() === 'hoy' || str.toLowerCase().includes('hoy')) {
    return new Date();
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    return new Date(y, m, d, 12, 0, 0); // Noon to prevent timezone boundaries shifting
  }

  // Full ISO string with T
  if (str.includes('T') && !isNaN(new Date(str).getTime())) {
    return new Date(str);
  }

  // Spanish text (e.g. "15 de Octubre 2026")
  const parsed = parseSpanishOrIsoDate(str);
  if (parsed && !isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  return new Date();
}

// Extract the local YYYY-MM-DD key for any sale or appointment
// Priority 1: serviceStartedAt (exact moment "Comenzar servicio" was clicked)
// Priority 2: date (appointment scheduled date e.g. "Hoy", "2026-10-15")
// Priority 3: createdAt
export function getSaleDateKey(sale: { serviceStartedAt?: string; date?: string; createdAt?: string }): string {
  if (sale.serviceStartedAt) {
    return formatLocalDateKey(parseAnyRecordDate(sale.serviceStartedAt));
  }
  if (sale.date) {
    return formatLocalDateKey(parseAnyRecordDate(sale.date));
  }
  if (sale.createdAt) {
    return formatLocalDateKey(parseAnyRecordDate(sale.createdAt));
  }
  return formatLocalDateKey(new Date());
}

export const VentasView: React.FC<VentasViewProps> = ({
  sales,
  appointments = [],
  salonConfig,
  onBack
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('7_dias');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatLocalDateKey(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return formatLocalDateKey(new Date());
  });

  // Hovered / active point for the smooth area chart tooltip
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Top services limit: 5 or 10
  const [topServicesLimit, setTopServicesLimit] = useState<5 | 10>(5);

  // Business currency: strictly from salon configuration (defaults to MXN if in Mexico)
  const businessCurrency = salonConfig.currency || (salonConfig.country?.toLowerCase().includes('m') ? 'MXN' : 'MXN');

  // Format money helper
  const formatMoney = (amount: number, curr?: string) => {
    const c = curr || businessCurrency;
    return `$${Number(amount || 0).toLocaleString()} ${c}`;
  };

  const todayDate = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatLocalDateKey(todayDate), [todayDate]);

  // Unified, deduplicated sales list by appointmentId
  // Guarantees that any started appointment in Agenda is immediately reflected!
  const unifiedSales = useMemo(() => {
    const map = new Map<string, SaleRecord>();

    // 1. Process all started or completed appointments from Agenda / Salón
    for (const apt of appointments) {
      const isStarted =
        apt.status === 'en_salon' ||
        apt.status === 'en_corte' ||
        apt.status === 'por_retirar' ||
        apt.status === 'completado';

      if (!isStarted) continue;

      let priceVal = Number(apt.salesRecordedAmount);
      if (!priceVal || isNaN(priceVal) || priceVal <= 0) {
        priceVal = Number(String(apt.price).replace(/[^0-9.,]/g, '').replace(',', '.'));
      }
      if (!priceVal || isNaN(priceVal) || priceVal <= 0) {
        const matched = salonConfig.services?.find(
          (s) => s.name?.toLowerCase().trim() === apt.serviceName?.toLowerCase().trim()
        );
        if (matched) {
          priceVal = Number(matched.price);
        }
      }

      // Only count if price is valid (> 0) and service was actually started
      if (priceVal > 0) {
        const key = apt.id;
        const dateIso = apt.serviceStartedAt || apt.createdAt || new Date().toISOString();
        map.set(key, {
          id: apt.saleRecordId || `sale_${apt.id}`,
          appointmentId: apt.id,
          businessId: salonConfig.id || 'biz_main',
          petId: apt.petId,
          petName: apt.petName,
          breed: apt.breed,
          tutorName: apt.tutorName,
          tutorPhone: apt.tutorPhone,
          serviceName: apt.serviceName,
          amount: priceVal,
          servicePrice: priceVal,
          finalPrice: priceVal,
          currency: apt.currency || businessCurrency,
          groomer: apt.groomer || 'Personal de turno',
          paymentStatus: apt.paymentStatus || (apt.status === 'completado' ? 'cobrado' : 'en_proceso'),
          date: apt.date || dateIso.split('T')[0],
          time: apt.time || 'En servicio',
          createdAt: apt.createdAt || dateIso,
          serviceStartedAt: apt.serviceStartedAt || dateIso,
          status: apt.status as any
        });
      }
    }

    // 2. Merge with explicit sales records (overriding or adding)
    if (sales && sales.length > 0) {
      for (const s of sales) {
        if (!s || !s.id) continue;
        const key = s.appointmentId || s.id;
        const existing = map.get(key);
        if (existing) {
          map.set(key, { ...existing, ...s });
        } else {
          map.set(key, s);
        }
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const dateA = a.serviceStartedAt || a.date || a.createdAt || '';
      const dateB = b.serviceStartedAt || b.date || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
    return list;
  }, [sales, appointments, salonConfig.id, salonConfig.services, businessCurrency]);

  // Validation for custom date range
  const isCustomRangeValid = useMemo(() => {
    if (selectedPeriod !== 'personalizado') return true;
    if (!customStartDate || !customEndDate) return false;
    return customStartDate <= customEndDate;
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Generate all consecutive days for the selected period
  const periodDaysList = useMemo(() => {
    const list: string[] = [];
    const refToday = new Date();
    refToday.setHours(12, 0, 0, 0);

    if (selectedPeriod === '7_dias') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(refToday);
        d.setDate(d.getDate() - i);
        list.push(formatLocalDateKey(d));
      }
    } else if (selectedPeriod === '14_dias') {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(refToday);
        d.setDate(d.getDate() - i);
        list.push(formatLocalDateKey(d));
      }
    } else if (selectedPeriod === '30_dias') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(refToday);
        d.setDate(d.getDate() - i);
        list.push(formatLocalDateKey(d));
      }
    } else if (selectedPeriod === 'personalizado') {
      if (isCustomRangeValid && customStartDate && customEndDate) {
        const start = parseAnyRecordDate(customStartDate);
        const end = parseAnyRecordDate(customEndDate);
        const curr = new Date(start);
        curr.setHours(12, 0, 0, 0);
        end.setHours(12, 0, 0, 0);

        while (curr <= end) {
          list.push(formatLocalDateKey(curr));
          curr.setDate(curr.getDate() + 1);
        }
      }
    }
    return list;
  }, [selectedPeriod, customStartDate, customEndDate, isCustomRangeValid]);

  const periodDaysSet = useMemo(() => new Set(periodDaysList), [periodDaysList]);

  // Filter sales belonging strictly to the selected period
  const salesInPeriod = useMemo(() => {
    if (!isCustomRangeValid && selectedPeriod === 'personalizado') {
      return [];
    }
    return unifiedSales.filter((sale) => {
      const saleKey = getSaleDateKey(sale);
      return periodDaysSet.has(saleKey);
    });
  }, [unifiedSales, periodDaysSet, isCustomRangeValid, selectedPeriod]);

  // KPI: Total Revenue of the selected period
  const totalRevenue = useMemo(() => {
    return salesInPeriod.reduce((sum, s) => sum + (Number(s.amount) || Number(s.servicePrice) || 0), 0);
  }, [salesInPeriod]);

  // KPI: Total counted started services in the selected period
  const totalServicesCount = salesInPeriod.length;

  // Breakdown by service for Element 5 (Horizontal bars sorted descending)
  const serviceStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    for (const s of salesInPeriod) {
      const name = s.serviceName || 'Servicio de peluquería';
      const amt = Number(s.amount) || Number(s.servicePrice) || 0;
      if (!stats[name]) {
        stats[name] = { count: 0, total: 0 };
      }
      stats[name].count += 1;
      stats[name].total += amt;
    }

    const list = Object.entries(stats).map(([name, data]) => ({
      name,
      count: data.count,
      total: data.total
    }));

    list.sort((a, b) => b.total - a.total);
    return list;
  }, [salesInPeriod]);

  const maxServiceAmount = useMemo(() => {
    if (serviceStats.length === 0) return 1;
    return Math.max(...serviceStats.map((s) => s.total), 1);
  }, [serviceStats]);

  const displayedServices = useMemo(() => {
    return serviceStats.slice(0, topServicesLimit);
  }, [serviceStats, topServicesLimit]);

  // Daily evolution data for Hotmart-style Smooth Area Curve Chart
  const chartData = useMemo(() => {
    const dayTotals: Record<string, number> = {};
    const dayCounts: Record<string, number> = {};

    for (const dayKey of periodDaysList) {
      dayTotals[dayKey] = 0;
      dayCounts[dayKey] = 0;
    }

    for (const s of salesInPeriod) {
      const dayKey = getSaleDateKey(s);
      const amt = Number(s.amount) || Number(s.servicePrice) || 0;
      if (dayTotals[dayKey] !== undefined) {
        dayTotals[dayKey] += amt;
        dayCounts[dayKey] += 1;
      }
    }

    const entries = periodDaysList.map((dayKey) => {
      const parsedDate = parseAnyRecordDate(dayKey);
      const dayLabel = parsedDate.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      });
      const fullDateLabel = parsedDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      return {
        dayKey,
        dayLabel,
        fullDateLabel,
        amount: dayTotals[dayKey] || 0,
        count: dayCounts[dayKey] || 0,
        isToday: dayKey === todayKey
      };
    });

    const maxAmount = Math.max(...entries.map((e) => e.amount), 1);
    return { entries, maxAmount };
  }, [periodDaysList, salesInPeriod, todayKey]);

  // Geometry computation for SVG Smooth Area Chart (Bezier Curve)
  const svgGeometry = useMemo(() => {
    const entries = chartData.entries;
    const n = entries.length;
    if (n === 0) return null;

    const width = 860;
    const height = 240;
    const padLeft = 60;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 40;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    const maxAmt = chartData.maxAmount;

    const points = entries.map((e, idx) => {
      const x = n === 1 ? padLeft + innerW / 2 : padLeft + (idx / (n - 1)) * innerW;
      const y = padTop + innerH - (e.amount / maxAmt) * innerH;
      return { x, y, ...e };
    });

    // Build smooth cubic bezier curve
    let linePath = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cp1x = curr.x + (next.x - curr.x) / 2;
      const cp1y = curr.y;
      const cp2x = curr.x + (next.x - curr.x) / 2;
      const cp2y = next.y;
      linePath += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
    }

    const baselineY = padTop + innerH;
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    const areaPath = `${linePath} L ${lastPt.x},${baselineY} L ${firstPt.x},${baselineY} Z`;

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      innerW,
      innerH,
      baselineY,
      points,
      linePath,
      areaPath,
      maxAmt
    };
  }, [chartData]);

  const periodTitle =
    selectedPeriod === '7_dias'
      ? 'Últimos 7 días'
      : selectedPeriod === '14_dias'
      ? 'Últimos 14 días'
      : selectedPeriod === '30_dias'
      ? 'Últimos 30 días'
      : 'Período personalizado';

  const activePoint = hoveredPointIndex !== null && svgGeometry?.points?.[hoveredPointIndex]
    ? svgGeometry.points[hoveredPointIndex]
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16 max-w-5xl mx-auto">
      {/* ELEMENTO 1: ENCABEZADO Y SINCRONIZACIÓN */}
      <div className="space-y-4">
        {/* Top Header Bar with Back Button */}
        <div className="flex items-center justify-between pb-3 border-b border-[#efecfd]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-white hover:bg-[#f5f2ff] text-[#2e004e] border border-[#cfc2d2]/40 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
              title="Volver a Ajustes"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#f2daff] text-[#2e004e] font-black text-[11px] uppercase tracking-wider">
                  Módulo Financiero
                </span>
                <span className="text-xs text-[#7e7482] font-semibold">
                  {salonConfig.name} • {businessCurrency}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1a1a26] tracking-tight">
                Ventas e ingresos
              </h1>
            </div>
          </div>
        </div>

        {/* Bloque informativo: Sincronización automática de ingresos (Conservado según instrucción) */}
        <div className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-[#2e004e] text-[#f9b900] flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">payments</span>
          </div>
          <div className="text-xs text-[#2e004e] leading-relaxed">
            <span className="font-extrabold block text-sm mb-0.5">
              Sincronización automática de ingresos
            </span>
            Cada servicio iniciado en Agenda mediante <strong className="font-black text-[#1a1a26]">«Comenzar servicio»</strong> se contabiliza inmediatamente aquí con su precio real ({businessCurrency}). El ingreso se registra una sola vez de forma persistente e inmutable.
          </div>
        </div>
      </div>

      {/* ELEMENTO 2: SELECTOR DE PERÍODOS */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#cfc2d2]/40 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
          <span className="text-xs font-black text-[#1a1a26] uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-[#4b0878]">calendar_month</span>
            <span>Período de consulta</span>
          </span>
          <span className="text-xs text-[#7e7482] font-semibold">
            {periodTitle}
          </span>
        </div>

        {/* Botones de períodos */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedPeriod('7_dias')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
              selectedPeriod === '7_dias'
                ? 'bg-[#2e004e] text-[#f9b900] shadow-sm ring-1 ring-[#2e004e]'
                : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
            }`}
          >
            Últimos 7 días
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod('14_dias')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
              selectedPeriod === '14_dias'
                ? 'bg-[#2e004e] text-[#f9b900] shadow-sm ring-1 ring-[#2e004e]'
                : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
            }`}
          >
            Últimos 14 días
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod('30_dias')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
              selectedPeriod === '30_dias'
                ? 'bg-[#2e004e] text-[#f9b900] shadow-sm ring-1 ring-[#2e004e]'
                : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
            }`}
          >
            Últimos 30 días
          </button>

          <button
            type="button"
            onClick={() => setSelectedPeriod('personalizado')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
              selectedPeriod === 'personalizado'
                ? 'bg-[#2e004e] text-[#f9b900] shadow-sm ring-1 ring-[#2e004e]'
                : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
            }`}
          >
            Personalizado
          </button>
        </div>

        {/* Formulario para rango personalizado */}
        {selectedPeriod === 'personalizado' && (
          <div className="bg-[#fcf8ff] border border-[#cfc2d2]/40 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-[#1a1a26] whitespace-nowrap">
                  Fecha inicial:
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-[#cfc2d2]/60 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none shadow-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-black text-[#1a1a26] whitespace-nowrap">
                  Fecha final:
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-[#cfc2d2]/60 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none shadow-xs"
                />
              </div>
            </div>

            {!isCustomRangeValid && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>
                  La fecha inicial no puede ser posterior a la fecha final. Por favor verifica el rango.
                </span>
              </div>
            )}

            <p className="text-[11px] text-[#7e7482]">
              Puedes seleccionar cualquier intervalo histórico de meses o años anteriores. El total y la gráfica se calcularán exclusivamente para las fechas seleccionadas.
            </p>
          </div>
        )}
      </div>

      {/* ELEMENTO 3: TOTAL DEL PERÍODO */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-[#cfc2d2]/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-[#7e7482] uppercase tracking-wider">
            Total {periodTitle}
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
            {totalServicesCount} {totalServicesCount === 1 ? 'servicio contabilizado' : 'servicios contabilizados'}
          </span>
        </div>

        <div className="text-3xl sm:text-4xl font-black text-[#1a1a26] tracking-tight">
          {formatMoney(totalRevenue)}
        </div>

        <p className="text-xs text-[#7e7482]">
          Calculado a partir de los servicios reales iniciados desde Agenda en este período.
        </p>
      </div>

      {/* ELEMENTO 4: GRÁFICA PRINCIPAL DE INGRESOS (Estilo Hotmart - Curva Suave de Área) */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-[#cfc2d2]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#efecfd]">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1a1a26] flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-[#2e004e]">trending_up</span>
              <span>Evolución diaria de ingresos</span>
            </h2>
            <p className="text-xs text-[#7e7482] mt-0.5">
              Evolución cronológica día a día ({periodTitle})
            </p>
          </div>

          {activePoint && (
            <div className="bg-[#2e004e] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 animate-in fade-in duration-150">
              <span className="text-[#f9b900] font-black">{formatMoney(activePoint.amount)}</span>
              <span className="text-white/60">•</span>
              <span className="text-white/90">{activePoint.dayLabel}</span>
              <span className="text-white/60">({activePoint.count} {activePoint.count === 1 ? 'servicio' : 'servicios'})</span>
            </div>
          )}
        </div>

        {/* SVG Container with Horizontal Scroll support on small mobile screens */}
        <div className="overflow-x-auto pb-2">
          <div style={{ minWidth: `${Math.max(chartData.entries.length * 36, 600)}px` }} className="relative">
            {svgGeometry && (
              <svg
                viewBox={`0 0 ${svgGeometry.width} ${svgGeometry.height}`}
                className="w-full h-64 sm:h-72 select-none"
              >
                <defs>
                  <linearGradient id="hotmartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2e004e" stopOpacity="0.22" />
                    <stop offset="85%" stopColor="#2e004e" stopOpacity="0.02" />
                    <stop offset="100%" stopColor="#2e004e" stopOpacity="0.0" />
                  </linearGradient>

                  <linearGradient id="hotmartLineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2e004e" />
                    <stop offset="100%" stopColor="#4b0878" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines at 100%, 50%, and 0% (baseline) */}
                {[1, 0.5, 0].map((ratio) => {
                  const y = svgGeometry.padTop + svgGeometry.innerH * (1 - ratio);
                  const labelAmt = Math.round(svgGeometry.maxAmt * ratio);
                  return (
                    <g key={ratio}>
                      <line
                        x1={svgGeometry.padLeft}
                        y1={y}
                        x2={svgGeometry.width - svgGeometry.padRight}
                        y2={y}
                        stroke="#e5dfeb"
                        strokeDasharray={ratio > 0 ? '4 4' : undefined}
                        strokeWidth={ratio === 0 ? 1.5 : 1}
                      />
                      <text
                        x={svgGeometry.padLeft - 10}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fontWeight="700"
                        fill="#7e7482"
                      >
                        ${labelAmt.toLocaleString()}
                      </text>
                    </g>
                  );
                })}

                {/* Filled Area beneath curve */}
                <path
                  d={svgGeometry.areaPath}
                  fill="url(#hotmartAreaGradient)"
                />

                {/* Smooth Curve Line */}
                <path
                  d={svgGeometry.linePath}
                  fill="none"
                  stroke="url(#hotmartLineGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive Points and X Axis Labels */}
                {svgGeometry.points.map((pt, idx) => {
                  const isHovered = hoveredPointIndex === idx;
                  const hasAmount = pt.amount > 0;

                  return (
                    <g
                      key={pt.dayKey}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      onClick={() => setHoveredPointIndex(idx)}
                    >
                      {/* Vertical Guideline on Hover */}
                      {isHovered && (
                        <line
                          x1={pt.x}
                          y1={svgGeometry.padTop}
                          x2={pt.x}
                          y2={svgGeometry.baselineY}
                          stroke="#2e004e"
                          strokeDasharray="3 3"
                          strokeWidth="1.5"
                          opacity="0.6"
                        />
                      )}

                      {/* Transparent Hover Target Area */}
                      <rect
                        x={pt.x - 14}
                        y={svgGeometry.padTop}
                        width={28}
                        height={svgGeometry.innerH + 30}
                        fill="transparent"
                      />

                      {/* Point Outer Ring */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 7 : hasAmount ? 5 : pt.isToday ? 4 : 3}
                        fill={isHovered ? '#f9b900' : hasAmount ? (pt.isToday ? '#f9b900' : '#2e004e') : '#cfc2d2'}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        className="transition-all duration-150"
                      />

                      {/* Floating Amount Tag on point if > 0 or hovered */}
                      {(hasAmount || isHovered) && (
                        <g>
                          <rect
                            x={pt.x - 30}
                            y={Math.max(pt.y - 24, 6)}
                            width={60}
                            height={18}
                            rx={6}
                            fill="#2e004e"
                            className="shadow-sm"
                          />
                          <text
                            x={pt.x}
                            y={Math.max(pt.y - 12, 18)}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="900"
                            fill="#f9b900"
                          >
                            ${pt.amount.toLocaleString()}
                          </text>
                        </g>
                      )}

                      {/* X Axis Date Label */}
                      <text
                        x={pt.x}
                        y={svgGeometry.baselineY + 20}
                        textAnchor="middle"
                        fontSize={pt.isToday ? '10' : '9'}
                        fontWeight={pt.isToday || isHovered ? '900' : '600'}
                        fill={pt.isToday ? '#2e004e' : isHovered ? '#1a1a26' : '#7e7482'}
                      >
                        {pt.isToday ? 'Hoy' : pt.dayLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Empty state overlay if zero total in the whole period */}
            {totalRevenue === 0 && (
              <div className="text-center py-2 text-xs text-[#7e7482] font-medium">
                Sin ingresos registrados en este período. Al pulsar «Comenzar servicio» en Agenda, la curva reflejará inmediatamente el importe.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ELEMENTO 5: GRÁFICA DE BARRAS POR SERVICIO (Horizontales ordenadas de mayor a menor importe) */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-[#cfc2d2]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#efecfd]">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1a1a26] flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-[#2e004e]">bar_chart</span>
              <span>Ingresos por servicio</span>
            </h2>
            <p className="text-xs text-[#7e7482] mt-0.5">
              Servicios con ingresos generados durante {periodTitle.toLowerCase()}
            </p>
          </div>

          {/* Toggle Top 5 / Top 10 */}
          {serviceStats.length > 5 && (
            <div className="flex items-center gap-1 bg-[#f5f2ff] p-1 rounded-xl self-start sm:self-auto border border-[#cfc2d2]/40">
              <button
                type="button"
                onClick={() => setTopServicesLimit(5)}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  topServicesLimit === 5
                    ? 'bg-[#2e004e] text-[#f9b900] shadow-xs'
                    : 'text-[#1a1a26] hover:text-[#2e004e]'
                }`}
              >
                Top 5
              </button>
              <button
                type="button"
                onClick={() => setTopServicesLimit(10)}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  topServicesLimit === 10
                    ? 'bg-[#2e004e] text-[#f9b900] shadow-xs'
                    : 'text-[#1a1a26] hover:text-[#2e004e]'
                }`}
              >
                Top 10
              </button>
            </div>
          )}
        </div>

        {displayedServices.length === 0 ? (
          <div className="text-center py-10 text-xs text-[#7e7482] space-y-1">
            <span className="material-symbols-outlined text-3xl text-gray-300 block">inventory_2</span>
            <span>No hay ingresos por servicios en el período seleccionado.</span>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {displayedServices.map((service, index) => {
              const widthPct = Math.max(Math.round((service.total / maxServiceAmount) * 100), 6);
              const sharePct = totalRevenue > 0 ? Math.round((service.total / totalRevenue) * 100) : 0;

              return (
                <div key={service.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-[#f5f2ff] text-[#2e004e] font-black text-[11px] flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="font-extrabold text-[#1a1a26] truncate" title={service.name}>
                        {service.name}
                      </span>
                      <span className="text-[11px] text-[#7e7482] shrink-0">
                        ({service.count} {service.count === 1 ? 'atención' : 'atenciones'} • {sharePct}%)
                      </span>
                    </div>

                    <span className="font-black text-[#2e004e] text-sm shrink-0">
                      {formatMoney(service.total)}
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-3 bg-[#f5f2ff] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        index === 0 ? 'bg-[#2e004e]' : 'bg-[#f9b900]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
