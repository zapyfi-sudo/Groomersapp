import React, { useState } from 'react';
import { UserAccount, BusinessAccountData } from '../types';
import { COUNTRIES, CURRENCIES } from '../utils/countries';
import { createNewBusinessAccount, switchAccount, loginWithEmail, restoreRemoteAccount } from '../utils/saasDb';
import {
  authWithGoogle,
  registerWithEmailPassword,
  loginWithEmailPassword,
  translateFirebaseAuthError,
  findBusinessByOwner
} from '../utils/firebase';
import { AppLanguage, LANGUAGE_OPTIONS, useTranslation } from '../utils/i18n';

interface LoginScreenProps {
  accountsList: UserAccount[];
  onLoginSuccess: (data: BusinessAccountData, account: UserAccount) => void;
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

export const LoginScreen: React.FC<LoginScreenProps> = ({
  accountsList,
  onLoginSuccess
}) => {
  const { lang, t, setLanguage } = useTranslation();

  const [mode, setMode] = useState<'select' | 'email' | 'register'>(
    accountsList.length > 0 ? 'email' : 'register'
  );

  // Email login state
  const [emailInput, setEmailInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register state
  const [registerMethod, setRegisterMethod] = useState<'google' | 'email'>('google');
  const [googleUser, setGoogleUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  } | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [country, setCountry] = useState('Ecuador');
  const [currency, setCurrency] = useState('USD');
  const [phonePrefix, setPhonePrefix] = useState('+593');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCountryChange = (cName: string) => {
    setCountry(cName);
    const found = COUNTRIES.find((c) => c.name === cName);
    if (found) {
      setCurrency(found.defaultCurrency);
      setPhonePrefix(found.callingCode);
    }
  };

  // Reusable Idioma selector placed cleanly below account header and before auth options
  const renderLanguageSelector = () => (
    <div className="bg-[#f7f4fb] border border-[#cfc2d2]/60 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-lg text-[#4b0878] shrink-0">translate</span>
        <label
          htmlFor="login-language-select"
          className="text-xs font-bold text-[#2e004e] truncate"
        >
          {t.auth.languageSelectorLabel}
        </label>
      </div>
      <select
        id="login-language-select"
        aria-label={t.auth.languageSelectorLabel}
        value={lang}
        onChange={(e) => setLanguage(e.target.value as AppLanguage)}
        className="px-2.5 py-1.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs font-bold text-[#1a1a26] bg-white cursor-pointer max-w-[65%]"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  // Google Login / Quick Account Recognition
  const handleGoogleAuthAction = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      const gUser = await authWithGoogle();
      if (!gUser || !gUser.email) return;

      // 1. Check local accounts first
      const matched = accountsList.find(
        (a) => a.email.toLowerCase() === gUser.email.toLowerCase() || (a.firebaseUid && a.firebaseUid === gUser.uid)
      );

      if (matched) {
        const data = await switchAccount(matched.id);
        if (data) {
          onLoginSuccess(data, matched);
          return;
        }
      }

      // 2. Check remote Firestore for an existing business owned by this Google account
      const remoteBiz = await findBusinessByOwner(gUser.uid, gUser.email);
      if (remoteBiz) {
        const restored = await restoreRemoteAccount({
          businessId: remoteBiz.businessId,
          config: remoteBiz.config,
          appointments: remoteBiz.appointments,
          pets: remoteBiz.pets,
          sales: remoteBiz.sales,
          user: {
            uid: gUser.uid,
            email: gUser.email,
            displayName: gUser.displayName,
            photoURL: gUser.photoURL,
            authProvider: 'google'
          }
        });
        onLoginSuccess(restored.data, restored.account);
        return;
      }

      // 3. New Google User: seamlessly proceed to business registration with Google info prefilled
      setGoogleUser(gUser);
      setRegEmail(gUser.email);
      if (gUser.displayName) setOwnerName(gUser.displayName);
      setRegisterMethod('google');
      setMode('register');
    } catch (err: any) {
      setErrorMsg(translateFirebaseAuthError(err, lang));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg(t.auth.errEmptyEmail);
      return;
    }

    if (!loginPassword) {
      setErrorMsg(t.auth.errPasswordLength);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Real Firebase Auth validation with email and password
      let fbUser: any = null;
      try {
        fbUser = await loginWithEmailPassword(cleanEmail, loginPassword);
      } catch (authErr: any) {
        setErrorMsg(translateFirebaseAuthError(authErr, lang));
        setLoading(false);
        return;
      }

      // 2. Check local accounts for match
      const res = await loginWithEmail(cleanEmail);
      if (res) {
        onLoginSuccess(res.data, res.account);
        return;
      }

      // 3. Check remote Firestore if logging in on a new device/browser
      if (fbUser) {
        const remoteBiz = await findBusinessByOwner(fbUser.uid, cleanEmail);
        if (remoteBiz) {
          const restored = await restoreRemoteAccount({
            businessId: remoteBiz.businessId,
            config: remoteBiz.config,
            appointments: remoteBiz.appointments,
            pets: remoteBiz.pets,
            sales: remoteBiz.sales,
            user: {
              uid: fbUser.uid,
              email: cleanEmail,
              displayName: fbUser.displayName,
              authProvider: 'password'
            }
          });
          onLoginSuccess(restored.data, restored.account);
          return;
        }

        // Firebase Auth account exists, but no business created yet: route to finish onboarding
        setRegEmail(cleanEmail);
        setRegisterMethod('email');
        setMode('register');
        setErrorMsg(t.auth.errEmptyBusinessName);
        return;
      }

      setErrorMsg(t.auth.errInvalidCredentials);
    } catch {
      setErrorMsg(t.auth.errSessionSync);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!businessName.trim()) {
      setErrorMsg(t.auth.errEmptyBusinessName);
      return;
    }

    let authUid: string | undefined = undefined;
    let authEmail: string = regEmail.trim().toLowerCase();
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
          setGoogleUser(gUser);
        } catch (gErr: any) {
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
      if (!authEmail || !authEmail.includes('@')) {
        setErrorMsg(t.auth.errInvalidEmail);
        return;
      }
      if (!regPassword || regPassword.length < 6) {
        setErrorMsg(t.auth.errPasswordLength);
        return;
      }
      if (regPassword !== confirmPassword) {
        setErrorMsg(t.auth.errInvalidCredentials);
        return;
      }

      setLoading(true);
      try {
        const cred = await registerWithEmailPassword(
          authEmail,
          regPassword,
          ownerName.trim() || businessName.trim()
        );
        authUid = cred.uid;
      } catch (authErr: any) {
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

      onLoginSuccess(res.data, res.account);
    } catch {
      setErrorMsg(t.auth.errAccountCreation);
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
            {t.auth.appTagline}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 text-amber-950 text-xs rounded-2xl flex items-start gap-2.5 shadow-xs">
              <span className="material-symbols-outlined text-lg text-amber-600 shrink-0 mt-0.5">warning</span>
              <span className="flex-1 font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Mode 1: Select Welcome / Actions */}
          {mode === 'select' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-base font-bold text-[#1a1a26]">{t.auth.welcomeBackTitle}</h2>
                <p className="text-xs text-[#7e7482] mt-0.5">
                  {t.auth.signInPrompt}
                </p>
              </div>

              {renderLanguageSelector()}

              {/* Botón rápido con Google */}
              <button
                type="button"
                disabled={googleLoading}
                onClick={handleGoogleAuthAction}
                className="w-full py-2.5 px-4 rounded-xl border border-[#cfc2d2] hover:border-[#2e004e] bg-white hover:bg-gray-50 text-[#1a1a26] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
              >
                <GoogleLogo />
                <span>{googleLoading ? t.auth.connectingGoogle : t.auth.continueWithGoogle}</span>
              </button>

              <div className="pt-3 border-t border-[#cfc2d2]/40 flex flex-col gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-bold text-xs shadow-xs hover:bg-[#ffdea1] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_business</span>
                  {t.auth.createBusinessAccountLink}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="text-xs font-semibold text-[#4b0878] hover:underline cursor-pointer"
                >
                  {t.auth.signInEmailBtn}
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Login with Email */}
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div className="text-center">
                <h2 className="text-base font-bold text-[#1a1a26]">{t.auth.signInTitle}</h2>
                <p className="text-xs text-[#7e7482] mt-0.5">
                  {t.auth.signInPrompt}
                </p>
              </div>

              {renderLanguageSelector()}

              {/* Botón rápido con Google */}
              <button
                type="button"
                disabled={googleLoading}
                onClick={handleGoogleAuthAction}
                className="w-full py-2.5 px-4 rounded-xl border border-[#cfc2d2] hover:border-[#2e004e] bg-white hover:bg-gray-50 text-[#1a1a26] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
              >
                <GoogleLogo />
                <span>{googleLoading ? t.auth.connectingGoogle : t.auth.continueWithGoogle}</span>
              </button>

              <div className="flex items-center gap-2 my-1">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.auth.emailTab}</span>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                  {t.auth.emailLabel}
                </label>
                <input
                  type="email"
                  required
                  placeholder={t.auth.emailPlaceholder}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                  {t.auth.passwordLabel}
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder={t.auth.passwordPlaceholder}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showLoginPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#2e004e] text-white font-bold text-sm shadow-md hover:bg-[#4b0878] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? t.auth.signingIn : t.auth.signInTitle}
              </button>

              <div className="pt-2 text-center space-y-1">
                {accountsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMode('select')}
                    className="text-xs font-semibold text-[#4b0878] hover:underline block w-full cursor-pointer"
                  >
                    ← {t.auth.orUseSavedAccount}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs font-semibold text-[#7e7482] hover:text-[#1a1a26] block w-full cursor-pointer"
                >
                  {t.auth.newToPlatform} {t.auth.createBusinessAccountLink}
                </button>
              </div>
            </form>
          )}

          {/* Mode 3: Register New Business */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="text-center pb-0.5">
                <h2 className="text-base font-bold text-[#1a1a26]">{t.auth.newBusinessAccount}</h2>
                <p className="text-xs text-[#7e7482] mt-0.5">
                  {t.auth.chooseAuthMethod}
                </p>
              </div>

              {/* Language selector positioned right below business account header and before auth methods */}
              {renderLanguageSelector()}

              {/* Selector de Método de Registro */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRegisterMethod('google')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    registerMethod === 'google'
                      ? 'bg-[#2e004e] text-white shadow-xs'
                      : 'text-[#4c4451] hover:bg-gray-200'
                  }`}
                >
                  <GoogleLogo />
                  <span>{t.auth.googleTab}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterMethod('email')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    registerMethod === 'email'
                      ? 'bg-[#2e004e] text-white shadow-xs'
                      : 'text-[#4c4451] hover:bg-gray-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">mail</span>
                  <span>{t.auth.emailTab}</span>
                </button>
              </div>

              {registerMethod === 'google' ? (
                <div>
                  {googleUser ? (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <GoogleLogo />
                        <span className="text-xs font-bold text-emerald-950 truncate">
                          {googleUser.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGoogleUser(null);
                          setRegEmail('');
                        }}
                        className="text-xs font-bold text-emerald-800 underline shrink-0 cursor-pointer"
                      >
                        {t.common.edit}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={googleLoading}
                      onClick={handleGoogleAuthAction}
                      className="w-full py-2.5 px-4 rounded-xl border border-[#cfc2d2] hover:border-[#2e004e] bg-white hover:bg-gray-50 text-[#1a1a26] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <GoogleLogo />
                      <span>{googleLoading ? t.auth.connectingGoogle : t.auth.continueWithGoogle}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                      {t.auth.emailLabel}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder={t.auth.emailPlaceholder}
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#cfc2d2] outline-none text-xs bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                        {t.auth.passwordLabel}
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          placeholder={t.auth.passwordMinHint}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-[#cfc2d2] outline-none text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {showRegPassword ? 'visibility_off' : 'visibility'}
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
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-[#cfc2d2] outline-none text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {showConfirmPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  className="w-full px-3.5 py-2 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
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
                  className="w-full px-3 py-2 rounded-xl border border-[#cfc2d2] outline-none text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#4c4451] uppercase tracking-wider mb-1">
                    {t.auth.countryLabel}
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
                    {t.auth.currencyLabel}
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
                  {t.auth.whatsappLabel}
                </label>
                <div className="flex gap-2">
                  <span className="px-3 py-2 rounded-xl bg-gray-100 border border-[#cfc2d2] text-xs font-bold flex items-center">
                    {phonePrefix}
                  </span>
                  <input
                    type="tel"
                    placeholder={t.auth.whatsappPlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-[#cfc2d2] focus:border-[#2e004e] outline-none text-sm bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#f9b900] text-[#261900] font-black text-sm shadow-md hover:bg-[#ffdea1] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 active:scale-95 disabled:opacity-60"
              >
                {loading ? t.auth.creatingAccount : t.auth.createSalonBtn}
              </button>

              <div className="text-center pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="text-xs font-semibold text-[#4b0878] hover:underline block w-full cursor-pointer"
                >
                  {t.auth.alreadyHaveAccount} {t.auth.signInHere}
                </button>
                {accountsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMode('select')}
                    className="text-xs font-semibold text-[#7e7482] hover:underline block w-full cursor-pointer"
                  >
                    ← {t.auth.orUseSavedAccount}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
