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
import { AppLanguage, LANGUAGE_OPTIONS, useTranslation } from '../utils/i18n';

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
  const { lang, t, setLanguage } = useTranslation();
  const [tab, setTab] = useState<'switch' | 'create'>('switch');

  // Strict account isolation: A user only sees accounts belonging to their verified identity
  const userVisibleAccounts = React.useMemo(() => {
    if (!activeAccount) return [];
    const currentEmail = (activeAccount.email || '').trim().toLowerCase();
    const isMasterAdmin = currentEmail === 'admin@agendacan.com' || currentEmail === 'zapyfi@gmail.com';
    if (isMasterAdmin) {
      return accountsList;
    }
    return accountsList.filter(
      (acc) =>
        acc.id === activeAccount.id ||
        (acc.email && acc.email.trim().toLowerCase() === currentEmail)
    );
  }, [accountsList, activeAccount]);

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
        setSuccessMsg(`${t.auth.googleAccountConnectedPrefix} ${gUser.email}`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.warn('[GOOGLE AUTH WARN]', err);
      setErrorMsg(translateFirebaseAuthError(err, lang));
    } finally {
      setGoogleLoading(false);
    }
  };

  // Final submission of the account creation form
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!businessName.trim()) {
      setErrorMsg(t.auth.errEmptyBusinessName);
      return;
    }

    let authUid: string | undefined = undefined;
    let authEmail: string = email.trim().toLowerCase();
    let authProviderType: 'google' | 'password' = 'password';
    let photoUrl: string | undefined = undefined;

    if (registerMethod === 'google') {
      authProviderType = 'google';
      if (!googleUser) {
        setLoading(true);
        try {
          const gUser = await authWithGoogle();
          if (!gUser || !gUser.email) {
            setErrorMsg(t.auth.errGoogleGeneric);
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
          setErrorMsg(translateFirebaseAuthError(gErr, lang));
          setLoading(false);
          return;
        }
      } else {
        authUid = googleUser.uid;
        authEmail = googleUser.email.toLowerCase();
        photoUrl = googleUser.photoURL;
      }
    } else {
      authProviderType = 'password';

      if (!authEmail || !authEmail.includes('@') || !authEmail.includes('.')) {
        setErrorMsg(t.auth.errInvalidEmail);
        return;
      }

      if (!password || password.length < 6) {
        setErrorMsg(t.auth.errPasswordLength);
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg(t.auth.errInvalidCredentials);
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
        setErrorMsg(translateFirebaseAuthError(authErr, lang));
        setLoading(false);
        return;
      }
    }

    try {
      const res = await createNewBusinessAccount({
        name: ownerName.trim() || businessName.trim(),
        email: authEmail,
        businessName: businessName.trim(),
        country,
        currency,
        language: lang,
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
      setErrorMsg(t.auth.errAccountCreation);
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
              <h3 className="font-bold text-base leading-tight">{t.auth.accountCenterTitle}</h3>
              <p className="text-xs text-white/70">{t.auth.accountSyncCloudInfo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.auth.closeModal}
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
            {t.auth.activeBusinessesTab} ({userVisibleAccounts.length})
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
            + {t.auth.addNewBusinessTab}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 text-amber-950 text-xs rounded-2xl flex items-start gap-2.5 shadow-xs animate-in fade-in">
              <span className="material-symbols-outlined text-lg text-amber-600 shrink-0 mt-0.5">warning</span>
              <span className="flex-1 font-medium leading-relaxed">{errorMsg}</span>
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
                {t.auth.accountSyncCloudInfo}
              </p>

              <div className="space-y-2.5">
                {userVisibleAccounts.length === 0 ? (
                  <p className="text-xs text-[#7e7482] text-center py-4">{t.auth.noSavedAccounts}</p>
                ) : (
                  userVisibleAccounts.map((acc) => {
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
                                  {t.auth.currentAccountBadge}
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
                              {t.common.active}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleSwitch(acc.id)}
                              className="px-3 py-1.5 rounded-xl bg-[#2e004e] text-white text-xs font-bold hover:bg-[#4b0878] transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              {loading ? t.auth.switchingAccount : t.auth.switchAccountBtn}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Cerrar Sesión Button */}
              <div className="pt-4 border-t border-[#cfc2d2]/40 flex items-center justify-between gap-3">
                <span className="text-xs text-[#7e7482]">
                  {t.auth.confirmSignOutDesc}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  {t.auth.signOutCurrent}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CREAR NUEVA CUENTA CON GOOGLE O CORREO/CONTRASEÑA */}
          {tab === 'create' && (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              {/* Language Selector */}
              <div className="bg-white border border-[#cfc2d2]/60 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-lg text-[#4b0878] shrink-0">translate</span>
                  <label htmlFor="modal-language-select" className="text-xs font-bold text-[#2e004e] truncate">
                    {t.auth.languageSelectorLabel}
                  </label>
                </div>
                <select
                  id="modal-language-select"
                  value={lang}
                  onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs font-bold text-[#1a1a26] bg-[#fcf8ff] cursor-pointer max-w-[65%]"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Método de Registro */}
              <div>
                <span className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-2">
                  {t.auth.chooseAuthMethod} *
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
                    <span>{t.auth.googleTab}</span>
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
                    <span>{t.auth.emailTab}</span>
                  </button>
                </div>
              </div>

              {/* OPCCIÓN A: CONTINUAR CON GOOGLE */}
              {registerMethod === 'google' && (
                <div className="space-y-3 p-4 bg-white rounded-2xl border border-[#cfc2d2]/60">
                  {googleUser ? (
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-white p-1 shadow-xs flex items-center justify-center shrink-0">
                          <GoogleLogo />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-emerald-950 truncate">
                              {googleUser.displayName || t.auth.googleTab}
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
                        {t.common.edit}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-[#7e7482] mb-3">
                        {t.auth.continueWithGoogleHint}
                      </p>
                      <button
                        type="button"
                        disabled={googleLoading}
                        onClick={handleGoogleAuth}
                        className="w-full py-2.5 px-4 rounded-xl border border-[#cfc2d2] hover:border-[#2e004e] bg-white hover:bg-gray-50 text-[#1a1a26] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
                      >
                        <GoogleLogo />
                        <span>{googleLoading ? t.auth.connectingGoogle : t.auth.continueWithGoogle}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* OPCIÓN B: CORREO Y CONTRASEÑA */}
              {registerMethod === 'email' && (
                <div className="space-y-3 p-4 bg-white rounded-2xl border border-[#cfc2d2]/60">
                  <div>
                    <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                      {t.auth.emailLabel}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder={t.auth.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] focus:ring-2 focus:ring-[#2e004e]/20 outline-none text-xs bg-white font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                        {t.auth.passwordLabel}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder={t.auth.passwordMinHint}
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
                        {t.common.confirm} *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          placeholder={t.auth.passwordPlaceholder}
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
                </div>
              )}

              {/* DATOS DEL NEGOCIO */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    {t.auth.businessNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.auth.businessNamePlaceholder}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] focus:ring-2 focus:ring-[#2e004e]/20 outline-none text-sm bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    {t.auth.ownerNameLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.auth.ownerNamePlaceholder}
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                      {t.auth.countryLabel}
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
                      {t.auth.currencyLabel}
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
                    {t.auth.whatsappLabel}
                  </label>
                  <div className="flex gap-2">
                    <span className="px-3 py-2.5 rounded-xl bg-gray-100 border border-[#cfc2d2] text-xs font-bold text-[#4c4451] flex items-center shrink-0">
                      {phonePrefix}
                    </span>
                    <input
                      type="tel"
                      placeholder={t.auth.whatsappPlaceholder}
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
                  {loading ? t.auth.registeringInCloud : t.auth.createAdditionalBusiness}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
