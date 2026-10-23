import React, { useState } from 'react';
import { UserAccount, BusinessAccountData } from '../types';
import { COUNTRIES, CURRENCIES } from '../utils/countries';
import { createNewBusinessAccount, switchAccount, logoutAccount } from '../utils/saasDb';
import {
  authWithGoogle,
  registerWithEmailPassword,
  translateFirebaseAuthError,
  logoutFirebaseAuth
} from '../utils/firebase';

interface AccountAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAccount: UserAccount | null;
  accountsList: UserAccount[];
  onAccountChanged: (data: BusinessAccountData, account: UserAccount) => void;
  onLoggedOut: () => void;
}

const GoogleLogo = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const AccountAuthModal: React.FC<AccountAuthModalProps> = ({
  isOpen,
  onClose,
  activeAccount,
  accountsList,
  onAccountChanged,
  onLoggedOut
}) => {
  const [tab, setTab] = useState<'switch' | 'create'>('switch');

  // Registration method selection: 'google' | 'email'
  const [registerMethod, setRegisterMethod] = useState<'google' | 'email'>('google');

  // Google authenticated state
  const [googleUser, setGoogleUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  } | null>(null);

  // Business and Owner Form fields
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Ecuador');
  const [currency, setCurrency] = useState('USD');
  const [phonePrefix, setPhonePrefix] = useState('+593');
  const [phone, setPhone] = useState('');

  // Password fields for Email registration
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCountryChange = (cName: string) => {
    setCountry(cName);
    const found = COUNTRIES.find((c) => c.name === cName);
    if (found) {
      setCurrency(found.defaultCurrency);
      setPhonePrefix(found.callingCode);
    }
  };

  // Google OAuth Flow
  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      const gUser = await authWithGoogle();
      if (gUser && gUser.email) {
        setGoogleUser(gUser);
        setEmail(gUser.email);
        if (!ownerName && gUser.displayName) {
          setOwnerName(gUser.displayName);
        }
        setSuccessMsg(`Autenticado correctamente con Google como ${gUser.email}`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.warn('[GOOGLE AUTH WARN]', err);
      const friendly = translateFirebaseAuthError(err);
      setErrorMsg(friendly);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Final submission of the account creation form
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Business Fields Validation
    if (!businessName.trim()) {
      setErrorMsg('Por favor ingresa el nombre de la peluquería o negocio.');
      return;
    }

    let authUid: string | undefined = undefined;
    let authEmail: string = email.trim().toLowerCase();
    let authProviderType: 'google' | 'password' = 'password';
    let photoUrl: string | undefined = undefined;

    // 2. Authentication Flow according to selected method
    if (registerMethod === 'google') {
      authProviderType = 'google';
      // If user hasn't clicked "Continuar con Google" yet, trigger Google popup
      if (!googleUser) {
        setLoading(true);
        try {
          const gUser = await authWithGoogle();
          if (!gUser || !gUser.email) {
            setErrorMsg('No se pudo completar la autenticación con Google.');
            setLoading(false);
            return;
          }
          authUid = gUser.uid;
          authEmail = gUser.email.toLowerCase();
          photoUrl = gUser.photoURL;
          if (!ownerName && gUser.displayName) {
            setOwnerName(gUser.displayName);
          }
          setGoogleUser(gUser);
        } catch (gErr: any) {
          console.warn('[GOOGLE REGISTRATION ERROR]', gErr);
          setErrorMsg(translateFirebaseAuthError(gErr));
          setLoading(false);
          return;
        }
      } else {
        authUid = googleUser.uid;
        authEmail = googleUser.email.toLowerCase();
        photoUrl = googleUser.photoURL;
      }
    } else {
      // Opción B: Correo electrónico y contraseña
      authProviderType = 'password';

      if (!authEmail || !authEmail.includes('@') || !authEmail.includes('.')) {
        setErrorMsg('Por favor ingresa un correo electrónico de acceso válido.');
        return;
      }

      if (!password || password.length < 6) {
        setErrorMsg('La contraseña de acceso debe tener al menos 6 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg('Las contraseñas no coinciden. Por favor asegúrate de que ambas coincidan exactamente.');
        return;
      }

      setLoading(true);
      try {
        const cred = await registerWithEmailPassword(
          authEmail,
          password,
          ownerName.trim() || businessName.trim()
        );
        authUid = cred.uid;
      } catch (authErr: any) {
        console.warn('[EMAIL PASSWORD REGISTRATION ERROR]', authErr);
        setErrorMsg(translateFirebaseAuthError(authErr));
        setLoading(false);
        return;
      }
    }

    // 3. Register Business in persistent storage & Firestore
    try {
      const res = await createNewBusinessAccount({
        name: ownerName.trim() || businessName.trim(),
        email: authEmail,
        businessName: businessName.trim(),
        country,
        currency,
        phonePrefix,
        phone: phone.trim(),
        firebaseUid: authUid,
        authProvider: authProviderType,
        photoUrl
      });

      onAccountChanged(res.data, res.account);
      onClose();
    } catch (err: any) {
      console.error('[CREATE BUSINESS ACCOUNT ERROR]', err);
      setErrorMsg('Error al registrar los datos del negocio. Por favor intenta nuevamente.');
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
      await logoutFirebaseAuth();
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
      <div className="bg-[#fcf8ff] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#cfc2d2]/40 flex flex-col max-h-[92vh]">
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
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#cfc2d2]/40 bg-white">
          <button
            type="button"
            onClick={() => setTab('switch')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
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
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-base text-emerald-600 shrink-0">check_circle</span>
              <span className="flex-1 font-semibold">{successMsg}</span>
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
                  const isGoogle = acc.authProvider === 'google';

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
                          {acc.name ? acc.name.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-[#1a1a26] truncate">
                              {acc.name}
                            </span>
                            {isGoogle && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                <GoogleLogo />
                                Google
                              </span>
                            )}
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
                            className="px-3 py-1.5 rounded-xl bg-[#2e004e] text-white text-xs font-bold hover:bg-[#4b0878] transition-all cursor-pointer shadow-xs active:scale-95"
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

          {/* TAB 2: CREAR NUEVA CUENTA CON GOOGLE O CORREO/CONTRASEÑA */}
          {tab === 'create' && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              {/* Selector de Método de Registro */}
              <div>
                <span className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-2">
                  Método de Autenticación *
                </span>
                <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-2xl border border-[#cfc2d2]/60">
                  <button
                    type="button"
                    onClick={() => setRegisterMethod('google')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      registerMethod === 'google'
                        ? 'bg-[#2e004e] text-white shadow-xs'
                        : 'text-[#4c4451] hover:bg-gray-100'
                    }`}
                  >
                    <GoogleLogo />
                    <span>Continuar con Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterMethod('email')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      registerMethod === 'email'
                        ? 'bg-[#2e004e] text-white shadow-xs'
                        : 'text-[#4c4451] hover:bg-gray-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">mail</span>
                    <span>Correo y Contraseña</span>
                  </button>
                </div>
              </div>

              {/* OPCCIÓN A: CONTINUAR CON GOOGLE */}
              {registerMethod === 'google' && (
                <div className="space-y-3 p-4 bg-white rounded-2xl border border-[#cfc2d2]/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1a1a26]">
                      Opción A: Registro con Google
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                      Acceso Rápido y Seguro
                    </span>
                  </div>

                  {googleUser ? (
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-white p-1 shadow-xs flex items-center justify-center shrink-0">
                          <GoogleLogo />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-emerald-950 truncate">
                              {googleUser.displayName || 'Usuario de Google'}
                            </span>
                            <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                          </div>
                          <span className="text-xs text-emerald-800 font-semibold block truncate">
                            {googleUser.email}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleUser(null);
                          setEmail('');
                        }}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline shrink-0 cursor-pointer"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-[#7e7482] mb-3">
                        Utiliza tu cuenta de Google para registrarte en un clic sin necesidad de recordar contraseñas adicionales.
                      </p>
                      <button
                        type="button"
                        disabled={googleLoading}
                        onClick={handleGoogleAuth}
                        className="w-full py-2.5 px-4 rounded-xl border border-[#cfc2d2] hover:border-[#2e004e] bg-white hover:bg-gray-50 text-[#1a1a26] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
                      >
                        <GoogleLogo />
                        <span>{googleLoading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* OPCIÓN B: CORREO Y CONTRASEÑA */}
              {registerMethod === 'email' && (
                <div className="space-y-3 p-4 bg-white rounded-2xl border border-[#cfc2d2]/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1a1a26]">
                      Opción B: Registro con Correo Electrónico
                    </span>
                    <span className="text-[10px] bg-purple-100 text-[#2e004e] font-bold px-2 py-0.5 rounded-full">
                      Credenciales Propias
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                      Correo Electrónico de Acceso *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@mipeluqueria.com (o tu correo personal)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] focus:ring-2 focus:ring-[#2e004e]/20 outline-none text-xs bg-white font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                        Contraseña *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Mínimo 6 caracteres"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] focus:ring-2 focus:ring-[#2e004e]/20 outline-none text-xs bg-white font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                        Confirmar Contraseña *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          placeholder="Repite la contraseña"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] focus:ring-2 focus:ring-[#2e004e]/20 outline-none text-xs bg-white font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showConfirmPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#7e7482]">
                    La contraseña es propia de Agenda Can para acceder al sistema y no tiene que coincidir con la de tu proveedor de correo.
                  </p>
                </div>
              )}

              {/* DATOS DEL NEGOCIO (CONSERVADOS) */}
              <div className="space-y-3 pt-1">
                <span className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider">
                  Datos de la Peluquería Canina
                </span>

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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] focus:ring-2 focus:ring-[#2e004e]/20 outline-none text-sm bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    Nombre del Responsable / Propietario
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Carlos Silva"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                      País
                    </label>
                    <select
                      value={country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs bg-white"
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
                      className="w-full px-3 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs bg-white"
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
                    <span className="px-3 py-2.5 rounded-xl bg-gray-100 border border-[#cfc2d2] text-xs font-bold text-[#4c4451] flex items-center shrink-0">
                      {phonePrefix}
                    </span>
                    <input
                      type="tel"
                      placeholder="99 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Botón Principal de Envío */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full py-3 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-black text-sm shadow-md hover:bg-[#ffdea1] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg">check</span>
                  {loading
                    ? 'Creando y configurando cuenta...'
                    : 'Crear Cuenta y Abrir Negocio'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
