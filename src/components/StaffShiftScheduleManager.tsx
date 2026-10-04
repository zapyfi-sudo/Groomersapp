import React from 'react';
import { StaffScheduleConfig } from '../types';

interface StaffShiftScheduleManagerProps {
  schedule: StaffScheduleConfig;
  onChangeSchedule: (updated: StaffScheduleConfig) => void;
}

export const StaffShiftScheduleManager: React.FC<StaffShiftScheduleManagerProps> = ({
  schedule,
  onChangeSchedule
}) => {
  const updateShift = (
    shiftKey: keyof StaffScheduleConfig,
    field: 'start' | 'end',
    val: string
  ) => {
    onChangeSchedule({
      ...schedule,
      [shiftKey]: {
        ...schedule[shiftKey],
        [field]: val
      }
    });
  };

  return (
    <div className="bg-[#fcf8ff] rounded-2xl p-4 border border-[#cfc2d2]/40 space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-[#efecfd]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4b0878] text-base">nest_clock_farsight_analog</span>
          <div>
            <h4 className="text-xs font-bold text-[#1a1a26]">Turnos y Horarios de Trabajo del Personal</h4>
            <p className="text-[11px] text-[#7e7482]">Configura las franjas horarias exactas que cumple tu equipo</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Turno 1: Todo el día */}
        <div className="bg-white p-3 rounded-xl border border-[#cfc2d2]/30 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#2e004e] flex items-center gap-1">
              <span>☀️🌙</span> Todo el día
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#7e7482]">Desde:</span>
              <input
                type="text"
                value={schedule.allDay.start}
                onChange={(e) => updateShift('allDay', 'start', e.target.value)}
                className="w-16 bg-[#f5f2ff] font-bold text-center py-1 px-1.5 rounded-lg border border-[#cfc2d2]/30 outline-none"
                placeholder="08:00"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#7e7482]">Hasta:</span>
              <input
                type="text"
                value={schedule.allDay.end}
                onChange={(e) => updateShift('allDay', 'end', e.target.value)}
                className="w-16 bg-[#f5f2ff] font-bold text-center py-1 px-1.5 rounded-lg border border-[#cfc2d2]/30 outline-none"
                placeholder="18:00"
              />
            </div>
          </div>
        </div>

        {/* Turno 2: Solo mañana */}
        <div className="bg-white p-3 rounded-xl border border-[#cfc2d2]/30 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#7a5900] flex items-center gap-1">
              <span>☀️</span> Solo mañana
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#7e7482]">Desde:</span>
              <input
                type="text"
                value={schedule.morning.start}
                onChange={(e) => updateShift('morning', 'start', e.target.value)}
                className="w-16 bg-[#f5f2ff] font-bold text-center py-1 px-1.5 rounded-lg border border-[#cfc2d2]/30 outline-none"
                placeholder="08:00"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#7e7482]">Hasta:</span>
              <input
                type="text"
                value={schedule.morning.end}
                onChange={(e) => updateShift('morning', 'end', e.target.value)}
                className="w-16 bg-[#f5f2ff] font-bold text-center py-1 px-1.5 rounded-lg border border-[#cfc2d2]/30 outline-none"
                placeholder="13:00"
              />
            </div>
          </div>
        </div>

        {/* Turno 3: Solo tarde */}
        <div className="bg-white p-3 rounded-xl border border-[#cfc2d2]/30 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#4b0878] flex items-center gap-1">
              <span>🌙</span> Solo en la tarde
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#7e7482]">Desde:</span>
              <input
                type="text"
                value={schedule.afternoon.start}
                onChange={(e) => updateShift('afternoon', 'start', e.target.value)}
                className="w-16 bg-[#f5f2ff] font-bold text-center py-1 px-1.5 rounded-lg border border-[#cfc2d2]/30 outline-none"
                placeholder="14:00"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#7e7482]">Hasta:</span>
              <input
                type="text"
                value={schedule.afternoon.end}
                onChange={(e) => updateShift('afternoon', 'end', e.target.value)}
                className="w-16 bg-[#f5f2ff] font-bold text-center py-1 px-1.5 rounded-lg border border-[#cfc2d2]/30 outline-none"
                placeholder="19:30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
