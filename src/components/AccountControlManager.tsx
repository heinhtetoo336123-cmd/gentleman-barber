import React, { useState } from 'react';
import { Designer } from '../types';
import { api } from '../api/client';
import {
  ADMIN_USERNAME,
  SUPERADMIN_USERNAME,
  getAdminCredentials,
  saveAdminCredentials,
  getSuperAdminCredentials,
  saveSuperAdminCredentials,
  verifyAdminOldPassword,
  verifySuperAdminOldPassword,
  verifySuperAdminPassword,
} from '../lib/authCrypto';
import { playSuccessChime } from '../utils/audio';
import {
  Shield,
  KeyRound,
  Phone,
  UserCheck,
  UserX,
  Edit2,
  Check,
  Copy,
  Plus,
  Lock,
  Eye,
  EyeOff,
  Scissors,
  Sparkles,
  AlertCircle,
  Percent,
  RefreshCw,
  Crown,
  CheckCircle2,
  Key,
  ShieldCheck,
  Sliders,
  Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AccountControlManagerProps {
  designers: Designer[];
  onRefresh: () => void;
  role?: 'admin' | 'superadmin';
}

export const AccountControlManager: React.FC<AccountControlManagerProps> = ({
  designers,
  onRefresh,
  role = 'admin',
}) => {
  const isSuperAdmin = role === 'superadmin';

  // Live credentials state
  const [adminCreds, setAdminCreds] = useState(() => getAdminCredentials());
  const [superAdminCreds, setSuperAdminCreds] = useState(() => getSuperAdminCredentials());

  // PIN visibility state
  const [visibleBarberPins, setVisibleBarberPins] = useState<Record<string, boolean>>({});
  const [isAdminPinVisible, setIsAdminPinVisible] = useState(false);
  const [isSuperAdminPinVisible, setIsSuperAdminPinVisible] = useState(false);

  // SuperAdmin PIN password unlock modal
  const [isSuperPinUnlockModalOpen, setIsSuperPinUnlockModalOpen] = useState(false);
  const [superUnlockPassword, setSuperUnlockPassword] = useState('');
  const [superUnlockError, setSuperUnlockError] = useState('');

  // Edit Admin Security Modal
  const [isEditAdminModalOpen, setIsEditAdminModalOpen] = useState(false);
  const [adminOldPass, setAdminOldPass] = useState('');
  const [adminNewPin, setAdminNewPin] = useState('');
  const [adminNewPass, setAdminNewPass] = useState('');
  const [adminConfirmPass, setAdminConfirmPass] = useState('');
  const [showAdminOldPass, setShowAdminOldPass] = useState(false);
  const [showAdminNewPass, setShowAdminNewPass] = useState(false);
  const [showAdminConfirmPass, setShowAdminConfirmPass] = useState(false);
  const [adminModalError, setAdminModalError] = useState('');
  const [isAdminModalSaving, setIsAdminModalSaving] = useState(false);

  // Edit SuperAdmin Security Modal
  const [isEditSuperAdminModalOpen, setIsEditSuperAdminModalOpen] = useState(false);
  const [superOldPass, setSuperOldPass] = useState('');
  const [superNewPin, setSuperNewPin] = useState('');
  const [superNewPass, setSuperNewPass] = useState('');
  const [superConfirmPass, setSuperConfirmPass] = useState('');
  const [showSuperOldPass, setShowSuperOldPass] = useState(false);
  const [showSuperNewPass, setShowSuperNewPass] = useState(false);
  const [showSuperConfirmPass, setShowSuperConfirmPass] = useState(false);
  const [superModalError, setSuperModalError] = useState('');
  const [isSuperModalSaving, setIsSuperModalSaving] = useState(false);

  // Edit Barber Modal
  const [editingDesigner, setEditingDesigner] = useState<Designer | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [commissionInput, setCommissionInput] = useState(50);
  const [activeInput, setActiveInput] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New Barber Modal
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('Barber Stylist');
  const [newPhone, setNewPhone] = useState('09');
  const [newPin, setNewPin] = useState('1234');
  const [newCommission, setNewCommission] = useState(50);
  const [newAvatar, setNewAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400');
  const [isCreating, setIsCreating] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const refreshLocalCreds = () => {
    setAdminCreds(getAdminCredentials());
    setSuperAdminCreds(getSuperAdminCredentials());
  };

  const toggleBarberPinVisibility = (id: string) => {
    setVisibleBarberPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Handle clicking the SuperAdmin PIN eye icon
  const handleSuperAdminPinToggle = () => {
    if (isSuperAdminPinVisible) {
      // Hide immediately
      setIsSuperAdminPinVisible(false);
    } else {
      // Require password confirmation before revealing
      setSuperUnlockPassword('');
      setSuperUnlockError('');
      setIsSuperPinUnlockModalOpen(true);
    }
  };

  // Unlock SuperAdmin PIN after entering password
  const handleConfirmSuperPinUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySuperAdminPassword(superUnlockPassword)) {
      setIsSuperAdminPinVisible(true);
      setIsSuperPinUnlockModalOpen(false);
      playSuccessChime();
      showToast('🔓 SuperAdmin PIN ကုဒ်ကို ဖော်ပြပေးလိုက်ပါပြီ');
    } else {
      setSuperUnlockError('စကားဝှက် (Password) မှားယွင်းနေပါသည်');
    }
  };

  // Save Admin PIN / Password changes
  const handleSaveAdminSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminModalError('');

    // If not superadmin, verify old admin password
    if (!isSuperAdmin) {
      if (!verifyAdminOldPassword(adminOldPass)) {
        setAdminModalError('လက်ရှိ Admin Password (Old Password) မှားယွင်းနေပါသည်');
        return;
      }
    }

    if (adminNewPin && (adminNewPin.length < 4 || adminNewPin.length > 8)) {
      setAdminModalError('PIN ကုဒ်သည် ဂဏန်း ၄ လုံးမှ ၈ လုံးအတွင်း ဖြစ်ရပါမည်');
      return;
    }

    if (adminNewPass.trim()) {
      if (adminNewPass.trim().length < 4) {
        setAdminModalError('Password အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
        return;
      }
      if (adminNewPass.trim() !== adminConfirmPass.trim()) {
        setAdminModalError('Password အသစ် နှစ်ကြိမ် ရိုက်ထည့်မှု မတူညီပါ (Passwords do not match)');
        return;
      }
    }

    if (!adminNewPin.trim() && !adminNewPass.trim()) {
      setAdminModalError('ကျေးဇူးပြု၍ ပြောင်းလဲမည့် PIN သို့မဟုတ် Password အသစ် ထည့်သွင်းပေးပါ');
      return;
    }

    setIsAdminModalSaving(true);
    try {
      const updates: any = {};
      if (adminNewPin.trim()) updates.pin = adminNewPin.trim();
      if (adminNewPass.trim()) updates.password = adminNewPass.trim();

      await saveAdminCredentials(updates);
      refreshLocalCreds();
      playSuccessChime();
      showToast('✅ Admin PIN / Password အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ');
      setIsEditAdminModalOpen(false);
      setAdminOldPass('');
      setAdminNewPin('');
      setAdminNewPass('');
      setAdminConfirmPass('');
    } catch (err) {
      setAdminModalError('ပြင်ဆင်မှု မအောင်မြင်ပါ');
    } finally {
      setIsAdminModalSaving(false);
    }
  };

  // Save SuperAdmin PIN / Password changes
  const handleSaveSuperAdminSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuperModalError('');

    if (!verifySuperAdminOldPassword(superOldPass)) {
      setSuperModalError('လက်ရှိ SuperAdmin Password မှားယွင်းနေပါသည်');
      return;
    }

    if (superNewPin && (superNewPin.length < 4 || superNewPin.length > 8)) {
      setSuperModalError('PIN ကုဒ်သည် ဂဏန်း ၄ လုံးမှ ၈ လုံးအတွင်း ဖြစ်ရပါမည်');
      return;
    }

    if (superNewPass.trim()) {
      if (superNewPass.trim().length < 4) {
        setSuperModalError('Password အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်');
        return;
      }
      if (superNewPass.trim() !== superConfirmPass.trim()) {
        setSuperModalError('Password အသစ် နှစ်ကြိမ် ရိုက်ထည့်မှု မတူညီပါ (Passwords do not match)');
        return;
      }
    }

    if (!superNewPin.trim() && !superNewPass.trim()) {
      setSuperModalError('ကျေးဇူးပြု၍ ပြောင်းလဲမည့် PIN သို့မဟုတ် Password အသစ် ထည့်သွင်းပေးပါ');
      return;
    }

    setIsSuperModalSaving(true);
    try {
      const updates: any = {};
      if (superNewPin.trim()) updates.pin = superNewPin.trim();
      if (superNewPass.trim()) updates.password = superNewPass.trim();

      await saveSuperAdminCredentials(updates);
      refreshLocalCreds();
      playSuccessChime();
      showToast('👑 SuperAdmin PIN & Password အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ');
      setIsEditSuperAdminModalOpen(false);
      setSuperOldPass('');
      setSuperNewPin('');
      setSuperNewPass('');
      setSuperConfirmPass('');
    } catch (err) {
      setSuperModalError('ပြင်ဆင်မှု မအောင်မြင်ပါ');
    } finally {
      setIsSuperModalSaving(false);
    }
  };

  const handleOpenEditBarber = (designer: Designer) => {
    setEditingDesigner(designer);
    setPhoneInput(designer.phone || '09000000000');
    setPinInput(designer.loginPin || '1234');
    setCommissionInput(designer.commissionPercent ?? 50);
    setActiveInput(designer.active !== false);
  };

  const handleSaveBarberCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDesigner) return;
    setIsSaving(true);
    try {
      await api.updateBarberCredentials(
        editingDesigner.id,
        phoneInput.trim(),
        pinInput.trim() || '1234',
        commissionInput,
        activeInput
      );
      playSuccessChime();
      showToast(`✅ ${editingDesigner.name} ၏ Phone PIN အကောင့် အချက်အလက် အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ`);
      setEditingDesigner(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast('❌ အချက်အလက် ပြင်ဆင်မှု မအောင်မြင်ပါ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await api.addDesigner({
        name: newName.trim(),
        title: newTitle.trim(),
        phone: newPhone.trim(),
        loginPin: newPin.trim() || '1234',
        commissionPercent: Number(newCommission) || 50,
        avatarUrl: newAvatar,
        active: true,
        experienceYears: 5,
      });
      playSuccessChime();
      showToast(`🎉 Barber ${newName} အကောင့်အသစ် ဖန်တီးပြီးပါပြီ!`);
      setIsAddingNew(false);
      setNewName('');
      setNewPhone('09');
      setNewPin('1234');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCredentials = (designer: Designer) => {
    const text = `💈 GENTLEMEN BARBER STAFF LOGIN\nBarber: ${designer.name}\n📞 Phone: ${designer.phone || '09000000000'}\n🔑 Login PIN: ${designer.loginPin || '1234'}\nCommission: ${designer.commissionPercent ?? 50}%\nLink: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    playSuccessChime();
    showToast(`📋 ${designer.name} ၏ Login အချက်အလက်များကို Copy ကူးယူပြီးပါပြီ`);
  };

  const activeBarbersCount = designers.filter((d) => d.active !== false).length;
  const disabledBarbersCount = designers.filter((d) => d.active === false).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-5 font-sans"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-stone-900 text-stone-100 border border-stone-800 font-mono text-xs flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="text-stone-400 hover:text-white text-xs cursor-pointer ml-3">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner - Calm & Compact */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">
                Staff & Security Credentials
              </h2>
              <p className="text-xs text-stone-500">
                Barber, Admin နှင့် SuperAdmin PIN များအား စီမံခန့်ခွဲခြင်းနှင့် လုံခြုံရေး စနစ်
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs flex items-center space-x-1.5 shrink-0 self-stretch sm:self-auto justify-center active:scale-98"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Add Barber</span>
          </button>
        </div>

        {/* Quick Stats Pill Line */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-2 border-t border-stone-100">
          <div className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 flex items-center justify-between">
            <span className="text-stone-500 text-[11px]">Total Barbers</span>
            <span className="font-bold text-stone-900 text-sm">{designers.length}</span>
          </div>
          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60 flex items-center justify-between">
            <span className="text-emerald-700 text-[11px]">Active</span>
            <span className="font-bold text-emerald-900 text-sm">{activeBarbersCount}</span>
          </div>
          <div className="bg-stone-50/80 p-2.5 rounded-xl border border-stone-200/60 flex items-center justify-between">
            <span className="text-stone-500 text-[11px]">Disabled</span>
            <span className="font-bold text-stone-700 text-sm">{disabledBarbersCount}</span>
          </div>
          <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60 flex items-center justify-between">
            <span className="text-emerald-800 text-[11px]">Role</span>
            <span className="font-bold text-emerald-950 text-xs uppercase">{isSuperAdmin ? '👑 SuperAdmin' : '🛡️ Admin'}</span>
          </div>
        </div>
      </div>

      {/* Security Credentials Vault Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 1. ADMIN CREDENTIALS CARD */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-800 flex items-center justify-center">
                <Shield className="w-4 h-4 text-stone-700" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">
                  Admin Credentials
                </h3>
                <span className="text-[10px] text-stone-500">
                  {isSuperAdmin ? '👑 SuperAdmin can view & manage Admin PIN' : 'Shop Management Access'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setAdminOldPass('');
                setAdminNewPin(adminCreds.pin);
                setAdminNewPass('');
                setAdminConfirmPass('');
                setShowAdminOldPass(false);
                setShowAdminNewPass(false);
                setShowAdminConfirmPass(false);
                setAdminModalError('');
                setIsEditAdminModalOpen(true);
              }}
              className="text-[11px] font-mono font-medium px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-stone-600" />
              <span>Change PIN / Password</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
            {/* Admin PIN Block */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
              <span className="text-stone-500 text-[10px] uppercase block">Admin PIN:</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-900 tracking-wider">
                  {/* SuperAdmin can see Admin PIN directly without password requirement */}
                  {isSuperAdmin || isAdminPinVisible ? adminCreds.pin : '••••••'}
                </span>
                {!isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsAdminPinVisible(!isAdminPinVisible)}
                    className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
                    title={isAdminPinVisible ? 'Hide PIN' : 'Show PIN'}
                  >
                    {isAdminPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-stone-500" />}
                  </button>
                )}
                {isSuperAdmin && (
                  <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded font-sans">
                    Visible to Owner
                  </span>
                )}
              </div>
            </div>

            {/* Admin Username Block */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
              <span className="text-stone-500 text-[10px] uppercase block">Username:</span>
              <p className="text-sm font-bold text-stone-900">{adminCreds.username}</p>
            </div>
          </div>
        </motion.div>

        {/* 2. SUPERADMIN CREDENTIALS CARD */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="bg-gradient-to-br from-emerald-50/60 via-stone-50 to-emerald-50/30 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950 font-mono flex items-center space-x-1">
                  <span>SuperAdmin Master</span>
                </h3>
                <span className="text-[10px] text-emerald-800">
                  Password-protected Master PIN
                </span>
              </div>
            </div>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setSuperOldPass('');
                  setSuperNewPin(superAdminCreds.pin);
                  setSuperNewPass('');
                  setSuperConfirmPass('');
                  setShowSuperOldPass(false);
                  setShowSuperNewPass(false);
                  setShowSuperConfirmPass(false);
                  setSuperModalError('');
                  setIsEditSuperAdminModalOpen(true);
                }}
                className="text-[11px] font-mono font-medium px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-950 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-900" />
                <span>Change PIN / Password</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
            {/* SuperAdmin PIN Block with Password Protection requirement */}
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 space-y-1">
              <span className="text-emerald-900 text-[10px] uppercase block">SuperAdmin PIN:</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-950 tracking-wider">
                  {isSuperAdminPinVisible ? superAdminCreds.pin : '••••••'}
                </span>
                <button
                  type="button"
                  onClick={handleSuperAdminPinToggle}
                  className="text-emerald-800 hover:text-emerald-950 cursor-pointer p-0.5 flex items-center space-x-1"
                  title={isSuperAdminPinVisible ? 'Hide PIN' : 'Enter Password to Reveal PIN'}
                >
                  {isSuperAdminPinVisible ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <span className="flex items-center space-x-0.5 text-[10px] font-sans font-medium text-emerald-800 hover:text-emerald-950">
                      <Lock className="w-3 h-3 text-emerald-700" />
                      <span>Reveal</span>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* SuperAdmin Username Block */}
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 space-y-1">
              <span className="text-emerald-900 text-[10px] uppercase block">Username:</span>
              <p className="text-sm font-bold text-emerald-950">{superAdminCreds.username}</p>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Barbers Phone & PIN Accounts Section */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <Scissors className="w-4 h-4 text-emerald-600 transform -rotate-45" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">
              Barber Staff Accounts ({designers.length})
            </h3>
          </div>
          <span className="text-[11px] text-stone-500 font-mono">
            {isSuperAdmin || role === 'admin' ? 'Admin can view & edit all Barber PINs' : ''}
          </span>
        </div>

        {/* Barber Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {designers.map((designer) => {
            const isActive = designer.active !== false;
            const phone = designer.phone || '09000000000';
            const pin = designer.loginPin || '1234';
            const isPinVisible = visibleBarberPins[designer.id] || false;

            return (
              <motion.div
                key={designer.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`rounded-xl border p-3.5 transition-all space-y-2.5 ${
                  isActive
                    ? 'bg-stone-50/50 border-stone-200/80 hover:bg-white hover:border-stone-300'
                    : 'bg-rose-50/20 border-rose-200/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="relative">
                      <img
                        src={designer.avatarUrl}
                        alt={designer.name}
                        referrerPolicy="no-referrer"
                        className={`w-10 h-10 rounded-lg object-cover border bg-stone-100 shrink-0 ${
                          isActive ? 'border-stone-200' : 'border-rose-300 grayscale'
                        }`}
                      />
                      <span
                        className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          isActive ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-stone-900 font-mono">{designer.name}</h4>
                      <p className="text-[11px] text-stone-500">{designer.title}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-md border ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                {/* Login Phone & PIN Row */}
                <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-stone-200/60 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-stone-500">Phone:</span>
                    <span className="font-medium text-stone-800 text-[11px]">{phone}</span>
                  </div>

                  <div className="flex items-center justify-between border-l border-stone-100 pl-2">
                    <span className="text-[10px] text-stone-500">PIN:</span>
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-emerald-800 tracking-wider text-[11px]">
                        {isPinVisible ? pin : '••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleBarberPinVisibility(designer.id)}
                        className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
                        title={isPinVisible ? 'Hide PIN' : 'Show PIN'}
                      >
                        {isPinVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-stone-500" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(designer)}
                    className="text-stone-500 hover:text-stone-900 font-mono text-[10px] flex items-center space-x-1 p-1 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Login</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditBarber(designer)}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-mono text-[11px] inline-flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-white" />
                    <span>Edit PIN</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: SUPERADMIN PIN UNLOCK PASSWORD CONFIRMATION MODAL               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isSuperPinUnlockModalOpen && (
          <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl font-sans"
            >
              <div className="flex items-center space-x-2.5 border-b border-stone-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">
                    SuperAdmin Verification
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    PIN ကုဒ်အား ကြည့်ရှုရန် SuperAdmin Password ရိုက်ထည့်ပါ
                  </p>
                </div>
              </div>

              <form onSubmit={handleConfirmSuperPinUnlock} className="space-y-3 font-mono text-xs">
                {superUnlockError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>{superUnlockError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-stone-700">
                    SuperAdmin Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showSuperOldPass ? 'text' : 'password'}
                      autoFocus
                      required
                      value={superUnlockPassword}
                      onChange={(e) => setSuperUnlockPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 pr-9 text-stone-900 focus:outline-hidden focus:border-emerald-600 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSuperOldPass(!showSuperOldPass)}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showSuperOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSuperPinUnlockModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                  >
                    <Unlock className="w-3.5 h-3.5 text-white" />
                    <span>Reveal PIN</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT ADMIN PIN & PASSWORD                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditAdminModalOpen && (
          <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-xl font-sans"
            >
              <div className="flex items-center space-x-2.5 border-b border-stone-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">
                    Admin PIN & Password ပြောင်းရန်
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    Admin အကောင့်အတွက် လုံခြုံရေး PIN ကုဒ် နှင့် Password အသစ် သတ်မှတ်ပါ
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveAdminSecurity} className="space-y-3 font-mono text-xs">
                {adminModalError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>{adminModalError}</span>
                  </div>
                )}

                {/* Old password check (not needed if superadmin is performing the update) */}
                {!isSuperAdmin && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-stone-700">
                      Current Admin Password (လက်ရှိ Password):
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminOldPass ? 'text' : 'password'}
                        required
                        value={adminOldPass}
                        onChange={(e) => setAdminOldPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 pr-9 text-stone-900 focus:outline-hidden focus:border-stone-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminOldPass(!showAdminOldPass)}
                        className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        {showAdminOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* New PIN Field */}
                <div className="space-y-1 pt-1 border-t border-stone-100">
                  <label className="block text-[11px] font-bold text-stone-700">
                    New Admin PIN (ဂဏန်း ၄ မှ ၈ လုံး):
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={adminNewPin}
                    onChange={(e) => setAdminNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-stone-900 tracking-widest text-center"
                  />
                </div>

                {/* New Password Field */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700">
                    New Admin Password (Password အသစ်):
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminNewPass ? 'text' : 'password'}
                      value={adminNewPass}
                      onChange={(e) => setAdminNewPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 pr-9 text-stone-900 focus:outline-hidden focus:border-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminNewPass(!showAdminNewPass)}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showAdminNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password Field */}
                {adminNewPass && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-stone-700">
                      Confirm New Password (စကားဝှက် အတည်ပြုပါ):
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminConfirmPass ? 'text' : 'password'}
                        required={Boolean(adminNewPass)}
                        value={adminConfirmPass}
                        onChange={(e) => setAdminConfirmPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 pr-9 text-stone-900 focus:outline-hidden focus:border-stone-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminConfirmPass(!showAdminConfirmPass)}
                        className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        {showAdminConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsEditAdminModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdminModalSaving}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>{isAdminModalSaving ? 'Saving...' : 'Update Admin Security'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT SUPERADMIN PIN & PASSWORD                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditSuperAdminModalOpen && (
          <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-xl font-sans"
            >
              <div className="flex items-center space-x-2.5 border-b border-stone-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950 font-mono">
                    SuperAdmin Master Security ပြောင်းရန်
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    Master Owner PIN နှင့် Password အား ပြင်ဆင်သတ်မှတ်ပါ
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSuperAdminSecurity} className="space-y-3 font-mono text-xs">
                {superModalError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>{superModalError}</span>
                  </div>
                )}

                {/* Current SuperAdmin Password Check */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700">
                    Current SuperAdmin Password (လက်ရှိ စကားဝှက်):
                  </label>
                  <div className="relative">
                    <input
                      type={showSuperOldPass ? 'text' : 'password'}
                      required
                      value={superOldPass}
                      onChange={(e) => setSuperOldPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 pr-9 text-stone-900 focus:outline-hidden focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSuperOldPass(!showSuperOldPass)}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showSuperOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* New SuperAdmin PIN */}
                <div className="space-y-1 pt-1 border-t border-stone-100">
                  <label className="block text-[11px] font-bold text-stone-700">
                    New SuperAdmin PIN (ဂဏန်း ၄ မှ ၈ လုံး):
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={superNewPin}
                    onChange={(e) => setSuperNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 tracking-widest text-center"
                  />
                </div>

                {/* New SuperAdmin Password */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700">
                    New SuperAdmin Password (Password အသစ်):
                  </label>
                  <div className="relative">
                    <input
                      type={showSuperNewPass ? 'text' : 'password'}
                      value={superNewPass}
                      onChange={(e) => setSuperNewPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 pr-9 text-stone-900 focus:outline-hidden focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSuperNewPass(!showSuperNewPass)}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      {showSuperNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New SuperAdmin Password */}
                {superNewPass && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-stone-700">
                      Confirm New SuperAdmin Password (စကားဝှက် အတည်ပြုပါ):
                    </label>
                    <div className="relative">
                      <input
                        type={showSuperConfirmPass ? 'text' : 'password'}
                        required={Boolean(superNewPass)}
                        value={superConfirmPass}
                        onChange={(e) => setSuperConfirmPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 pr-9 text-stone-900 focus:outline-hidden focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSuperConfirmPass(!showSuperConfirmPass)}
                        className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        {showSuperConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsEditSuperAdminModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSuperModalSaving}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>{isSuperModalSaving ? 'Saving...' : 'Update SuperAdmin Security'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT BARBER CREDENTIALS & PIN                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingDesigner && (
          <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-xl font-sans"
            >
              <div className="flex items-center space-x-2.5 border-b border-stone-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Scissors className="w-4 h-4 text-emerald-700 transform -rotate-45" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">
                    Edit Barber Phone & PIN
                  </h3>
                  <p className="text-[10px] text-stone-500 font-mono">{editingDesigner.name} ({editingDesigner.title})</p>
                </div>
              </div>

              <form onSubmit={handleSaveBarberCredentials} className="space-y-3 text-xs font-mono">
                <div className="space-y-1">
                  <label className="block font-medium text-stone-700">
                    Barber Login Phone (ဖုန်းနံပါတ်):
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="09xxxxxxxxx"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-stone-700">
                    Login PIN (ဂဏန်း ၄ မှ ၈ လုံး):
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-stone-700">
                    Commission Rate %:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                  <div>
                    <span className="font-bold text-stone-800 text-xs block">Account Status:</span>
                    <span className="text-[10px] text-stone-500 font-sans">ပိတ်ထားပါက Barber Login ဝင်၍ မရနိုင်ပါ</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveInput(!activeInput)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer border ${
                      activeInput
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {activeInput ? '● Active' : '○ Disabled'}
                  </button>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setEditingDesigner(null)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 5: ADD NEW BARBER ACCOUNT                                           */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddingNew && (
          <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-xl font-sans"
            >
              <div className="flex items-center space-x-2.5 border-b border-stone-100 pb-3">
                <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
                  <Scissors className="w-4 h-4 transform -rotate-45" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-mono">
                    Add New Barber Account
                  </h3>
                  <p className="text-[10px] text-stone-500 font-mono">Create staff profile with Phone & PIN</p>
                </div>
              </div>

              <form onSubmit={handleCreateNewBarber} className="space-y-3 text-xs font-mono">
                <div className="space-y-1">
                  <label className="block font-medium text-stone-700">Barber Name:</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-stone-700">Title / Speciality:</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Lead Barber / Fade Specialist"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block font-medium text-stone-700">Login Phone:</label>
                    <input
                      type="tel"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="09xxxxxxxxx"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-medium text-stone-700">Login PIN:</label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="1234"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 tracking-widest"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-medium text-stone-700">Commission %:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newCommission}
                    onChange={(e) => setNewCommission(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>{isCreating ? 'Creating...' : 'Create Account'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
