import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import { playNotificationChime, playSuccessChime } from '../utils/audio';
import { getClientBookings, normalizePhoneNumber } from '../utils/notifications';
import { BarberRatingModal } from './BarberRatingModal';
import {
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Star,
  Check,
  Phone,
  RefreshCw,
  Plus,
  CreditCard,
  MessageSquare,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

interface UserBookingHistoryProps {
  bookings: Booking[];
  onRefresh: () => void;
  onOpenNewBooking: () => void;
  userPhone?: string;
  onOpenPaymentModal?: (booking: Booking) => void;
}

const statusBadgeConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-300',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Pending Approval',
    bg: 'bg-emerald-50',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-300',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-100',
    text: 'text-emerald-950 font-bold',
    border: 'border-emerald-300',
    icon: Check,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-50',
    text: 'text-rose-900 font-bold',
    border: 'border-rose-200',
    icon: XCircle,
  },
};

export const UserBookingHistory: React.FC<UserBookingHistoryProps> = ({
  bookings,
  onRefresh,
  onOpenNewBooking,
  userPhone = '',
}) => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Active phone linkage state
  const [activeClientPhone, setActiveClientPhone] = useState<string>(() => {
    if (userPhone && userPhone.trim()) return userPhone.trim();
    try {
      const p1 = localStorage.getItem('baba_booking_customer_phone');
      if (p1 && p1.trim()) return p1.trim();
      const p2 = localStorage.getItem('baba_user_phone');
      if (p2 && p2.trim()) return p2.trim();
      const p3 = localStorage.getItem('baba_last_customer_phone');
      if (p3 && p3.trim()) return p3.trim();
      const profile = localStorage.getItem('baba_user_profile_v1');
      if (profile) {
        const parsed = JSON.parse(profile);
        if (parsed.phone && parsed.phone.trim()) return parsed.phone.trim();
      }
    } catch {}
    return '';
  });

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [inputPhone, setInputPhone] = useState(activeClientPhone);

  // Search booking code
  const [searchCode, setSearchCode] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);

  // Rating Modal State
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Reschedule Modal State
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  useEffect(() => {
    if (userPhone && userPhone.trim() && userPhone !== activeClientPhone) {
      setActiveClientPhone(userPhone.trim());
    }
  }, [userPhone]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const myBookings = getClientBookings(bookings, activeClientPhone);

  const myFilteredBookings = myBookings.filter((b) => {
    if (filter === 'upcoming') return b.status === 'confirmed' || b.status === 'pending';
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'cancelled') return b.status === 'cancelled';
    return true;
  });

  const handleCancel = async (id: string) => {
    if (!window.confirm('ဒီဘိုကင်ကို ပယ်ဖျက်ရန် သေချာပါသလား?')) return;
    setCancellingId(id);
    try {
      await api.updateBookingStatus(id, 'cancelled');
      playNotificationChime();
      showToast('ဘိုကင်ကို ပယ်ဖျက်ပြီးပါပြီ');
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast('ပယ်ဖျက်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setCancellingId(null);
    }
  };

  const handleOpenRating = (booking: Booking) => {
    if (booking.status !== 'completed') {
      showToast('ဝန်ဆောင်မှု ပြီးမြောက်ပြီးမှသာ Barber Rating ပေးနိုင်ပါမည်');
      return;
    }
    if (booking.rating && booking.rating > 0) {
      showToast(`ဤ Booking (${booking.bookingCode || booking.id.slice(0, 8)}) အတွက် Rating ${booking.rating}⭐️ ပေးပြီးဖြစ်ပါသည် (တစ်ကြိမ်သာ ပေးခွင့်ရှိပါသည်)`);
      return;
    }
    setRatingBooking(booking);
    setSelectedRating(5);
    setReviewNote('');
    playNotificationChime();
  };

  const handleReschedule = async () => {
    if (!reschedulingBooking || !newDate || !newTime) return;
    setIsSubmittingReschedule(true);
    try {
      await api.updateBooking(reschedulingBooking.id, {
        date: newDate,
        timeSlot: newTime,
      });
      playSuccessChime();
      showToast('ရက်ချိန်းအသစ် ပြောင်းလဲပြီးပါပြီ');
      setReschedulingBooking(null);
      onRefresh();
    } catch (e) {
      console.error(e);
      showToast('ရက်ချိန်း ပြောင်းလဲရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const handleSearchCodeToRate = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchNotFound(false);
    const code = searchCode.trim().toUpperCase();
    if (!code) return;

    const found = bookings.find(
      (b) => b.bookingCode?.toUpperCase() === code || b.id.toUpperCase() === code
    );

    if (found) {
      if (found.status !== 'completed') {
        showToast(`Booking (${found.bookingCode || found.id.slice(0, 8)}) မှာ ဝန်ဆောင်မှု မပြီးဆုံးသေးပါ (Status: ${found.status})`);
        return;
      }
      if (found.rating && found.rating > 0) {
        showToast(`Booking (${found.bookingCode || found.id.slice(0, 8)}) အတွက် Rating ${found.rating}⭐️ ပေးပြီးဖြစ်ပါသည် (တစ်ကြိမ်သာ ပေးခွင့်ရှိပါသည်)`);
        return;
      }
      handleOpenRating(found);
      setSearchCode('');
    } else {
      setSearchNotFound(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 pb-16">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 text-xs font-bold border border-emerald-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white border border-emerald-100 rounded-2xl p-3 px-4 shadow-2xs">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-emerald-700" />
          <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            My Appointments ({myFilteredBookings.length})
          </h2>
        </div>

        <button
          onClick={onOpenNewBooking}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-all shadow-xs active:scale-98"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Book Now</span>
        </button>
      </div>

      {/* Sleek Filter & Search Row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Status Filter Pills */}
        <div className="flex-1 bg-emerald-50/70 p-1 rounded-xl flex items-center space-x-1 border border-emerald-100/60">
          {(['all', 'upcoming', 'completed', 'cancelled'] as const).map((f) => {
            const labelMap = {
              all: 'All',
              upcoming: 'Upcoming',
              completed: 'Completed',
              cancelled: 'Cancelled',
            };
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  filter === f
                    ? 'bg-white text-emerald-950 shadow-2xs'
                    : 'text-stone-600 hover:text-emerald-900'
                }`}
              >
                {labelMap[f]}
              </button>
            );
          })}
        </div>

        {/* Quick Search/Rate Bar */}
        <form onSubmit={handleSearchCodeToRate} className="relative sm:w-48 shrink-0">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => {
              setSearchCode(e.target.value);
              setSearchNotFound(false);
            }}
            placeholder="Search Code to Rate..."
            className="w-full bg-white border border-emerald-100 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:outline-none shadow-2xs placeholder-stone-400 font-mono"
          />
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </form>
      </div>

      {searchNotFound && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>ဘိုကင်နံပါတ် ရှာမတွေ့ပါ။ စာလုံးပေါင်း မှန်မမှန် ပြန်စစ်ဆေးပေးပါ။</span>
        </div>
      )}

      {/* Linked Phone Bar */}
      {!isEditingPhone ? (
        <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 px-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="text-[11px] text-stone-500 shrink-0">Phone:</span>
            <span className="font-mono font-bold text-emerald-950 truncate">
              {activeClientPhone || 'Not linked'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setInputPhone(activeClientPhone);
              setIsEditingPhone(true);
            }}
            className="text-[11px] text-emerald-800 hover:text-emerald-950 font-bold px-2.5 py-1 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
          >
            {activeClientPhone ? 'Change Phone' : 'Link Phone'}
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-900 flex items-center space-x-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              <span>{activeClientPhone ? 'Change Phone Number' : 'Link Phone Number'}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsEditingPhone(false)}
              className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = inputPhone.trim().replace(/\s+/g, '');
              setActiveClientPhone(clean);
              localStorage.setItem('baba_booking_customer_phone', clean);
              setIsEditingPhone(false);
            }}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2"
          >
            <input
              type="tel"
              value={inputPhone}
              onChange={(e) => setInputPhone(e.target.value)}
              placeholder="09xxxxxxxxx"
              autoFocus
              className="flex-1 min-w-[140px] bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            />
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPhone(false)}
                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bookings List */}
      {myFilteredBookings.length === 0 ? (
        <div className="p-6 text-center bg-white border border-emerald-100 rounded-2xl space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-700">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-stone-900">
              {!activeClientPhone ? 'ဘိုကင်မှတ်တမ်း ရှာမတွေ့သေးပါ' : 'ဤဖုန်းနံပါတ်ဖြင့် ဘိုကင်မှတ်တမ်း မရှိသေးပါ'}
            </p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {!activeClientPhone
                ? 'သင် ဘိုကင်တင်စဉ်က အသုံးပြုခဲ့သော ဖုန်းနံပါတ် (သို့မဟုတ်) Booking Code ကို ထည့်သွင်း၍ ဘိုကင်မှတ်တမ်းများ ပြန်လည်ကြည့်ရှုနိုင်ပါသည်။'
                : 'ဖုန်းနံပါတ်ပြောင်းလဲလိုပါက အောက်တွင် အသစ်ထည့်သွင်းနိုင်ပါသည် (ဥပမာ - 09xxxxxxxxx)'}
            </p>
          </div>

          {/* Quick Phone Search Form in Empty State */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputPhone.trim()) {
                const clean = inputPhone.trim().replace(/\s+/g, '');
                setActiveClientPhone(clean);
                localStorage.setItem('baba_booking_customer_phone', clean);
                setIsEditingPhone(false);
              }
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto pt-1"
          >
            <input
              type="tel"
              value={inputPhone}
              onChange={(e) => setInputPhone(e.target.value)}
              placeholder="သင်၏ ဘိုကင်ဖုန်းနံပါတ် ထည့်ပါ (09xxxxxxxxx)"
              className="w-full sm:flex-1 bg-stone-50 border border-emerald-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:bg-white shadow-2xs"
            />
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all shrink-0"
            >
              မှတ်တမ်းရှာမည်
            </button>
          </form>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenNewBooking}
              className="bg-stone-900 hover:bg-stone-950 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-2xs transition-all active:scale-98 flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ဘိုကင်အသစ် တင်မည်</span>
            </button>
            <button
              onClick={onRefresh}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh ဒေတာ</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {myFilteredBookings.map((b) => {
            const isCompleted = b.status === 'completed';
            const isExpanded = !!expandedIds[b.id];
            const hasDetails = b.completionNote || b.rating || b.reviewNote || (b.statusHistory && b.statusHistory.length > 0) || b.paymentTxnId;

            const statusConfig = isCompleted
              ? b.rating
                ? {
                    label: `⭐️ ${b.rating} / 5 Stars`,
                    bg: 'bg-emerald-100',
                    text: 'text-emerald-950 font-bold',
                    border: 'border-emerald-300',
                    icon: Star,
                  }
                : {
                    label: 'Rate Service',
                    bg: 'bg-emerald-50',
                    text: 'text-emerald-900 font-bold',
                    border: 'border-emerald-300',
                    icon: Star,
                  }
              : statusBadgeConfig[b.status] || statusBadgeConfig.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={b.id}
                className="bg-white rounded-xl border border-emerald-100/90 hover:border-emerald-400 transition-all p-3 shadow-2xs space-y-2"
              >
                {/* Primary Row */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <img
                      src={b.designerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'}
                      alt={b.designerName}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-xl object-cover border border-emerald-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <h4 className="font-bold text-xs text-stone-900 truncate">{b.serviceName}</h4>
                        <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {b.bookingCode}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-stone-500 flex-wrap">
                        <span className="text-stone-700 font-medium truncate">{b.designerName}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-emerald-900 font-bold font-mono">
                          {b.date} ({b.timeSlot})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Price & Status */}
                  <div className="flex flex-col items-end shrink-0 space-y-1">
                    <span className="text-xs font-black font-mono text-stone-900">{formatPrice(b.servicePrice)}</span>
                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={() => handleOpenRating(b)}
                        className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] cursor-pointer ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                      >
                        <Star className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                        <span>{statusConfig.label}</span>
                      </button>
                    ) : (
                      <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        <span>{statusConfig.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-emerald-50 text-[11px]">
                  <span className="inline-flex items-center space-x-1 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200 text-[10px] text-stone-600">
                    <CreditCard className="w-3 h-3 text-emerald-600" />
                    <span>{b.paymentMethod === 'kpay_wave' ? 'KPay/Wave' : 'Cash'}</span>
                  </span>

                  <div className="flex items-center space-x-1.5">
                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                      <>
                        <button
                          onClick={() => {
                            setReschedulingBooking(b);
                            setNewDate(b.date);
                            setNewTime(b.timeSlot);
                          }}
                          className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] border border-stone-200 cursor-pointer font-medium"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={cancellingId === b.id}
                          className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] border border-rose-200 cursor-pointer font-medium"
                        >
                          {cancellingId === b.id ? '...' : 'Cancel'}
                        </button>
                      </>
                    )}

                    {/* Rate Barber Action Button for Completed Booking */}
                    {b.status === 'completed' && (
                      b.rating ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md font-mono">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                          <span>Rated {b.rating}/5 (ပြီးပါပြီ)</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenRating(b)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] cursor-pointer font-bold flex items-center space-x-1 shadow-xs active:scale-95 transition-all"
                        >
                          <Star className="w-2.5 h-2.5 fill-white text-white" />
                          <span>Rate Barber (+50 pts)</span>
                        </button>
                      )
                    )}

                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(b.id)}
                        className="inline-flex items-center space-x-0.5 text-[10px] text-emerald-800 font-medium px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide' : 'Details'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Accordion */}
                {isExpanded && (
                  <div className="pt-2 border-t border-emerald-50 space-y-1.5 text-xs bg-emerald-50/40 p-2.5 rounded-lg">
                    {b.completionNote && (
                      <p className="text-[11px] text-stone-700 italic">
                        Barber Note: "{b.completionNote}"
                      </p>
                    )}
                    {b.rating && (
                      <div className="flex items-center space-x-1.5 text-[11px] text-stone-700">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span className="font-bold">Rating: {b.rating}/5</span>
                        {b.reviewNote && <span className="italic">("{b.reviewNote}")</span>}
                        <span className="text-[10px] text-stone-400">(သတ်မှတ်ပြီး)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Barber Rating Modal (One-Time Rating Enforced) */}
      <BarberRatingModal
        isOpen={Boolean(ratingBooking)}
        booking={ratingBooking}
        role="user"
        lang="my"
        onClose={() => setRatingBooking(null)}
        onSuccess={(_bk, rating) => {
          setRatingBooking(null);
          showToast(`ကျေးဇူးတင်ပါသည်! Rating ${rating}⭐️ ပေးပြီး +50 Points ရရှိပါသည်! (တစ်ကြိမ်သာ ပေးခွင့်ရှိပါသည်)`);
          onRefresh();
        }}
      />

      {/* Reschedule Modal */}
      {reschedulingBooking && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-emerald-100 rounded-3xl p-5 w-full max-w-sm space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-stone-900">Reschedule Appointment</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-stone-50 border border-emerald-100 rounded-xl p-2 text-xs text-stone-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">New Time Slot</label>
                <input
                  type="text"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  placeholder="e.g. 14:00 - 14:45"
                  className="w-full bg-stone-50 border border-emerald-100 rounded-xl p-2 text-xs text-stone-900"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReschedulingBooking(null)}
                className="flex-1 py-2 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReschedule || !newDate || !newTime}
                onClick={handleReschedule}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {isSubmittingReschedule ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
