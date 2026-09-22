import React, { useState, useEffect, useRef } from 'react';
import { Language, translations } from '../data/i18n';
import { Designer, PaymentSettings } from '../types';
import {
  ADMIN_USERNAME,
  SUPERADMIN_USERNAME,
  verifyAdminPin,
  verifyAdminPassword,
  verifySuperAdminPin,
  verifySuperAdminPassword,
  diagnosePinVerification,
  PinDiagnosticResult,
  normalizePinInput,
  syncLatestCredentialsFromCloud,
  encryptSessionData,
  saveClientSession,
  getClientSession,
  generateClientAuthToken
} from '../lib/authCrypto';
import { api } from '../api/client';
import { normalizePhoneNumber } from '../utils/notifications';
import { playSuccessChime, playNotificationChime } from '../utils/audio';
import {
  Scissors,
  User,
  Phone,
  Shield,
  Lock,
  ArrowRight,
  AlertCircle,
  X,
  KeyRound,
  Loader2,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Users,
  Check,
  Crown,
  Wrench,
  Copy,
  Info,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from './BrandLogo';
import { RepairDatabaseModal } from './RepairDatabaseModal';
import { PinKeypad } from './PinKeypad';

interface RoleSelectionScreenProps {
  lang: Language;
  onSelectLang: (lang: Language) => void;
  onEnterUser: () => void;
  onEnterAdmin: () => void;
  onEnterSuperAdmin?: () => void;
  onEnterBarber?: (barber: Designer) => void;
  designers?: Designer[];
  shopSettings?: PaymentSettings | null;
  logoUrl?: string;
  shopName?: string;
  tagline?: string;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  lang,
  onSelectLang,
  onEnterUser,
  onEnterAdmin,
  onEnterSuperAdmin,
  onEnterBarber,
  designers = [],
  shopSettings,
  logoUrl,
  shopName,
  tagline,
}) => {
  const t = translations[lang];

  // Real-time dynamic shop branding
  const [liveSettings, setLiveSettings] = useState<PaymentSettings | null>(shopSettings || null);

  useEffect(() => {
    if (shopSettings) {
      setLiveSettings(shopSettings);
    }
  }, [shopSettings]);

  useEffect(() => {
    const unsub = api.subscribeToSettings((data) => {
      if (data) {
        setLiveSettings(data);
      }
    });
    return () => unsub();
  }, []);

  const activeLogoUrl = logoUrl || liveSettings?.logoUrl;
  const activeShopName = shopName || liveSettings?.shopName || 'GENTLEMAN';
  const activeTagline = tagline || liveSettings?.tagline || (lang === 'my' ? 'ဆံသနှင့် အလှပြင်ဆိုင်' : 'Barber Shop');

  // Client Identification State
  const [existingClient, setExistingClient] = useState<{
    name: string;
    phone: string;
    memberTier: string;
    points: number;
  } | null>(null);
  const [isSwitchingClient, setIsSwitchingClient] = useState(false);
  const [clientPhoneInput, setClientPhoneInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientError, setClientError] = useState('');
  const [enterUserLoading, setEnterUserLoading] = useState(false);

  // Portal Modal State
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalMode, setPortalMode] = useState<'admin' | 'barber' | 'superadmin'>('admin');

  // Admin / SuperAdmin Login State (PIN-Only)
  const [pinCode, setPinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<PinDiagnosticResult | null>(null);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Repair Modal State
  const [showRepairModal, setShowRepairModal] = useState(false);

  // Barber Login State
  const [barberPhone, setBarberPhone] = useState('');
  const [barberPin, setBarberPin] = useState('');
  const [barberError, setBarberError] = useState('');
  const [barberLoading, setBarberLoading] = useState(false);
  const [barberUseKeypad, setBarberUseKeypad] = useState(false);

  // Secret 5-Tap Gesture to Reveal Staff / Admin Login
  const [logoTapCount, setLogoTapCount] = useState(0);
  const lastLogoTapRef = useRef<number>(0);

  const handleLogoSecretTap = () => {
    const now = Date.now();
    let currentTaps = logoTapCount;
    if (now - lastLogoTapRef.current > 2200) {
      currentTaps = 1;
    } else {
      currentTaps += 1;
    }
    lastLogoTapRef.current = now;
    setLogoTapCount(currentTaps);

    if (currentTaps >= 5) {
      setLogoTapCount(0);
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([40, 60, 40]);
        }
      } catch {}
      playSuccessChime();
      setPortalMode('barber');
      setErrorMsg('');
      setBarberError('');
      setShowPortalModal(true);
    }
  };

  useEffect(() => {
    // Check if client has a verified phone session
    try {
      const stored = localStorage.getItem('baba_user_profile_v1');
      const session = getClientSession();
      if (stored) {
        const p = JSON.parse(stored);
        const norm = normalizePhoneNumber(p.phone);
        if (norm && norm !== '0000000000' && norm.length >= 8) {
          setExistingClient({
            name: p.name || 'Valued Client',
            phone: p.phone,
            memberTier: p.memberTier || session?.memberTier || 'Bronze',
            points: p.points ?? session?.points ?? 500,
          });
          setClientPhoneInput(p.phone);
          setClientNameInput(p.name || '');
          return;
        }
      }
      if (session?.phone && normalizePhoneNumber(session.phone) !== '0000000000') {
        setExistingClient({
          name: session.name || 'Valued Client',
          phone: session.phone,
          memberTier: session.memberTier || 'Bronze',
          points: session.points || 500,
        });
        setClientPhoneInput(session.phone);
        setClientNameInput(session.name || '');
      }
    } catch {}
  }, []);

  const handleEnterWithExistingClient = async () => {
    if (!existingClient) return;
    setEnterUserLoading(true);
    playNotificationChime();

    // Re-verify token
    generateClientAuthToken({
      name: existingClient.name,
      phone: existingClient.phone,
      memberTier: existingClient.memberTier as any,
      points: existingClient.points,
    });

    await new Promise((r) => setTimeout(r, 650));
    setEnterUserLoading(false);
    onEnterUser();
  };

  const handleClientPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError('');

    const norm = normalizePhoneNumber(clientPhoneInput);
    if (!norm || norm === '0000000000' || norm.length < 8) {
      setClientError(
        lang === 'my'
          ? 'မှန်ကန်သော ဖုန်းနံပါတ် (ဥပမာ 09xxxxxxxxx) ထည့်သွင်းပေးပါ'
          : 'Please enter a valid phone number (e.g. 09xxxxxxxxx)'
      );
      return;
    }

    setEnterUserLoading(true);
    playNotificationChime();

    try {
      const cleanPhone = clientPhoneInput.trim();
      const cleanName = clientNameInput.trim() || (lang === 'my' ? 'ဖောက်သည်' : 'Client Guest');

      // Link or create account in Firestore
      const res = await api.syncOrLinkClientAccount({
        name: cleanName,
        phone: cleanPhone,
        source: 'client_app',
      });

      if (res.client.kicked) {
        setClientError(lang === 'my' ? 'သင့်အကောင့်အား SuperAdmin မှ အသုံးပြုခွင့် ရပ်ဆိုင်း (Kicked) ထားပါသည်' : 'Your account has been suspended by SuperAdmin.');
        setEnterUserLoading(false);
        return;
      }

      const clientData = {
        name: res.client.name,
        phone: res.client.phone,
        email: res.client.email || '',
        avatarUrl: res.client.avatarUrl || '',
        photoBonusClaimed: res.client.photoBonusClaimed || false,
        memberTier: res.client.memberTier,
        points: res.client.points,
        joinedDate: res.client.joinedDate,
      };

      // Store in verified local profile
      localStorage.setItem('baba_user_profile_v1', JSON.stringify(clientData));
      localStorage.setItem('baba_client_phone', cleanPhone);
      localStorage.setItem('baba_booking_customer_phone', cleanPhone);
      localStorage.setItem('baba_booking_customer_name', cleanName);

      // Issue cryptographic client session token
      saveClientSession({
        name: clientData.name,
        phone: clientData.phone,
        memberTier: clientData.memberTier,
        points: clientData.points,
      });

      await new Promise((r) => setTimeout(r, 650));
      onEnterUser();
    } catch (err: any) {
      setClientError(err?.message || 'Login failed. Please try again.');
    } finally {
      setEnterUserLoading(false);
    }
  };

  const handleAdminLogin = async (explicitPin?: string) => {
    const activePin = typeof explicitPin === 'string' ? explicitPin : pinCode;
    setErrorMsg('');
    setDiagnosticResult(null);
    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 200));

      const isSuper = portalMode === 'superadmin';
      const role = isSuper ? 'superadmin' : 'admin';

      // 1. Initial Diagnostic & Verification Test
      let diag = diagnosePinVerification(role, activePin);

      // 2. If initial match failed, auto-trigger live cloud credentials sync
      if (!diag.isValid) {
        await syncLatestCredentialsFromCloud();
        diag = diagnosePinVerification(role, activePin);
      }

      if (diag.isValid) {
        const token = encryptSessionData({
          username: isSuper ? SUPERADMIN_USERNAME : ADMIN_USERNAME,
          role: isSuper ? 'superadmin' : 'admin',
          loginAt: Date.now(),
        });
        localStorage.setItem('baba_admin_session', token);
        playSuccessChime();
        setShowPortalModal(false);
        setPinCode('');
        setDiagnosticResult(null);
        if (isSuper && onEnterSuperAdmin) {
          onEnterSuperAdmin();
        } else {
          onEnterAdmin();
        }
      } else {
        setDiagnosticResult(diag);
        setErrorMsg(diag.failureReasonEnglish || 'Authentication failed. Please check the entered PIN.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      await syncLatestCredentialsFromCloud();
      const isSuper = portalMode === 'superadmin';
      const role = isSuper ? 'superadmin' : 'admin';
      if (pinCode) {
        const diag = diagnosePinVerification(role, pinCode);
        setDiagnosticResult(diag);
        if (diag.isValid) {
          await handleAdminLogin(pinCode);
        } else {
          setErrorMsg(`Cloud Synced. ${diag.failureReasonEnglish}`);
        }
      } else {
        setErrorMsg(`Cloud credentials synced successfully. Enter your 6-digit ${role.toUpperCase()} PIN.`);
      }
    } catch (err: any) {
      setErrorMsg(`Cloud sync error: ${err?.message || 'Network timeout'}`);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleCopyDiagnostic = () => {
    if (!diagnosticResult) return;
    const isSuper = portalMode === 'superadmin';
    const reportText = `[BABA BARBER AUTHENTICATION DIAGNOSTIC REPORT]
Timestamp: ${new Date().toISOString()}
Role Target: ${isSuper ? 'SUPERADMIN (Owner)' : 'ADMIN (Manager)'}
Error Code: ${diagnosticResult.failureCode || 'ERR_UNKNOWN'}
Failure Reason: ${diagnosticResult.failureReasonEnglish || 'N/A'}
Normalized Input Length: ${diagnosticResult.normalizedLength} digits (Expected ${diagnosticResult.expectedLength})
Cloud Firestore Sync Status: ${diagnosticResult.cloudSyncStatus}
Last Cloud Credential Update: ${diagnosticResult.cloudUpdatedAt}
Updated By: ${diagnosticResult.cloudUpdatedBy}
User Action Recommendation: ${diagnosticResult.recommendedActionEnglish || 'Sync credentials or repair cache'}`;

    navigator.clipboard?.writeText(reportText).then(() => {
      setCopiedDiagnostic(true);
      setTimeout(() => setCopiedDiagnostic(false), 2500);
    });
  };

  const handleBarberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBarberError('');
    setBarberLoading(true);

    try {
      const cleanPhone = barberPhone.trim();
      const cleanPin = barberPin.trim();

      if (!cleanPhone) {
        setBarberError(lang === 'my' ? 'Barber ဖုန်းနံပါတ် ထည့်သွင်းပေးပါ' : 'Please enter barber phone number');
        return;
      }
      if (!cleanPin || cleanPin.length < 4) {
        setBarberError(lang === 'my' ? '၄ လုံးပါ PIN ကုဒ် ရိုက်ထည့်ပါ' : 'Please enter 4-digit PIN');
        return;
      }

      const res = await api.verifyBarberPin(cleanPhone, cleanPin);
      if (!res.success || !res.barber) {
        setBarberError(res.error || (lang === 'my' ? 'ဖုန်းနံပါတ် သို့မဟုတ် PIN ကုဒ် မှားယွင်းနေပါသည်' : 'Invalid phone or PIN'));
        return;
      }

      if (res.barber.active === false) {
        setBarberError(lang === 'my' ? 'ဒီ Barber အကောင့်အား ခေတ္တပိတ်ထားပါသည် (Disabled by Admin)' : 'Account is deactivated by Admin');
        return;
      }

      // Save encrypted barber session
      const token = encryptSessionData({
        role: 'barber',
        barberId: res.barber.id,
        barberName: res.barber.name,
        phone: res.barber.phone,
        loginAt: Date.now(),
      });
      localStorage.setItem('baba_barber_session', token);
      localStorage.setItem('baba_active_barber_id', res.barber.id);
      localStorage.setItem('baba_active_barber_phone', res.barber.phone || '');
      localStorage.setItem('baba_active_barber_name', res.barber.name || '');
      localStorage.setItem('baba_active_barber_obj', JSON.stringify(res.barber));

      playSuccessChime();
      setShowPortalModal(false);
      if (onEnterBarber) {
        onEnterBarber(res.barber);
      }
    } catch (err: any) {
      setBarberError(err?.message || 'Login failed. Please try again.');
    } finally {
      setBarberLoading(false);
    }
  };

  const handleQuickSelectBarber = (designer: Designer) => {
    setBarberPhone(designer.phone || '');
    setBarberPin(''); // Strictly never auto-fill PIN
    setBarberError('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#FAFAFA] text-[#18181B] flex flex-col justify-between px-4 py-4 sm:p-8 font-sans selection:bg-[#D4AF37] selection:text-black overflow-y-auto"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      
      {/* Top: Brand & Lang */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between">
        <div 
          onClick={handleLogoSecretTap}
          className="flex items-center space-x-3 cursor-pointer select-none transition-transform active:scale-95"
          title={activeShopName}
        >
          <BrandLogo size={42} logoUrl={activeLogoUrl} shopName={activeShopName} tagline={activeTagline} />
          <div>
            <span className="font-black text-base tracking-wider font-sans uppercase text-stone-900">
              {activeShopName}
            </span>
            <div className="text-[10px] text-emerald-700 font-sans font-bold tracking-widest uppercase">{activeTagline}</div>
          </div>
        </div>

        <div className="flex items-center bg-white p-1 rounded-2xl border border-stone-200 shadow-xs">
          <button
            onClick={() => onSelectLang('en')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer ${
              lang === 'en' ? 'bg-emerald-700 text-white shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => onSelectLang('my')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer ${
              lang === 'my' ? 'bg-emerald-700 text-white shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            မြန်မာ
          </button>
        </div>
      </div>

      {/* Center: Client Identification Gate */}
      <div className="max-w-md mx-auto w-full my-auto text-center space-y-5 py-4">
        <div className="flex flex-col items-center space-y-2">
          <div
            onClick={handleLogoSecretTap}
            className="cursor-pointer select-none transition-transform active:scale-95 flex flex-col items-center"
            title={activeShopName}
          >
            <BrandLogo size={84} logoUrl={activeLogoUrl} shopName={activeShopName} tagline={activeTagline} className="mb-1" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight uppercase font-sans">
            {activeShopName}
          </h1>
        </div>

        {/* Existing Client Fast Login or Phone Registration */}
        <div className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-sm text-left space-y-4">
          {existingClient && !isSwitchingClient ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black text-lg shadow-xs">
                    {existingClient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-sm text-stone-900 font-sans">{existingClient.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold font-sans">
                        {existingClient.memberTier}
                      </span>
                    </div>
                    <div className="text-xs font-sans text-stone-500 font-medium">{existingClient.phone}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-sans text-stone-400 block font-semibold">Rewards</span>
                  <span className="text-xs font-sans font-black text-emerald-800">{existingClient.points} PTS</span>
                </div>
              </div>

              <button
                disabled={enterUserLoading}
                onClick={handleEnterWithExistingClient}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-70"
              >
                {enterUserLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{lang === 'my' ? 'ခေတ္တစောင့်ပါ...' : 'Entering Lounge...'}</span>
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 text-white" />
                    <span>{lang === 'my' ? 'စတင်အသုံးပြုမည်' : 'Enter Lounge'}</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsSwitchingClient(true)}
                  className="text-xs font-sans font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  {lang === 'my' ? '🔄 အခြား ဖုန်းနံပါတ်ဖြင့် ဝင်ရောက်မည်' : '🔄 Switch Phone Number'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleClientPhoneSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                    <Phone className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 font-sans">
                    {lang === 'my' ? 'Client အကောင့်ဝင်ရန်' : 'Client Sign-In'}
                  </h3>
                </div>
                {existingClient && isSwitchingClient && (
                  <button
                    type="button"
                    onClick={() => setIsSwitchingClient(false)}
                    className="text-xs font-sans font-semibold text-stone-500 hover:text-stone-900 cursor-pointer"
                  >
                    {lang === 'my' ? 'မလုပ်တော့ပါ' : 'Cancel'}
                  </button>
                )}
              </div>

              {clientError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{clientError}</span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="block text-stone-800 font-bold font-sans">
                    {lang === 'my' ? 'ဖုန်းနံပါတ်' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="09xxxxxxxxx"
                      value={clientPhoneInput}
                      onChange={(e) => setClientPhoneInput(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-3.5 rounded-xl border border-stone-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-bold text-stone-900 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-stone-800 font-bold font-sans">
                    {lang === 'my' ? 'အမည်' : 'Name'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={lang === 'my' ? 'ဥပမာ ကိုအောင်' : 'e.g. Ko Aung'}
                      value={clientNameInput}
                      onChange={(e) => setClientNameInput(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-3.5 rounded-xl border border-stone-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans text-stone-900 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={enterUserLoading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl transition-all shadow-xs cursor-pointer flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-70"
              >
                {enterUserLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{lang === 'my' ? 'အကောင့်စစ်ဆေးနေပါသည်...' : 'Verifying Account...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'my' ? 'အတည်ပြုပြီး စတင်မည်' : 'Continue to Lounge'}</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom: Minimalist Clean Footer */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between text-[11px] text-stone-500 pt-4 border-t border-stone-200">
        <span className="font-sans">© {new Date().getFullYear()} {activeShopName}</span>
        <button
          type="button"
          onClick={() => setShowRepairModal(true)}
          className="inline-flex items-center space-x-1.5 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-sans text-[11px] font-semibold"
          title="Repair Database & Clear Cache"
        >
          <Wrench className="w-3.5 h-3.5 text-emerald-700" />
          <span>{lang === 'my' ? 'ပြုပြင်ရန်' : 'Repair'}</span>
        </button>
      </div>

      {/* Modern Admin & Barber Access Modal */}
      <AnimatePresence>
        {showPortalModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md bg-[#FFFFFF] border border-[#E4E4E7] rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-[#18181B]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-700 text-white shadow-xs">
                    {portalMode === 'superadmin' ? (
                      <Crown className="w-5 h-5 text-white" />
                    ) : portalMode === 'admin' ? (
                      <Shield className="w-5 h-5 text-white" />
                    ) : (
                      <Scissors className="w-5 h-5 transform -rotate-45 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 font-sans">
                      {portalMode === 'superadmin'
                        ? 'SuperAdmin Portal'
                        : portalMode === 'admin'
                        ? 'Admin Portal'
                        : 'Barber Staff Portal'}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowPortalModal(false)}
                  className="text-stone-500 hover:text-stone-900 p-2 rounded-xl hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Portal Mode Switcher 3 Tabs */}
              <div className="grid grid-cols-3 bg-stone-100 p-1 rounded-2xl border border-stone-200 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('barber');
                    setBarberError('');
                  }}
                  className={`py-2 rounded-xl text-[11px] font-sans font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                    portalMode === 'barber'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Scissors className="w-3 h-3 transform -rotate-45" />
                  <span>Barber</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('admin');
                    setPinCode('');
                    setErrorMsg('');
                    setDiagnosticResult(null);
                  }}
                  className={`py-2 rounded-xl text-[11px] font-sans font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                    portalMode === 'admin'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>Admin PIN</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPortalMode('superadmin');
                    setPinCode('');
                    setErrorMsg('');
                    setDiagnosticResult(null);
                  }}
                  className={`py-2 rounded-xl text-[11px] font-sans font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                    portalMode === 'superadmin'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 hover:text-emerald-700'
                  }`}
                >
                  <Crown className="w-3 h-3 text-current" />
                  <span>SuperAdmin</span>
                </button>
              </div>

              {/* MODE A: BARBER STAFF LOGIN */}
              {portalMode === 'barber' && (
                <div className="space-y-4 pt-1">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-xs text-stone-900 space-y-1">
                    <p className="font-bold flex items-center space-x-1.5 text-emerald-900">
                      <KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{lang === 'my' ? 'Barber အကောင့်ဝင်ရောက်ရန်' : 'Barber Staff Login'}</span>
                    </p>
                  </div>

                  {/* Quick Barber Selector Chips */}
                  {designers.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-sans font-bold text-stone-500 uppercase tracking-wider block">
                        {lang === 'my' ? 'ရွေးချယ်ရန်:' : 'Quick Select:'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {designers.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleQuickSelectBarber(d)}
                            className="flex items-center space-x-2 p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 text-left cursor-pointer transition-all active:scale-95 group"
                          >
                            <img
                              src={d.avatarUrl}
                              alt={d.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover border border-stone-200 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-stone-900 truncate group-hover:text-emerald-700">{d.name}</p>
                              <p className="text-[10px] text-stone-500 font-sans truncate">{d.phone || '09000000000'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleBarberLogin} className="space-y-3.5">
                    {barberError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="leading-snug">{barberError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRepairModal(true)}
                          className="w-full py-1.5 px-2.5 bg-red-100 hover:bg-red-200 text-red-900 border border-red-300 rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5 text-red-700 shrink-0" />
                          <span>Clear Cache & Repair Login</span>
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-stone-800 uppercase tracking-wider mb-1 font-sans">
                        {lang === 'my' ? 'Barber ဖုန်းနံပါတ်' : 'Barber Phone Number'}
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3.5" />
                        <input
                          type="tel"
                          required
                          value={barberPhone}
                          onChange={(e) => setBarberPhone(e.target.value)}
                          placeholder="09111111111"
                          className="w-full pl-9 pr-3 py-3 bg-white border border-stone-200 rounded-xl text-xs font-sans font-bold text-stone-900 focus:outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-stone-800 uppercase tracking-wider font-sans">
                          {lang === 'my' ? '၄ လုံးပါ PIN ကုဒ်' : '4-Digit Staff PIN'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setBarberUseKeypad(!barberUseKeypad)}
                          className="text-[10px] text-emerald-700 font-sans font-bold hover:underline cursor-pointer"
                        >
                          {barberUseKeypad ? 'Standard Input' : 'PIN Pad'}
                        </button>
                      </div>

                      {barberUseKeypad ? (
                        <div className="pt-2">
                          <PinKeypad
                            pin={barberPin}
                            onChange={(p) => setBarberPin(p)}
                            maxLength={4}
                            autoSubmitOnComplete={false}
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          <KeyRound className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3.5" />
                          <input
                            type="password"
                            maxLength={6}
                            required
                            value={barberPin}
                            onChange={(e) => setBarberPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••"
                            className="w-full pl-9 pr-3 py-3 bg-white border border-stone-200 rounded-xl text-xs font-sans font-bold tracking-widest text-stone-900 focus:outline-none focus:border-emerald-500 transition-all"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={barberLoading || !barberPhone || barberPin.length < 4}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
                    >
                      {barberLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>{lang === 'my' ? 'စစ်ဆေးနေသည်...' : 'Authenticating...'}</span>
                        </>
                      ) : (
                        <>
                          <Scissors className="w-4 h-4 transform -rotate-45 text-white" />
                          <span>{lang === 'my' ? 'Barber အကောင့်သို့ ဝင်မည်' : 'Enter Barber Desk'}</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* MODE B: ADMIN MANAGER LOGIN (PIN ONLY + VIRTUAL KEYPAD) */}
              {portalMode === 'admin' && (
                <div className="space-y-4 pt-1">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-xs text-stone-900 space-y-1">
                    <p className="font-bold flex items-center space-x-1.5 text-emerald-900">
                      <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>ADMIN ACCESS</span>
                    </p>
                  </div>

                  {/* English Diagnostic Report Panel on Failure */}
                  {errorMsg && (
                    <div className="p-3.5 bg-red-50/90 border-2 border-red-300 rounded-2xl text-red-950 text-xs space-y-2.5 shadow-sm">
                      <div className="flex items-start space-x-2">
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-red-900 uppercase tracking-wide text-[11px]">
                            Authentication Failed
                          </p>
                          <p className="text-xs text-red-800 font-sans font-medium mt-0.5 leading-relaxed">
                            {errorMsg}
                          </p>
                        </div>
                      </div>

                      {diagnosticResult && (
                        <div className="bg-white p-2.5 rounded-xl border border-red-200 text-[11px] font-sans space-y-1.5 text-stone-800">
                          <div className="flex justify-between items-center border-b border-stone-100 pb-1">
                            <span className="text-stone-500 font-medium">Diagnostic Code:</span>
                            <span className="font-mono font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                              {diagnosticResult.failureCode || 'ERR_PIN_MISMATCH'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-stone-500">Digits Entered:</span>
                            <span className="font-bold text-stone-900">
                              {diagnosticResult.normalizedLength} / 6 Digits
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-stone-500">Cloud Sync Status:</span>
                            <span className="font-bold text-emerald-700">
                              {diagnosticResult.cloudSyncStatus === 'synced' ? '☁️ Connected to Cloud' : '⚠️ Local Storage Fallback'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action buttons in English */}
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={isCloudSyncing}
                          onClick={handleForceCloudSync}
                          className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-white ${isCloudSyncing ? 'animate-spin' : ''}`} />
                          <span>{isCloudSyncing ? 'Syncing Cloud Credentials...' : '⚡ Sync Cloud Credentials & Retry'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-red-200">
                        <button
                          type="button"
                          onClick={handleCopyDiagnostic}
                          className="text-[11px] text-red-800 hover:text-red-950 font-bold flex items-center space-x-1 cursor-pointer py-1"
                        >
                          {copiedDiagnostic ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-700">Diagnostic Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-red-600" />
                              <span>Copy Diagnostic</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowRepairModal(true)}
                          className="text-[11px] text-red-800 hover:text-red-950 font-bold flex items-center space-x-1 cursor-pointer py-1"
                        >
                          <Wrench className="w-3.5 h-3.5 text-red-600" />
                          <span>Repair Storage</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Virtual PIN Keypad for Admin */}
                  <div className="pt-1">
                    <PinKeypad
                      pin={pinCode}
                      onChange={(newPin) => {
                        setPinCode(newPin);
                        if (errorMsg) setErrorMsg('');
                        if (diagnosticResult) setDiagnosticResult(null);
                      }}
                      onSubmit={(fullPin) => handleAdminLogin(fullPin || pinCode)}
                      maxLength={6}
                      disabled={loading || isCloudSyncing}
                      error={!!errorMsg}
                      autoSubmitOnComplete={true}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdminLogin(pinCode)}
                    disabled={loading || isCloudSyncing || pinCode.length < 4}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying PIN...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 text-white" />
                        <span>Unlock Admin Dashboard</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* MODE C: SUPERADMIN OWNER LOGIN (PIN ONLY + VIRTUAL KEYPAD) */}
              {portalMode === 'superadmin' && (
                <div className="space-y-4 pt-1">
                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-xs text-stone-900 space-y-1">
                    <p className="font-bold flex items-center space-x-1.5 text-emerald-900">
                      <Crown className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>SUPERADMIN ACCESS</span>
                    </p>
                  </div>

                  {/* English Diagnostic Report Panel on Failure */}
                  {errorMsg && (
                    <div className="p-3.5 bg-red-50/90 border-2 border-red-300 rounded-2xl text-red-950 text-xs space-y-2.5 shadow-sm">
                      <div className="flex items-start space-x-2">
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-red-900 uppercase tracking-wide text-[11px]">
                            Authentication Failed
                          </p>
                          <p className="text-xs text-red-800 font-sans font-medium mt-0.5 leading-relaxed">
                            {errorMsg}
                          </p>
                        </div>
                      </div>

                      {diagnosticResult && (
                        <div className="bg-white p-2.5 rounded-xl border border-red-200 text-[11px] font-sans space-y-1.5 text-stone-800">
                          <div className="flex justify-between items-center border-b border-stone-100 pb-1">
                            <span className="text-stone-500 font-medium">Diagnostic Code:</span>
                            <span className="font-mono font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                              {diagnosticResult.failureCode || 'ERR_PIN_MISMATCH'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-stone-500">Digits Entered:</span>
                            <span className="font-bold text-stone-900">
                              {diagnosticResult.normalizedLength} / 6 Digits
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-stone-500">Cloud Sync Status:</span>
                            <span className="font-bold text-emerald-700">
                              {diagnosticResult.cloudSyncStatus === 'synced' ? '☁️ Connected to Cloud' : '⚠️ Local Storage Fallback'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action buttons in English */}
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={isCloudSyncing}
                          onClick={handleForceCloudSync}
                          className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-white ${isCloudSyncing ? 'animate-spin' : ''}`} />
                          <span>{isCloudSyncing ? 'Syncing Cloud Credentials...' : '⚡ Sync Cloud Credentials & Retry'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-red-200">
                        <button
                          type="button"
                          onClick={handleCopyDiagnostic}
                          className="text-[11px] text-red-800 hover:text-red-950 font-bold flex items-center space-x-1 cursor-pointer py-1"
                        >
                          {copiedDiagnostic ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-700">Diagnostic Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-red-600" />
                              <span>Copy Diagnostic</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowRepairModal(true)}
                          className="text-[11px] text-red-800 hover:text-red-950 font-bold flex items-center space-x-1 cursor-pointer py-1"
                        >
                          <Wrench className="w-3.5 h-3.5 text-red-600" />
                          <span>Repair Storage</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Virtual PIN Keypad for SuperAdmin */}
                  <div className="pt-1">
                    <PinKeypad
                      pin={pinCode}
                      onChange={(newPin) => {
                        setPinCode(newPin);
                        if (errorMsg) setErrorMsg('');
                        if (diagnosticResult) setDiagnosticResult(null);
                      }}
                      onSubmit={(fullPin) => handleAdminLogin(fullPin || pinCode)}
                      maxLength={6}
                      disabled={loading || isCloudSyncing}
                      error={!!errorMsg}
                      autoSubmitOnComplete={true}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdminLogin(pinCode)}
                    disabled={loading || isCloudSyncing || pinCode.length < 4}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying PIN...</span>
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4 text-white" />
                        <span>Unlock SuperAdmin</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Modal Persistent Repair & Diagnostics Footer */}
              <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowRepairModal(true)}
                  className="text-xs text-stone-600 hover:text-stone-900 font-sans font-medium flex items-center space-x-1.5 py-1.5 px-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{lang === 'my' ? '🛠️ ပြုပြင်ရန်' : '🛠️ Fix Login / Clear Cache'}</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1-Click Database & Cache Repair Modal */}
      <RepairDatabaseModal
        isOpen={showRepairModal}
        onClose={() => setShowRepairModal(false)}
        lang={lang === 'my' ? 'my' : 'en'}
        onRepaired={async () => {
          await syncLatestCredentialsFromCloud();
        }}
      />

    </div>
  );
};
