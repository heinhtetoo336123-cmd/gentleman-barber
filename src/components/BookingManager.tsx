import React, { useState } from 'react';
import { Booking, BookingStatus, Designer, Service } from '../types';
import { api } from '../api/client';
import { formatPrice, sortBookingsMostRecentFirst } from '../utils/formatters';
import { getBurmeseStatusLabel, formatHistoryLogBurmese } from '../utils/burmeseTranslators';
import {
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  XCircle,
  Search,
  Phone,
  Mail,
  Filter,
  Check,
  X,
  Play,
  RotateCcw,
  Sparkles,
  CreditCard,
  MessageSquare,
  Send,
  History,
  Crown,
  Lock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  DollarSign,
  Save,
  AlertCircle
} from 'lucide-react';

interface BookingManagerProps {
  bookings: Booking[];
  designers?: Designer[];
  services?: Service[];
  onRefresh: () => void;
  role?: string;
}

export const BookingManager: React.FC<BookingManagerProps> = ({
  bookings,
  designers = [],
  services = [],
  onRefresh,
  role = 'admin',
}) => {
  const isSuperAdmin = role === 'superadmin';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewingSlipUrl, setViewingSlipUrl] = useState<string | null>(null);

  // SuperAdmin Edit Booking State
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePrice, setEditServicePrice] = useState<number | string>(0);
  const [editDesignerId, setEditDesignerId] = useState('');
  const [editDesignerName, setEditDesignerName] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTimeSlot, setEditTimeSlot] = useState('');
  const [editStatus, setEditStatus] = useState<BookingStatus>('confirmed');
  const [editAdminReply, setEditAdminReply] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Duplicate Txn ID detection
  const duplicateTxnIds = React.useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.paymentTxnId && b.paymentTxnId.trim().length > 2) {
        const idStr = b.paymentTxnId.trim();
        counts[idStr] = (counts[idStr] || 0) + 1;
      }
    });
    return Object.keys(counts).filter((id) => counts[id] > 1);
  }, [bookings]);

  // Reschedule state
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('14:00');

  // Expanded details per card state
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const toggleCardExpand = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Reply state
  const [replyingBooking, setReplyingBooking] = useState<Booking | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyTargetStatus, setReplyTargetStatus] = useState<BookingStatus>('confirmed');

  const handleStatusUpdate = async (id: string, status: BookingStatus, note?: string) => {
    setUpdatingId(id);
    try {
      await api.updateBookingStatus(id, status, note);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingBooking) return;
    setUpdatingId(replyingBooking.id);
    try {
      await api.updateBookingStatus(
        replyingBooking.id,
        replyTargetStatus,
        `Admin Reply: ${replyMessage}`,
        undefined,
        undefined,
        replyMessage
      );
      setReplyingBooking(null);
      setReplyMessage('');
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEditBooking = (b: Booking) => {
    setEditingBooking(b);
    setEditServiceName(b.serviceName || '');
    setEditServicePrice(b.servicePrice || 0);
    setEditDesignerId(b.designerId || '');
    setEditDesignerName(b.designerName || '');
    setEditCustomerName(b.customerName || '');
    setEditCustomerPhone(b.customerPhone || '');
    setEditDate(b.date || '');
    setEditTimeSlot(b.timeSlot || '');
    setEditStatus(b.status);
    setEditAdminReply(b.adminReply || '');
  };

  const handleSaveEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    setSavingEdit(true);
    try {
      await api.updateBooking(editingBooking.id, {
        serviceName: editServiceName,
        servicePrice: Number(editServicePrice) || 0,
        designerId: editDesignerId,
        designerName: editDesignerName,
        customerName: editCustomerName,
        customerPhone: editCustomerPhone,
        date: editDate,
        timeSlot: editTimeSlot,
        status: editStatus,
        adminReply: editAdminReply,
      });
      setEditingBooking(null);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Booking ပြင်ဆင်ရာတွင် အမှားဖြစ်ခဲ့ပါသည်');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSingleBooking = async (id: string, code: string) => {
    if (!isSuperAdmin) {
      alert('သတိပေးချက်: Booking အဟောင်းများ ဖျက်ပစ်ခွင့်ကို SuperAdmin (ဆိုင်ပိုင်ရှင်) သာ လုပ်ဆောင်နိုင်ပါသည် (SuperAdmin permission required).');
      return;
    }
    const isConfirmed = window.confirm(`👑 [SuperAdmin Action]\nBooking (${code}) အား စနစ်ထဲမှ အပြီးသတ် ဖျက်ပစ်ရန် သေချာပါသလား?`);
    if (!isConfirmed) {
      return;
    }
    setUpdatingId(id);
    try {
      await api.deleteBooking(id);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Booking ဖျက်ရာတွင် အမှားဖြစ်ခဲ့ပါသည်');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearHistoryBatch = async () => {
    if (!isSuperAdmin) {
      alert('သတိပေးချက်: Booking ရာဇဝင် အဟောင်းများ ဖျက်ပစ်ခွင့်ကို SuperAdmin (ဆိုင်ပိုင်ရှင်) သာ လုပ်ဆောင်နိုင်ပါသည် (SuperAdmin permission required).');
      return;
    }
    if (confirm('👑 [SuperAdmin Action]\nပြီးစီးသွားသော (Completed) နှင့် ပယ်ဖျက်ထားသော (Cancelled) Booking ရာဇဝင် အားလုံးကို အပြီးသတ် ဖျက်ပစ်ရန် သေချာပါသလား?')) {
      try {
        await api.clearBookingHistory(true);
        onRefresh();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!reschedulingBooking || !newDate || !newTime) return;
    setUpdatingId(reschedulingBooking.id);
    try {
      await api.updateBookingStatus(
        reschedulingBooking.id,
        'confirmed',
        `Rescheduled by Admin to ${newDate} @ ${newTime}`,
        newDate,
        newTime
      );
      setReschedulingBooking(null);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredBookings = sortBookingsMostRecentFirst(
    bookings.filter((b) => {
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesDate = !selectedDate || b.date === selectedDate;
      const matchesSearch =
        b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.bookingCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.designerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customerPhone.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesDate && matchesSearch;
    })
  );

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  return (
    <div className="space-y-3">
      {/* Compact Filter Toolbar & Controls */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
        {/* Top Row: Status Tabs & Quick Action Buttons */}
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Status Pill Tabs */}
          <div className="flex space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1 min-w-0">
            {[
              { id: 'all', label: `All (${bookings.length})` },
              { id: 'pending', label: pendingCount > 0 ? `⏳ Pending (${pendingCount})` : '⏳ Pending' },
              { id: 'confirmed', label: '✅ Confirmed' },
              { id: 'completed', label: '🎉 Completed' },
              { id: 'cancelled', label: '❌ Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-emerald-700 text-white font-bold shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* SuperAdmin Clear History Action */}
          {isSuperAdmin && (
            <button
              onClick={handleClearHistoryBatch}
              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer transition-colors flex items-center space-x-1 shrink-0 shadow-2xs"
              title="Clear completed & cancelled history"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Clear History</span>
            </button>
          )}
        </div>

        {/* Search & Date Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search client, phone, booking code BABA-..., stylist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-600 font-mono focus:bg-white transition-colors"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold cursor-pointer"
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bookings Grid / Cards - Ultra Compact High-Density View */}
      {filteredBookings.length === 0 ? (
        <div className="p-8 text-center bg-white border border-stone-200 rounded-2xl shadow-2xs">
          <p className="text-xs text-stone-500">No appointments matching current filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBookings.map((b) => {
            const isExpanded = !!expandedCardIds[b.id];
            const hasDetails = b.adminReply || b.notes || b.paymentTxnId || b.paymentSlipUrl || (b.statusHistory && b.statusHistory.length > 0);

            return (
              <div
                key={b.id}
                className={`bg-white rounded-xl border transition-all p-3 shadow-2xs space-y-2 ${
                  b.status === 'pending'
                    ? 'border-emerald-400 ring-2 ring-emerald-100/70 bg-emerald-50/20'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                {/* Header Row: Code, Service, Time/Date, Status & Delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="font-mono font-black text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded text-xs border border-emerald-300/80 shrink-0">
                      {b.bookingCode}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                      {b.serviceName}
                    </h4>
                    <span className="hidden sm:inline-flex text-[10px] text-stone-500 font-mono">
                      ({b.serviceDuration}m)
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <span className={`text-[10px] sm:text-xs font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                      b.status === 'pending' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                      b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      b.status === 'in-progress' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                      b.status === 'completed' ? 'bg-stone-100 text-stone-700 border-stone-200' :
                      'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {getBurmeseStatusLabel(b.status)}
                    </span>

                    {isSuperAdmin && (
                      <>
                        <button
                          onClick={() => handleOpenEditBooking(b)}
                          className="p-1 rounded-lg bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 border border-stone-200 cursor-pointer transition-colors"
                          title="Edit booking"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSingleBooking(b.id, b.bookingCode)}
                          disabled={updatingId === b.id}
                          className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition-colors"
                          title="Delete booking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Main Compact Content Row: Customer, Phone, Designer, Schedule, Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-stone-50/80 p-2 rounded-lg border border-stone-200/80 text-xs">
                  {/* Customer Info */}
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-300">
                      {b.customerName ? b.customerName.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-stone-900 truncate leading-tight">{b.customerName}</p>
                      {b.customerPhone && (
                        <div className="flex items-center space-x-1.5 mt-0.5">
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

                  {/* Designer & Schedule */}
                  <div className="flex items-center space-x-2 min-w-0">
                    <User className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-800 truncate leading-tight">{b.designerName}</p>
                      <p className="text-[11px] text-stone-600 font-mono flex items-center space-x-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5 text-stone-400" />
                        <span>{b.date}</span>
                        <span className="text-emerald-800 font-bold">({b.timeSlot})</span>
                      </p>
                    </div>
                  </div>

                  {/* Price & Payment */}
                  <div className="flex items-center justify-between sm:justify-end sm:space-x-3 text-right">
                    <div>
                      <p className="font-mono font-black text-xs sm:text-sm text-stone-900 leading-tight">
                        {formatPrice(b.servicePrice)}
                      </p>
                      <span className="text-[10px] font-medium text-stone-500">
                        {b.paymentMethod === 'kpay_wave' ? '💳 KPay/Wave' : '💵 Pay at Shop'}
                      </span>
                    </div>

                    {b.paymentSlipUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingSlipUrl(b.paymentSlipUrl || null)}
                        className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        📷 Slip
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick 1-Tap Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-xs">
                  <div className="flex items-center space-x-1 text-[11px] text-stone-400 font-mono">
                    <Clock className="w-3 h-3 text-stone-400" />
                    <span>{new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {/* Reply button */}
                    <button
                      onClick={() => {
                        setReplyingBooking(b);
                        setReplyMessage(b.adminReply || '');
                        setReplyTargetStatus(b.status === 'pending' ? 'confirmed' : b.status);
                      }}
                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-[11px] cursor-pointer"
                    >
                      <Send className="w-3 h-3 text-purple-600" />
                      <span>Reply</span>
                    </button>

                    {/* Status specific quick buttons */}
                    {b.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(b.id, 'confirmed', 'Approved by Admin')}
                          disabled={updatingId === b.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] cursor-pointer shadow-2xs flex items-center space-x-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(b.id, 'completed', 'Completed by Admin')}
                          disabled={updatingId === b.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                        <button
                          onClick={() => {
                            setReschedulingBooking(b);
                            setNewDate(b.date);
                            setNewTime(b.timeSlot);
                          }}
                          className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] border border-stone-200 cursor-pointer font-medium"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(b.id, 'cancelled', 'Rejected by Admin')}
                          disabled={updatingId === b.id}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] border border-rose-200 cursor-pointer font-medium"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {b.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(b.id, 'completed', 'Finished & paid')}
                          disabled={updatingId === b.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] cursor-pointer flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                        <button
                          onClick={() => {
                            setReschedulingBooking(b);
                            setNewDate(b.date);
                            setNewTime(b.timeSlot);
                          }}
                          className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] border border-stone-200 cursor-pointer font-medium"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(b.id, 'cancelled', 'Cancelled by Admin')}
                          disabled={updatingId === b.id}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] border border-rose-200 cursor-pointer font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {b.status === 'in-progress' && (
                      <button
                        onClick={() => handleStatusUpdate(b.id, 'completed', 'Finished & paid')}
                        disabled={updatingId === b.id}
                        className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] cursor-pointer flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Complete</span>
                      </button>
                    )}

                    {(b.status === 'completed' || b.status === 'cancelled') && (
                      <button
                        onClick={() => handleStatusUpdate(b.id, 'confirmed', 'Re-activated appointment')}
                        disabled={updatingId === b.id}
                        className="px-2 py-1 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 text-[11px] cursor-pointer border border-stone-200 flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Re-open</span>
                      </button>
                    )}

                    {/* Details toggle */}
                    {hasDetails && (
                      <button
                        type="button"
                        onClick={() => toggleCardExpand(b.id)}
                        className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 text-stone-800 border border-stone-200 text-[11px] font-bold cursor-pointer flex items-center space-x-0.5"
                      >
                        <span>{isExpanded ? 'ဝှက်မည်' : 'အသေးစိတ်'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Details: Admin Reply, Notes, Txn ID, History Logs */}
                {isExpanded && (
                  <div className="pt-2 border-t border-stone-100 space-y-1.5 text-xs bg-stone-50/60 p-2.5 rounded-lg">
                    {b.adminReply && (
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg text-[11px]">
                        <span className="font-bold text-purple-800">Admin Response: </span>
                        <span className="text-purple-950 italic">"{b.adminReply}"</span>
                      </div>
                    )}

                    {b.notes && (
                      <div className="p-2 bg-emerald-50/60 border border-emerald-200 rounded-lg text-[11px]">
                        <span className="font-bold text-emerald-900">Customer Note: </span>
                        <span className="text-stone-800">"{b.notes}"</span>
                      </div>
                    )}

                    {b.paymentTxnId && (
                      <div className="flex items-center space-x-1.5 text-[11px]">
                        <span className="font-medium text-stone-500">Transaction ID:</span>
                        <span className={`font-mono font-bold px-1.5 py-0.2 rounded border ${
                          duplicateTxnIds.includes(b.paymentTxnId.trim())
                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {b.paymentTxnId}
                          {duplicateTxnIds.includes(b.paymentTxnId.trim()) && ' ⚠️ DUPLICATE!'}
                        </span>
                      </div>
                    )}

                    {b.statusHistory && b.statusHistory.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-stone-200/60 text-[10px]">
                        <span className="font-bold text-stone-600 font-mono uppercase">Activity Logs:</span>
                        {b.statusHistory.slice(-2).map((hist, idx) => (
                          <div key={idx} className="flex items-center justify-between text-stone-600">
                            <span>{formatHistoryLogBurmese(hist.note, hist.status)}</span>
                            <span className="font-mono text-stone-400">
                              {new Date(hist.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Admin Reschedule Dialog */}
      {reschedulingBooking && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-stone-900 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Admin Reschedule ({reschedulingBooking.bookingCode})</span>
            </h3>

            <p className="text-xs text-stone-600">
              Propose new time for {reschedulingBooking.customerName}'s appointment. Client will receive notification alert.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-hidden focus:border-emerald-600 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">New Time Slot</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:outline-hidden focus:border-emerald-600 focus:bg-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setReschedulingBooking(null)}
                className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs cursor-pointer border border-stone-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Confirm & Notify Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Reply & Confirm Modal */}
      {replyingBooking && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center space-x-2 font-mono">
                <Send className="w-4 h-4 text-purple-600" />
                <span>Client ထံ တုံ့ပြန်စာ ပေးပို့မည် ({replyingBooking.bookingCode})</span>
              </h3>
              <button
                onClick={() => setReplyingBooking(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReplySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 mb-1 font-semibold">Client Name & Phone</label>
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-stone-900 font-bold">
                  {replyingBooking.customerName} ({replyingBooking.customerPhone})
                </div>
              </div>

              <div>
                <label className="block text-stone-600 mb-1 font-semibold">Status ပြောင်းလဲမည်</label>
                <select
                  value={replyTargetStatus}
                  onChange={(e) => setReplyTargetStatus(e.target.value as BookingStatus)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                >
                  <option value="confirmed">အတည်ပြုသည် (Confirmed)</option>
                  <option value="completed">ပြီးစီးသည် (Completed)</option>
                  <option value="cancelled">ပယ်ဖျက်သည် (Cancelled)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-600 mb-1 font-semibold">တုံ့ပြန်ချက် စာတို (Reply Message for Client)</label>
                <textarea
                  rows={3}
                  required
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  placeholder="e.g. မင်္ဂလာပါ၊ လူကြီးမင်း၏ Booking အား အတည်ပြုလိုက်ပါပြီ။ ရက်ချိန်းချိန်ထက် ၁၀ မိနစ် ကြိုတင် ရောက်ရှိပေးပါရန်။"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplyingBooking(null)}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs cursor-pointer border border-stone-300 font-medium"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>အကြောင်းပြန်စာ ပေးပို့မည် (Send & Update)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slip Image Preview Modal */}
      {viewingSlipUrl && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-4 max-w-lg w-full space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h4 className="text-sm font-bold text-stone-900 flex items-center space-x-1.5">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <span>ငွေလွှဲ ပြေစာ ဓာတ်ပုံ (Payment Slip Image)</span>
              </h4>
              <button
                type="button"
                onClick={() => setViewingSlipUrl(null)}
                className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex justify-center bg-stone-100 p-2 rounded-2xl border border-stone-200">
              <img src={viewingSlipUrl} alt="Payment Slip" className="max-w-full h-auto object-contain rounded-xl" />
            </div>
            <div className="text-right pt-1">
              <button
                type="button"
                onClick={() => setViewingSlipUrl(null)}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                ပိတ်မည် (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SuperAdmin Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-stone-300 rounded-3xl p-5 w-full max-w-lg space-y-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm sm:text-base font-bold text-stone-900 font-mono">
                  Edit Booking ({editingBooking.bookingCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBooking} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Service Selection */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Service (ဝန်ဆောင်မှု အမည်)</label>
                  <input
                    type="text"
                    required
                    value={editServiceName}
                    onChange={(e) => setEditServiceName(e.target.value)}
                    list="services-list"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  />
                  <datalist id="services-list">
                    {services.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>

                {/* Service Price */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Price (ကျသင့်ငွေ - MMK)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editServicePrice}
                    onChange={(e) => setEditServicePrice(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono font-bold focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Barber / Designer */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Barber / Stylist</label>
                  <select
                    value={editDesignerId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setEditDesignerId(selId);
                      const found = designers.find((d) => d.id === selId);
                      if (found) setEditDesignerName(found.name);
                    }}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  >
                    <option value="">-- Barber ရွေးချယ်ပါ --</option>
                    {designers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty || 'Barber'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Status (အခြေအနေ)</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as BookingStatus)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-bold focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  >
                    <option value="pending">Pending (စောင့်ဆိုင်းဆဲ)</option>
                    <option value="confirmed">Confirmed (အတည်ပြုပြီး)</option>
                    <option value="completed">Completed (ပြီးစီး/ငွေရှင်းပြီး)</option>
                    <option value="cancelled">Cancelled (ပယ်ဖျက်ပြီး)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Name */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Client Name (ဖောက်သည် အမည်)</label>
                  <input
                    type="text"
                    required
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  />
                </div>

                {/* Customer Phone */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Phone (ဖုန်းနံပါတ်)</label>
                  <input
                    type="text"
                    required
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Date (ရက်စွဲ)</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  />
                </div>

                {/* Time Slot */}
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Time Slot (အချိန်)</label>
                  <input
                    type="time"
                    required
                    value={editTimeSlot}
                    onChange={(e) => setEditTimeSlot(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 font-mono focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                  />
                </div>
              </div>

              {/* Admin Note / Reply */}
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Note / Response (မှတ်ချက်)</label>
                <input
                  type="text"
                  value={editAdminReply}
                  onChange={(e) => setEditAdminReply(e.target.value)}
                  placeholder="e.g. VIP appointment customized"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 focus:border-emerald-600 focus:outline-hidden focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => handleDeleteSingleBooking(editingBooking.id, editingBooking.bookingCode)}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingBooking(null)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs cursor-pointer border border-stone-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
