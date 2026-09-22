import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  Scissors,
  Check,
  X,
  LogOut,
  Edit3,
  Save,
  Star,
  RefreshCw,
  Bell,
  Globe
} from 'lucide-react';
import { Language } from '../data/i18n';
import { Designer, Service } from '../types';
import { api } from '../api/client';
import { motion } from 'motion/react';

export interface UserProfileData {
  name: string;
  phone: string;
  email: string;
  preferredBarberId?: string;
  preferredBarberName?: string;
  favoriteService?: string;
  memberTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  points: number;
  joinedDate: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  designers: Designer[];
  services: Service[];
  unreadNotifsCount?: number;
  onSelectLang?: (lang: Language) => void;
  onOpenNotifications?: () => void;
  onSwitchPortal?: () => void;
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

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  lang,
  designers,
  services,
  unreadNotifsCount = 0,
  onSelectLang,
  onOpenNotifications,
  onSwitchPortal,
  onProfileUpdate,
}) => {
  const [profile, setProfile] = useState<UserProfileData>(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('baba_user_profile_v1');
        if (stored) {
          setProfile(JSON.parse(stored));
        } else {
          setProfile(DEFAULT_PROFILE);
        }
      } catch {
        setProfile(DEFAULT_PROFILE);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name && !profile.phone) return;

    setIsSaving(true);
    setSyncMessage(null);

    try {
      const res = await api.syncOrLinkClientAccount({
        name: profile.name.trim() || 'Guest Client',
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

  const handleClearAccount = () => {
    if (window.confirm(lang === 'my' ? 'သင်၏ အကောင့်အချက်အလက်များကို ထွက်ပြီး ပြန်လည် ဖျက်ထုတ်ပါမည်လား။' : 'Are you sure you want to reset profile?')) {
      localStorage.removeItem('baba_user_profile_v1');
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
      setIsEditing(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        
        {/* Modal Header */}
        <div className="p-4 px-5 bg-white border-b border-emerald-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-sm shadow-xs">
              {profile.name ? profile.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider font-mono">
                {lang === 'my' ? 'ပရိုဖိုင်နှင့် ဆက်တင်များ' : 'Profile & Settings'}
              </h3>
              <p className="text-[11px] text-stone-500 font-mono">
                {profile.phone || '0000000000'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {onSelectLang && (
              <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-[11px] font-mono font-bold mr-1">
                <button
                  onClick={() => onSelectLang('en')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    lang === 'en' ? 'bg-emerald-700 text-white' : 'text-stone-600'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => onSelectLang('my')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    lang === 'my' ? 'bg-emerald-700 text-white' : 'text-stone-600'
                  }`}
                >
                  MY
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-950 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">

          {/* Quick Actions (Notifications / Logout) */}
          {(onOpenNotifications || onSwitchPortal) && (
            <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
              <span className="text-xs font-mono font-bold text-stone-600 uppercase">Quick Actions</span>
              <div className="flex items-center space-x-2">
                {onOpenNotifications && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenNotifications();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-900 hover:bg-emerald-50 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Alerts {unreadNotifsCount > 0 ? `(${unreadNotifsCount})` : ''}</span>
                  </button>
                )}
                {onSwitchPortal && (
                  <button
                    onClick={() => {
                      onClose();
                      onSwitchPortal();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-900 hover:bg-emerald-50 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Exit</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-700 text-white text-xs font-bold flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>{lang === 'my' ? 'အကောင့် အချက်အလက်များ အောင်မြင်စွာ သိမ်းဆည်းလိုက်ပါပြီ။' : 'Profile updated successfully.'}</span>
              </div>
              {syncMessage && (
                <p className="text-[11px] text-emerald-100 pl-6 font-mono font-normal">
                  {syncMessage}
                </p>
              )}
            </div>
          )}

          {/* Light Theme Emerald Member Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 text-stone-900 border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-800 uppercase font-mono font-bold block">VIP Member</span>
                <span className="text-sm font-black text-stone-900">{profile.name || 'Valued Client'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-800 uppercase font-mono font-bold block">Points</span>
                <span className="text-sm font-black font-mono text-emerald-700 flex items-center justify-end space-x-1">
                  <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                  <span>{profile.points} PTS</span>
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          {!isEditing && profile.name ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Name</span>
                  <span className="font-bold text-stone-950">{profile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Phone</span>
                  <span className="font-bold font-mono text-stone-950">{profile.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Stylist</span>
                  <span className="font-bold text-stone-950">{profile.preferredBarberName}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAccount}
                  className="py-2.5 px-3 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 font-bold text-xs cursor-pointer border border-stone-200"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono font-bold text-stone-500 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ko Htet"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-950 text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-stone-500 uppercase mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0000000000"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-950 font-mono text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-stone-500 uppercase mb-1">
                  Preferred Stylist
                </label>
                <select
                  value={profile.preferredBarberName}
                  onChange={(e) => setProfile({ ...profile, preferredBarberName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-950 text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                >
                  <option value="မည်သူမဆို ရရှိနိုင်သူ (Any Stylist)">Any Stylist</option>
                  {designers.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.title})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs flex items-center justify-center space-x-1.5"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                {profile.name && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="py-2.5 px-3 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs cursor-pointer border border-stone-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

        </div>

      </motion.div>
    </div>
  );
};
