import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Phone,
  Mail,
  Scissors,
  Sparkles,
  Award,
  Check,
  LogOut,
  Edit3,
  Save,
  Gift,
  Star,
  RefreshCw,
  Bell,
  Globe,
  ChevronRight,
  Shield,
  Key,
  Copy,
  CheckCircle2,
  Volume2,
  Camera,
  Upload
} from 'lucide-react';
import { Language, translations } from '../data/i18n';
import { Designer, Service, UserRole } from '../types';
import { api } from '../api/client';
import { getTierConfig, calculateTierFromPoints } from '../utils/tierStyles';
import {
  getClientSession,
  saveClientSession,
  ClientTokenPayload,
  CLIENT_AUTH_TOKEN_KEY
} from '../lib/authCrypto';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendLocalPushNotification,
  playAudioChime
} from '../utils/notifications';
import { motion } from 'motion/react';
import { ImageCropModal } from './ImageCropModal';

export interface UserProfileData {
  name: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  photoBonusClaimed?: boolean;
  preferredBarberId?: string;
  preferredBarberName?: string;
  favoriteService?: string;
  memberTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  points: number;
  joinedDate: string;
}

interface UserProfileViewProps {
  lang: Language;
  role: UserRole;
  designers: Designer[];
  services: Service[];
  unreadNotifsCount: number;
  onSelectLang: (lang: Language) => void;
  onOpenNotifications: () => void;
  onSwitchPortal: () => void;
  onViewBookings?: () => void;
  onProfileUpdate?: (profile: UserProfileData) => void;
}

const DEFAULT_PROFILE: UserProfileData = {
  name: '',
  phone: '',
  email: '',
  preferredBarberId: '',
  preferredBarberName: 'မည်သူမဆို ရရှိနိုင်သူ (Any Stylist)',
  favoriteService: '',
  memberTier: 'Gold',
  points: 1500,
  joinedDate: new Date().toISOString().split('T')[0],
};

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  lang,
  role,
  designers,
  services,
  unreadNotifsCount,
  onSelectLang,
  onOpenNotifications,
  onSwitchPortal,
  onViewBookings,
  onProfileUpdate,
}) => {
  const t = translations[lang];

  const [profile, setProfile] = useState<UserProfileData>(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Client Token Session state
  const [clientSession, setClientSession] = useState<ClientTokenPayload | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Photo Upload & Points Bonus State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoBonusMsg, setPhotoBonusMsg] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageForCrop, setRawImageForCrop] = useState<string>('');

  // Web Push Notification State
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [pushTesting, setPushTesting] = useState(false);

  // Active Tier Style Config
  const tierConfig = getTierConfig(profile.memberTier);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('baba_user_profile_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        setProfile({
          ...DEFAULT_PROFILE,
          ...parsed,
          memberTier: calculateTierFromPoints(parsed.points || 0),
        });
      } else {
        setProfile(DEFAULT_PROFILE);
      }
    } catch {
      setProfile(DEFAULT_PROFILE);
    }

    // Load or create client auth token session
    let sess = getClientSession();
    if (!sess) {
      saveClientSession({
        memberTier: 'Bronze',
        points: 500,
      });
      sess = getClientSession();
    }
    setClientSession(sess);
    setPushStatus(getNotificationPermissionStatus());

    // Subscribe to client account updates in real-time
    const unsubscribe = api.subscribeToClients((clients) => {
      try {
        const currentStored = localStorage.getItem('baba_user_profile_v1');
        const currentPhone = currentStored ? JSON.parse(currentStored).phone : '';
        if (currentPhone) {
          const match = clients.find((c) => {
            const p1 = c.phone.replace(/[^0-9]/g, '');
            const p2 = currentPhone.replace(/[^0-9]/g, '');
            return p1 === p2 || p1.endsWith(p2) || p2.endsWith(p1);
          });
          if (match) {
            setProfile((prev) => {
              const calcTier = calculateTierFromPoints(match.points);
              const updated: UserProfileData = {
                ...prev,
                name: match.name,
                phone: match.phone,
                email: match.email || prev.email || '',
                avatarUrl: match.avatarUrl || prev.avatarUrl || '',
                photoBonusClaimed: match.photoBonusClaimed ?? prev.photoBonusClaimed ?? false,
                memberTier: calcTier,
                points: match.points,
                joinedDate: match.joinedDate,
              };
              localStorage.setItem('baba_user_profile_v1', JSON.stringify(updated));
              saveClientSession({
                name: match.name,
                phone: match.phone,
                memberTier: calcTier,
                points: match.points,
              });
              setClientSession(getClientSession());
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('Real-time profile sync err:', err);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name && !profile.phone) return;

    setIsSaving(true);
    setSyncMessage(null);

    try {
      // 1-second spring loading feedback
      await new Promise((r) => setTimeout(r, 950));

      const res = await api.syncOrLinkClientAccount({
        name: profile.name.trim() || 'Valued Guest',
        phone: profile.phone.trim() || '0000000000',
        email: profile.email.trim(),
        preferredBarberName: profile.preferredBarberName,
        source: 'client_app',
      });

      const updatedData: UserProfileData = {
        ...profile,
        name: res.client.name,
        phone: res.client.phone,
        email: res.client.email || '',
        memberTier: res.client.memberTier,
        points: res.client.points,
        joinedDate: res.client.joinedDate,
      };

      setProfile(updatedData);
      localStorage.setItem('baba_user_profile_v1', JSON.stringify(updatedData));
      
      // Update authenticated client token session
      saveClientSession({
        name: res.client.name,
        phone: res.client.phone,
        memberTier: res.client.memberTier,
        points: res.client.points,
      });
      setClientSession(getClientSession());

      setSyncMessage(res.message);
      setSavedSuccess(true);
      setIsEditing(false);

      if (onProfileUpdate) onProfileUpdate(updatedData);

      setTimeout(() => {
        setSavedSuccess(false);
        setSyncMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to sync profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!profile.phone || profile.phone === '0000000000') {
      alert(lang === 'my' ? 'ကျေးဇူးပြု၍ ဖုန်းနံပါတ် အရင် ဖြည့်သွင်းပြီး သိမ်းဆည်းပေးပါ' : 'Please enter and save your phone number first.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const rawUrl = reader.result as string;
        setRawImageForCrop(rawUrl);
        setCropModalOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('File read error:', err);
    }
  };

  const handleCropComplete = async (croppedCompressedDataUrl: string) => {
    setPhotoUploading(true);
    setPhotoBonusMsg(null);

    try {
      const res = await api.uploadClientAvatarAndAwardPoints(profile.phone, croppedCompressedDataUrl);

      setProfile((prev) => {
        const newPoints = res.newPoints || prev.points;
        const newTier = calculateTierFromPoints(newPoints);
        const updated: UserProfileData = {
          ...prev,
          avatarUrl: croppedCompressedDataUrl,
          photoBonusClaimed: true,
          points: newPoints,
          memberTier: newTier,
        };
        localStorage.setItem('baba_user_profile_v1', JSON.stringify(updated));
        saveClientSession({
          name: updated.name,
          phone: updated.phone,
          memberTier: newTier,
          points: newPoints,
        });
        if (onProfileUpdate) onProfileUpdate(updated);
        return updated;
      });

      setPhotoBonusMsg(res.message);
      playAudioChime();
      setTimeout(() => setPhotoBonusMsg(null), 6000);
    } catch (err: any) {
      console.warn('Photo upload err:', err);
    } finally {
      setPhotoUploading(false);
      setCropModalOpen(false);
      setRawImageForCrop('');
    }
  };

  const handleCopyClientToken = () => {
    const rawToken = localStorage.getItem(CLIENT_AUTH_TOKEN_KEY) || clientSession?.clientId || '';
    if (rawToken && navigator.clipboard) {
      navigator.clipboard.writeText(rawToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission();
    setPushStatus(getNotificationPermissionStatus());
    if (granted) {
      playAudioChime();
      sendLocalPushNotification(
        '🔔 Web Push Active!',
        'Push notifications are enabled for appointment confirmations and salon updates.'
      );
    }
  };

  const handleTestPushNotification = async () => {
    setPushTesting(true);
    playAudioChime();
    await sendLocalPushNotification(
      '✂️ GENTLEMEN Barber Lounge',
      'This is a real Web Push alert! You will receive live appointment updates directly.'
    );
    setTimeout(() => setPushTesting(false), 1000);
  };

  const handleClearAccount = () => {
    if (window.confirm(lang === 'my' ? 'သင်၏ အကောင့်အချက်အလက်များကို ထွက်ပြီး ပြန်လည် ဖျက်ထုတ်ပါမည်လား။' : 'Are you sure you want to reset profile data?')) {
      localStorage.removeItem('baba_user_profile_v1');
      saveClientSession({
        name: 'Guest Client',
        phone: '',
        memberTier: 'Bronze',
        points: 0,
      });
      setProfile({
        name: '',
        phone: '',
        email: '',
        preferredBarberId: '',
        preferredBarberName: '',
        favoriteService: '',
        memberTier: 'Bronze',
        points: 0,
        joinedDate: new Date().toISOString().split('T')[0],
      });
      setClientSession(getClientSession());
      setIsEditing(true);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 font-sans">
      
      {/* Top Profile Header: Actions (Bell, Language, Logout) */}
      <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-stone-950 uppercase tracking-wider font-mono">
            {lang === 'my' ? 'အကောင့်နှင့် ဆက်တင်များ' : 'Account & Settings'}
          </h2>
          <p className="text-xs text-stone-500">
            {lang === 'my' ? 'ဘာသာစကား၊ သတိပေးချက်များနှင့် အကောင့်အချက်အလက်' : 'Manage language, notifications & member profile'}
          </p>
        </div>

        {/* Action Controls Toolbar: Language, Bell, Logout */}
        <div className="flex items-center space-x-2">
          {/* Language Selector */}
          <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-mono font-bold">
            <button
              onClick={() => onSelectLang('en')}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                lang === 'en' ? 'bg-emerald-700 text-white shadow-xs' : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => onSelectLang('my')}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                lang === 'my' ? 'bg-emerald-700 text-white shadow-xs' : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              MY
            </button>
          </div>

          {/* Bell Notifications */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 cursor-pointer transition-all active:scale-95 flex items-center justify-center"
            title={lang === 'my' ? 'သတိပေးချက်များ' : 'Notifications'}
          >
            <Bell className="w-4 h-4 text-stone-900" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-700 text-white font-mono text-[9px] font-bold flex items-center justify-center border-2 border-white">
                {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Logout / Switch Mode */}
          <button
            onClick={onSwitchPortal}
            className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 border border-stone-200 cursor-pointer transition-all active:scale-95 flex items-center space-x-1"
            title={role === 'admin' ? 'Exit Admin' : 'Switch Mode'}
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-bold font-mono hidden sm:inline-block">
              {lang === 'my' ? 'ထွက်ရန်' : 'Exit'}
            </span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {savedSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-900 text-white border border-emerald-800 text-xs flex flex-col space-y-1 shadow-sm"
        >
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="font-bold">
              {lang === 'my' ? 'အကောင့် အချက်အလက်များ အောင်မြင်စွာ သိမ်းဆည်းလိုက်ပါပြီ။' : 'Profile information saved successfully.'}
            </span>
          </div>
          {syncMessage && (
            <p className="text-[11px] text-emerald-100 pl-6 font-mono">
              {syncMessage}
            </p>
          )}
        </motion.div>
      )}

      {/* Photo Upload Royalty Bonus Toast */}
      {photoBonusMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-2xl bg-emerald-700 text-white border border-emerald-600 font-bold text-xs flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-white shrink-0 animate-bounce" />
            <span>{photoBonusMsg}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-200 text-[10px] font-mono">
            +100 PTS
          </span>
        </motion.div>
      )}

      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Member Card - Light Theme Emerald Green Archetype */}
      <div
        className={`p-6 rounded-3xl bg-linear-to-br ${tierConfig.cardBgGradient} text-stone-900 border ${tierConfig.cardBorder} shadow-sm relative overflow-hidden transition-all duration-300`}
        style={{
          boxShadow: `0 8px 24px -6px ${tierConfig.glowColor}`,
        }}
      >
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center space-x-3.5">
            {/* Interactive Avatar with Upload Trigger */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border-2 border-emerald-300/80 overflow-hidden flex items-center justify-center font-black text-xl shadow-xs text-emerald-900">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : profile.name ? (
                  <span className="text-2xl text-emerald-900">{profile.name.charAt(0).toUpperCase()}</span>
                ) : (
                  <User className="w-8 h-8 text-emerald-700" />
                )}
              </div>

              {/* Camera Upload Badge */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                title={lang === 'my' ? 'ပရိုဖိုင် ဓာတ်ပုံ တင်ရန် (+100 Royalty Points ရရှိမည်)' : 'Upload Avatar (+100 Points Bonus)'}
                className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer transition-transform group-hover:scale-110 flex items-center justify-center"
              >
                {photoUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-stone-950">
                  {profile.name || (lang === 'my' ? 'ဧည့်သည် အကောင့်' : 'Guest Member')}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full ${tierConfig.badgeBg} ${tierConfig.badgeText} border ${tierConfig.badgeBorder} font-mono font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1`}>
                  <span>{tierConfig.icon}</span>
                  <span>{profile.memberTier} TIER</span>
                </span>
              </div>
              <p className="text-xs text-stone-600 font-mono mt-0.5 font-medium">
                {profile.phone || '0000000000'}
              </p>

              {/* Photo Bonus Pill Notice */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 text-[10px] font-mono text-emerald-800 hover:text-emerald-950 flex items-center space-x-1 bg-emerald-100/90 hover:bg-emerald-200/90 px-2 py-0.5 rounded-lg w-fit cursor-pointer border border-emerald-200 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-emerald-700" />
                <span>{lang === 'my' ? 'ပုံထည့်ပြီး +100 Points ရယူပါ' : 'Upload photo for +100 PTS'}</span>
              </button>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-mono text-emerald-800 font-bold block tracking-wider">Royalty Club</span>
            <div className="text-lg sm:text-xl font-mono font-black text-emerald-700 flex items-center justify-end space-x-1 mt-0.5">
              <Star className="w-4 h-4 fill-emerald-600 text-emerald-600" />
              <span>{profile.points} PTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real Client Login & Auth Token Card */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-950 font-mono">
                {lang === 'my' ? 'လုံခြုံစိတ်ချရသော Client Auth Token' : 'Client Auth Token & Session'}
              </h3>
              <p className="text-[10px] text-stone-400 font-mono">Cryptographic Local Token Verification</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Active Session</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-mono font-bold text-stone-400 uppercase">Client Token ID</span>
            <div className="font-mono font-bold text-stone-900 text-xs truncate">
              {clientSession?.clientId || 'client_auth_ready'}
            </div>
          </div>

          <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-1">
            <span className="text-[10px] font-mono font-bold text-stone-400 uppercase">Verified Tier & Phone</span>
            <div className="font-mono font-bold text-stone-900 text-xs">
              {profile.memberTier} TIER • {profile.phone || '0000000000'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyClientToken}
            className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-800 text-xs font-bold font-mono flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedToken ? (lang === 'my' ? 'Token ကူးယူပြီး' : 'Copied Token') : (lang === 'my' ? 'Client Token ကူးယူမည်' : 'Copy Auth Token')}</span>
          </button>

          <button
            onClick={() => {
              saveClientSession({
                name: profile.name,
                phone: profile.phone,
                memberTier: profile.memberTier,
                points: profile.points,
              });
              setClientSession(getClientSession());
              alert(lang === 'my' ? 'Client Auth Token အောင်မြင်စွာ Refresh လုပ်ပြီးပါပြီ' : 'Client Auth Token refreshed successfully');
            }}
            className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-800 text-xs font-bold font-mono flex items-center justify-center space-x-1 transition-all cursor-pointer"
            title="Refresh Token"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-700" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Web Push Notification Settings Card */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-950 font-mono">
                {lang === 'my' ? 'Web Push & Service Worker' : 'Web Push Notifications'}
              </h3>
              <p className="text-[10px] text-stone-400 font-mono">FCM & Browser Background Push</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
              pushStatus === 'granted'
                ? 'bg-emerald-100 text-emerald-800'
                : pushStatus === 'denied'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {pushStatus === 'granted'
              ? 'ENABLED (Active)'
              : pushStatus === 'denied'
              ? 'BLOCKED'
              : 'NOT ENABLED'}
          </span>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          {lang === 'my'
            ? 'Web Push Notification ဖွင့်ထားပါက ဆိုင်ဘက်မှ Booking အတည်ပြုချက်များ၊ အချိန်ပြောင်းလဲမှုများနှင့် အထူး Promotion များကို ဖုန်း/Browser သို့ တိုက်ရိုက်ရောက်ရှိစေပါမည်။'
            : 'Enable Web Push alerts to receive instant booking confirmations, queue notifications, and stylist status updates directly on your device.'}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {pushStatus !== 'granted' ? (
            <button
              onClick={handleEnablePush}
              className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 active:scale-98"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{lang === 'my' ? 'Web Push ခွင့်ပြုမည် (Enable Push)' : 'Enable Web Push'}</span>
            </button>
          ) : (
            <button
              onClick={handleTestPushNotification}
              disabled={pushTesting}
              className="py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 active:scale-98 disabled:opacity-50"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{pushTesting ? (lang === 'my' ? 'အသံစမ်းသပ်နေပါသည်...' : 'Testing...') : (lang === 'my' ? 'Push စမ်းသပ်မည် (Test Chime)' : 'Test Web Push')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Details or Edit Form */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-stone-950 font-mono">
            {lang === 'my' ? 'အကောင့် အချက်အလက်များ' : 'Personal Information'}
          </h3>

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold text-xs flex items-center space-x-1.5 cursor-pointer border border-emerald-200 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
              <span>{lang === 'my' ? 'ပြင်ဆင်ရန်' : 'Edit'}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs cursor-pointer"
            >
              {lang === 'my' ? 'မလုပ်တော့ပါ' : 'Cancel'}
            </button>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
              <span className="text-stone-500">{lang === 'my' ? 'အမည်' : 'Full Name'}</span>
              <span className="font-bold text-stone-950">{profile.name || 'Guest Client'}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
              <span className="text-stone-500">{lang === 'my' ? 'ဖုန်းနံပါတ်' : 'Phone Number'}</span>
              <span className="font-bold font-mono text-stone-950">{profile.phone || '0000000000'}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
              <span className="text-stone-500">{lang === 'my' ? 'အီးမေးလ်' : 'Email Address'}</span>
              <span className="font-bold text-stone-950">{profile.email || (lang === 'my' ? 'မဖြည့်ရသေးပါ' : 'Not set')}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
              <span className="text-stone-500">{lang === 'my' ? 'ကြိုက်နှစ်သက်သော ဆံသပညာရှင်' : 'Preferred Stylist'}</span>
              <span className="font-bold text-stone-950">{profile.preferredBarberName || 'Any Stylist'}</span>
            </div>

            {onViewBookings && (
              <button
                onClick={onViewBookings}
                className="w-full py-3.5 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer transition-all mt-3"
              >
                <span>{lang === 'my' ? 'ကျွန်ုပ်၏ ဘိုကင်များ ကြည့်ရန်' : 'View My Appointments'}</span>
                <ChevronRight className="w-4 h-4 text-emerald-700" />
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-bold text-stone-500 uppercase mb-1">
                {lang === 'my' ? 'အမည် (Full Name)' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ko Htet"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-950 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold text-stone-500 uppercase mb-1">
                {lang === 'my' ? 'ဖုန်းနံပါတ် (Phone Number)' : 'Phone Number'}
              </label>
              <input
                type="tel"
                required
                placeholder="0000000000"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-950 font-mono focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold text-stone-500 uppercase mb-1">
                {lang === 'my' ? 'အီးမေးလ် (Email Address - Optional)' : 'Email Address (Optional)'}
              </label>
              <input
                type="email"
                placeholder="client@gmail.com"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-950 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold text-stone-500 uppercase mb-1">
                {lang === 'my' ? 'ကြိုက်နှစ်သက်သော ဆံသပညာရှင် (Preferred Stylist)' : 'Preferred Stylist'}
              </label>
              <select
                value={profile.preferredBarberName}
                onChange={(e) => setProfile({ ...profile, preferredBarberName: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-950 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              >
                <option value="မည်သူမဆို ရရှိနိုင်သူ (Any Stylist)">
                  {lang === 'my' ? 'မည်သူမဆို ရရှိနိုင်သူ (Any Stylist)' : 'Any Stylist (Fastest Available)'}
                </option>
                {designers.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name} ({d.title})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? (lang === 'my' ? 'သိမ်းဆည်းနေပါသည်...' : 'Saving...') : (lang === 'my' ? 'သိမ်းဆည်းမည်' : 'Save Profile')}</span>
              </button>

              <button
                type="button"
                onClick={handleClearAccount}
                className="py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs cursor-pointer border border-stone-200"
              >
                {lang === 'my' ? 'အချက်အလက် ရှင်းရန်' : 'Reset'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Interactive Photo Crop & Auto-Compression Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageForCrop}
        onClose={() => {
          setCropModalOpen(false);
          setRawImageForCrop('');
        }}
        onCropComplete={handleCropComplete}
        title={lang === 'my' ? 'ပရိုဖိုင် ဓာတ်ပုံ နေရာညှိပြီး ချုံ့သိမ်းမည် (+100 PTS)' : 'Crop & Auto-Compress Profile Photo (+100 PTS)'}
        cropShape="circle"
        outputSize={512}
      />

    </div>
  );
};
