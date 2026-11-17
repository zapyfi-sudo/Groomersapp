import React, { useState } from 'react';
import { SalonConfig, SalonService } from '../types';
import { HOTLINK_IMAGES } from '../mockData';
import { AddServiceModal } from './AddServiceModal';
import { formatPrice } from '../utils/priceUtils';
import { useTranslation } from '../utils/i18n/I18nContext';

interface SalonSetupViewProps {
  config: SalonConfig;
  onUpdateConfig: (updated: SalonConfig) => void;
  onContinueToPet: () => void;
}

export const SalonSetupView: React.FC<SalonSetupViewProps> = ({
  config,
  onUpdateConfig,
  onContinueToPet
}) => {
  const { t } = useTranslation();
  const st = t.setup;
  const ct = t.common;

  const [businessName, setBusinessName] = useState(config.name);
  const [logoUrl, setLogoUrl] = useState(config.logoUrl);
  const [phone, setPhone] = useState(config.phone);
  const [address, setAddress] = useState(config.address);
  const [workingDays, setWorkingDays] = useState(config.workingDays);
  const [openTime, setOpenTime] = useState(config.openTime);
  const [closeTime, setCloseTime] = useState(config.closeTime);
  const [currency, setCurrency] = useState(config.currency);
  const [services, setServices] = useState<SalonService[]>(config.services);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddService = (newSvc: SalonService) => {
    const updated = [...services, newSvc];
    setServices(updated);
    onUpdateConfig({ ...config, services: updated });
  };

  const handleRemoveService = (id: string) => {
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    onUpdateConfig({ ...config, services: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const updatedConfig: SalonConfig = {
      ...config,
      name: businessName,
      logoUrl,
      phonePrefix: config.phonePrefix,
      phone,
      address,
      workingDays,
      openTime,
      closeTime,
      currency,
      services
    };

    onUpdateConfig(updatedConfig);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        onContinueToPet();
      }, 1000);
    }, 1100);
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Hero Section */}
      <section className="relative bg-[#2e004e] text-white px-4 pt-6 pb-10 rounded-b-xl overflow-hidden shadow-md">
        {/* Ambient glowing backdrop accent */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#f9b900]/20 blur-2xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-32 h-32 rounded-full bg-[#4b0878]/60 blur-xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Logo Container */}
          <div className="w-16 h-16 rounded-xl bg-white p-2 shadow-sm flex items-center justify-center mb-4 transition-transform active:scale-95 duration-200">
            <img
              alt="AgendaCan Logo"
              className="w-full h-full object-contain rounded-lg"
              src={logoUrl || HOTLINK_IMAGES.logo}
            />
          </div>

          {/* Badge step indicator */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4b0878] text-[#f2daff] text-[10px] font-bold uppercase tracking-wider mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f9b900] animate-pulse"></span>
            {st.stepBadge}
          </div>

          {/* Main Welcome Title */}
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {st.heroWelcome}{' '}
            <span className="inline-block transform hover:rotate-12 transition-transform cursor-default">
              🐶
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm text-[#e3e0f1] max-w-xs mt-2 leading-relaxed">
            {st.heroSubtitle}
          </p>

          {/* Warm Yellow Subtle Divider Highlight */}
          <div className="w-12 h-1 bg-[#f9b900] rounded-full mt-4"></div>
        </div>
      </section>

      {/* Form & Details Container */}
      <form onSubmit={handleSubmit} className="px-4 -mt-4 relative z-20 space-y-4">
        {/* Card: Datos Principales */}
        <div className="bg-white rounded-xl p-4 shadow-md space-y-5 border border-[#cfc2d2]/20">
          <div className="flex items-center justify-between pb-1 border-b border-[#efecfd]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4b0878] text-xl">
                storefront
              </span>
              <h2 className="text-lg font-bold text-[#1a1a26]">{st.yourSalonTitle}</h2>
            </div>
            <span className="text-[11px] text-[#4c4451] bg-[#efecfd] px-2 py-0.5 rounded-full font-semibold">
              {ct.required}
            </span>
          </div>

          {/* Input 1: Nombre del negocio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#1a1a26]" htmlFor="business-name">
              {st.businessNameLabel}
            </label>
            <div className="relative flex items-center">
              <input
                className="w-full bg-[#f5f2ff] text-[#1a1a26] placeholder:text-[#7e7482] text-sm px-3.5 py-3 rounded-lg shadow-xs outline-none focus:bg-white focus:ring-2 focus:ring-[#2e004e] transition-all border border-[#cfc2d2]/20 font-medium"
                id="business-name"
                placeholder={st.businessNamePlaceholder}
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Input 2: Logo del negocio */}
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-[#1a1a26]">{st.salonLogoLabel}</span>
            <label
              htmlFor="logo-file-input"
              className="bg-[#f5f2ff] hover:bg-[#e9e6f7] rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors border border-dashed border-[#cfc2d2]"
            >
              <div className="w-12 h-12 rounded-full bg-[#e3e0f1] flex items-center justify-center text-[#4b0878] mb-2">
                <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
              </div>
              <p className="text-xs font-bold text-[#1a1a26]">{st.dragOrSelectImg}</p>
              <p className="text-[11px] text-[#4c4451] mt-0.5">{st.imgFormatHint}</p>
              <span className="mt-3 px-3 py-1.5 bg-[#4b0878] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
                <span className="material-symbols-outlined text-sm">upload</span>
                {st.uploadFileBtn}
              </span>
              <input
                id="logo-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </label>
          </div>

          {/* Input 3: WhatsApp con prefijo */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#1a1a26]" htmlFor="whatsapp-number">
              {st.commercialWhatsApp}
            </label>
            <div className="flex items-center bg-[#f5f2ff] rounded-lg p-1 shadow-xs border border-[#cfc2d2]/20">
              <div className="flex items-center gap-1 px-2.5 py-2 text-[#2e004e] text-xs font-bold bg-white rounded-md shadow-xs">
                <span>🇦🇷</span>
                <span>+54</span>
              </div>
              <input
                className="w-full bg-transparent text-[#1a1a26] placeholder:text-[#7e7482] text-sm px-3 py-2 outline-none font-medium"
                id="whatsapp-number"
                placeholder="9 11 2345-6789"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <p className="text-[11px] text-[#4c4451] px-1 leading-snug">
              {st.whatsappHint}
            </p>
          </div>

          {/* Input 4: Dirección */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#1a1a26]" htmlFor="business-address">
              {st.salonAddressLabel}
            </label>
            <div className="relative flex items-center bg-[#f5f2ff] rounded-lg px-3 py-2.5 shadow-xs border border-[#cfc2d2]/20">
              <span className="material-symbols-outlined text-[#7e7482] mr-2 text-lg">
                location_on
              </span>
              <input
                className="w-full bg-transparent text-[#1a1a26] placeholder:text-[#7e7482] text-sm outline-none font-medium"
                id="business-address"
                placeholder={st.salonAddressPlaceholder}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Input 5: Horarios de atención */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-[#1a1a26]">
              {st.usualHoursLabel}
            </label>
            <div className="bg-[#f5f2ff] rounded-xl p-3.5 space-y-3 border border-[#cfc2d2]/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1a1a26] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#2e004e] text-base">
                    calendar_today
                  </span>
                  {workingDays}
                </span>
                <span className="text-[10px] text-[#684c00] bg-[#ffdea1] px-2 py-0.5 rounded-full font-bold">
                  {st.openBadge}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#4c4451] font-semibold">{t.settings.openTimeLabel}</span>
                  <div className="bg-white rounded-lg px-3 py-2 text-[#1a1a26] text-xs font-semibold flex items-center justify-between shadow-xs border border-[#cfc2d2]/30">
                    <input
                      type="text"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="w-20 outline-none"
                    />
                    <span className="material-symbols-outlined text-[#7e7482] text-xs">
                      schedule
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#4c4451] font-semibold">{t.settings.closeTimeLabel}</span>
                  <div className="bg-white rounded-lg px-3 py-2 text-[#1a1a26] text-xs font-semibold flex items-center justify-between shadow-xs border border-[#cfc2d2]/30">
                    <input
                      type="text"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="w-20 outline-none"
                    />
                    <span className="material-symbols-outlined text-[#7e7482] text-xs">
                      schedule
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input 6: Moneda principal */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#1a1a26]" htmlFor="currency-select">
                {st.mainCurrencyLabel}
              </label>
              <span className="text-[11px] text-[#2e004e] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">payments</span>
                {st.pricesInBookingsHint}
              </span>
            </div>
            <div className="relative flex items-center bg-[#f5f2ff] rounded-lg p-1 shadow-xs border border-[#cfc2d2]/20">
              <div className="flex items-center gap-1.5 px-3 py-2 text-[#2e004e] text-xs bg-white rounded-md shadow-xs shrink-0">
                <span>{currency === 'ARS' ? '🇦🇷' : currency === 'USD' ? '🇺🇸' : currency === 'MXN' ? '🇲🇽' : '🌍'}</span>
                <span className="font-bold">{currency}</span>
                <span className="text-[#7e7482]">($)</span>
              </div>
              <select
                className="w-full bg-transparent text-[#1a1a26] text-xs font-semibold px-3 py-2 outline-none cursor-pointer appearance-none"
                id="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="ARS">ARS - Peso Argentino ($)</option>
                <option value="USD">USD - Dólar Estadounidense (US$)</option>
                <option value="MXN">MXN - Peso Mexicano ($)</option>
                <option value="COP">COP - Peso Colombiano ($)</option>
                <option value="CLP">CLP - Peso Chileno ($)</option>
                <option value="UYU">UYU - Peso Uruguayo ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
              </select>
              <div className="pointer-events-none pr-3 flex items-center text-[#7e7482]">
                <span className="material-symbols-outlined text-base">unfold_more</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card: Mis Servicios */}
        <div className="bg-white rounded-xl p-4 shadow-md space-y-4 border border-[#cfc2d2]/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4b0878] text-lg">
                  content_cut
                </span>
                <h2 className="text-base font-bold text-[#1a1a26]">{st.myServicesTitle}</h2>
              </div>
              <p className="text-xs text-[#4c4451] mt-0.5">{st.defineBaseMenuDesc}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative inline-flex items-center bg-[#f5f2ff] rounded-lg px-2 py-1 text-xs font-bold text-[#1a1a26] border border-[#cfc2d2]/30">
                <span className="material-symbols-outlined text-xs text-[#2e004e] mr-1">
                  attach_money
                </span>
                <span className="font-bold text-[#2e004e]">{currency}</span>
                <span className="text-[#4c4451] ml-0.5">($)</span>
              </div>

              <button
                type="button"
                onClick={() => setIsAddServiceModalOpen(true)}
                className="px-2.5 py-1.5 bg-[#e9e6f7] text-[#2e004e] rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-[#e3e0f1] active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {st.addBtn}
              </button>
            </div>
          </div>

          {/* Services List */}
          <div className="space-y-2.5">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="group flex items-center justify-between p-3.5 rounded-xl bg-[#f5f2ff] transition-all hover:bg-[#efecfd] shadow-xs border border-[#cfc2d2]/20"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-[#4b0878] shadow-xs shrink-0">
                    <span className="material-symbols-outlined text-lg">
                      {svc.icon || 'content_cut'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-[#1a1a26] truncate">{svc.name}</p>
                      {svc.badge && (
                        <span className="bg-[#2e004e]/10 text-[#2e004e] text-[10px] font-bold px-1.5 py-0.2 rounded">
                          {svc.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#4c4451] flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {svc.durationMin} {ct.minShort}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-base text-[#2e004e] font-extrabold tracking-tight">
                      {formatPrice(svc.price, currency)}
                    </span>
                    <span className="text-[10px] text-[#4c4451] uppercase tracking-wider block">
                      {currency}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(svc.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#7e7482] hover:text-[#ba1a1a] hover:bg-white transition-colors"
                    title={st.deleteServiceTooltip}
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick info note */}
          <div className="p-2.5 rounded-lg bg-[#e9e6f7] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f9b900] text-lg">lightbulb</span>
            <p className="text-xs text-[#4c4451]">
              {st.setupTip}
            </p>
          </div>
        </div>

        {/* Client Delight Guarantee Micro-Card */}
        <div className="bg-[#f5f2ff] rounded-xl p-3.5 flex items-center gap-3 shadow-xs border border-[#cfc2d2]/30">
          <div className="w-8 h-8 rounded-full bg-[#ffdea1] flex items-center justify-center text-[#261900] shrink-0">
            <span className="material-symbols-outlined text-base">verified</span>
          </div>
          <p className="text-xs text-[#1a1a26] leading-snug">
            {st.readyLinkGuarantee}
          </p>
        </div>

        {/* Main CTA Fixed-like bottom area */}
        <div className="pt-2 pb-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full text-base font-bold py-4 px-6 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] cursor-pointer ${
              isSuccess
                ? 'bg-[#2e004e] text-white'
                : 'bg-[#f9b900] hover:bg-[#ffdea1] text-[#261900]'
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-xl">
                  progress_activity
                </span>
                <span>{st.creatingSalon}</span>
              </>
            ) : isSuccess ? (
              <>
                <span className="material-symbols-outlined text-xl">check_circle</span>
                <span>{st.agendaReadyOpening}</span>
              </>
            ) : (
              <>
                <span>{st.createMyAgenda}</span>
                <span className="material-symbols-outlined text-xl font-bold">arrow_forward</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 mt-3 text-[#4c4451]">
            <span className="material-symbols-outlined text-xs">lock</span>
            <span className="text-xs">{st.fastSecureNote}</span>
          </div>
        </div>
      </form>

      <AddServiceModal
        isOpen={isAddServiceModalOpen}
        onClose={() => setIsAddServiceModalOpen(false)}
        currency={currency}
        onAddService={handleAddService}
      />
    </div>
  );
};
