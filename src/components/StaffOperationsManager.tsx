import React, { useState, useMemo } from 'react';
import { Designer, Booking } from '../types';
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
import { playSuccessChime, playNotificationChime } from '../utils/audio';
import { uploadImageToStorage } from '../utils/imageCompressor';
import { formatPrice } from '../utils/formatters';
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
  Unlock,
  Trash2,
  Clock,
  DollarSign,
  TrendingUp,
  X,
  Upload,
  Calendar,
  Zap,
  Activity,
  Award,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StaffOperationsManagerProps {
  designers: Designer[];
  bookings?: Booking[];
  onRefresh: () => void;
  role?: 'admin' | 'superadmin';
}

const PRESET_AVATARS = [
  { name: 'Master Barber', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400' },
  { name: 'Hair Sculptor', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400' },
  { name: 'Fade Specialist', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400' },
  { name: 'Precision Artist', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400' },
  { name: 'Beard Stylist', url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=400' },
  { name: 'VIP Groomer', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400' },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const StaffOperationsManager: React.FC<StaffOperationsManagerProps> = ({
  designers,
  bookings = [],
  onRefresh,
  role = 'superadmin',
}) => {
  const isSuperAdmin = role === 'superadmin';
  const [activeFilter, setActiveFilter] = useState<'all' | 'barbers' | 'admins'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Live credentials state
  const [adminCreds, setAdminCreds] = useState(() => getAdminCredentials());
  const [superAdminCreds, setSuperAdminCreds] = useState(() => getSuperAdminCredentials());

  // Visibility toggles
  const [visibleBarberPins, setVisibleBarberPins] = useState<Record<string, boolean>>({});
  const [isAdminPinVisible, setIsAdminPinVisible] = useState(false);
  const [isSuperAdminPinVisible, setIsSuperAdminPinVisible] = useState(false);

  // SuperAdmin Unlock modal
  const [isSuperPinUnlockModalOpen, setIsSuperPinUnlockModalOpen] = useState(false);
  const [superUnlockPassword, setSuperUnlockPassword] = useState('');
  const [superUnlockError, setSuperUnlockError] = useState('');

  // Modals for editing Admin & SuperAdmin
  const [isEditAdminModalOpen, setIsEditAdminModalOpen] = useState(false);
  const [adminOldPass, setAdminOldPass] = useState('');
  const [adminNewPin, setAdminNewPin] = useState('');
  const [adminNewPass, setAdminNewPass] = useState('');
  const [adminConfirmPass, setAdminConfirmPass] = useState('');
  const [adminModalError, setAdminModalError] = useState('');
  const [isAdminModalSaving, setIsAdminModalSaving] = useState(false);

  const [isEditSuperAdminModalOpen, setIsEditSuperAdminModalOpen] = useState(false);
  const [superOldPass, setSuperOldPass] = useState('');
  const [superNewPin, setSuperNewPin] = useState('');
  const [superNewPass, setSuperNewPass] = useState('');
  const [superConfirmPass, setSuperConfirmPass] = useState('');
  const [superModalError, setSuperModalError] = useState('');
  const [isSuperModalSaving, setIsSuperModalSaving] = useState(false);

  // Barber Edit / Add Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Designer | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffTitle, setStaffTitle] = useState('Senior Barber');
  const [staffPhone, setStaffPhone] = useState('09');
  const [staffPin, setStaffPin] = useState('1234');
  const [staffCommission, setStaffCommission] = useState(50);
  const [staffExp, setStaffExp] = useState(5);
  const [staffAvatar, setStaffAvatar] = useState(PRESET_AVATARS[0].url);
  const [staffAvailableDays, setStaffAvailableDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [staffStartTime, setStaffStartTime] = useState('09:00');
  const [staffEndTime, setStaffEndTime] = useState('19:00');
  const [staffBio, setStaffBio] = useState('');
  const [staffActive, setStaffActive] = useState(true);
  const [isStaffSaving, setIsStaffSaving] = useState(false);
  const [staffModalError, setStaffModalError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const refreshCreds = () => {
    setAdminCreds(getAdminCredentials());
    setSuperAdminCreds(getSuperAdminCredentials());
  };

  // Today stats per barber
  const todayStr = new Date().toISOString().split('T')[0];
  const barberPerformance = useMemo(() => {
    const stats: Record<string, { completedToday: number; revenueToday: number; commissionToday: number }> = {};
    designers.forEach((d) => {
      stats[d.id] = { completedToday: 0, revenueToday: 0, commissionToday: 0 };
    });

    bookings.forEach((b) => {
      if (b.designerId && stats[b.designerId]) {
        const isToday = b.date === todayStr;
        const isFinished = b.status === 'completed' || b.status === 'confirmed';
        if (isToday && isFinished) {
          stats[b.designerId].completedToday += 1;
          const price = b.servicePrice || 0;
          stats[b.designerId].revenueToday += price;
          const commRate = (designers.find((d) => d.id === b.designerId)?.commissionPercent ?? 50) / 100;
          stats[b.designerId].commissionToday += price * commRate;
        }
      }
    });

    return stats;
  }, [designers, bookings, todayStr]);

  // Overall calculations
  const totalStaffCount = designers.length + 2; // Barbers + Admin + SuperAdmin
  const activeBarbersCount = designers.filter((d) => d.active !== false).length;
  const totalTodayServed = Object.values(barberPerformance).reduce((acc, curr) => acc + curr.completedToday, 0);
  const totalTodayCommission = Object.values(barberPerformance).reduce((acc, curr) => acc + curr.commissionToday, 0);

  // Toggle shift status
  const handleToggleShiftStatus = async (barber: Designer) => {
    const nextStatus = barber.active === false ? true : false;
    try {
      await api.updateDesigner(barber.id, { active: nextStatus });
      playSuccessChime();
      showToast(`${barber.name} shift is now ${nextStatus ? 'ON DUTY 🟢' : 'OFF DUTY 🔴'}`);
      onRefresh();
    } catch (e: any) {
      showToast(e.message || 'Failed to update shift');
    }
  };

  // Open Edit Modal
  const openEditStaff = (d: Designer) => {
    setEditingStaff(d);
    setStaffName(d.name || '');
    setStaffTitle(d.title || 'Senior Barber');
    setStaffPhone(d.phone || '09');
    setStaffPin(d.loginPin || '1234');
    setStaffCommission(d.commissionPercent ?? 50);
    setStaffExp(d.experienceYears || 5);
    setStaffAvatar(d.avatarUrl || PRESET_AVATARS[0].url);
    setStaffAvailableDays(d.availableDays && d.availableDays.length > 0 ? d.availableDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    setStaffStartTime(d.workingHours?.start || '09:00');
    setStaffEndTime(d.workingHours?.end || '19:00');
    setStaffBio(d.bio || '');
    setStaffActive(d.active !== false);
    setStaffModalError('');
    setIsStaffModalOpen(true);
  };

  // Open Add Modal
  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffName('');
    setStaffTitle('Senior Barber');
    setStaffPhone('09');
    setStaffPin('1234');
    setStaffCommission(50);
    setStaffExp(5);
    setStaffAvatar(PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)].url);
    setStaffAvailableDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    setStaffStartTime('09:00');
    setStaffEndTime('19:00');
    setStaffBio('');
    setStaffActive(true);
    setStaffModalError('');
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffModalError('');
    if (!staffName.trim()) {
      setStaffModalError('Staff name is required');
      return;
    }
    if (!staffPhone.trim() || staffPhone.trim().length < 8) {
      setStaffModalError('Valid phone number is required');
      return;
    }
    if (!staffPin.trim() || staffPin.trim().length < 4) {
      setStaffModalError('4-digit PIN is required');
      return;
    }

    setIsStaffSaving(true);
    try {
      if (editingStaff) {
        await api.updateDesigner(editingStaff.id, {
          name: staffName.trim(),
          title: staffTitle.trim(),
          phone: staffPhone.trim(),
          loginPin: staffPin.trim(),
          commissionPercent: Number(staffCommission),
          experienceYears: Number(staffExp),
          avatarUrl: staffAvatar,
          availableDays: staffAvailableDays,
          workingHours: { start: staffStartTime, end: staffEndTime },
          bio: staffBio.trim(),
          active: staffActive,
        });
        showToast(`Staff member "${staffName}" updated successfully!`);
      } else {
        await api.addDesigner({
          name: staffName.trim(),
          title: staffTitle.trim(),
          phone: staffPhone.trim(),
          loginPin: staffPin.trim(),
          commissionPercent: Number(staffCommission),
          experienceYears: Number(staffExp),
          avatarUrl: staffAvatar,
          availableDays: staffAvailableDays,
          workingHours: { start: staffStartTime, end: staffEndTime },
          bio: staffBio.trim(),
          rating: 5.0,
          reviewsCount: 1,
          active: staffActive,
        });
        showToast(`New staff member "${staffName}" added successfully!`);
      }
      playSuccessChime();
      setIsStaffModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setStaffModalError(err.message || 'Failed to save staff record');
    } finally {
      setIsStaffSaving(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from staff?`)) return;
    setDeletingId(id);
    try {
      await api.deleteDesigner(id);
      playSuccessChime();
      showToast(`${name} removed successfully`);
      onRefresh();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete staff');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadImageToStorage(file, 'staff', 350, 350);
      setStaffAvatar(url);
      playSuccessChime();
    } catch (err: any) {
      setStaffModalError(err.message || 'Avatar upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Filtered staff list
  const filteredBarbers = designers.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.title?.toLowerCase().includes(q) ||
      d.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 bg-[#242428] border border-[#D4AF37] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner: Staff Operations Overview */}
      <div className="bg-[#202024] border border-[#33333a] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="w-8 h-8 rounded-xl bg-[#D4AF37] text-black flex items-center justify-center font-black shadow-sm">
                <Users className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
                Executive Control Hub
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Staff & Admin Operations (ဝန်ထမ်းများနှင့် Admin စီမံခန့်ခွဲမှု)
            </h2>
            <p className="text-xs text-stone-300 font-medium max-w-2xl leading-relaxed">
              Real-time monitoring of all lounge personnel — Barber duty status, phone PIN authentication, commission calculations, and SuperAdmin security privileges.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={openAddStaff}
              className="px-4 py-3 rounded-2xl bg-[#D4AF37] hover:bg-[#c49f2b] active:scale-95 text-black font-black text-xs uppercase tracking-wider flex items-center space-x-2 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Add New Staff</span>
            </button>
            <button
              onClick={onRefresh}
              className="p-3 rounded-2xl bg-[#28282e] hover:bg-[#32323a] text-white border border-[#3d3d46] transition-all cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Operational Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#2e2e34]">
          <div className="bg-[#18181a] border border-[#2e2e34] rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-stone-400">Total Personnel</span>
              <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <p className="text-xl font-black text-white mt-1">{totalStaffCount}</p>
            <span className="text-[10px] text-stone-400 font-medium">
              {designers.length} Stylists • 2 Admins
            </span>
          </div>

          <div className="bg-[#18181a] border border-[#2e2e34] rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-stone-400">On Duty Today</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xl font-black text-emerald-400 mt-1">{activeBarbersCount} / {designers.length}</p>
            <span className="text-[10px] text-stone-400 font-medium">Ready for bookings</span>
          </div>

          <div className="bg-[#18181a] border border-[#2e2e34] rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-stone-400">Today's Served</span>
              <Scissors className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <p className="text-xl font-black text-white mt-1">{totalTodayServed} Cuts</p>
            <span className="text-[10px] text-stone-400 font-medium">Client appointments</span>
          </div>

          <div className="bg-[#18181a] border border-[#2e2e34] rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-stone-400">Staff Commission</span>
              <DollarSign className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <p className="text-xl font-black text-[#D4AF37] mt-1">{formatPrice(totalTodayCommission)}</p>
            <span className="text-[10px] text-stone-400 font-medium">Today's earned split</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#202024] border border-[#33333a] p-2 rounded-2xl">
        <div className="flex items-center space-x-1 bg-[#18181a] p-1 rounded-xl border border-[#2e2e34]">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all' ? 'bg-[#D4AF37] text-black shadow-xs' : 'text-stone-300 hover:text-white'
            }`}
          >
            All Staff ({totalStaffCount})
          </button>
          <button
            onClick={() => setActiveFilter('barbers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'barbers' ? 'bg-[#D4AF37] text-black shadow-xs' : 'text-stone-300 hover:text-white'
            }`}
          >
            ✂️ Barbers ({designers.length})
          </button>
          <button
            onClick={() => setActiveFilter('admins')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'admins' ? 'bg-[#D4AF37] text-black shadow-xs' : 'text-stone-300 hover:text-white'
            }`}
          >
            👑 Admins (2)
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name or phone..."
            className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-[#D4AF37]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-stone-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: ADMIN & SUPERADMIN PRIVILEGED OPERATIONS (Shown when 'all' or 'admins') */}
      {(activeFilter === 'all' || activeFilter === 'admins') && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-xs font-black uppercase tracking-widest text-stone-300">
              System Administrators & Executive Accounts
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SuperAdmin Card */}
            <div className="bg-[#202024] border border-[#33333a] rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#1e1a10] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center font-black text-xl shadow-md">
                    👑
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-black text-base text-white">{SUPERADMIN_USERNAME}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-[#D4AF37] text-black text-[9px] font-black uppercase">
                        SuperAdmin
                      </span>
                    </div>
                    <p className="text-xs text-[#D4AF37] font-semibold mt-0.5">
                      Full Root & Financial Authority
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 bg-[#18181a] border border-[#2e2e34] px-2.5 py-1 rounded-full text-[11px] text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Permanent Root</span>
                </div>
              </div>

              {/* SuperAdmin Credentials Display */}
              <div className="bg-[#18181a] border border-[#2e2e34] rounded-2xl p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-stone-300">
                  <span className="font-medium">Executive Username:</span>
                  <span className="font-bold text-white font-mono bg-[#28282e] px-2 py-0.5 rounded border border-[#3d3d46]">
                    {SUPERADMIN_USERNAME}
                  </span>
                </div>

                <div className="flex items-center justify-between text-stone-300">
                  <span className="font-medium">SuperAdmin 4-Digit PIN:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#D4AF37] font-mono bg-[#28282e] px-2.5 py-0.5 rounded border border-[#3d3d46]">
                      {isSuperAdminPinVisible ? superAdminCreds.pin : '••••'}
                    </span>
                    <button
                      onClick={() => setIsSuperAdminPinVisible(!isSuperAdminPinVisible)}
                      className="text-stone-400 hover:text-white cursor-pointer"
                      title="Toggle PIN"
                    >
                      {isSuperAdminPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-stone-300">
                  <span className="font-medium">Permissions:</span>
                  <span className="text-[10px] font-bold text-stone-300 bg-white/10 px-2 py-0.5 rounded">
                    Staff, Settlement, Database, Bookings
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => {
                    setSuperOldPass('');
                    setSuperNewPin(superAdminCreds.pin);
                    setSuperNewPass('');
                    setSuperConfirmPass('');
                    setSuperModalError('');
                    setIsEditSuperAdminModalOpen(true);
                  }}
                  className="flex-1 bg-[#28282e] hover:bg-[#32323a] text-white border border-[#3d3d46] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Change SuperAdmin PIN / Password</span>
                </button>
              </div>
            </div>

            {/* Standard Branch Admin Card */}
            <div className="bg-[#202024] border border-[#33333a] rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#1e1a10] border border-[#3d3d46] text-[#D4AF37] flex items-center justify-center font-black text-xl shadow-md">
                    🛡️
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-black text-base text-white">{ADMIN_USERNAME}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-[#32323a] text-white text-[9px] font-black uppercase">
                        Branch Admin
                      </span>
                    </div>
                    <p className="text-xs text-stone-300 font-semibold mt-0.5">
                      Daily Floor & Appointment Operations
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 bg-[#18181a] border border-[#2e2e34] px-2.5 py-1 rounded-full text-[11px] text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active</span>
                </div>
              </div>

              {/* Admin Credentials Display */}
              <div className="bg-[#18181a] border border-[#2e2e34] rounded-2xl p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-stone-300">
                  <span className="font-medium">Admin Username:</span>
                  <span className="font-bold text-white font-mono bg-[#28282e] px-2 py-0.5 rounded border border-[#3d3d46]">
                    {ADMIN_USERNAME}
                  </span>
                </div>

                <div className="flex items-center justify-between text-stone-300">
                  <span className="font-medium">Admin 4-Digit PIN:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#D4AF37] font-mono bg-[#28282e] px-2.5 py-0.5 rounded border border-[#3d3d46]">
                      {isAdminPinVisible ? adminCreds.pin : '••••'}
                    </span>
                    <button
                      onClick={() => setIsAdminPinVisible(!isAdminPinVisible)}
                      className="text-stone-400 hover:text-white cursor-pointer"
                      title="Toggle PIN"
                    >
                      {isAdminPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-stone-300">
                  <span className="font-medium">Permissions:</span>
                  <span className="text-[10px] font-bold text-stone-300 bg-white/10 px-2 py-0.5 rounded">
                    Walk-ins, Queue, Catalog, Clients
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => {
                    setAdminOldPass('');
                    setAdminNewPin(adminCreds.pin);
                    setAdminNewPass('');
                    setAdminConfirmPass('');
                    setAdminModalError('');
                    setIsEditAdminModalOpen(true);
                  }}
                  className="flex-1 bg-[#28282e] hover:bg-[#32323a] text-white border border-[#3d3d46] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Change Admin PIN / Password</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: BARBERS & STYLISTS OPERATIONAL CARDS */}
      {(activeFilter === 'all' || activeFilter === 'barbers') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Scissors className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-xs font-black uppercase tracking-widest text-stone-300">
                Barbers & Stylists Operations Roster ({filteredBarbers.length})
              </h3>
            </div>
            <span className="text-xs text-stone-400 font-medium">
              Click shift badge to toggle On/Off Duty
            </span>
          </div>

          {filteredBarbers.length === 0 ? (
            <div className="bg-[#202024] border border-[#33333a] rounded-3xl p-8 text-center space-y-3">
              <p className="text-stone-400 text-xs">No barbers found matching your filter.</p>
              <button
                onClick={openAddStaff}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs cursor-pointer"
              >
                + Add Barber
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBarbers.map((barber) => {
                const perf = barberPerformance[barber.id] || { completedToday: 0, revenueToday: 0, commissionToday: 0 };
                const isPinVisible = !!visibleBarberPins[barber.id];
                const isOnDuty = barber.active !== false;

                return (
                  <motion.div
                    key={barber.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#202024] border border-[#33333a] hover:border-[#D4AF37]/50 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
                  >
                    {/* Top Row: Avatar, Info & Shift Toggle */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <img
                          src={barber.avatarUrl || PRESET_AVATARS[0].url}
                          alt={barber.name}
                          referrerPolicy="no-referrer"
                          className="w-13 h-13 rounded-2xl object-cover border-2 border-[#3d3d46] shadow-sm shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-white truncate leading-tight">
                            {barber.name}
                          </h4>
                          <span className="text-[11px] font-bold text-[#D4AF37] block mt-0.5">
                            {barber.title || 'Senior Barber'}
                          </span>
                          <span className="text-[10px] text-stone-400 block">
                            {barber.experienceYears || 5} yrs exp • {barber.commissionPercent ?? 50}% Comm.
                          </span>
                        </div>
                      </div>

                      {/* 1-Click Shift Badge */}
                      <button
                        onClick={() => handleToggleShiftStatus(barber)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs select-none ${
                          isOnDuty
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 hover:bg-emerald-900'
                            : 'bg-red-950 text-red-300 border border-red-700 hover:bg-red-900'
                        }`}
                        title="Click to toggle Shift Duty"
                      >
                        <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        <span>{isOnDuty ? 'On Duty' : 'Off Duty'}</span>
                      </button>
                    </div>

                    {/* Operational Details Box */}
                    <div className="bg-[#18181a] border border-[#2e2e34] rounded-2xl p-3 space-y-2 text-xs">
                      {/* Phone & PIN */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-stone-300">
                          <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span className="font-bold text-white font-mono">{barber.phone || '09000000000'}</span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <KeyRound className="w-3 h-3 text-[#D4AF37]" />
                          <span className="font-bold text-[#D4AF37] font-mono bg-[#28282e] px-1.5 py-0.5 rounded border border-[#3d3d46]">
                            {isPinVisible ? (barber.loginPin || '1234') : '••••'}
                          </span>
                          <button
                            onClick={() => setVisibleBarberPins((prev) => ({ ...prev, [barber.id]: !prev[barber.id] }))}
                            className="text-stone-400 hover:text-white cursor-pointer"
                          >
                            {isPinVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Today's Metrics */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#28282e] text-[11px]">
                        <div>
                          <span className="text-stone-400 block text-[10px]">Today Served:</span>
                          <span className="font-bold text-white font-mono">{perf.completedToday} appointments</span>
                        </div>
                        <div>
                          <span className="text-stone-400 block text-[10px]">Est. Commission:</span>
                          <span className="font-bold text-[#D4AF37] font-mono">{formatPrice(perf.commissionToday)}</span>
                        </div>
                      </div>

                      {/* Working Hours & Available Days */}
                      <div className="text-[10px] text-stone-400 flex items-center justify-between pt-1 border-t border-[#28282e]">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>{barber.workingHours?.start || '09:00'} - {barber.workingHours?.end || '19:00'}</span>
                        </span>
                        <span>{(barber.availableDays || []).join(', ')}</span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        onClick={() => openEditStaff(barber)}
                        className="flex-1 bg-[#28282e] hover:bg-[#32323a] text-white border border-[#3d3d46] py-2 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Edit Profile & PIN</span>
                      </button>

                      <button
                        disabled={deletingId === barber.id}
                        onClick={() => handleDeleteStaff(barber.id, barber.name)}
                        className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 transition-all cursor-pointer disabled:opacity-50"
                        title="Remove Staff"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Edit or Add Staff Member */}
      <AnimatePresence>
        {isStaffModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto pt-[env(safe-area-inset-top,1rem)] pb-[env(safe-area-inset-bottom,1rem)]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202024] border border-[#33333a] rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-white my-auto max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#2e2e34] pb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#D4AF37] text-black flex items-center justify-center font-black">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">
                      {editingStaff ? `Edit Staff: ${editingStaff.name}` : 'Add New Barber Stylist'}
                    </h3>
                    <p className="text-xs text-stone-400">Set authentication phone, PIN, commission % and shift schedule.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsStaffModalOpen(false)}
                  className="p-1.5 rounded-xl bg-[#28282e] hover:bg-[#32323a] text-stone-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {staffModalError && (
                <div className="bg-red-950/80 border border-red-800 text-red-200 p-3 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{staffModalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
                {/* Avatar Row */}
                <div className="flex items-center space-x-4">
                  <img
                    src={staffAvatar}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#D4AF37] shrink-0 shadow-md"
                  />
                  <div className="space-y-2 flex-1">
                    <label className="font-bold text-stone-300 block">Avatar Photo</label>
                    <div className="flex items-center space-x-2">
                      <label className="px-3 py-2 rounded-xl bg-[#28282e] hover:bg-[#32323a] border border-[#3d3d46] text-white font-bold cursor-pointer flex items-center space-x-1.5">
                        <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>{uploadingAvatar ? 'Uploading...' : 'Upload Image'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Name & Title */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Staff Full Name *</label>
                    <input
                      type="text"
                      required
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Master Hein Htet"
                      className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2.5 text-white placeholder-stone-400 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Professional Title</label>
                    <input
                      type="text"
                      value={staffTitle}
                      onChange={(e) => setStaffTitle(e.target.value)}
                      placeholder="e.g. Master Barber / VIP Stylist"
                      className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2.5 text-white placeholder-stone-400 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Login Phone & 4-Digit PIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#18181a] border border-[#2e2e34] p-3.5 rounded-2xl">
                  <div>
                    <label className="font-bold text-[#D4AF37] block mb-1 flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Barber Login Phone *</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value)}
                      placeholder="09..."
                      className="w-full bg-[#202024] border border-[#33333a] rounded-xl px-3.5 py-2 text-white font-mono placeholder-stone-400 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[#D4AF37] block mb-1 flex items-center space-x-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>4-Digit Login PIN *</span>
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      required
                      value={staffPin}
                      onChange={(e) => setStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="1234"
                      className="w-full bg-[#202024] border border-[#33333a] rounded-xl px-3.5 py-2 text-white font-mono tracking-widest text-center focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Commission & Experience */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Commission Split (%)</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={staffCommission}
                        onChange={(e) => setStaffCommission(Number(e.target.value))}
                        className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                      />
                      <span className="text-stone-400 font-bold">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Years of Experience</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={staffExp}
                      onChange={(e) => setStaffExp(Number(e.target.value))}
                      className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Working Hours */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Shift Start</label>
                    <input
                      type="time"
                      value={staffStartTime}
                      onChange={(e) => setStaffStartTime(e.target.value)}
                      className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Shift End</label>
                    <input
                      type="time"
                      value={staffEndTime}
                      onChange={(e) => setStaffEndTime(e.target.value)}
                      className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                {/* Available Days */}
                <div>
                  <label className="font-bold text-stone-300 block mb-1.5">Working Days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSel = staffAvailableDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              if (staffAvailableDays.length > 1) {
                                setStaffAvailableDays(staffAvailableDays.filter((d) => d !== day));
                              }
                            } else {
                              setStaffAvailableDays([...staffAvailableDays, day]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                            isSel ? 'bg-[#D4AF37] text-black' : 'bg-[#18181a] text-stone-400 hover:text-white border border-[#2e2e34]'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Staff Bio / Specialization</label>
                  <textarea
                    rows={2}
                    value={staffBio}
                    onChange={(e) => setStaffBio(e.target.value)}
                    placeholder="e.g. Master of classic scissor cuts, precision fades, and hot towel beard shaping."
                    className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl p-3 text-white placeholder-stone-400 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Active Switch */}
                <div className="flex items-center justify-between bg-[#18181a] border border-[#2e2e34] p-3 rounded-xl">
                  <div>
                    <span className="font-bold text-white block">Active Status</span>
                    <span className="text-stone-400 text-[10px]">When active, this barber appears in client bookings</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={staffActive}
                    onChange={(e) => setStaffActive(e.target.checked)}
                    className="w-5 h-5 accent-[#D4AF37] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#2e2e34]">
                  <button
                    type="button"
                    onClick={() => setIsStaffModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#28282e] hover:bg-[#32323a] text-stone-300 hover:text-white font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isStaffSaving}
                    className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2b] text-black font-black flex items-center space-x-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isStaffSaving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Save Staff Record</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SuperAdmin Edit Credentials */}
      <AnimatePresence>
        {isEditSuperAdminModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202024] border border-[#D4AF37] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-[#2e2e34] pb-3">
                <div className="flex items-center space-x-2">
                  <Crown className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="font-black text-sm text-white uppercase">SuperAdmin Credentials</h3>
                </div>
                <button onClick={() => setIsEditSuperAdminModalOpen(false)} className="text-stone-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {superModalError && (
                <div className="bg-red-950 border border-red-800 text-red-200 p-2.5 rounded-xl text-xs">
                  {superModalError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSuperModalError('');
                  if (!verifySuperAdminOldPassword(superOldPass)) {
                    setSuperModalError('Current password is incorrect');
                    return;
                  }
                  if (superNewPin.length !== 4) {
                    setSuperModalError('PIN must be exactly 4 digits');
                    return;
                  }
                  if (superNewPass && superNewPass !== superConfirmPass) {
                    setSuperModalError('New passwords do not match');
                    return;
                  }

                  saveSuperAdminCredentials({
                    pin: superNewPin,
                    password: superNewPass || superAdminCreds.password,
                  });
                  refreshCreds();
                  playSuccessChime();
                  showToast('SuperAdmin credentials updated successfully!');
                  setIsEditSuperAdminModalOpen(false);
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Current Password *</label>
                  <input
                    type="password"
                    required
                    value={superOldPass}
                    onChange={(e) => setSuperOldPass(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-300 block mb-1">New 4-Digit SuperAdmin PIN *</label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={superNewPin}
                    onChange={(e) => setSuperNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="9999"
                    className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white font-mono tracking-widest text-center focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-300 block mb-1">New Password (Optional)</label>
                  <input
                    type="password"
                    value={superNewPass}
                    onChange={(e) => setSuperNewPass(e.target.value)}
                    placeholder="Leave empty to keep current"
                    className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {superNewPass && (
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Confirm New Password *</label>
                    <input
                      type="password"
                      required
                      value={superConfirmPass}
                      onChange={(e) => setSuperConfirmPass(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end space-x-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditSuperAdminModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#28282e] text-stone-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] text-black font-black shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Branch Admin Edit Credentials */}
      <AnimatePresence>
        {isEditAdminModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#202024] border border-[#33333a] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-white"
            >
              <div className="flex items-center justify-between border-b border-[#2e2e34] pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="font-black text-sm text-white uppercase">Admin Credentials</h3>
                </div>
                <button onClick={() => setIsEditAdminModalOpen(false)} className="text-stone-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {adminModalError && (
                <div className="bg-red-950 border border-red-800 text-red-200 p-2.5 rounded-xl text-xs">
                  {adminModalError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdminModalError('');
                  if (!verifyAdminOldPassword(adminOldPass)) {
                    setAdminModalError('Current password is incorrect');
                    return;
                  }
                  if (adminNewPin.length !== 4) {
                    setAdminModalError('PIN must be exactly 4 digits');
                    return;
                  }
                  if (adminNewPass && adminNewPass !== adminConfirmPass) {
                    setAdminModalError('New passwords do not match');
                    return;
                  }

                  saveAdminCredentials({
                    pin: adminNewPin,
                    password: adminNewPass || adminCreds.password,
                  });
                  refreshCreds();
                  playSuccessChime();
                  showToast('Admin credentials updated successfully!');
                  setIsEditAdminModalOpen(false);
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="font-bold text-stone-300 block mb-1">Current Password *</label>
                  <input
                    type="password"
                    required
                    value={adminOldPass}
                    onChange={(e) => setAdminOldPass(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-300 block mb-1">New 4-Digit Admin PIN *</label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={adminNewPin}
                    onChange={(e) => setAdminNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0000"
                    className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white font-mono tracking-widest text-center focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-300 block mb-1">New Password (Optional)</label>
                  <input
                    type="password"
                    value={adminNewPass}
                    onChange={(e) => setAdminNewPass(e.target.value)}
                    placeholder="Leave empty to keep current"
                    className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {adminNewPass && (
                  <div>
                    <label className="font-bold text-stone-300 block mb-1">Confirm New Password *</label>
                    <input
                      type="password"
                      required
                      value={adminConfirmPass}
                      onChange={(e) => setAdminConfirmPass(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-[#18181a] border border-[#2e2e34] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end space-x-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditAdminModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#28282e] text-stone-300 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#D4AF37] text-black font-black shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
