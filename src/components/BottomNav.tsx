import React from 'react';
import { AppLanguage, TRANSLATIONS } from '../utils/translations';

interface BottomNavProps {
  currentTab: 'retencion' | 'ficha' | 'agenda' | 'mascotas' | 'onboarding';
  onSelectTab: (tab: 'retencion' | 'ficha' | 'agenda' | 'mascotas' | 'onboarding') => void;
  urgentCount?: number;
  currentLanguage?: AppLanguage;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  urgentCount = 0,
  currentLanguage = 'es-LA'
}) => {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS['es-LA'];

  const tabs = [
    {
      id: 'agenda' as const,
      label: t.agenda,
      icon: 'calendar_month'
    },
    {
      id: 'mascotas' as const,
      label: t.clients,
      icon: 'pets'
    },
    {
      id: 'retencion' as const,
      label: t.retention,
      icon: 'sync',
      badge: urgentCount
    },
    {
      id: 'onboarding' as const,
      label: t.settings,
      icon: 'tune'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#cfc2d2]/40 shadow-[0_-4px_20px_rgba(46,0,78,0.06)] md:hidden">
      <div className="max-w-md mx-auto grid grid-cols-4 h-16 divide-x divide-dashed divide-[#5b95ff]/40">
        {tabs.map((tab) => {
          const isActive =
            currentTab === tab.id || (tab.id === 'mascotas' && currentTab === 'ficha');

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer relative ${
                isActive ? 'text-[#4b0878] font-bold' : 'text-[#7e7482] hover:text-[#1a1a26]'
              }`}
            >
              <div className="relative">
                <div
                  className={`w-10 h-7 rounded-full flex items-center justify-center mb-0.5 transition-colors ${
                    isActive ? 'bg-[#f2daff] text-[#2e004e]' : ''
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                </div>

                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#f9b900] text-[#261900] text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] tracking-tight leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
