import React, { useMemo } from 'react';
import { parseTimeParts } from '../utils/scheduleUtils';

interface TimeSelectPickerProps {
  value: string; // e.g. "9:15 AM", "09:15", "14:30", etc.
  onChange: (newValue12h: string, newValue24h: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

const HOURS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS: ('AM' | 'PM')[] = ['AM', 'PM'];

export const TimeSelectPicker: React.FC<TimeSelectPickerProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  compact = false
}) => {
  const parts = useMemo(() => parseTimeParts(value), [value]);

  const handleChange = (newHour: string, newMin: string, newPeriod: 'AM' | 'PM') => {
    const formatted12 = `${newHour}:${newMin} ${newPeriod}`;
    let h24 = parseInt(newHour, 10);
    if (newPeriod === 'PM' && h24 < 12) h24 += 12;
    if (newPeriod === 'AM' && h24 === 12) h24 = 0;
    const formatted24 = `${String(h24).padStart(2, '0')}:${newMin}`;

    onChange(formatted12, formatted24);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* 1. Selector de Hora (1 a 12) */}
      <div className="flex-1 min-w-[58px]">
        <select
          disabled={disabled}
          value={parts.hour12}
          onChange={(e) => handleChange(e.target.value, parts.minute, parts.period)}
          className={`w-full bg-white text-[#1a1a26] font-bold rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878] transition-all cursor-pointer ${
            compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-xs sm:text-sm'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-[#4b0878]'}`}
          aria-label="Hora"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      <span className="font-bold text-[#7e7482] text-sm select-none">:</span>

      {/* 2. Selector de Minutos (00 a 59, de uno en uno) */}
      <div className="flex-1 min-w-[58px]">
        <select
          disabled={disabled}
          value={parts.minute}
          onChange={(e) => handleChange(parts.hour12, e.target.value, parts.period)}
          className={`w-full bg-white text-[#1a1a26] font-bold rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878] transition-all cursor-pointer ${
            compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-xs sm:text-sm'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-[#4b0878]'}`}
          aria-label="Minutos"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Selector de Período (AM / PM) */}
      <div className="min-w-[62px]">
        <select
          disabled={disabled}
          value={parts.period}
          onChange={(e) => handleChange(parts.hour12, parts.minute, e.target.value as 'AM' | 'PM')}
          className={`w-full bg-white text-[#2e004e] font-extrabold rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878] transition-all cursor-pointer ${
            compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-xs sm:text-sm'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-[#4b0878]'}`}
          aria-label="Período AM/PM"
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
