import React, { useState, useMemo } from 'react';
import { SaleRecord, SalonConfig, Appointment } from '../types';
import { parseSpanishOrIsoDate } from '../utils/storage';

interface VentasViewProps {
  sales: SaleRecord[];
  appointments?: Appointment[];
  salonConfig: SalonConfig;
  onBack: () => void;
}

export type PeriodOption = '7_dias' | '15_dias' | '30_dias' | 'personalizado';

// Helper to format Date into local YYYY-MM-DD (safe from UTC timezone shifts)
export function formatLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to parse any format (ISO, YYYY-MM-DD, Spanish text, "Hoy") into a reliable Date
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

  // Spanish text (e.g. "14 de Octubre 2026")
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
export function getSaleDateKey(sale: { serviceStartedAt?: string; createdAt?: string; date?: string }): string {
  if (sale.serviceStartedAt) {
    return formatLocalDateKey(parseAnyRecordDate(sale.serviceStartedAt));
  }
  if (sale.createdAt) {
    return formatLocalDateKey(parseAnyRecordDate(sale.createdAt));
  }
  if (sale.date) {
    return formatLocalDateKey(parseAnyRecordDate(sale.date));
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'todos' | 'cobrado' | 'en_proceso' | 'por_cobrar'>('todos');

  // Business currency
  const businessCurrency = salonConfig.currency || 'MXN';

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

      const priceVal = Number(apt.salesRecordedAmount) > 0
        ? Number(apt.salesRecordedAmount)
        : Number(apt.price) > 0
        ? Number(apt.price)
        : 0;

      // Only count if price is valid (> 0) and service was actually started
      if (isStarted && priceVal > 0) {
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
      const dateA = a.serviceStartedAt || a.createdAt || a.date || '';
      const dateB = b.serviceStartedAt || b.createdAt || b.date || '';
      return dateB.localeCompare(dateA);
    });
    return list;
  }, [sales, appointments, salonConfig.id, businessCurrency]);

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
    } else if (selectedPeriod === '15_dias') {
      for (let i = 14; i >= 0; i--) {
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

  // Further filter for the transaction ledger table by search query and payment status
  const displayedLedgerSales = useMemo(() => {
    return salesInPeriod.filter((s) => {
      if (paymentFilter !== 'todos') {
        const matches = s.paymentStatus === paymentFilter;
        if (!matches) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.petName.toLowerCase().includes(q) ||
        s.tutorName.toLowerCase().includes(q) ||
        s.serviceName.toLowerCase().includes(q) ||
        (s.groomer && s.groomer.toLowerCase().includes(q)) ||
        (s.breed && s.breed.toLowerCase().includes(q))
      );
    });
  }, [salesInPeriod, paymentFilter, searchQuery]);

  // KPI Calculations for the selected period
  const totalRevenue = useMemo(() => {
    return salesInPeriod.reduce((sum, s) => sum + (Number(s.amount) || Number(s.servicePrice) || 0), 0);
  }, [salesInPeriod]);

  const totalServicesCount = salesInPeriod.length;

  const averageTicket = totalServicesCount > 0 ? Math.round(totalRevenue / totalServicesCount) : 0;

  // Breakdown by service
  const serviceStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    for (const s of salesInPeriod) {
      const name = s.serviceName || 'Otros servicios';
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
      total: data.total,
      percentage: totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0
    }));

    list.sort((a, b) => b.total - a.total);
    return list;
  }, [salesInPeriod, totalRevenue]);

  const topService = serviceStats[0];

  // Daily evolution data for chart bars (aggregating by day)
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

  // Export CSV Handler
  const handleExportCSV = () => {
    if (displayedLedgerSales.length === 0) return;

    const headers = [
      'ID Venta',
      'Cita ID',
      'Fecha',
      'Hora',
      'Mascota',
      'Raza',
      'Cliente / Tutor',
      'Teléfono',
      'Servicio',
      'Peluquero',
      'Monto Registrado',
      'Moneda',
      'Estado'
    ];

    const rows = displayedLedgerSales.map((s) => [
      s.id,
      s.appointmentId,
      s.date || (s.serviceStartedAt ? new Date(s.serviceStartedAt).toLocaleDateString('es-ES') : ''),
      s.time || '',
      `"${(s.petName || '').replace(/"/g, '""')}"`,
      `"${(s.breed || '').replace(/"/g, '""')}"`,
      `"${(s.tutorName || '').replace(/"/g, '""')}"`,
      `"${s.tutorPhone || ''}"`,
      `"${(s.serviceName || '').replace(/"/g, '""')}"`,
      `"${(s.groomer || '').replace(/"/g, '""')}"`,
      Number(s.amount || s.servicePrice || 0),
      s.currency || businessCurrency,
      s.paymentStatus || 'cobrado'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ventas_${salonConfig.name || 'Salon'}_${todayKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const periodTitle =
    selectedPeriod === '7_dias'
      ? 'Últimos 7 días'
      : selectedPeriod === '15_dias'
      ? 'Últimos 15 días'
      : selectedPeriod === '30_dias'
      ? 'Últimos 30 días'
      : 'Período personalizado';

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#efecfd]">
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
            <h1 className="text-2xl font-black text-[#1a1a26] tracking-tight">
              Ventas e Ingresos
            </h1>
          </div>
        </div>

        {/* Action Button: Export CSV */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={displayedLedgerSales.length === 0}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
              displayedLedgerSales.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title="Descargar listado en formato Excel / CSV"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Operational Notice: Source of Revenue (Requirement #1 & #2) */}
      <div className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#2e004e] text-[#f9b900] flex items-center justify-center shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-lg">payments</span>
        </div>
        <div className="text-xs text-[#2e004e] leading-relaxed">
          <span className="font-extrabold block text-sm mb-0.5">
            Sincronización automática de ingresos
          </span>
          Cada servicio iniciado en Agenda mediante <strong className="font-black text-[#1a1a26]">«Comenzar servicio»</strong> se contabiliza inmediatamente aquí con su precio real ({businessCurrency}). El ingreso se registra una sola vez de forma persistente e inmutable.
        </div>
      </div>

      {/* Section: Evolución de Ingresos - Period Filters (Requirement #3, #4, #5) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#efecfd]">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-[#2e004e]">trending_up</span>
              <h2 className="text-base sm:text-lg font-black text-[#1a1a26]">
                Evolución de Ingresos
              </h2>
            </div>
            <p className="text-xs text-[#7e7482] mt-0.5">
              Consulta de ingresos generados automáticamente al iniciar servicios en Agenda
            </p>
          </div>

          <span className="text-xs font-black text-[#2e004e] bg-[#f5f2ff] px-3 py-1 rounded-xl self-start sm:self-auto border border-[#cfc2d2]/30">
            {totalServicesCount} {totalServicesCount === 1 ? 'servicio contabilizado' : 'servicios contabilizados'}
          </span>
        </div>

        {/* 4 Required Period Filter Tabs (Requirement #3) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedPeriod('7_dias')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedPeriod === '7_dias'
                  ? 'bg-[#2e004e] text-[#f9b900] shadow-sm'
                  : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
              }`}
            >
              Últimos 7 días
            </button>

            <button
              type="button"
              onClick={() => setSelectedPeriod('15_dias')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedPeriod === '15_dias'
                  ? 'bg-[#2e004e] text-[#f9b900] shadow-sm'
                  : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
              }`}
            >
              Últimos 15 días
            </button>

            <button
              type="button"
              onClick={() => setSelectedPeriod('30_dias')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedPeriod === '30_dias'
                  ? 'bg-[#2e004e] text-[#f9b900] shadow-sm'
                  : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
              }`}
            >
              Últimos 30 días
            </button>

            <button
              type="button"
              onClick={() => setSelectedPeriod('personalizado')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedPeriod === 'personalizado'
                  ? 'bg-[#2e004e] text-[#f9b900] shadow-sm'
                  : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Custom Date Range Selector (Requirement #5) */}
          {selectedPeriod === 'personalizado' && (
            <div className="bg-[#fcf8ff] border border-[#cfc2d2]/40 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black text-[#1a1a26] whitespace-nowrap">
                    Fecha de inicio:
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
                    Fecha de fin:
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white border border-[#cfc2d2]/60 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* Date Validation Alert (Requirement #5) */}
              {!isCustomRangeValid && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>
                    La fecha de inicio no puede ser posterior a la fecha de fin. Por favor verifica el rango de fechas.
                  </span>
                </div>
              )}

              <p className="text-[11px] text-[#7e7482]">
                Puedes consultar cualquier intervalo histórico (meses o años anteriores). El total y el gráfico se actualizarán exclusivamente con los registros de ese período.
              </p>
            </div>
          )}
        </div>

        {/* Primary KPI Cards (Requirement #6 & #7) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Card 1: Total Revenue of Period */}
          <div className="bg-[#fbf7fe] rounded-2xl p-4 border border-[#cfc2d2]/40 relative overflow-hidden shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-2">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <span className="text-[11px] font-bold text-[#7e7482] uppercase tracking-wider block">
              Total {periodTitle}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#1a1a26] mt-1 tracking-tight">
              {formatMoney(totalRevenue)}
            </div>
            <span className="text-[11px] text-emerald-700 font-extrabold mt-1 inline-block">
              {totalServicesCount} {totalServicesCount === 1 ? 'servicio iniciado' : 'servicios iniciados'}
            </span>
          </div>

          {/* Card 2: Services Count */}
          <div className="bg-[#fbf7fe] rounded-2xl p-4 border border-[#cfc2d2]/40 relative overflow-hidden shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#f5f2ff] text-[#2e004e] flex items-center justify-center font-bold mb-2">
              <span className="material-symbols-outlined text-xl">content_cut</span>
            </div>
            <span className="text-[11px] font-bold text-[#7e7482] uppercase tracking-wider block">
              Servicios Iniciados
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#1a1a26] mt-1 tracking-tight">
              {totalServicesCount}
            </div>
            <span className="text-[11px] text-[#4b0878] font-bold mt-1 inline-block">
              Mascotas atendidas en el período
            </span>
          </div>

          {/* Card 3: Average Ticket */}
          <div className="bg-[#fbf7fe] rounded-2xl p-4 border border-[#cfc2d2]/40 relative overflow-hidden shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#fff8e1] text-[#7a5900] flex items-center justify-center font-bold mb-2">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <span className="text-[11px] font-bold text-[#7e7482] uppercase tracking-wider block">
              Ticket Promedio
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#1a1a26] mt-1 tracking-tight">
              {formatMoney(averageTicket)}
            </div>
            <span className="text-[11px] text-[#7a5900] font-bold mt-1 inline-block">
              Ingreso promedio por mascota
            </span>
          </div>

          {/* Card 4: Top Service */}
          <div className="bg-[#fbf7fe] rounded-2xl p-4 border border-[#cfc2d2]/40 relative overflow-hidden shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#f2daff] text-[#2e004e] flex items-center justify-center font-bold mb-2">
              <span className="material-symbols-outlined text-xl">star</span>
            </div>
            <span className="text-[11px] font-bold text-[#7e7482] uppercase tracking-wider block">
              Servicio Más Demandado
            </span>
            <div className="text-base sm:text-lg font-black text-[#1a1a26] mt-1 tracking-tight truncate" title={topService?.name || 'Sin servicios'}>
              {topService?.name || 'Sin registros'}
            </div>
            <span className="text-[11px] text-[#2e004e] font-bold mt-1 inline-block">
              {topService ? `${topService.count} veces (${topService.percentage}%)` : 'Aún sin datos'}
            </span>
          </div>
        </div>

        {/* Dynamic Evolution Bar Chart (Requirement #4 & #6) */}
        <div className="pt-4 border-t border-[#efecfd] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#1a1a26] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#2e004e]">bar_chart</span>
              <span>Gráfico de ingresos diarios — {periodTitle}</span>
            </h3>
            <span className="text-xs font-bold text-[#7e7482]">
              {chartData.entries.length} {chartData.entries.length === 1 ? 'día' : 'días'} en el período
            </span>
          </div>

          {/* Interactive Chart Container with Horizontal Scroll if many days */}
          <div className="overflow-x-auto pb-2">
            <div
              style={{ minWidth: `${Math.max(chartData.entries.length * 38, 300)}px` }}
              className="h-56 pt-8 pb-2 flex items-end justify-between gap-1.5 sm:gap-2 px-2 bg-[#fcf8ff] rounded-2xl border border-[#cfc2d2]/30"
            >
              {chartData.entries.map((item) => {
                const heightPercent = chartData.maxAmount > 0
                  ? Math.max(Math.round((item.amount / chartData.maxAmount) * 100), item.amount > 0 ? 14 : 5)
                  : 5;

                return (
                  <div
                    key={item.dayKey}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative cursor-pointer"
                  >
                    {/* Floating Tooltip on Hover / Focus (Requirement #6) */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#2e004e] text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg pointer-events-none z-20">
                      <div>{item.fullDateLabel}</div>
                      <div className="text-[#f9b900] font-black">{formatMoney(item.amount)} ({item.count} {item.count === 1 ? 'servicio' : 'servicios'})</div>
                    </div>

                    {/* Amount badge on top of bar if > 0 */}
                    {item.amount > 0 && (
                      <span className="text-[10px] font-black text-[#2e004e] block truncate max-w-full">
                        {formatMoney(item.amount)}
                      </span>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[46px] rounded-t-xl transition-all ${
                        item.amount > 0
                          ? item.isToday
                            ? 'bg-[#f9b900] ring-2 ring-[#2e004e]'
                            : 'bg-[#2e004e] group-hover:bg-[#4b0878]'
                          : 'bg-[#cfc2d2]/40'
                      }`}
                    />

                    {/* Day Label below bar */}
                    <span
                      className={`text-[10px] font-extrabold text-center truncate max-w-[50px] ${
                        item.isToday ? 'text-[#2e004e] font-black bg-[#f9b900]/30 px-1 rounded' : 'text-[#7e7482]'
                      }`}
                      title={item.fullDateLabel}
                    >
                      {item.isToday ? 'Hoy' : item.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Service Breakdown & Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Breakdown by Service */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-[#2e004e]">donut_small</span>
              <h2 className="text-base font-black text-[#1a1a26]">
                Desglose por Servicio
              </h2>
            </div>
            <span className="text-xs text-[#7e7482] font-semibold">
              {serviceStats.length} servicios
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {serviceStats.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#7e7482]">
                No hay servicios iniciados en este período
              </div>
            ) : (
              serviceStats.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#1a1a26] truncate max-w-[200px]">
                      {item.name}
                    </span>
                    <span className="text-[#2e004e] font-black">
                      {formatMoney(item.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#f5f2ff] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${item.percentage}%` }}
                        className="h-full bg-[#f9b900] rounded-full"
                      />
                    </div>
                    <span className="text-[10px] text-[#7e7482] font-bold w-12 text-right">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detailed Transactions Ledger Table */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#efecfd]">
            <div>
              <h2 className="text-base font-black text-[#1a1a26] flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-[#2e004e]">list_alt</span>
                <span>Registro Detallado ({periodTitle})</span>
              </h2>
              <p className="text-xs text-[#7e7482]">
                Cada cita iniciada con su precio contabilizado
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2 text-[#7e7482] text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar mascota, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none placeholder:text-[#7e7482]/60 w-44 sm:w-52"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            {displayedLedgerSales.length === 0 ? (
              <div className="text-center py-10 space-y-1">
                <span className="material-symbols-outlined text-3xl text-[#cfc2d2]">
                  receipt_long
                </span>
                <p className="text-xs font-bold text-[#1a1a26]">
                  No hay ingresos registrados en este período
                </p>
                <p className="text-[11px] text-[#7e7482]">
                  Al pulsar «Comenzar servicio» en Agenda, el precio aparecerá aquí de inmediato.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#efecfd] text-[10px] font-black uppercase tracking-wider text-[#7e7482]">
                    <th className="py-2 px-2.5">Fecha</th>
                    <th className="py-2 px-2.5">Mascota / Tutor</th>
                    <th className="py-2 px-2.5">Servicio</th>
                    <th className="py-2 px-2.5 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efecfd] text-xs">
                  {displayedLedgerSales.map((sale) => {
                    const saleAmt = Number(sale.amount) || Number(sale.servicePrice) || 0;
                    const dateDisplay = sale.date || (sale.serviceStartedAt ? new Date(sale.serviceStartedAt).toLocaleDateString('es-ES') : 'Hoy');

                    return (
                      <tr key={sale.id} className="hover:bg-[#fcf8ff] transition-colors">
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <div className="font-extrabold text-[#1a1a26] text-xs">{dateDisplay}</div>
                          <div className="text-[10px] text-[#7e7482]">{sale.time || 'En servicio'}</div>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <div className="font-black text-[#2e004e] flex items-center gap-1">
                            <span>🐾</span> {sale.petName}
                          </div>
                          <div className="text-[10px] text-[#7e7482] truncate max-w-[140px]">
                            {sale.tutorName}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <span className="font-bold text-[#1a1a26] text-xs">
                            {sale.serviceName}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                          <span className="font-black text-[#1a1a26] text-xs">
                            {formatMoney(saleAmt, sale.currency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
