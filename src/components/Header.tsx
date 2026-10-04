import React from 'react';
import { HOTLINK_IMAGES } from '../mockData';

interface HeaderProps {
  currentTab: 'retencion' | 'ficha' | 'agenda' | 'mascotas' | 'onboarding';
  onSelectTab: (tab: 'retencion' | 'ficha' | 'agenda' | 'mascotas' | 'onboarding') => void;
  salonName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  salonName = 'Peluquería Canina Luna'
}) => {
  return (
    <>
      {/* DESKTOP & TABLET TOP NAVIGATION BAR (Visible on md and larger screens)
          Completely hidden on mobile phones so it does not freeze or block the screen */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-[#2e004e] text-white shadow-md">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs shrink-0">
              <img
                alt="AgendaCan Logo"
                className="w-full h-full object-contain"
                src={HOTLINK_IMAGES.logo}
              />
            </div>

            <div className="min-w-0">
              <h1 className="font-black text-base tracking-tight text-white truncate leading-tight">
                {salonName}
              </h1>
              <span className="text-[10px] text-[#f9b900] font-bold uppercase tracking-wider block">
                SISTEMA DE GESTIÓN CANINA
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => onSelectTab('agenda')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'agenda'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
              <span>Agenda</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('mascotas')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'mascotas'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">pets</span>
              <span>Clientes</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('retencion')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'retencion'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">sync</span>
              <span>Por Volver</span>
              <span className="bg-[#2e004e] text-[#f9b900] text-[10px] px-1.5 rounded-full font-black">
                3
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('ficha')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'ficha'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">badge</span>
              <span>Ficha Mascota</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('onboarding')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                currentTab === 'onboarding'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span>Ajustes</span>
            </button>
          </nav>

          {/* Profile Badge (No unexpected redirects) */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#f9b900] shadow-md">
                <img
                  alt="Profile"
                  className="w-full h-full object-cover"
                  src={HOTLINK_IMAGES.profileAvatar}
                />
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-xs font-bold text-white block leading-tight">Admin Salón</span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  En línea
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
