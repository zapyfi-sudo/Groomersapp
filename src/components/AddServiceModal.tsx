import React, { useState } from 'react';
import { SalonService } from '../types';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  onAddService: (service: SalonService) => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  onClose,
  currency,
  onAddService
}) => {
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [price, setPrice] = useState(20000);
  const [badge, setBadge] = useState('');
  const [icon, setIcon] = useState('content_cut');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddService({
      id: 's-' + Date.now(),
      name: name.trim(),
      durationMin: Number(durationMin) || 60,
      price: Number(price) || 0,
      badge: badge.trim() || undefined,
      icon,
      active: true
    });
    setName('');
    setBadge('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f9b900]">content_cut</span>
            <h3 className="font-bold text-base">Nuevo Servicio</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 text-white"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[#4c4451] mb-1">Nombre del Servicio</label>
            <input
              type="text"
              placeholder="ej. Corte de Raza + Baño de Ozono"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Duración (min)</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="5"
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="w-full bg-white text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
                  required
                />
                <span className="absolute right-3 text-xs text-[#7e7482]">min</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">
                Precio ({currency})
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="500"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-white text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878] font-bold"
                  required
                />
                <span className="absolute right-3 text-xs text-[#7e7482]">$</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Etiqueta destacada</label>
              <input
                type="text"
                placeholder="ej. Popular, Nuevo"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full bg-white text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4c4451] mb-1">Icono</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-white text-[#1a1a26] text-sm px-3.5 py-2.5 rounded-xl border border-[#cfc2d2]/40 outline-none focus:ring-2 focus:ring-[#4b0878]"
              >
                <option value="content_cut">Tijeras / Corte</option>
                <option value="bathtub">Bañera / Baño</option>
                <option value="water_drop">Gotas / Hidratación</option>
                <option value="brush">Cepillo / Deslanado</option>
                <option value="spa">Spa / Tratamiento</option>
                <option value="sanitizer">Higiene</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#cfc2d2] text-[#4c4451] font-semibold text-sm hover:bg-[#f5f2ff]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-bold text-sm shadow-md hover:bg-[#ffdea1] active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Agregar a Carta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
