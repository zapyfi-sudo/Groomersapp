import React, { useState } from 'react';
import { UserAccount, BusinessAccountData } from '../types';
import { COUNTRIES, CURRENCIES } from '../utils/countries';
import { createNewBusinessAccount, switchAccount, loginWithEmail } from '../utils/saasDb';

interface LoginScreenProps {
  accountsList: UserAccount[];
  onLoginSuccess: (data: BusinessAccountData, account: UserAccount) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  accountsList,
  onLoginSuccess
}) => {
  const [mode, setMode] = useState<'select' | 'email' | 'register'>(
    accountsList.length > 0 ? 'select' : 'register'
  );

  // Email login state
  const [emailInput, setEmailInput] = useState('');

  // Register state
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [country, setCountry] = useState('Ecuador');
  const [currency, setCurrency] = useState('USD');
  const [phonePrefix, setPhonePrefix] = useState('+593');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCountryChange = (cName: string) => {
    setCountry(cName);
    const found = COUNTRIES.find((c) => c.name === cName);
    if (found) {
      setCurrency(found.defaultCurrency);
      setPhonePrefix(found.callingCode);
    }
  };

  const handleSelectAccount = async (userId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await switchAccount(userId);
      const acc = accountsList.find((a) => a.id === userId);
      if (data && acc) {
        onLoginSuccess(data, acc);
      } else {
        setErrorMsg('No se pudo cargar la cuenta seleccionada.');
      }
    } catch {
      setErrorMsg('Error al conectar con la base de datos persistente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await loginWithEmail(emailInput);
      if (res) {
        onLoginSuccess(res.data, res.account);
      } else {
        setErrorMsg('No se encontró ninguna cuenta registrada con este correo electrónico.');
      }
    } catch {
      setErrorMsg('Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !regEmail.trim()) {
      setErrorMsg('Por favor completa el nombre del negocio y el correo.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await createNewBusinessAccount({
        name: ownerName.trim() || businessName.trim(),
        email: regEmail.trim(),
        businessName: businessName.trim(),
        country,
        currency,
        phonePrefix,
        phone: phone.trim()
      });

      onLoginSuccess(res.data, res.account);
    } catch {
      setErrorMsg('Error al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f0f7] text-[#1a1a26] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#cfc2d2]/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#2e004e] to-[#4b0878] p-6 text-white text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#f9b900] text-[#2e004e] flex items-center justify-center font-black shadow-lg mb-3">
            <span className="material-symbols-outlined text-3xl">pets</span>
          </div>
          <h1 className="text-xl font-black tracking-tight">AgendaCan SaaS</h1>
          <p className="text-xs text-[#e3e0f1] mt-0.5">
            Gestión inteligente para peluquerías y spas caninos
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-red-600">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode 1: Select Stored Account */}
          {mode === 'select' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-base font-bold text-[#1a1a26]">Selecciona tu cuenta</h2>
                <p className="text-xs text-[#7e7482] mt-0.5">
                  Cuentas guardadas permanentemente en este dispositivo
                </p>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {accountsList.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectAccount(acc.id)}
                    className="w-full p-3.5 rounded-2xl border border-[#cfc2d2]/60 hover:border-[#2e004e] bg-[#fcf8ff] hover:bg-[#f5f0fb] text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#2e004e] text-white flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                        {acc.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-sm text-[#1a1a26] block truncate">
                          {acc.name}
                        </span>
                        <span className="text-xs text-[#7e7482] block truncate">
                          {acc.email}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-lg text-[#2e004e] group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-[#cfc2d2]/40 flex flex-col gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-bold text-xs shadow-xs hover:bg-[#ffdea1] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_business</span>
                  Crear Nueva Peluquería / Cuenta
                </button>
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="text-xs font-semibold text-[#4b0878] hover:underline"
                >
                  O ingresar con otro correo
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Login with Email */}
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="text-center">
                <h2 className="text-base font-bold text-[#1a1a26]">Iniciar sesión</h2>
                <p className="text-xs text-[#7e7482] mt-0.5">
                  Ingresa el correo registrado de tu negocio
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="ej. contacto@mipeluqueria.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#2e004e] text-white font-bold text-sm shadow-md hover:bg-[#4b0878] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Accediendo...' : 'Entrar a mi cuenta'}
              </button>

              <div className="pt-2 text-center space-y-1">
                {accountsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMode('select')}
                    className="text-xs font-semibold text-[#4b0878] hover:underline block w-full"
                  >
                    ← Volver a mis cuentas guardadas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs font-semibold text-[#7e7482] hover:text-[#1a1a26] block w-full"
                >
                  ¿No tienes cuenta? Regístrate aquí
                </button>
              </div>
            </form>
          )}

          {/* Mode 3: Register New Business */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="text-center pb-1">
                <h2 className="text-base font-bold text-[#1a1a26]">Nueva Cuenta de Negocio</h2>
                <p className="text-xs text-[#7e7482] mt-0.5">
                  Configura tu peluquería en menos de un minuto
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                  Nombre de la Peluquería *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Mi Peluquería Canina"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@mipeluqueria.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    País
                  </label>
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#cfc2d2] text-xs bg-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
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
                    className="w-full px-3 py-2 rounded-xl border border-[#cfc2d2] text-xs bg-white"
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
                  WhatsApp
                </label>
                <div className="flex gap-2">
                  <span className="px-3 py-2 rounded-xl bg-gray-100 border border-[#cfc2d2] text-xs font-bold flex items-center">
                    {phonePrefix}
                  </span>
                  <input
                    type="tel"
                    placeholder="99 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-black text-sm shadow-md hover:bg-[#ffdea1] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? 'Creando cuenta...' : 'Crear Peluquería y Comenzar'}
              </button>

              {accountsList.length > 0 && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setMode('select')}
                    className="text-xs font-semibold text-[#4b0878] hover:underline"
                  >
                    ← Volver a cuentas existentes
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
