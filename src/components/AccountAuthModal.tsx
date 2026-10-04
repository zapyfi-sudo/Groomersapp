import React, { useState } from 'react';
import { UserAccount, BusinessAccountData } from '../types';
import { COUNTRIES, CURRENCIES } from '../utils/countries';
import { createNewBusinessAccount, switchAccount, logoutAccount } from '../utils/saasDb';

interface AccountAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: UserAccount | null;
  accountsList: UserAccount[];
  onAccountChanged: (data: BusinessAccountData, account: UserAccount) => void;
  onLoggedOut: () => void;
}

export const AccountAuthModal: React.FC<AccountAuthModalProps> = ({
  isOpen,
  onClose,
  activeAccount,
  accountsList,
  onAccountChanged,
  onLoggedOut
}) => {
  const [tab, setTab] = useState<'switch' | 'create'>('switch');

  // Form for creating new business account
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Ecuador');
  const [currency, setCurrency] = useState('USD');
  const [phonePrefix, setPhonePrefix] = useState('+593');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCountryChange = (cName: string) => {
    setCountry(cName);
    const found = COUNTRIES.find((c) => c.name === cName);
    if (found) {
      setCurrency(found.defaultCurrency);
      setPhonePrefix(found.callingCode);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setErrorMsg('Por favor ingresa el nombre de la peluquería.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await createNewBusinessAccount({
        name: ownerName.trim() || businessName.trim(),
        email: email.trim(),
        businessName: businessName.trim(),
        country,
        currency,
        phonePrefix,
        phone: phone.trim()
      });

      onAccountChanged(res.data, res.account);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al crear la cuenta. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (userId: string) => {
    if (activeAccount?.id === userId) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      const data = await switchAccount(userId);
      const acc = accountsList.find((a) => a.id === userId);
      if (data && acc) {
        onAccountChanged(data, acc);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutAccount();
      onLoggedOut();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#2e004e] to-[#4b0878] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#f9b900] text-[#2e004e] flex items-center justify-center font-black shadow-md">
              <span className="material-symbols-outlined text-2xl">account_circle</span>
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Cuentas y Gestión SaaS</h3>
              <p className="text-xs text-white/70">Gestión de usuarios y negocios caninos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-white/80 hover:text-white"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#cfc2d2]/40 bg-white">
          <button
            type="button"
            onClick={() => setTab('switch')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 ${
              tab === 'switch'
                ? 'border-[#f9b900] text-[#2e004e] bg-[#fcf8ff]'
                : 'border-transparent text-[#7e7482] hover:text-[#1a1a26]'
            }`}
          >
            <span className="material-symbols-outlined text-base">switch_account</span>
            Mis Cuentas ({accountsList.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 ${
              tab === 'create'
                ? 'border-[#f9b900] text-[#2e004e] bg-[#fcf8ff]'
                : 'border-transparent text-[#7e7482] hover:text-[#1a1a26]'
            }`}
          >
            <span className="material-symbols-outlined text-base">add_business</span>
            + Crear Nueva Cuenta
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-red-600">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: MIS CUENTAS / SWITCH */}
          {tab === 'switch' && (
            <div className="space-y-4">
              <p className="text-xs text-[#7e7482]">
                Cada cuenta almacena su propio catálogo de servicios, clientes, mascotas, citas y configuración de negocio de forma 100% aislada y permanente.
              </p>

              <div className="space-y-2.5">
                {accountsList.map((acc) => {
                  const isActive = activeAccount?.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isActive
                          ? 'border-[#2e004e] bg-[#f5f0fb] ring-2 ring-[#2e004e]/20'
                          : 'border-[#cfc2d2]/40 bg-white hover:border-[#4b0878]/60 hover:bg-[#faf8fd]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#2e004e] text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-[#1a1a26] truncate">
                              {acc.name}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wide">
                                Sesión Activa
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#7e7482] block truncate">
                            {acc.email}
                          </span>
                        </div>
                      </div>

                      <div>
                        {isActive ? (
                          <span className="text-xs font-bold text-[#2e004e] flex items-center gap-1">
                            <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                            En uso
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSwitch(acc.id)}
                            className="px-3 py-1.5 rounded-xl bg-[#2e004e] text-white text-xs font-bold hover:bg-[#4b0878] transition-all cursor-pointer shadow-xs"
                          >
                            Abrir Cuenta
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cerrar Sesión Button */}
              <div className="pt-4 border-t border-[#cfc2d2]/40 flex items-center justify-between">
                <span className="text-xs text-[#7e7482]">
                  Cerrar sesión guarda tus datos de forma segura sin eliminarlos.
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CREAR NUEVA CUENTA DE NEGOCIO */}
          {tab === 'create' && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                  Nombre del Negocio / Peluquería *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Grooming Spa Guayaquil"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] focus:ring-2 focus:ring-[#2e004e]/20 outline-none text-sm bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    Nombre del Responsable
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Carlos Silva"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contacto@mipeluqueria.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    País
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name} ({c.defaultCurrency})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    Moneda
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                  >
                    {CURRENCIES.map((cur) => (
                      <option key={cur.code} value={cur.code}>
                        {cur.name} ({cur.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                  WhatsApp del Salón
                </label>
                <div className="flex gap-2">
                  <span className="px-3 py-2.5 rounded-xl bg-gray-100 border border-[#cfc2d2] text-xs font-bold text-[#4c4451] flex items-center">
                    {phonePrefix}
                  </span>
                  <input
                    type="tel"
                    placeholder="99 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-black text-sm shadow-md hover:bg-[#ffdea1] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">check</span>
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta y Abrir Negocio'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
