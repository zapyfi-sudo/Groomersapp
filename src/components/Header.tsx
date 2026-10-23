import React from 'react';
import { HOTLINK_IMAGES } from '../mockData';
import { AppLanguage, TRANSLATIONS } from '../utils/translations';
import { UserAccount } from '../types';

interface HeaderProps {
  currentTab: 'retencion' | 'ficha' | 'agenda' | 'en_salon' | 'mascotas' | 'onboarding';
  onSelectTab: (tab: 'retencion' | 'ficha' | 'agenda' | 'en_salon' | 'mascotas' | 'onboarding') => void;
  salonName?: string;
  logoUrl?: string;
  urgentCount?: number;
  inSalonCount?: number;
  currentLanguage?: AppLanguage;
  activeAccount?: UserAccount | null;
  onOpenAccountModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  salonName = 'Groomer Aida',
  logoUrl,
  urgentCount = 0,
  inSalonCount = 0,
  currentLanguage = 'es-LA',
  activeAccount,
  onOpenAccountModal
}) => {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS['es-LA'];

  return (
    <>
      {/* DESKTOP & TABLET TOP NAVIGATION BAR */}
      <header className="hidden md:block fixed top-0 left-0 right-0 z-40 bg-[#2e004e] text-white shadow-md">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              <img
                alt={`${salonName} Logo`}
                className="w-full h-full object-contain"
                src={logoUrl || HOTLINK_IMAGES.logo}
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
            {/* 1. Agenda */}
            <button
              type="button"
              onClick={() => onSelectTab('agenda')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'agenda'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
              <span>{t.agenda}</span>
            </button>

            {/* 2. En salón */}
            <button
              type="button"
              onClick={() => onSelectTab('en_salon')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'en_salon'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">storefront</span>
              <span>{t.inSalonNav || 'En salón'}</span>
              {inSalonCount > 0 && (
                <span className="bg-[#2e004e] text-[#f9b900] text-[10px] px-1.5 rounded-full font-black">
                  {inSalonCount}
                </span>
              )}
            </button>

            {/* 3. Clientes */}
            <button
              type="button"
              onClick={() => onSelectTab('mascotas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'mascotas' || currentTab === 'ficha'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">pets</span>
              <span>{t.clients}</span>
            </button>

            {/* 4. Por volver */}
            <button
              type="button"
              onClick={() => onSelectTab('retencion')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'retencion'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">sync</span>
              <span>{t.retention}</span>
              {urgentCount > 0 && (
                <span className="bg-[#2e004e] text-[#f9b900] text-[10px] px-1.5 rounded-full font-black">
                  {urgentCount}
                </span>
              )}
            </button>

            {/* 5. Ajustes */}
            <button
              type="button"
              onClick={() => onSelectTab('onboarding')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'onboarding'
                  ? 'bg-[#f9b900] text-[#261900] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span>{t.settings}</span>
            </button>
          </nav>

          {/* Discreet Administrative Access for Desktop (No avatar image, no arrow) */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAccountModal}
              title="Gestionar Cuentas y Negocios"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/10 active:scale-95"
            >
              <span className="material-symbols-outlined text-base text-[#f9b900]">manage_accounts</span>
              <span>Gestionar cuentas</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
