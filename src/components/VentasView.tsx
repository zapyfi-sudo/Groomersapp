import React, { useState, useMemo } from 'react';
import { SaleRecord, SalonConfig } from '../types';

interface VentasViewProps {
  sales: SaleRecord[];
  salonConfig: SalonConfig;
  onBack: () => void;
}

type DatePeriod = 'hoy' | 'semana' | 'mes' | 'ultimos_30' | 'todo' | 'personalizado';

export const VentasView: React.FC<VentasViewProps> = ({
  sales,
  salonConfig,
  onBack
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>('hoy');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'todos' | 'cobrado' | 'en_proceso' | 'por_cobrar'>('todos');

  const currencySymbol = salonConfig.currency || '$';

  // Helper to format currency
  const formatMoney = (amount: number) => {
    return `${currencySymbol} ${amount.toLocaleString('es-AR')}`;
  };

  // Helper date parsing
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Helper to get start of current week (Monday)
  const getStartOfWeek = () => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Helper to get start of current month
  const getStartOfMonth = () => {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  // Helper to get 30 days ago
  const get30DaysAgo = () => {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Filter sales by date period
  const filteredByDateSales = useMemo(() => {
    if (!sales || sales.length === 0) return [];

    return sales.filter((sale) => {
      // Sale timestamp can be in createdAt, serviceStartedAt, or date
      const dateRaw = sale.createdAt || sale.serviceStartedAt || sale.date;
      const saleDate = new Date(dateRaw);
      const saleDateStr = !isNaN(saleDate.getTime()) ? saleDate.toISOString().split('T')[0] : (sale.date || '');

      switch (selectedPeriod) {
        case 'hoy': {
          if (saleDateStr === todayStr) return true;
          // Fallback if date matches human string like "Hoy"
          return (sale.date || '').toLowerCase().includes('hoy');
        }
        case 'semana': {
          const weekStart = getStartOfWeek();
          return !isNaN(saleDate.getTime()) && saleDate >= weekStart;
        }
        case 'mes': {
          const monthStart = getStartOfMonth();
          return !isNaN(saleDate.getTime()) && saleDate >= monthStart;
        }
        case 'ultimos_30': {
          const thirtyAgo = get30DaysAgo();
          return !isNaN(saleDate.getTime()) && saleDate >= thirtyAgo;
        }
        case 'personalizado': {
          if (customStartDate && customEndDate) {
            return saleDateStr >= customStartDate && saleDateStr <= customEndDate;
          }
          if (customStartDate) {
            return saleDateStr >= customStartDate;
          }
          if (customEndDate) {
            return saleDateStr <= customEndDate;
          }
          return true;
        }
        case 'todo':
        default:
          return true;
      }
    });
  }, [sales, selectedPeriod, todayStr, customStartDate, customEndDate]);

  // Further filter by search text and payment status
  const displayedSales = useMemo(() => {
    return filteredByDateSales.filter((s) => {
      // Payment filter
      if (paymentFilter !== 'todos') {
        const matchesPayment = s.paymentStatus === paymentFilter;
        if (!matchesPayment) return false;
      }

      // Search query
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
  }, [filteredByDateSales, paymentFilter, searchQuery]);

  // KPI Calculations
  const totalRevenue = useMemo(() => {
    return filteredByDateSales.reduce((sum, s) => sum + (Number(s.amount) || Number(s.servicePrice) || 0), 0);
  }, [filteredByDateSales]);

  const totalServicesCount = filteredByDateSales.length;

  const averageTicket = totalServicesCount > 0 ? Math.round(totalRevenue / totalServicesCount) : 0;

  // Most popular service
  const serviceStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    for (const s of filteredByDateSales) {
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
  }, [filteredByDateSales, totalRevenue]);

  const topService = serviceStats[0];

  // Daily evolution data for chart/bars
  const dailyEvolution = useMemo(() => {
    const dayMap: Record<string, number> = {};

    // For the last 7 days or matching the range
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dayMap[str] = 0;
    }

    for (const s of filteredByDateSales) {
      const dateRaw = s.createdAt || s.serviceStartedAt || s.date;
      const d = new Date(dateRaw);
      const str = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : todayStr;
      if (dayMap[str] !== undefined) {
        dayMap[str] += Number(s.amount) || Number(s.servicePrice) || 0;
      }
    }

    const entries = Object.entries(dayMap).map(([dateStr, amount]) => {
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      return {
        dateStr,
        dayLabel: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
        amount
      };
    });

    const maxAmount = Math.max(...entries.map((e) => e.amount), 1);
    return { entries, maxAmount };
  }, [filteredByDateSales, todayStr]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (displayedSales.length === 0) return;

    const headers = ['ID Venta', 'Fecha', 'Hora', 'Mascota', 'Raza', 'Cliente / Tutor', 'Teléfono', 'Servicio', 'Peluquero', 'Monto', 'Moneda', 'Estado Pago'];
    const rows = displayedSales.map((s) => [
      s.id,
      s.date || (s.createdAt ? new Date(s.createdAt).toLocaleDateString('es-ES') : ''),
      s.time || '',
      `"${(s.petName || '').replace(/"/g, '""')}"`,
      `"${(s.breed || '').replace(/"/g, '""')}"`,
      `"${(s.tutorName || '').replace(/"/g, '""')}"`,
      `"${s.tutorPhone || ''}"`,
      `"${(s.serviceName || '').replace(/"/g, '""')}"`,
      `"${(s.groomer || '').replace(/"/g, '""')}"`,
      Number(s.amount || s.servicePrice || 0),
      s.currency || currencySymbol,
      s.paymentStatus || 'cobrado'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Ventas_${salonConfig.name || 'Salon'}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Bar with Back Button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#efecfd]">
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
                {salonConfig.name}
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#1a1a26] tracking-tight">
              Ventas e Ingresos
            </h1>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={displayedSales.length === 0}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
              displayedSales.length > 0
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

      {/* Operational notice: Source of revenue */}
      <div className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#2e004e] text-[#f9b900] flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-lg">info</span>
        </div>
        <div className="text-xs text-[#2e004e] leading-relaxed">
          <span className="font-extrabold block text-sm mb-0.5">
            Fuente automática de ingresos
          </span>
          Cada ingreso se registra en este módulo en el momento exacto en que pulsas <strong className="font-black text-[#1a1a26]">«Comenzar servicio»</strong> para una cita confirmada en Agenda o En salón. El valor histórico del servicio queda guardado de forma permanente, sin duplicaciones.
        </div>
      </div>

      {/* Period Selector Tabs */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#cfc2d2]/40 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#7e7482]">
            Período de visualización:
          </span>
          <span className="text-xs font-extrabold text-[#2e004e]">
            {filteredByDateSales.length} {filteredByDateSales.length === 1 ? 'servicio registrado' : 'servicios registrados'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Esta semana' },
              { id: 'mes', label: 'Este mes' },
              { id: 'ultimos_30', label: 'Últimos 30 días' },
              { id: 'todo', label: 'Todo el tiempo' },
              { id: 'personalizado', label: 'Personalizado' }
            ] as const
          ).map((period) => (
            <button
              key={period.id}
              type="button"
              onClick={() => setSelectedPeriod(period.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                selectedPeriod === period.id
                  ? 'bg-[#2e004e] text-[#f9b900] shadow-sm'
                  : 'bg-[#f5f2ff] hover:bg-[#efeafd] text-[#1a1a26]'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {selectedPeriod === 'personalizado' && (
          <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-[#efecfd] mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#7e7482]">Desde:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#7e7482]">Hasta:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#cfc2d2]/40 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold mb-3 shadow-xs">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
          <span className="text-xs font-bold text-[#7e7482] uppercase tracking-wider block">
            Ingresos del período
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#1a1a26] mt-1 tracking-tight">
            {formatMoney(totalRevenue)}
          </div>
          <span className="text-[11px] text-emerald-700 font-extrabold mt-1 inline-block">
            {totalServicesCount} {totalServicesCount === 1 ? 'servicio cobrado/en curso' : 'servicios cobrados/en curso'}
          </span>
        </div>

        {/* KPI 2: Services Count */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#cfc2d2]/40 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-[#f5f2ff] text-[#2e004e] flex items-center justify-center font-bold mb-3 shadow-xs">
            <span className="material-symbols-outlined text-2xl">content_cut</span>
          </div>
          <span className="text-xs font-bold text-[#7e7482] uppercase tracking-wider block">
            Servicios Realizados
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#1a1a26] mt-1 tracking-tight">
            {totalServicesCount}
          </div>
          <span className="text-[11px] text-[#4b0878] font-bold mt-1 inline-block">
            Mascotas atendidas en salón
          </span>
        </div>

        {/* KPI 3: Average Ticket */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#cfc2d2]/40 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-[#fff8e1] text-[#7a5900] flex items-center justify-center font-bold mb-3 shadow-xs">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <span className="text-xs font-bold text-[#7e7482] uppercase tracking-wider block">
            Ticket Promedio
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[#1a1a26] mt-1 tracking-tight">
            {formatMoney(averageTicket)}
          </div>
          <span className="text-[11px] text-[#7a5900] font-bold mt-1 inline-block">
            Ingreso promedio por mascota
          </span>
        </div>

        {/* KPI 4: Top Service */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#cfc2d2]/40 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-2xl bg-[#f2daff] text-[#2e004e] flex items-center justify-center font-bold mb-3 shadow-xs">
            <span className="material-symbols-outlined text-2xl">star</span>
          </div>
          <span className="text-xs font-bold text-[#7e7482] uppercase tracking-wider block">
            Servicio Más Popular
          </span>
          <div className="text-lg sm:text-xl font-black text-[#1a1a26] mt-1 tracking-tight truncate" title={topService?.name || 'Sin datos'}>
            {topService?.name || 'Sin servicios'}
          </div>
          <span className="text-[11px] text-[#2e004e] font-bold mt-1 inline-block">
            {topService ? `${topService.count} veces (${topService.percentage}%)` : 'Aún sin registros'}
          </span>
        </div>
      </div>

      {/* Two columns: Daily Evolution Bar Chart & Services Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 7-Day Evolution Bar Chart */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#efecfd]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-[#2e004e]">bar_chart</span>
              <h2 className="text-base font-black text-[#1a1a26]">
                Evolución de Ingresos (Últimos 7 Días)
              </h2>
            </div>
            <span className="text-xs text-[#7e7482] font-semibold">
              Monto por día
            </span>
          </div>

          <div className="h-48 pt-6 flex items-end justify-between gap-2 sm:gap-4 px-2">
            {dailyEvolution.entries.map((item) => {
              const heightPercent = dailyEvolution.maxAmount > 0
                ? Math.max(Math.round((item.amount / dailyEvolution.maxAmount) * 100), item.amount > 0 ? 12 : 4)
                : 4;
              const isToday = item.dateStr === todayStr;

              return (
                <div key={item.dateStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  {/* Tooltip on hover */}
                  <div className="text-[10px] font-black text-[#2e004e] opacity-0 group-hover:opacity-100 transition-opacity bg-[#f5f2ff] px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-xs">
                    {formatMoney(item.amount)}
                  </div>
                  {/* Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[42px] rounded-xl transition-all ${
                      item.amount > 0
                        ? isToday
                          ? 'bg-[#f9b900] shadow-sm'
                          : 'bg-[#2e004e] group-hover:bg-[#4b0878]'
                        : 'bg-gray-100'
                    }`}
                  />
                  {/* Day label */}
                  <span className={`text-[11px] font-bold text-center truncate ${isToday ? 'text-[#2e004e] font-black' : 'text-[#7e7482]'}`}>
                    {item.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Breakdown by Service */}
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

          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {serviceStats.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#7e7482]">
                No hay ventas registradas en este período
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
      </div>

      {/* Transaction Ledger Table */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-[#cfc2d2]/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#efecfd]">
          <div>
            <h2 className="text-base font-black text-[#1a1a26] flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-[#2e004e]">list_alt</span>
              <span>Registro Detallado de Ventas</span>
            </h2>
            <p className="text-xs text-[#7e7482]">
              Historial de cada servicio iniciado y su valor registrado
            </p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2 text-[#7e7482] text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar mascota, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none placeholder:text-[#7e7482]/60 w-48 sm:w-56"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="bg-[#f5f2ff] border border-[#cfc2d2]/40 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1a1a26] outline-none cursor-pointer"
            >
              <option value="todos">Todos los pagos</option>
              <option value="cobrado">Cobrados</option>
              <option value="en_proceso">En proceso</option>
              <option value="por_cobrar">Por cobrar</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {displayedSales.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#cfc2d2]">
                receipt_long
              </span>
              <p className="text-sm font-bold text-[#1a1a26]">
                No hay ventas que coincidan con la búsqueda o el período seleccionado
              </p>
              <p className="text-xs text-[#7e7482]">
                Al comenzar un servicio en Agenda, verás el registro detallado aquí.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#efecfd] text-[11px] font-black uppercase tracking-wider text-[#7e7482]">
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Mascota</th>
                  <th className="py-2.5 px-3">Cliente / Tutor</th>
                  <th className="py-2.5 px-3">Servicio</th>
                  <th className="py-2.5 px-3">Peluquero</th>
                  <th className="py-2.5 px-3 text-right">Monto Registrado</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efecfd] text-xs">
                {displayedSales.map((sale) => {
                  const saleAmt = Number(sale.amount) || Number(sale.servicePrice) || 0;
                  const dateDisplay = sale.date || (sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('es-ES') : 'Hoy');

                  return (
                    <tr key={sale.id} className="hover:bg-[#fcf8ff] transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-extrabold text-[#1a1a26]">{dateDisplay}</div>
                        <div className="text-[11px] text-[#7e7482]">{sale.time || 'En servicio'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-[#2e004e] flex items-center gap-1">
                          <span>🐾</span> {sale.petName}
                        </div>
                        {sale.breed && (
                          <div className="text-[11px] text-[#7e7482]">{sale.breed}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#1a1a26]">{sale.tutorName}</div>
                        {sale.tutorPhone && (
                          <div className="text-[11px] text-[#7e7482]">{sale.tutorPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-[#1a1a26] bg-[#f5f2ff] px-2 py-0.5 rounded-lg border border-[#cfc2d2]/30 inline-block">
                          {sale.serviceName}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#7e7482] font-semibold whitespace-nowrap">
                        {sale.groomer || 'Personal de turno'}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="font-black text-[#1a1a26] text-sm">
                          {formatMoney(saleAmt)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block ${
                            sale.paymentStatus === 'cobrado' || sale.status === 'completado' || sale.status === 'entregado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sale.paymentStatus === 'cobrado' ? 'Cobrado' : 'En proceso'}
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
  );
};
