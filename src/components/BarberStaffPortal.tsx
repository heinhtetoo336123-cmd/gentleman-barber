import React, { useState, useEffect, useMemo } from 'react';
import { Designer, Booking, NotificationItem } from '../types';
import { Language } from '../data/i18n';
import { formatPrice, sortBookingsMostRecentFirst } from '../utils/formatters';
import { isNotificationForBarber, getClearedNotificationIds } from '../utils/notifications';
import { api } from '../api/client';
import { playNotificationChime, playSuccessChime } from '../utils/audio';
import {
  Scissors,
  Calendar,
  Clock,
  User,
  DollarSign,
  TrendingUp,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Award,
  Star,
  Check,
  Sparkles,
  FileText,
  Filter,
  LogOut,
  Bell,
  Search,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Clock3,
  CalendarDays,
  ShieldCheck,
  CheckCheck,
  Trash2,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AutoDeleteCountdownBadge } from './AutoDeleteCountdownBadge';

interface BarberStaffPortalProps {
  designers: Designer[];
  bookings: Booking[];
  notifications?: NotificationItem[];
  onRefresh: () => void;
  currentBarberId?: string;
  isDirectBarberRole?: boolean;
  onLogout?: () => void;
  lang?: Language;
  activeTab?: BarberPortalTab;
  onSelectTab?: (tab: BarberPortalTab) => void;
}

export type BarberPortalTab = 'timeline' | 'bookings' | 'notifications' | 'profile';

export const BarberStaffPortal: React.FC<BarberStaffPortalProps> = ({
  designers,
  bookings,
  notifications = [],
  onRefresh,
  currentBarberId,
  isDirectBarberRole = false,
  onLogout,
  lang = 'en',
  activeTab: externalActiveTab,
  onSelectTab,
}) => {
  // Tab 1: Timeline is default as requested ("timeline (default screen)")
  const [internalActiveTab, setInternalActiveTab] = useState<BarberPortalTab>('timeline');
  const activeTab = externalActiveTab || internalActiveTab;

  const handleTabChange = (tab: BarberPortalTab) => {
    setInternalActiveTab(tab);
    if (onSelectTab) {
      onSelectTab(tab);
    }
  };

  // Selected Barber State with robust multi-field persistence
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>(() => {
    if (currentBarberId) return currentBarberId;
    try {
      const stored = localStorage.getItem('baba_active_barber_id');
      if (stored) return stored;
      const cached = localStorage.getItem('baba_active_barber_obj');
      if (cached) {
        const obj = JSON.parse(cached);
        if (obj?.id) return obj.id;
      }
    } catch {}
    return isDirectBarberRole ? '' : (designers[0]?.id || '');
  });

  useEffect(() => {
    if (currentBarberId && currentBarberId !== selectedDesignerId) {
      setSelectedDesignerId(currentBarberId);
      try {
        localStorage.setItem('baba_active_barber_id', currentBarberId);
      } catch {}
    }
  }, [currentBarberId]);

  const activeDesigner = useMemo(() => {
    // 1. Resolve ID from state or localStorage or props
    const storedId = localStorage.getItem('baba_active_barber_id') || '';
    const storedPhone = (localStorage.getItem('baba_active_barber_phone') || '').replace(/[^0-9]/g, '');
    const storedName = (localStorage.getItem('baba_active_barber_name') || '').trim().toLowerCase();
    const targetId = isDirectBarberRole ? (currentBarberId || storedId || selectedDesignerId) : (selectedDesignerId || storedId || currentBarberId);

    // 2. Match from designers list
    if (designers && designers.length > 0) {
      let match: Designer | undefined;

      // Priority 1: Match exact target ID
      if (targetId) {
        match = designers.find((d) => d.id === targetId || (d as any).firestoreDocId === targetId);
      }

      // Priority 2: If not found, match by stored ID
      if (!match && storedId) {
        match = designers.find((d) => d.id === storedId || (d as any).firestoreDocId === storedId);
      }

      // Priority 3: Match by stored phone
      if (!match && storedPhone) {
        match = designers.find((d) => {
          const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
          return dPhone && dPhone === storedPhone;
        });
      }

      // Priority 4: Match by stored name
      if (!match && storedName) {
        match = designers.find((d) => d.name && d.name.trim().toLowerCase() === storedName);
      }

      if (match) {
        if (match.id !== storedId) {
          try {
            localStorage.setItem('baba_active_barber_id', match.id);
            localStorage.setItem('baba_active_barber_phone', match.phone || '');
            localStorage.setItem('baba_active_barber_name', match.name || '');
            localStorage.setItem('baba_active_barber_obj', JSON.stringify(match));
          } catch {}
        }
        return match;
      }
    }

    // 3. Fallback to cached verified barber profile
    try {
      const cached = localStorage.getItem('baba_active_barber_obj');
      if (cached) {
        const obj = JSON.parse(cached);
        if (obj && obj.name && (obj.id === targetId || !targetId)) return obj as Designer;
      }
    } catch {}

    return isDirectBarberRole ? null : (designers[0] || null);
  }, [designers, selectedDesignerId, currentBarberId, isDirectBarberRole]);

  // Date State for Timeline Tab
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Timeline Period Mode & Date Range State
  const [timelinePeriodMode, setTimelinePeriodMode] = useState<'single' | 'range'>('single');
  const [timelineRangePreset, setTimelineRangePreset] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [timelineStartDate, setTimelineStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [timelineEndDate, setTimelineEndDate] = useState<string>(todayStr);
  const [timelineChannelFilter, setTimelineChannelFilter] = useState<'all' | 'walkin' | 'booking'>('all');

  // Booking List Tab Filter & Search
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications Tab Filter
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  // Actions & Modal State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [completingBooking, setCompletingBooking] = useState<Booking | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Expanded booking card details
  const [expandedBarberCardIds, setExpandedBarberCardIds] = useState<Record<string, boolean>>({});
  const toggleBarberCardExpand = (id: string) => {
    setExpandedBarberCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Change PIN State for Barber Self-Service
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Commission Rate
  const commissionRate = activeDesigner?.commissionPercent ?? 50;

  // Filter all bookings strictly to this barber
  const barberBookings = useMemo(() => {
    if (!activeDesigner) return [];
    return bookings.filter((b) => b.designerId === activeDesigner.id);
  }, [bookings, activeDesigner]);

  // Timeline Bookings for Selected Date or Date Range with Channel Filter
  const timelineFilteredBookings = useMemo(() => {
    return barberBookings
      .filter((b) => {
        // Date Filtering
        if (timelinePeriodMode === 'single') {
          if (b.date !== selectedDate) return false;
        } else {
          if (timelineStartDate && b.date < timelineStartDate) return false;
          if (timelineEndDate && b.date > timelineEndDate) return false;
        }

        // Channel Filtering
        if (timelineChannelFilter === 'walkin' && !b.isWalkin) return false;
        if (timelineChannelFilter === 'booking' && b.isWalkin) return false;

        return true;
      })
      .sort((a, b) => {
        const dComp = (a.date || '').localeCompare(b.date || '');
        if (dComp !== 0) return dComp;
        return (a.timeSlot || '').localeCompare(b.timeSlot || '');
      });
  }, [barberBookings, timelinePeriodMode, selectedDate, timelineStartDate, timelineEndDate, timelineChannelFilter]);

  // Dynamic Timeline Statistics for Selected Period (Only COMPLETED bookings count toward revenue and commission)
  const timelineStats = useMemo(() => {
    let walkinCount = 0;
    let walkinRevenue = 0;
    let bookingCount = 0;
    let bookingRevenue = 0;
    let totalServiceValue = 0;
    let totalCommission = 0;

    timelineFilteredBookings.forEach((b) => {
      const isCompleted = b.status === 'completed';
      const finalPrice = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));

      if (b.isWalkin) {
        walkinCount += 1;
        if (isCompleted) {
          walkinRevenue += finalPrice;
        }
      } else {
        bookingCount += 1;
        if (isCompleted) {
          bookingRevenue += finalPrice;
        }
      }

      // STRICT FINANCIAL RULE: Financials (Revenue, Service Value, Commission) ONLY accumulate when COMPLETED
      if (isCompleted) {
        totalServiceValue += finalPrice;
        const comm = typeof b.commissionAmount === 'number' && b.commissionAmount > 0
          ? b.commissionAmount
          : Math.round((finalPrice * commissionRate) / 100);
        totalCommission += comm;
      }
    });

    return {
      totalCount: timelineFilteredBookings.length,
      walkinCount,
      walkinRevenue,
      bookingCount,
      bookingRevenue,
      totalServiceValue,
      totalCommission
    };
  }, [timelineFilteredBookings, commissionRate]);

  // Legacy timelineBookings alias for backward-compatible handlers
  const timelineBookings = timelineFilteredBookings;

  // Search & Filter for Booking List Tab
  const filteredBookingsList = useMemo(() => {
    const filtered = barberBookings.filter((b) => {
      // Status Filter
      if (bookingStatusFilter === 'pending' && b.status !== 'pending') return false;
      if (bookingStatusFilter === 'confirmed' && b.status !== 'confirmed') return false;
      if (bookingStatusFilter === 'completed' && b.status !== 'completed') return false;
      if (bookingStatusFilter === 'cancelled' && b.status !== 'cancelled') return false;

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = b.customerName.toLowerCase().includes(q);
        const matchPhone = b.customerPhone.toLowerCase().includes(q);
        const matchCode = b.bookingCode.toLowerCase().includes(q);
        const matchService = b.serviceName.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode && !matchService) return false;
      }

      return true;
    });

    return sortBookingsMostRecentFirst(filtered);
  }, [barberBookings, bookingStatusFilter, searchQuery]);

  // Performance Calculations (Barber-Only Metrics: No Shop Revenue)
  const completedBookings = useMemo(() => {
    return barberBookings.filter((b) => b.status === 'completed');
  }, [barberBookings]);

  // Barber's own commission calculation
  const totalCommissionEarned = useMemo(() => {
    return completedBookings.reduce((acc, b) => {
      const price = b.servicePrice - (b.discountAmount || 0);
      return acc + Math.round((price * commissionRate) / 100);
    }, 0);
  }, [completedBookings, commissionRate]);

  // Rated Bookings & Comprehensive Rating Status
  const ratedBookings = useMemo(() => {
    return barberBookings.filter((b) => b.rating && b.rating > 0);
  }, [barberBookings]);

  const starCounts = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratedBookings.forEach((b) => {
      const r = Math.min(5, Math.max(1, Math.round(b.rating || 5)));
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [ratedBookings]);

  const avgRating = useMemo(() => {
    if (ratedBookings.length === 0) {
      return activeDesigner?.rating || 5.0;
    }
    const sum = ratedBookings.reduce((acc, b) => acc + (b.rating || 5), 0);
    return Number((sum / ratedBookings.length).toFixed(1));
  }, [ratedBookings, activeDesigner]);

  const satisfactionRate = useMemo(() => {
    if (ratedBookings.length === 0) return 100;
    const positiveCount = (starCounts[5] || 0) + (starCounts[4] || 0);
    return Math.round((positiveCount / ratedBookings.length) * 100);
  }, [ratedBookings, starCounts]);

  const pendingCount = useMemo(() => {
    return barberBookings.filter((b) => b.status === 'pending').length;
  }, [barberBookings]);

  // Barber-Relevant Notifications: Strictly restricted to this specific booked barber only!
  const barberNotifications = useMemo(() => {
    if (!activeDesigner?.id) return [];
    const clearedIds = getClearedNotificationIds();
    return notifications.filter((n) => {
      return isNotificationForBarber(n, activeDesigner.id, activeDesigner.phone, activeDesigner.name, clearedIds);
    });
  }, [notifications, activeDesigner]);

  const unreadNotifCount = useMemo(() => {
    return barberNotifications.filter((n) => !n.read).length;
  }, [barberNotifications]);

  const filteredNotifs = useMemo(() => {
    if (notifFilter === 'unread') {
      return barberNotifications.filter((n) => !n.read);
    }
    return barberNotifications;
  }, [barberNotifications, notifFilter]);

  // Accept / Confirm Booking
  const handleConfirmBooking = async (b: Booking) => {
    setActionLoadingId(b.id);
    try {
      await api.updateBookingStatus(b.id, 'confirmed', `Barber ${activeDesigner?.name || ''} မှ ဘိုကင် အတည်ပြု လက်ခံလိုက်ပါပြီ`);
      playSuccessChime();
      onRefresh();
    } catch (err) {
      console.error('Failed to confirm booking:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Start In-Chair Service
  const handleStartService = async (b: Booking) => {
    setActionLoadingId(b.id);
    try {
      await api.updateBookingStatus(b.id, 'in-progress', `ဧည့်သည်တော် ခုံပေါ်ရောက်ရှိပြီး ဝန်ဆောင်မှု စတင်နေပါသည်`);
      playNotificationChime();
      onRefresh();
    } catch (err) {
      console.error('Failed to start service:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Complete Modal
  const handleOpenCompleteModal = (b: Booking) => {
    setCompletingBooking(b);
    setCompletionNote(`Classic Haircut & Styling done. Clean neck taper, beard trimmed.`);
  };

  // Submit Complete with Note
  const handleSubmitComplete = async () => {
    if (!completingBooking) return;
    setSavingNote(true);
    try {
      await api.completeBookingWithNote(completingBooking.id, completionNote);
      playSuccessChime();
      setCompletingBooking(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to complete booking:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Notification Actions
  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read) {
      try {
        playNotificationChime();
        await api.markNotificationsRead('all', [n.id]);
        n.read = true;
        n.readAt = new Date().toISOString();
        onRefresh();
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }
  };

  const handleMarkAllRead = async () => {
    const ids = barberNotifications.map((n) => n.id);
    await api.markNotificationsRead('all', ids);
    playSuccessChime();
    onRefresh();
  };

  const handleClearNotifs = async () => {
    if (confirm(lang === 'my' ? 'သတိပေးချက်များ အားလုံးကို ရှင်းလင်းရန် သေချာပါသလား?' : 'Clear all notifications?')) {
      const ids = barberNotifications.map((n) => n.id);
      await api.clearAllNotifications('all', ids);
      playSuccessChime();
      onRefresh();
    }
  };

  // Barber Change Login PIN Submit
  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError('');
    setPinChangeSuccess('');

    if (!activeDesigner) return;
    const currentSavedPin = (activeDesigner.loginPin || '1234').trim();

    if (currentPinInput.trim() !== currentSavedPin) {
      setPinChangeError(lang === 'my' ? 'လက်ရှိ PIN ကုဒ် မှားယွင်းနေပါသည်' : 'Current PIN is incorrect');
      return;
    }

    if (newPinInput.length < 4 || newPinInput.length > 8) {
      setPinChangeError(lang === 'my' ? 'PIN အသစ်သည် ဂဏန်း ၄ လုံးမှ ၈ လုံးအတွင်း ဖြစ်ရပါမည်' : 'New PIN must be 4 to 8 digits');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinChangeError(lang === 'my' ? 'PIN အသစ် နှစ်ကြိမ် ရိုက်ထည့်မှု မတူညီပါ' : 'New PIN and confirmation do not match');
      return;
    }

    setIsSavingPin(true);
    try {
      await api.updateDesignerAccount(activeDesigner.id, { loginPin: newPinInput.trim() });
      playSuccessChime();
      setPinChangeSuccess(lang === 'my' ? '✅ PIN ကုဒ် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ' : '✅ PIN successfully changed!');
      setTimeout(() => {
        setIsChangePinOpen(false);
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setPinChangeSuccess('');
        onRefresh();
      }, 1400);
    } catch (err) {
      setPinChangeError(lang === 'my' ? 'PIN ပြောင်းလဲမှု မအောင်မြင်ပါ' : 'Failed to update PIN');
    } finally {
      setIsSavingPin(false);
    }
  };

  // Date Helper
  const changeDateByDays = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    setSelectedDate(curr.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-5 font-sans max-w-5xl mx-auto pb-12">
      {/* 1. TOP BARBER DESK HEADER CARD */}
      <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Barber Info */}
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <img
                src={activeDesigner?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                alt={activeDesigner?.name}
                referrerPolicy="no-referrer"
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-emerald-600 shadow-xs shrink-0"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" title="Online" />
            </div>

            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base sm:text-lg font-black text-stone-950 font-mono">
                  {activeDesigner?.name}
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold flex items-center space-x-1">
                  <Star className="w-3 h-3 fill-emerald-500 text-emerald-600" />
                  <span>★ {activeDesigner?.rating || '5.0'}</span>
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {commissionRate}% Commission
                </span>
              </div>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                {activeDesigner?.title} • {activeDesigner?.phone || '09000000000'}
              </p>
            </div>
          </div>

          {/* Right Controls: Switcher (if admin testing) & Logout */}
          <div className="flex items-center space-x-2 self-end sm:self-center">
            {!isDirectBarberRole && designers.length > 1 && (
              <select
                value={activeDesigner?.id || selectedDesignerId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedDesignerId(newId);
                  const found = designers.find((d) => d.id === newId);
                  if (found) {
                    try {
                      localStorage.setItem('baba_active_barber_id', found.id);
                      localStorage.setItem('baba_active_barber_phone', found.phone || '');
                      localStorage.setItem('baba_active_barber_name', found.name || '');
                      localStorage.setItem('baba_active_barber_obj', JSON.stringify(found));
                    } catch {}
                  }
                }}
                className="bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-2.5 py-2 font-mono cursor-pointer focus:outline-hidden focus:border-emerald-600"
              >
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.title})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={onRefresh}
              className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl cursor-pointer transition-all active:scale-95"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentPinInput('');
                setNewPinInput('');
                setConfirmPinInput('');
                setPinChangeError('');
                setPinChangeSuccess('');
                setIsChangePinOpen(true);
              }}
              className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all active:scale-95 border border-stone-200"
              title="Change My Login PIN"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">{lang === 'my' ? 'PIN ပြောင်းမည်' : 'Change PIN'}</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'my' ? 'ထွက်မည်' : 'Log Out'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. TAB VIEWS CONTENT (Navigated via Bottom Navigation Bar) */}
      <div>
        
        {/* ========================================================================= */}
        {/* TAB 1: TIMELINE (DEFAULT SCREEN) WITH DATE RANGE & COMMISSION STATS       */}
        {/* ========================================================================= */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            
            {/* Filter & Date Range Header Card */}
            <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
              {/* Mode Toggle & Presets */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3.5">
                <div className="flex items-center space-x-1.5 bg-stone-100 p-1 rounded-2xl self-start">
                  <button
                    type="button"
                    onClick={() => setTimelinePeriodMode('single')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                      timelinePeriodMode === 'single'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-950'
                    }`}
                  >
                    📅 {lang === 'my' ? 'တစ်ရက်ချင်း (Single Day)' : 'Single Day'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelinePeriodMode('range')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                      timelinePeriodMode === 'range'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-950'
                    }`}
                  >
                    🗓️ {lang === 'my' ? 'ရက်အပိုင်းအခြား (Date Range)' : 'Date Range'}
                  </button>
                </div>

                {/* Channel Filter Pills (All / Walk-in / Booking) */}
                <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-2xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setTimelineChannelFilter('all')}
                    className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-xl cursor-pointer transition-all ${
                      timelineChannelFilter === 'all'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {lang === 'my' ? 'အားလုံး' : 'All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineChannelFilter('walkin')}
                    className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-xl cursor-pointer transition-all ${
                      timelineChannelFilter === 'walkin'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    🚶 {lang === 'my' ? 'Walk-in သီးသန့်' : 'Walk-in'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineChannelFilter('booking')}
                    className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-xl cursor-pointer transition-all ${
                      timelineChannelFilter === 'booking'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    📱 {lang === 'my' ? 'Booking သီးသန့်' : 'Booking'}
                  </button>
                </div>
              </div>

              {/* Date Selector Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {timelinePeriodMode === 'single' ? (
                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    <button
                      onClick={() => changeDateByDays(-1)}
                      className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl cursor-pointer transition-all active:scale-95"
                      title="Previous Day"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-stone-50 border border-stone-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-stone-900 cursor-pointer focus:outline-hidden focus:border-emerald-600"
                    />

                    <button
                      onClick={() => setSelectedDate(todayStr)}
                      className={`px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl cursor-pointer transition-all ${
                        selectedDate === todayStr
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {lang === 'my' ? 'ယနေ့ (Today)' : 'Today'}
                    </button>

                    <button
                      onClick={() => changeDateByDays(1)}
                      className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl cursor-pointer transition-all active:scale-95"
                      title="Next Day"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    {/* Presets */}
                    <button
                      type="button"
                      onClick={() => {
                        setTimelineRangePreset('today');
                        setTimelineStartDate(todayStr);
                        setTimelineEndDate(todayStr);
                      }}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-xl cursor-pointer transition-all ${
                        timelineRangePreset === 'today' && timelineStartDate === todayStr && timelineEndDate === todayStr
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {lang === 'my' ? 'ယနေ့' : 'Today'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTimelineRangePreset('week');
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setTimelineStartDate(d.toISOString().split('T')[0]);
                        setTimelineEndDate(todayStr);
                      }}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-xl cursor-pointer transition-all ${
                        timelineRangePreset === 'week'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {lang === 'my' ? 'လွန်ခဲ့သော ၇ ရက်' : 'Last 7 Days'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTimelineRangePreset('month');
                        const d = new Date();
                        d.setDate(d.getDate() - 30);
                        setTimelineStartDate(d.toISOString().split('T')[0]);
                        setTimelineEndDate(todayStr);
                      }}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded-xl cursor-pointer transition-all ${
                        timelineRangePreset === 'month'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {lang === 'my' ? 'ဒီလ / ၃၀ ရက်' : 'Last 30 Days'}
                    </button>

                    {/* Date Inputs */}
                    <div className="flex items-center space-x-1.5 text-xs font-mono font-bold">
                      <input
                        type="date"
                        value={timelineStartDate}
                        onChange={(e) => {
                          setTimelineRangePreset('custom');
                          setTimelineStartDate(e.target.value);
                        }}
                        className="bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1 text-xs font-mono text-stone-900 cursor-pointer focus:outline-hidden focus:border-emerald-600"
                      />
                      <span className="text-stone-400">~</span>
                      <input
                        type="date"
                        value={timelineEndDate}
                        onChange={(e) => {
                          setTimelineRangePreset('custom');
                          setTimelineEndDate(e.target.value);
                        }}
                        className="bg-stone-50 border border-stone-300 rounded-xl px-2.5 py-1 text-xs font-mono text-stone-900 cursor-pointer focus:outline-hidden focus:border-emerald-600"
                      />
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-stone-500 font-mono">
                  ⏰ Working Shift: {activeDesigner?.workingHours?.start || '09:00'} - {activeDesigner?.workingHours?.end || '20:00'}
                </div>
              </div>
            </div>

            {/* 4 HIGHLIGHT KPI STATS CARDS FOR SELECTED PERIOD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Card 1: Walk-ins */}
              <div className="bg-white border border-stone-200 rounded-3xl p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-stone-500 text-xs font-mono font-bold">
                  <span className="flex items-center space-x-1">
                    <span>🚶</span>
                    <span>{lang === 'my' ? 'Walk-in စာရင်း' : 'Walk-ins'}</span>
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    {timelineStats.walkinCount} {lang === 'my' ? 'ဦး' : 'jobs'}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-black text-stone-950 font-mono tracking-tight">
                  {formatPrice(timelineStats.walkinRevenue)}
                </div>
                <p className="text-[10px] text-stone-400 font-mono">
                  {lang === 'my' ? 'ဆိုင်ရောက် တိုက်ရိုက် ဝန်ဆောင်မှု' : 'Direct walk-in clients'}
                </p>
              </div>

              {/* Card 2: Online Bookings */}
              <div className="bg-white border border-stone-200 rounded-3xl p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-stone-500 text-xs font-mono font-bold">
                  <span className="flex items-center space-x-1">
                    <span>📱</span>
                    <span>{lang === 'my' ? 'Booking စာရင်း' : 'Bookings'}</span>
                  </span>
                  <span className="text-[10px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                    {timelineStats.bookingCount} {lang === 'my' ? 'ဦး' : 'jobs'}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-black text-stone-950 font-mono tracking-tight">
                  {formatPrice(timelineStats.bookingRevenue)}
                </div>
                <p className="text-[10px] text-stone-400 font-mono">
                  {lang === 'my' ? 'ပြီးမြောက်ပြီး ကြိုတင်ဘိုကင်များ' : 'Completed bookings only'}
                </p>
              </div>

              {/* Card 3: Total Service Value */}
              <div className="bg-white border border-stone-200 rounded-3xl p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-stone-500 text-xs font-mono font-bold">
                  <span className="flex items-center space-x-1">
                    <Scissors className="w-3.5 h-3.5 text-stone-600 inline" />
                    <span>{lang === 'my' ? 'ပြီးစီး တန်ဖိုး' : 'Completed Value'}</span>
                  </span>
                  <span className="text-[10px] bg-stone-100 text-stone-800 px-2 py-0.5 rounded-full border border-stone-200">
                    {timelineStats.totalCount} {lang === 'my' ? 'ခု' : 'total'}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-black text-stone-950 font-mono tracking-tight">
                  {formatPrice(timelineStats.totalServiceValue)}
                </div>
                <p className="text-[10px] text-stone-400 font-mono">
                  {lang === 'my' ? 'ပြီးမြောက်ပြီး ဝန်ဆောင်မှု စုစုပေါင်း' : 'Completed services total'}
                </p>
              </div>

              {/* Card 4: Barber Commission */}
              <div className="bg-emerald-950 text-white rounded-3xl p-4 shadow-2xs space-y-1 border border-emerald-900">
                <div className="flex items-center justify-between text-emerald-300 text-xs font-mono font-bold">
                  <span className="flex items-center space-x-1">
                    <Award className="w-3.5 h-3.5 text-emerald-400 inline" />
                    <span>{lang === 'my' ? 'ရရှိပြီး ကော်မရှင်' : 'Earned Commission'}</span>
                  </span>
                  <span className="text-[10px] bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded-full">
                    {commissionRate}%
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-300 font-mono tracking-tight">
                  {formatPrice(timelineStats.totalCommission)}
                </div>
                <p className="text-[10px] text-emerald-400 font-mono">
                  {lang === 'my' ? 'ပြီးမြောက်ပြီးမှ ရရှိသော ကော်မရှင်' : 'Earned from completed jobs'}
                </p>
              </div>
            </div>

            {/* Visual Timeline & Appointment Schedule */}
            <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono flex items-center space-x-2">
                  <Clock3 className="w-4 h-4 text-emerald-700" />
                  <span>
                    {timelinePeriodMode === 'single'
                      ? selectedDate === todayStr
                        ? (lang === 'my' ? 'ယနေ့ အချိန်ဇယား (Today Timeline)' : 'Today Schedule')
                        : `Schedule for ${selectedDate}`
                      : `${lang === 'my' ? 'အချိန်ဇယားနှင့် မှတ်တမ်း' : 'Schedule & History'} (${timelineStartDate} ~ ${timelineEndDate})`}
                  </span>
                </h3>
                <span className="text-[11px] font-mono text-stone-400">
                  {timelineFilteredBookings.length} {lang === 'my' ? 'ခု ရှိပါသည်' : 'Appointments'}
                </span>
              </div>

              {timelineFilteredBookings.length === 0 ? (
                <div className="text-center py-12 text-stone-400 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-700">
                      {lang === 'my' ? 'ရွေးချယ်ထားသော နေ့ရက်/ကာလတွင် ဝန်ဆောင်မှု မှတ်တမ်း မရှိပါ' : 'No appointments found for the selected period'}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      {lang === 'my' ? 'ဧည့်သည်တော်များ ဘိုကင်တင်လာပါက သို့မဟုတ် walk-in သွင်းပါက ဤနေရာတွင် တိုက်ရိုက်ပေါ်လာပါမည်။' : 'Scheduled and walk-in appointments will appear here.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTimelinePeriodMode('single');
                      setSelectedDate(todayStr);
                      setTimelineChannelFilter('all');
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-mono font-bold cursor-pointer"
                  >
                    {lang === 'my' ? 'ယနေ့သို့ ပြန်သွားမည် (Back to Today)' : 'Back to Today'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:left-4 sm:before:left-6 before:top-3 before:bottom-3 before:w-0.5 before:bg-stone-200">
                  {timelineFilteredBookings.map((b) => {
                    const finalPrice = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));
                    const comm = typeof b.commissionAmount === 'number' && b.commissionAmount > 0
                      ? b.commissionAmount
                      : Math.round((finalPrice * commissionRate) / 100);
                    const isBusy = actionLoadingId === b.id;

                    const isConfirmed = b.status === 'confirmed';
                    const isInProgress = b.status === 'in-progress';
                    const isCompleted = b.status === 'completed';
                    const isPending = b.status === 'pending';

                    return (
                      <div key={b.id} className="relative pl-10 sm:pl-14">
                        {/* Timeline Node Icon */}
                        <div className={`absolute left-2 sm:left-4 -translate-x-1/2 top-3 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                          isCompleted
                            ? 'border-emerald-500 text-emerald-600'
                            : isInProgress
                            ? 'border-blue-500 bg-blue-50 text-blue-600 animate-pulse'
                            : isConfirmed
                            ? 'border-emerald-600 text-emerald-700'
                            : 'border-stone-400 text-stone-500'
                        }`}>
                          <span className="w-2 h-2 rounded-full bg-current" />
                        </div>

                        {/* Timeline Card */}
                        <div className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs space-y-3 ${
                          isInProgress
                            ? 'bg-blue-50/60 border-blue-300'
                            : isCompleted
                            ? 'bg-stone-50 border-stone-200'
                            : 'bg-white border-stone-200 hover:border-emerald-400'
                        }`}>
                          
                          {/* Card Header: Date + Time Slot + Type Badge + Status */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/70 pb-2.5">
                            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                              <span className="px-2.5 py-1 bg-stone-950 text-white font-mono text-xs font-black rounded-xl">
                                {timelinePeriodMode === 'range' ? `${b.date} • ` : ''}⏰ {b.timeSlot}
                              </span>
                              
                              {/* Walk-in vs Booking Channel Badge */}
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                b.isWalkin
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-300'
                              }`}>
                                {b.isWalkin ? '🚶 Walk-in' : '📱 Online Booking'}
                              </span>

                              <span className="text-xs font-mono font-bold text-stone-500">
                                {b.bookingCode}
                              </span>
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : isInProgress
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : isConfirmed
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : b.status === 'cancelled'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-stone-100 text-stone-800 border-stone-300'
                              }`}>
                                {b.status === 'in-progress' ? 'ခုံပေါ်ရောက် (In Chair)' : b.status}
                              </span>
                            </div>
                          </div>

                          {/* Customer & Service Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-stone-400 text-[10px] uppercase font-mono">Customer</p>
                              <p className="font-extrabold text-stone-900 text-sm mt-0.5">{b.customerName}</p>
                              {b.customerPhone && b.customerPhone !== 'Walk-in Guest' && (
                                <a
                                  href={`tel:${b.customerPhone}`}
                                  className="inline-flex items-center space-x-1 text-stone-600 hover:text-emerald-700 font-mono mt-0.5"
                                >
                                  <Phone className="w-3 h-3 text-emerald-700" />
                                  <span>{b.customerPhone}</span>
                                </a>
                              )}
                            </div>

                            <div>
                              <p className="text-stone-400 text-[10px] uppercase font-mono">Service Request & Price</p>
                              <p className="font-bold text-stone-900 mt-0.5 flex items-center space-x-1">
                                <Scissors className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>{b.serviceName}</span>
                              </p>
                              {/* Additional Services if any */}
                              {b.additionalServices && b.additionalServices.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {b.additionalServices.map((as, idx) => (
                                    <span key={idx} className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-mono border border-stone-200">
                                      +{as.name} ({formatPrice(as.price)})
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center space-x-2 mt-1 font-mono">
                                <span className="text-xs font-bold text-stone-900">
                                  {lang === 'my' ? 'တန်ဖိုး:' : 'Price:'} {formatPrice(finalPrice)}
                                </span>
                                <span className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                  <Award className="w-3 h-3 text-emerald-600 inline shrink-0" />
                                  <span>{lang === 'my' ? 'ကော်မရှင်:' : 'Comm:'} {formatPrice(comm)}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Customer Notes */}
                          {b.notes && (
                            <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200 text-xs text-stone-700 flex items-start space-x-2">
                              <MessageSquare className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-stone-900">{lang === 'my' ? 'ဧည့်သည်တော် မှတ်ချက်: ' : 'Customer Note: '}</span>
                                <span>{b.notes}</span>
                              </div>
                            </div>
                          )}

                          {/* Barber Work Note if completed */}
                          {b.completionNote && (
                            <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start space-x-2">
                              <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">Barber Work Note: </span>
                                <span>{b.completionNote}</span>
                              </div>
                            </div>
                          )}

                          {/* Client Rating & Review if completed */}
                          {b.rating && (
                            <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start space-x-2">
                              <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-600 shrink-0 mt-0.5" />
                              <div>
                                <div className="flex items-center space-x-1">
                                  <span className="font-bold">⭐️ Client Rating: {b.rating} / 5.0</span>
                                  <div className="flex items-center text-emerald-600 ml-1">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star key={s} className={`w-3 h-3 ${s <= (b.rating || 0) ? 'fill-emerald-500 text-emerald-600' : 'text-stone-300'}`} />
                                    ))}
                                  </div>
                                </div>
                                {b.reviewNote && <p className="text-stone-700 italic mt-0.5">"{b.reviewNote}"</p>}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons on Timeline */}
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-stone-200/70">
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleConfirmBooking(b)}
                                disabled={isBusy}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer active:scale-95 shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{lang === 'my' ? 'အတည်ပြုလက်ခံမည် (Confirm)' : 'Confirm'}</span>
                              </button>
                            )}

                            {isConfirmed && (
                              <button
                                type="button"
                                onClick={() => handleOpenCompleteModal(b)}
                                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer active:scale-95 shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                <span>{lang === 'my' ? 'ပြီးစီးကြောင်း Note ချမည်' : 'Complete with Note'}</span>
                              </button>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BOOKING LIST (ဘိုကင်စာရင်းတွေကို ကြည့်နိုင်၊ အတည်ပြုနိုင်သော စာရင်း) */}
        {/* ========================================================================= */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            
            {/* Search & Filter Controls */}
            <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name, phone, or booking code..."
                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-950 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-700"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="text-xs font-mono text-stone-500 shrink-0">
                  Total Found: <span className="font-bold text-stone-900">{filteredBookingsList.length}</span>
                </div>
              </div>

              {/* Status Filter Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { id: 'all', label: `အားလုံး (${barberBookings.length})` },
                  { id: 'pending', label: `အတည်ပြုရန် (${pendingCount})` },
                  { id: 'confirmed', label: `အတည်ပြုပြီး (${barberBookings.filter(b => b.status === 'confirmed').length})` },
                  { id: 'completed', label: `ပြီးစီး (${completedBookings.length})` },
                  { id: 'cancelled', label: `ပယ်ဖျက် (${barberBookings.filter(b => b.status === 'cancelled').length})` },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setBookingStatusFilter(chip.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      bookingStatusFilter === chip.id
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookings List Cards */}
            <div className="space-y-3">
              {filteredBookingsList.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-400 space-y-2">
                  <Scissors className="w-8 h-8 mx-auto text-stone-300" />
                  <p className="text-xs font-bold text-stone-600">ဘိုကင်စာရင်း မရှိသေးပါ</p>
                  <p className="text-[11px]">ရှာဖွေမှု filter များကို ပြောင်းလဲကြည့်ရှုနိုင်ပါသည်</p>
                </div>
              ) : (
                filteredBookingsList.map((b) => {
                  const finalPrice = Math.max(0, b.servicePrice - (b.discountAmount || 0));
                  const comm = Math.round((finalPrice * commissionRate) / 100);
                  const isBusy = actionLoadingId === b.id;
                  const isExpanded = !!expandedBarberCardIds[b.id];
                  const hasDetails = b.notes || b.completionNote || b.rating || b.reviewNote || b.paymentSlipUrl;

                  return (
                    <div
                      key={b.id}
                      className="bg-white border border-stone-200 hover:border-emerald-400 rounded-xl p-3 shadow-2xs transition-all space-y-2"
                    >
                      {/* Top Compact Row: Code, Date & Time, Commission & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="px-2 py-0.5 bg-emerald-700 text-white font-mono text-xs font-bold rounded-md shrink-0">
                            {b.bookingCode}
                          </span>
                          <span className="text-xs font-mono font-semibold text-stone-800 truncate">
                            📅 {b.date} <span className="text-emerald-800 font-bold">({b.timeSlot})</span>
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Award className="w-3 h-3 text-emerald-600" />
                            <span>+{formatPrice(comm)}</span>
                          </span>

                          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                            b.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : b.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : b.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : b.status === 'cancelled'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-stone-100 text-stone-800 border-stone-300'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                      </div>

                      {/* Main Info Row: Customer & Service */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-50/80 p-2 rounded-lg border border-stone-200/80 text-xs">
                        <div className="flex items-center space-x-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {b.customerName ? b.customerName.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-stone-900 truncate leading-tight">{b.customerName}</p>
                            {b.customerPhone && (
                              <div className="flex items-center space-x-2 mt-0.5">
                                <a
                                  href={`tel:${b.customerPhone}`}
                                  className="inline-flex items-center space-x-1 text-[11px] text-stone-600 hover:text-emerald-800 font-mono"
                                >
                                  <Phone className="w-2.5 h-2.5 text-emerald-700" />
                                  <span>{b.customerPhone}</span>
                                </a>
                                <a
                                  href={`viber://chat?number=%2B95${b.customerPhone.replace(/^09/, '9')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-purple-700 font-bold hover:underline"
                                  title="Viber"
                                >
                                  [Viber]
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end sm:space-x-3 text-right">
                          <div>
                            <p className="font-bold text-stone-900 truncate leading-tight">{b.serviceName}</p>
                            <span className="text-[10px] text-stone-500 font-mono">
                              {b.paymentStatus === 'verified' || b.paymentStatus === 'paid_advance' ? '✅ Paid' : '💵 Pay at Shop'} • {formatPrice(finalPrice)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick 1-Tap Action Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-xs">
                        <div>
                          {b.rating ? (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Star className="w-3 h-3 fill-emerald-500 text-emerald-600" />
                              <span>{b.rating} / 5</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400 font-mono">
                              Commission: {commissionRate}%
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {b.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmBooking(b)}
                              disabled={isBusy}
                              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer active:scale-95 shadow-2xs"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm</span>
                            </button>
                          )}

                          {b.status !== 'completed' && b.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleOpenCompleteModal(b)}
                              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer active:scale-95 shadow-2xs"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                              <span>Complete & Note</span>
                            </button>
                          )}

                          {/* Details Toggle Button */}
                          {hasDetails && (
                            <button
                              type="button"
                              onClick={() => toggleBarberCardExpand(b.id)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold cursor-pointer flex items-center space-x-0.5"
                            >
                              <span>{isExpanded ? 'ဝှက်မည်' : 'အသေးစိတ်'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Collapsible Details: Notes, Barber Note, Review */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-stone-100 space-y-1.5 text-xs bg-stone-50/60 p-2.5 rounded-lg">
                          {b.notes && (
                            <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 text-stone-800 text-[11px]">
                              <span className="font-bold text-emerald-900">ဧည့်သည်တော် မှတ်ချက်: </span>
                              <span>"{b.notes}"</span>
                            </div>
                          )}

                          {b.completionNote && (
                            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-emerald-900 text-[11px]">
                              <span className="font-bold">Barber Completion Note: </span>
                              <span>"{b.completionNote}"</span>
                            </div>
                          )}

                          {b.reviewNote && (
                            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-emerald-950 text-[11px]">
                              <span className="font-bold">Client Review: </span>
                              <span className="italic">"{b.reviewNote}"</span>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NOTIFICATION (သတိပေးချက်များနှင့် စာတိုများ)                     */}
        {/* ========================================================================= */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            
            <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                      Barber Staff Alerts ({barberNotifications.length})
                    </h3>
                    <p className="text-[11px] text-stone-500 font-mono">ဘိုကင်အသစ်၊ ပြန်လည်သုံးသပ်ချက်နှင့် အသိပေးချက်များ</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleMarkAllRead}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all active:scale-95"
                  >
                    ဖတ်ပြီးမှတ်သားမည်
                  </button>

                  <button
                    onClick={handleClearNotifs}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all active:scale-95 flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ရှင်းလင်းမည်</span>
                  </button>
                </div>
              </div>

              {/* Unread / All Filter */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setNotifFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    notifFilter === 'all' ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  All ({barberNotifications.length})
                </button>
                <button
                  onClick={() => setNotifFilter('unread')}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    notifFilter === 'unread' ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  Unread ({unreadNotifCount})
                </button>
              </div>
            </div>

            {/* Notifications Feed List */}
            <div className="space-y-2.5">
              {filteredNotifs.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-3xl p-10 text-center text-stone-400 space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-stone-300" />
                  <p className="text-xs font-bold text-stone-700">သတိပေးချက် အသစ် မရှိပါ</p>
                </div>
              ) : (
                filteredNotifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`rounded-2xl border p-3.5 sm:p-4 transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      !n.read ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs' : 'bg-white hover:bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 mt-0.5">
                        {n.type === 'new_booking' ? (
                          <Calendar className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Bell className="w-4 h-4 text-stone-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <p className="text-xs font-black text-stone-950 truncate">{n.title}</p>
                            {!n.read && (
                              <span className="bg-emerald-700 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded-full shrink-0">
                                NEW
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono shrink-0">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-stone-700 leading-relaxed break-words">{n.message}</p>
                        {n.read && (
                          <div className="pt-1">
                            <AutoDeleteCountdownBadge
                              notification={n}
                              lang={lang}
                              onExpire={async (id) => {
                                await api.deleteNotification(id);
                                onRefresh();
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await api.deleteNotification(n.id);
                        onRefresh();
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: BARBER PROFILE & PERFORMANCE                                       */}
        {/* "ကိုယ့်ရဲ့ performance ကို ပြထားမယ့် Barber profile & Rating"               */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            
            {/* 1. Barber-Only Performance Analytics Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 font-mono">
              
              <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
                <p className="text-[10px] text-stone-500 uppercase">{lang === 'my' ? 'ပြီးစီးခဲ့သော ဝန်ဆောင်မှု' : 'Completed Jobs'}</p>
                <p className="text-xl sm:text-2xl font-black text-stone-950 mt-1">
                  {completedBookings.length} <span className="text-xs text-stone-400 font-normal">{lang === 'my' ? 'ခေါင်း' : 'jobs'}</span>
                </p>
                <p className="text-[10px] text-emerald-600 mt-1">{lang === 'my' ? 'အောင်မြင်စွာ ညှပ်ပေးပြီး' : 'Total haircuts finished'}</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 shadow-2xs">
                <p className="text-[10px] text-emerald-800 font-bold uppercase flex items-center space-x-1">
                  <Award className="w-3 h-3 text-emerald-600" />
                  <span>{lang === 'my' ? `ရရှိသည့် ကော်မရှင် (${commissionRate}%)` : `My Commission (${commissionRate}%)`}</span>
                </p>
                <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                  {formatPrice(totalCommissionEarned)}
                </p>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">{lang === 'my' ? 'Barber ကော်မရှင်ဝင်ငွေ' : 'Earned Payout'}</p>
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
                <p className="text-[10px] text-stone-500 uppercase">{lang === 'my' ? 'ပျမ်းမျှ စတားရမှတ်' : 'Average Rating'}</p>
                <p className="text-xl sm:text-2xl font-black text-stone-950 mt-1 flex items-center space-x-1.5">
                  <Star className="w-4 h-4 fill-emerald-500 text-emerald-600" />
                  <span>{avgRating.toFixed(1)}</span>
                  <span className="text-xs text-stone-400 font-normal">/ 5.0</span>
                </p>
                <p className="text-[10px] text-emerald-700 font-bold mt-1">{ratedBookings.length} {lang === 'my' ? 'သုံးသပ်ချက်များ' : 'Reviews'}</p>
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs">
                <p className="text-[10px] text-stone-500 uppercase">{lang === 'my' ? 'စိတ်ကျေနပ်မှု' : 'Satisfaction'}</p>
                <p className="text-xl sm:text-2xl font-black text-stone-950 mt-1">
                  {satisfactionRate}%
                </p>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">{lang === 'my' ? 'Positive Feedback' : 'Happy Clients'}</p>
              </div>

            </div>

            {/* 2. Rating & Client Review Analytics Breakdown */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-3 gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-stone-950 font-mono flex items-center space-x-2">
                  <Star className="w-4 h-4 text-emerald-600 fill-emerald-500" />
                  <span>{lang === 'my' ? 'စတားရမှတ် အခြေအနေ နှင့် သုံးသပ်ချက် ခွဲခြမ်းစိတ်ဖြာမှု' : 'Rating Status & Client Feedback Breakdown'}</span>
                </h3>
                <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                  {satisfactionRate}% {lang === 'my' ? 'အထူးစိတ်ကျေနပ်မှု ရရှိထားသည်' : 'Overall Satisfaction'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Score Summary */}
                <div className="md:col-span-4 bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center space-y-2">
                  <p className="text-3xl sm:text-4xl font-black text-stone-950 font-mono">
                    {avgRating.toFixed(1)}
                  </p>
                  <div className="flex items-center justify-center space-x-1 text-emerald-600">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(avgRating)
                            ? 'fill-emerald-500 text-emerald-600'
                            : 'text-stone-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-stone-600 font-medium">
                    {lang === 'my'
                      ? `စုစုပေါင်း ${ratedBookings.length} ဦး သုံးသပ်ထားပါသည်`
                      : `Based on ${ratedBookings.length} verified ratings`}
                  </p>
                </div>

                {/* Star Progress Distribution Bars */}
                <div className="md:col-span-8 space-y-2 font-mono text-xs">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = starCounts[stars] || 0;
                    const pct = ratedBookings.length > 0 ? Math.round((count / ratedBookings.length) * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center space-x-3">
                        <span className="w-12 text-stone-600 text-right flex items-center justify-end space-x-1">
                          <span>{stars}</span>
                          <Star className="w-3 h-3 fill-emerald-500 text-emerald-600" />
                        </span>
                        <div className="flex-1 bg-stone-100 rounded-full h-2.5 overflow-hidden border border-stone-200">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-16 text-[11px] text-stone-500 text-right">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Barber Profile Detail Card */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-2xs space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-stone-950 font-mono border-b border-stone-100 pb-3 flex items-center space-x-2">
                <User className="w-4 h-4 text-emerald-700" />
                <span>{lang === 'my' ? 'Barber ကိုယ်ရေးအချက်အလက်' : 'Barber Profile Details'}</span>
              </h3>

              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <img
                  src={activeDesigner?.avatarUrl}
                  alt={activeDesigner?.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                />
                <div className="space-y-1 text-xs">
                  <h4 className="text-base font-extrabold text-stone-950">{activeDesigner?.name}</h4>
                  <p className="text-stone-600 font-medium">{activeDesigner?.title} • {activeDesigner?.experienceYears} Years Experience</p>
                  <p className="text-stone-500 leading-relaxed max-w-xl">{activeDesigner?.bio || 'Professional gentlemen barber specialized in precision fades, classic scissor cuts and traditional hot towel beard shaving.'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono pt-2 border-t border-stone-100">
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <p className="text-[10px] text-stone-500 uppercase">{lang === 'my' ? 'ဖုန်းနံပါတ်' : 'Assigned Phone'}</p>
                  <p className="font-bold text-stone-900 mt-0.5">{activeDesigner?.phone || '09000000000'}</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <p className="text-[10px] text-stone-500 uppercase">{lang === 'my' ? 'တာဝန်ကျချိန်' : 'Working Hours'}</p>
                  <p className="font-bold text-stone-900 mt-0.5">{activeDesigner?.workingHours?.start || '09:00'} - {activeDesigner?.workingHours?.end || '20:00'}</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <p className="text-[10px] text-stone-500 uppercase">{lang === 'my' ? 'အကောင့် အခြေအနေ' : 'Account Status'}</p>
                  <p className="font-bold text-emerald-700 mt-0.5">
                    {activeDesigner?.active !== false ? '✅ Active on Roster' : '🚫 Account Suspended'}
                  </p>
                </div>
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase">{lang === 'my' ? 'Login PIN' : 'My PIN'}</p>
                    <p className="font-bold text-stone-900 mt-0.5 tracking-wider">••••</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPinInput('');
                      setNewPinInput('');
                      setConfirmPinInput('');
                      setPinChangeError('');
                      setPinChangeSuccess('');
                      setIsChangePinOpen(true);
                    }}
                    className="text-xs bg-white hover:bg-stone-100 text-stone-900 font-bold px-2 py-1 rounded-lg border border-stone-300 flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <KeyRound className="w-3 h-3 text-emerald-700" />
                    <span>{lang === 'my' ? 'PIN ပြောင်းရန်' : 'Change'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Client Reviews Feed */}
            <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-stone-950 font-mono flex items-center space-x-2">
                  <Star className="w-4 h-4 text-emerald-600 fill-emerald-500" />
                  <span>{lang === 'my' ? `ဧည့်သည်တော်များ၏ သုံးသပ်ချက်များ (${ratedBookings.length})` : `Recent Client Reviews (${ratedBookings.length})`}</span>
                </h3>
              </div>

              {ratedBookings.length === 0 ? (
                <p className="text-xs text-stone-400 py-4 text-center">{lang === 'my' ? 'ဒီဇိုင်နာအတွက် သုံးသပ်ချက် မှတ်ချက်များ မရှိသေးပါ' : 'No client reviews yet'}</p>
              ) : (
                <div className="space-y-2.5">
                  {ratedBookings.map((b) => (
                    <div key={b.id} className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-stone-900">{b.customerName}</span>
                          <span className="text-emerald-600 text-xs font-mono font-bold">
                            {'★'.repeat(b.rating || 5)}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono">{b.date} • {b.timeSlot}</span>
                      </div>
                      <p className="text-xs text-stone-700 italic">
                        "{b.reviewNote || (lang === 'my' ? 'အထူးကောင်းမွန်သော ဆံပင်ပုံသွင်းမှု ဝန်ဆောင်မှု ဖြစ်ပါသည်' : 'Excellent haircut service! Highly recommended.')}"
                      </p>
                      <p className="text-[10px] text-stone-500 font-mono">Service: {b.serviceName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* 4. COMPLETION WORK NOTE MODAL */}
      {completingBooking && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 font-mono">
                    Complete Booking & Add Work Note
                  </h3>
                  <p className="text-[11px] text-stone-500 font-mono">{completingBooking.bookingCode} • Client: {completingBooking.customerName}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-stone-700">
                လုပ်ဆောင်ခဲ့သည့် ဆံပင်ပုံစံ/ဝန်ဆောင်မှု မှတ်ချက် (Barber Work Note):
              </label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                rows={3}
                placeholder="ဆံပင်ညှပ်ပုံစံ၊ သုံးခဲ့သည့် product များ၊ နောက်တစ်ကြိမ် လာသင့်သည့် အချိန် စသည်တို့ကို မှတ်ချက်ချနိုင်ပါသည်..."
                className="w-full bg-stone-50 border border-stone-300 rounded-xl p-3 text-stone-900 focus:outline-hidden focus:border-emerald-600 text-xs"
              />

              {/* Quick Preset Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Side taper fade + beard trim',
                  'Classic skin fade completed',
                  'Hair wash & scalp massage done',
                  'Pomade styling wax applied',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCompletionNote(tag)}
                    className="text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono px-2 py-1 rounded-lg border border-stone-200 cursor-pointer"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletingBooking(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
              >
                ပိတ်မည် (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSubmitComplete}
                disabled={savingNote}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-md flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{savingNote ? 'သိမ်းဆည်းနေသည်...' : 'လုပ်ငန်းပြီးစီးကြောင်း အတည်ပြုမည်'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. BARBER CHANGE LOGIN PIN MODAL */}
      <AnimatePresence>
        {isChangePinOpen && (
          <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-xl font-sans"
            >
              <div className="flex items-center space-x-2.5 border-b border-stone-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 font-mono">
                    {lang === 'my' ? 'Barber Login PIN ပြောင်းလဲရန်' : 'Change Barber PIN'}
                  </h3>
                  <p className="text-[11px] text-stone-500 font-mono">
                    {activeDesigner?.name} ({activeDesigner?.phone})
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePinSubmit} className="space-y-3 font-mono text-xs">
                {pinChangeError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>{pinChangeError}</span>
                  </div>
                )}

                {pinChangeSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span>{pinChangeSuccess}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700">
                    {lang === 'my' ? 'လက်ရှိ PIN ကုဒ် (Current PIN):' : 'Current PIN:'}
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 tracking-widest text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700">
                    {lang === 'my' ? 'PIN အသစ် (New PIN 4-8 digits):' : 'New PIN (4-8 digits):'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 tracking-widest text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700">
                    {lang === 'my' ? 'PIN အသစ် ထပ်မံရိုက်ထည့်ပါ (Confirm):' : 'Confirm New PIN:'}
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={8}
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 font-bold focus:outline-hidden focus:border-emerald-600 tracking-widest text-center"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsChangePinOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                  >
                    {lang === 'my' ? 'ပိတ်မည်' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPin}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>{isSavingPin ? 'Saving...' : lang === 'my' ? 'PIN ပြောင်းမည်' : 'Save PIN'}</span>
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
