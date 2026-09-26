import React, { useState, useMemo, useEffect } from 'react';
import { Service, Designer, Booking, BookingStatus, UserProfile, RetailProduct, BookingRetailItem } from '../types';
import { api } from '../api/client';
import { getLocalTodayStr } from '../utils/timeSlots';
import { formatPrice } from '../utils/formatters';
import { playSuccessChime, playNotificationChime } from '../utils/audio';
import {
  Calendar,
  Clock,
  UserPlus,
  Scissors,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Phone,
  CreditCard,
  Banknote,
  DollarSign,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  UserCheck,
  Zap,
  Timer,
  Trash2,
  Edit3,
  Search,
  FileText,
  Printer,
  BarChart3,
  Layers,
  CalendarDays,
  Receipt,
  Save,
  RotateCcw,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { KnownClient } from './walkin/ClientCombobox';
import { WalkinBackfillForm } from './walkin/WalkinBackfillForm';
import { EditWalkinModal } from './walkin/EditWalkinModal';
import { BarberRatingModal } from './BarberRatingModal';

interface AdminQuickWalkinManagerProps {
  services: Service[];
  designers: Designer[];
  bookings: Booking[];
  clients?: UserProfile[];
  onRefresh: () => void;
  lang?: 'en' | 'my';
  onNavigateToSettlement?: () => void;
}

export const AdminQuickWalkinManager: React.FC<AdminQuickWalkinManagerProps> = ({
  services,
  designers,
  bookings,
  clients = [],
  onRefresh,
  lang = 'en'
}) => {
  const todayStr = getLocalTodayStr();
  
  // Top Manager loading & alerts
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Records & History Search and Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'>('all');
  const [historyCustomStartDate, setHistoryCustomStartDate] = useState<string>('');
  const [historyCustomEndDate, setHistoryCustomEndDate] = useState<string>('');
  const [historyDesignerFilter, setHistoryDesignerFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState<string>('all');

  // Edit Walk-in Record Modal State
  const [editingRecord, setEditingRecord] = useState<Booking | null>(null);

  // View Mode: Timeline View vs Table View (Defaults to Timeline Most Recent First)
  const [historyViewMode, setHistoryViewMode] = useState<'timeline' | 'table'>('timeline');

  // Delete Record Confirmation State
  const [recordToDelete, setRecordToDelete] = useState<Booking | null>(null);

  // Quick Action Detail / Receipt Modal State
  const [activeBookingDetail, setActiveBookingDetail] = useState<Booking | null>(null);

  // Barber Rating Modal State for Walk-ins
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);

  // Active Stylists List
  const activeDesignersList = useMemo(() => {
    return designers.filter(d => d.active !== false);
  }, [designers]);

  // POS / Retail Products from database
  const [retailProducts, setRetailProducts] = useState<RetailProduct[]>([]);
  useEffect(() => {
    const unsub = api.subscribeToRetailProducts((products) => {
      setRetailProducts(products);
    });
    return () => unsub();
  }, []);

  // Extract Past Unique Notes across all bookings for history selection
  const pastNotes = useMemo<string[]>(() => {
    const notesSet = new Set<string>();
    bookings.forEach(b => {
      if (b.notes && b.notes.trim()) {
        notesSet.add(b.notes.trim());
      }
    });
    return Array.from(notesSet);
  }, [bookings]);

  // Extract Known Clients from both registered client profiles and all historical bookings
  const knownClients = useMemo<KnownClient[]>(() => {
    const clientMap = new Map<string, KnownClient>();

    // 1. Registered App Users
    if (clients && clients.length > 0) {
      for (const c of clients) {
        const key = (c.phone || c.name || c.id).trim().toLowerCase();
        if (key) {
          clientMap.set(key, {
            id: c.id,
            name: c.name || 'Registered Client',
            phone: c.phone || '',
            visitCount: 0,
            lastVisitDate: '',
            isRegistered: true
          });
        }
      }
    }

    // 2. All Historical Bookings (Walk-ins & Online)
    for (const b of bookings) {
      const rawName = (b.customerName || '').trim();
      const rawPhone = (b.customerPhone || '').trim();
      if (!rawName && !rawPhone) continue;

      const key = rawPhone ? rawPhone.toLowerCase() : rawName.toLowerCase();
      const existing = clientMap.get(key);

      if (existing) {
        existing.visitCount += 1;
        if (!existing.lastVisitDate || (b.date && b.date > existing.lastVisitDate)) {
          existing.lastVisitDate = b.date;
        }
        if (rawPhone && !existing.phone) existing.phone = rawPhone;
        if (rawName && (!existing.name || existing.name === 'Walk-in Guest')) existing.name = rawName;
      } else {
        clientMap.set(key, {
          id: b.id,
          name: rawName || 'Customer',
          phone: rawPhone,
          visitCount: 1,
          lastVisitDate: b.date || '',
          isRegistered: false
        });
      }
    }

    // Sort: High visit count first, then latest visit date
    return Array.from(clientMap.values()).sort((a, b) => {
      if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
      return (b.lastVisitDate || '').localeCompare(a.lastVisitDate || '');
    });
  }, [bookings, clients]);

  // Helper to extract a precise timestamp for timeline sorting (Most Recent First)
  const getWalkinChronologicalTimestamp = (b: Booking): number => {
    try {
      const rawDate = (b.date || '').replace(/\//g, '-').split('T')[0];
      if (rawDate) {
        const slot = (b.timeSlot || '12:00').split('-')[0].trim();
        let h = 12;
        let m = 0;
        const isPM = /pm/i.test(slot);
        const isAM = /am/i.test(slot);
        const clean = slot.replace(/(am|pm)/gi, '').trim();
        const parts = clean.split(':');
        if (parts.length >= 2) {
          h = parseInt(parts[0], 10) || 0;
          m = parseInt(parts[1], 10) || 0;
          if (isPM && h < 12) h += 12;
          if (isAM && h === 12) h = 0;
        }
        const d = new Date(`${rawDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        const timeMs = d.getTime();
        if (!isNaN(timeMs)) return timeMs;
      }
    } catch {}

    if (b.createdAt) {
      const t = new Date(b.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (b.updatedAt) {
      const t = new Date(b.updatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  const compareWalkinsMostRecentFirst = (a: Booking, b: Booking): number => {
    // 1. Appointment Date descending (Today & upcoming dates first)
    const rawDateA = (a.date || '').replace(/\//g, '-').split('T')[0];
    const rawDateB = (b.date || '').replace(/\//g, '-').split('T')[0];
    if (rawDateA !== rawDateB) {
      return rawDateB.localeCompare(rawDateA);
    }

    // 2. Appointment Time slot descending (latest time slot of the day first)
    const timeA = getWalkinChronologicalTimestamp(a);
    const timeB = getWalkinChronologicalTimestamp(b);
    if (timeA !== timeB) {
      return timeB - timeA;
    }

    // 3. Created At timestamp descending (newest registered record first)
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdA !== createdB) {
      return createdB - createdA;
    }

    // 4. Booking code / ID descending
    return (b.bookingCode || b.id || '').localeCompare(a.bookingCode || a.id || '');
  };

  // All Walk-in Bookings across the entire dataset (Latest First)
  const allWalkinBookings = useMemo(() => {
    return (bookings || [])
      .filter(
        (b) =>
          b.isWalkin === true ||
          b.bookingCode?.startsWith('WLK-') ||
          (b.notes && /walk-?in|ဆိုင်ရောက်/i.test(b.notes)) ||
          (b.customerName && /walk-?in|ဧည့်သည်/i.test(b.customerName))
      )
      .sort(compareWalkinsMostRecentFirst);
  }, [bookings]);

  // Toast Helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    if (type === 'success') playSuccessChime();
    else playNotificationChime();
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Submit Backfill / Past Record Walk-in
  const handleCreateBackfillSubmit = async (formData: any) => {
    const selectedSrv = services.find(s => s.id === formData.serviceId);
    const selectedDes = designers.find(d => d.id === formData.designerId);
    const unitPrice = typeof formData.customPrice === 'number' && formData.customPrice >= 0
      ? formData.customPrice
      : (selectedSrv?.price || 15000);

    setLoading(true);
    try {
      const newBk = await api.createWalkinBooking({
        serviceId: formData.serviceId,
        servicesList: formData.servicesList,
        retailItems: formData.retailItems,
        customPrice: formData.customPrice,
        designerId: formData.designerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        date: formData.date,
        timeSlot: formData.timeSlot,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus,
        status: formData.status,
        discountAmount: formData.discountAmount || 0,
        notes: formData.notes
      });

      // If retail items were purchased in walk-in, also log sales in POS system automatically
      if (formData.retailItems && formData.retailItems.length > 0) {
        for (const item of formData.retailItems) {
          try {
            await api.addRetailSale({
              date: formData.date,
              productId: item.productId,
              productName: item.productName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
              barberId: formData.designerId,
              barberName: selectedDes?.name || 'Stylist',
              barberCommissionAmount: item.barberCommissionAmount || 0,
              paymentMethod: formData.paymentMethod,
              customerName: formData.customerName || 'Walk-in Guest',
              customerPhone: formData.customerPhone || '',
              notes: `Walk-in (${newBk.bookingCode}) POS ဝယ်ယူမှု`
            });
          } catch (saleErr) {
            console.warn('Failed to auto-log retail sale record:', saleErr);
          }
        }
      }

      if (typeof formData.customPrice === 'number' && formData.customPrice >= 0 && formData.customPrice !== selectedSrv?.price) {
        const commPercent = selectedDes?.commissionPercent ?? 50;
        const finalNet = Math.max(0, unitPrice - (formData.discountAmount || 0));
        const commissionAmount = Math.round((finalNet * commPercent) / 100);
        await api.updateBooking(newBk.id, {
          servicePrice: unitPrice,
          commissionAmount,
          servicesList: formData.servicesList,
          retailItems: formData.retailItems
        });
      }

      onRefresh();
      showToast(
        lang === 'my'
          ? `ရက်စွဲ (${formData.date} • ${formData.timeSlot}) အတွက် Walk-in မှတ်တမ်းနှင့် POS အရောင်းကို အောင်မြင်စွာ သိမ်းဆည်းလိုက်ပါပြီ!`
          : `Walk-in record and POS retail sale for ${formData.date} (${formData.timeSlot}) successfully saved!`
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to save record', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save Record Edits
  const handleSaveRecordEdits = async (bookingId: string, updates: Partial<Booking>) => {
    setLoading(true);
    try {
      await api.updateBooking(bookingId, updates);
      setEditingRecord(null);
      onRefresh();
      showToast(
        lang === 'my'
          ? `Walk-in မှတ်တမ်းအား အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ!`
          : `Walk-in record updated successfully!`
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update record', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Record
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setLoading(true);
    try {
      await api.deleteBooking(recordToDelete.id);
      showToast(
        lang === 'my'
          ? `Walk-in မှတ်တမ်း (${recordToDelete.bookingCode}) အား စာရင်းမှ ပယ်ဖျက်ပြီးပါပြီ`
          : `Walk-in record ${recordToDelete.bookingCode} deleted!`
      );
      setRecordToDelete(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete record', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Quick Status Update
  const handleQuickStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    setLoading(true);
    try {
      await api.updateBookingStatus(bookingId, newStatus);
      if (activeBookingDetail && activeBookingDetail.id === bookingId) {
        setActiveBookingDetail({ ...activeBookingDetail, status: newStatus });
      }
      onRefresh();
      showToast(
        lang === 'my'
          ? `အခြေအနေအား ${newStatus.toUpperCase()} သို့ ပြောင်းလဲပြီးပါပြီ`
          : `Status updated to ${newStatus}`
      );
    } catch (e: any) {
      showToast(e.message || 'Update failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered History Records
  const filteredHistoryRecords = useMemo(() => {
    const today = new Date();
    const todayStrFormatted = today.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];

    return allWalkinBookings.filter((rec) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (rec.customerName || '').toLowerCase().includes(q);
        const matchPhone = (rec.customerPhone || '').toLowerCase().includes(q);
        const matchCode = (rec.bookingCode || '').toLowerCase().includes(q);
        const matchDesigner = (rec.designerName || '').toLowerCase().includes(q);
        const matchService = (rec.serviceName || '').toLowerCase().includes(q);
        const matchNotes = (rec.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode && !matchDesigner && !matchService && !matchNotes) {
          return false;
        }
      }

      const recDate = (rec.date || '').replace(/\//g, '-').split('T')[0];

      if (historyPeriodFilter === 'today' && recDate !== todayStrFormatted) return false;
      if (historyPeriodFilter === 'yesterday' && recDate !== yesterdayStr) return false;
      if (historyPeriodFilter === 'this_week' && recDate < weekAgoStr) return false;
      if (historyPeriodFilter === 'this_month' && recDate < monthAgoStr) return false;
      if (historyPeriodFilter === 'custom') {
        if (historyCustomStartDate && recDate < historyCustomStartDate) return false;
        if (historyCustomEndDate && recDate > historyCustomEndDate) return false;
      }

      if (historyDesignerFilter !== 'all' && rec.designerId !== historyDesignerFilter) return false;
      if (historyStatusFilter !== 'all' && rec.status !== historyStatusFilter) return false;
      if (historyPaymentFilter !== 'all' && rec.paymentMethod !== historyPaymentFilter) return false;

      return true;
    }).sort(compareWalkinsMostRecentFirst);
  }, [
    allWalkinBookings,
    searchQuery,
    historyPeriodFilter,
    historyCustomStartDate,
    historyCustomEndDate,
    historyDesignerFilter,
    historyStatusFilter,
    historyPaymentFilter,
  ]);

  // Analytics Metrics
  const walkinAnalytics = useMemo(() => {
    let totalRevenue = 0;
    let cashTotal = 0;
    let digitalTotal = 0;
    let totalDiscount = 0;
    let stylistRevenueMap: Record<string, { name: string; count: number; revenue: number; commission: number }> = {};

    for (const b of allWalkinBookings) {
      if (b.status === 'cancelled') continue;
      const rawPrice = Number(
        b.price ??
        b.servicePrice ??
        (b.servicesList && b.servicesList.length > 0
          ? b.servicesList.reduce((acc, s) => acc + (Number(s.servicePrice) || 0), 0)
          : 0)
      );
      const discount = Number(b.discountAmount || 0);
      const net = Math.max(0, rawPrice - discount);
      const commission = b.commissionAmount || Math.round(net * 0.5);

      totalRevenue += net;
      totalDiscount += discount;

      if (b.paymentMethod === 'cash' || b.paymentMethod === 'pay_at_shop') {
        cashTotal += net;
      } else {
        digitalTotal += net;
      }

      const dName = b.designerName || 'Unassigned';
      if (!stylistRevenueMap[dName]) {
        stylistRevenueMap[dName] = { name: dName, count: 0, revenue: 0, commission: 0 };
      }
      stylistRevenueMap[dName].count += 1;
      stylistRevenueMap[dName].revenue += net;
      stylistRevenueMap[dName].commission += commission;
    }

    return {
      totalCount: allWalkinBookings.length,
      totalRevenue,
      cashTotal,
      digitalTotal,
      totalDiscount,
      stylistBreakdown: Object.values(stylistRevenueMap).sort((a, b) => b.revenue - a.revenue)
    };
  }, [allWalkinBookings]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-mono font-bold ${
              toastMsg.type === 'success'
                ? 'bg-stone-900 text-emerald-300 border border-emerald-300'
                : 'bg-rose-950 text-rose-200 border border-rose-500/30'
            }`}
          >
            {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: REGISTER NEW WALKIN */}
      <WalkinBackfillForm
        services={services}
        designers={designers}
        knownClients={knownClients}
        pastNotes={pastNotes}
        retailProducts={retailProducts}
        onSubmit={handleCreateBackfillSubmit}
        loading={loading}
        lang={lang}
      />

      {/* SECTION 2: RECORDS & HISTORY LEDGER */}
      <div className="space-y-4 pt-2">
        {/* Section Title & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <h3 className="text-xs font-black text-stone-950 uppercase font-mono tracking-wider">
              {lang === 'my' ? 'Walk-in အချိန်ဇယား & မှတ်တမ်းစာရင်း' : 'Walk-in Timeline & History'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-100 text-stone-700 border border-stone-200">
              {allWalkinBookings.length} records
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
              <span>⚡</span>
              <span>{lang === 'my' ? 'အသစ်ဆုံး အရင် (Most Recent First)' : 'Most Recent First'}</span>
            </span>
          </div>

          {/* View Mode Toggle: Timeline vs Table */}
          <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200 self-start sm:self-auto">
            <button
              onClick={() => setHistoryViewMode('timeline')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                historyViewMode === 'timeline'
                  ? 'bg-stone-950 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{lang === 'my' ? 'Timeline ပုံစံ' : 'Timeline'}</span>
            </button>

            <button
              onClick={() => setHistoryViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                historyViewMode === 'table'
                  ? 'bg-stone-950 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{lang === 'my' ? 'Table ဇယား' : 'Table'}</span>
            </button>
          </div>
        </div>
          {/* Filter Bar */}
          <div className="bg-white border border-stone-200 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder={lang === 'my' ? 'အမည်၊ ဖုန်း၊ ဘိုကင်ကုတ်၊ ဆံသဆရာ၊ မှတ်ချက်ဖြင့် ရှာပါ...' : 'Search customer, phone, code, stylist, notes...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-2 pl-9 pr-3 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <select
                  value={historyPeriodFilter}
                  onChange={(e) => setHistoryPeriodFilter(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-2 text-xs font-mono font-bold text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All Dates ({allWalkinBookings.length})</option>
                  <option value="today">Today Only</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">Past 7 Days</option>
                  <option value="this_month">Past 30 Days</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
              </div>

              <div>
                <select
                  value={historyDesignerFilter}
                  onChange={(e) => setHistoryDesignerFilter(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-2 text-xs font-bold text-stone-800 focus:outline-hidden"
                >
                  <option value="all">All Stylists</option>
                  {designers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Date Range Pickers if selected */}
            {historyPeriodFilter === 'custom' && (
              <div className="flex items-center space-x-3 pt-2 border-t border-stone-100 text-xs font-mono">
                <span className="text-stone-500 font-bold">From:</span>
                <input
                  type="date"
                  value={historyCustomStartDate}
                  onChange={(e) => setHistoryCustomStartDate(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl p-1.5 text-xs text-stone-800"
                />
                <span className="text-stone-500 font-bold">To:</span>
                <input
                  type="date"
                  value={historyCustomEndDate}
                  onChange={(e) => setHistoryCustomEndDate(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl p-1.5 text-xs text-stone-800"
                />
              </div>
            )}

            {/* Additional Status / Payment Quick Filters */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-stone-100 text-xs font-mono">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                <span className="text-stone-400 font-bold mr-1">Status:</span>
                {['all', 'completed', 'confirmed', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setHistoryStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-xl capitalize font-bold transition-colors cursor-pointer ${
                      historyStatusFilter === st
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-stone-400 font-bold mr-1">Payment:</span>
                {['all', 'cash', 'kpay', 'wave'].map((pay) => (
                  <button
                    key={pay}
                    onClick={() => setHistoryPaymentFilter(pay)}
                    className={`px-2.5 py-1 rounded-xl uppercase font-bold transition-colors cursor-pointer ${
                      historyPaymentFilter === pay
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {pay === 'all' ? 'All' : pay}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Records: Timeline View vs Table View */}
          {historyViewMode === 'timeline' ? (
            <div className="space-y-4">
              {filteredHistoryRecords.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center text-stone-400 font-mono">
                  {lang === 'my'
                    ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော Walk-in မှတ်တမ်း မရှိပါ'
                    : 'No walk-in records match the current filter.'}
                </div>
              ) : (
                <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-stone-200">
                  {filteredHistoryRecords.map((record) => {
                    const net = Math.max(0, (record.servicePrice || 0) - (record.discountAmount || 0));
                    const comm = record.commissionAmount || Math.round(net * 0.5);
                    const isCompleted = record.status === 'completed';
                    const isCancelled = record.status === 'cancelled';

                    return (
                      <div key={record.id} className="relative group">
                        {/* Timeline Node Icon */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-3.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${
                            isCompleted
                              ? 'bg-emerald-600 border-white text-white ring-4 ring-emerald-100'
                              : isCancelled
                              ? 'bg-rose-600 border-white text-white ring-4 ring-rose-100'
                              : 'bg-stone-900 border-white text-white ring-4 ring-stone-100'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isCancelled ? (
                            <X className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {/* Timeline Card */}
                        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all space-y-3">
                          {/* Header: Date & Time + Code + Status */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="px-2.5 py-1 bg-stone-950 text-white font-mono text-xs font-black rounded-xl">
                                📅 {record.date} • ⏰ {record.timeSlot}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-stone-100 text-stone-800 border border-stone-200">
                                {record.bookingCode}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                                  record.paymentMethod === 'cash' || record.paymentMethod === 'pay_at_shop'
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : 'bg-blue-100 text-blue-900'
                                }`}
                              >
                                {record.paymentMethod || 'cash'}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">
                                ({record.paymentStatus || 'verified'})
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${
                                  isCompleted
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : isCancelled
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : 'bg-blue-100 text-blue-900 border-blue-300'
                                }`}
                              >
                                {record.status}
                              </span>
                            </div>
                          </div>

                          {/* Body: Customer & Stylist Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-extrabold text-stone-950 text-sm">
                                  {record.customerName || 'Walk-in Guest'}
                                </span>
                                <span className="text-xs text-stone-500 font-mono">
                                  {record.customerPhone ? `📞 ${record.customerPhone}` : '(No Phone)'}
                                </span>
                              </div>
                              <div className="text-xs text-stone-700 flex items-center space-x-1.5 font-medium">
                                <span className="text-stone-400">✂️ Stylist:</span>
                                <span className="font-bold text-stone-900">{record.designerName || 'Unassigned'}</span>
                              </div>
                              <div className="text-xs text-stone-600 font-medium">
                                <span>💇 {record.serviceName}</span>
                              </div>
                              {record.notes && (
                                <p className="text-[11px] text-emerald-900 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/60 inline-block mt-1">
                                  💬 {record.notes}
                                </p>
                              )}
                            </div>

                            <div className="space-y-1.5 sm:text-right">
                              <div className="text-sm font-black font-mono text-stone-950">
                                {formatPrice(net)}
                              </div>
                              {record.discountAmount && record.discountAmount > 0 ? (
                                <div className="text-[11px] font-mono text-rose-500">
                                  Discount: -{formatPrice(record.discountAmount)}
                                </div>
                              ) : null}
                              <div className="text-[11px] font-mono text-emerald-700 font-bold">
                                Stylist Comm: {formatPrice(comm)}
                              </div>
                            </div>
                          </div>

                          {/* Multi-services or Retail Products list if any */}
                          {((record.servicesList && record.servicesList.length > 1) || (record.retailItems && record.retailItems.length > 0)) && (
                            <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-1.5">
                              {record.servicesList && record.servicesList.length > 1 && record.servicesList.map((s, idx) => (
                                <span key={idx} className="text-[10px] font-mono bg-stone-100 text-stone-800 px-2 py-0.5 rounded-md border border-stone-200">
                                  ✂️ {s.serviceName} ({formatPrice(s.servicePrice)})
                                </span>
                              ))}
                              {record.retailItems?.map((prod, idx) => (
                                <span key={idx} className="text-[10px] font-mono bg-emerald-700 text-white font-bold px-2 py-0.5 rounded-md flex items-center space-x-1 shadow-2xs">
                                  <span>🛍️ {prod.quantity}x {prod.productName}</span>
                                  <span>({formatPrice(prod.totalPrice)})</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Actions Bar */}
                          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                            <span className="text-[10px] font-mono text-stone-400">
                              {record.createdAt ? `Logged: ${new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </span>
                            <div className="flex items-center space-x-1.5">
                              {/* Direct Barber Rating Button / Badge */}
                              {record.rating ? (
                                <span className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 shadow-2xs">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  <span>{record.rating}/5</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRatingBooking(record)}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                                  title={lang === 'my' ? 'Barber Rating ပေးမည်' : 'Rate Barber'}
                                >
                                  <Star className="w-3.5 h-3.5 fill-white text-white" />
                                  <span>{lang === 'my' ? 'Rating ပေးမည်' : 'Rate'}</span>
                                </button>
                              )}

                              <button
                                onClick={() => setActiveBookingDetail(record)}
                                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Receipt</span>
                              </button>
                              <button
                                onClick={() => setEditingRecord(record)}
                                className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setRecordToDelete(record)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-mono cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Records Table / Cards */
            <div className="bg-white border border-stone-200 rounded-3xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-emerald-950 text-white font-mono text-[11px] uppercase tracking-wider">
                      <th className="p-3.5">Code / Date</th>
                      <th className="p-3.5">Customer / Contact</th>
                      <th className="p-3.5">Stylist & Service</th>
                      <th className="p-3.5">Price & Comm</th>
                      <th className="p-3.5">Payment</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 font-sans">
                    {filteredHistoryRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-stone-400 font-mono">
                          {lang === 'my'
                            ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော Walk-in မှတ်တမ်း မရှိပါ'
                            : 'No walk-in records match the current filter.'}
                        </td>
                      </tr>
                    ) : (
                      filteredHistoryRecords.map((record) => {
                        const net = Math.max(0, (record.servicePrice || 0) - (record.discountAmount || 0));
                        const comm = record.commissionAmount || Math.round(net * 0.5);

                        return (
                          <tr key={record.id} className="hover:bg-emerald-50/40 transition-colors">
                            <td className="p-3.5 font-mono">
                              <span className="font-bold text-stone-950 block">{record.bookingCode}</span>
                              <span className="text-[11px] text-stone-500 block">{record.date} • {record.timeSlot}</span>
                            </td>

                            <td className="p-3.5">
                              <span className="font-bold text-stone-900 block">{record.customerName}</span>
                              <span className="text-[11px] text-stone-500 font-mono block">
                                {record.customerPhone || 'No Phone (Walk-in)'}
                              </span>
                              {record.notes && (
                                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 inline-block truncate max-w-[180px]">
                                  {record.notes}
                                </span>
                              )}
                            </td>

                            <td className="p-3.5">
                              <span className="font-bold text-stone-900 block">{record.designerName}</span>
                              <span className="text-[11px] text-stone-700 font-medium block">{record.serviceName}</span>
                              {record.servicesList && record.servicesList.length > 1 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {record.servicesList.map((s, idx) => (
                                    <span key={idx} className="text-[9px] font-mono bg-emerald-50 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-200">
                                      • {s.serviceName} ({formatPrice(s.servicePrice)})
                                    </span>
                                  ))}
                                </div>
                              )}
                              {record.retailItems && record.retailItems.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {record.retailItems.map((prod, idx) => (
                                    <span key={idx} className="text-[9px] font-mono bg-emerald-700 text-white font-bold px-1.5 py-0.5 rounded-md shadow-2xs flex items-center space-x-1">
                                      <span>🛍️ {prod.quantity}x {prod.productName}</span>
                                      <span>({formatPrice(prod.totalPrice)})</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="p-3.5 font-mono">
                              <div className="font-bold text-stone-900">{formatPrice(net)}</div>
                              {record.discountAmount && record.discountAmount > 0 ? (
                                <span className="text-[10px] text-rose-500 block">
                                  Disc: -{formatPrice(record.discountAmount)}
                                </span>
                              ) : null}
                              <span className="text-[10px] text-emerald-700 font-bold block">
                                Comm: {formatPrice(comm)}
                              </span>
                            </td>

                            <td className="p-3.5">
                              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                                record.paymentMethod === 'cash' || record.paymentMethod === 'pay_at_shop'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-blue-100 text-blue-900'
                              }`}>
                                <span>{record.paymentMethod || 'cash'}</span>
                              </span>
                              <span className="block text-[10px] text-stone-400 font-mono mt-0.5">
                                {record.paymentStatus || 'verified'}
                              </span>
                            </td>

                            <td className="p-3.5">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                                record.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : record.status === 'cancelled'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-900'
                              }`}>
                                {record.status}
                              </span>
                            </td>

                            <td className="p-3.5 text-right space-x-1">
                              {/* Direct Barber Rating Button / Badge */}
                              {record.rating ? (
                                <span
                                  className="inline-flex items-center space-x-0.5 px-1.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[10px] font-bold font-mono align-middle shadow-2xs"
                                  title={`Rated ${record.rating}/5 Stars`}
                                >
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                                  <span>{record.rating}★</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRatingBooking(record)}
                                  className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg cursor-pointer transition-colors shadow-2xs align-middle"
                                  title={lang === 'my' ? 'Barber Rating ပေးမည်' : 'Rate Barber'}
                                >
                                  <Star className="w-3.5 h-3.5 fill-white text-white" />
                                </button>
                              )}

                              <button
                                onClick={() => setActiveBookingDetail(record)}
                                className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg cursor-pointer transition-colors"
                                title="View Details"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setEditingRecord(record)}
                                className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg cursor-pointer transition-colors"
                                title="Edit Record"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setRecordToDelete(record)}
                                className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg cursor-pointer transition-colors"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* 1. Edit Walk-in Record Modal */}
      <EditWalkinModal
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        services={services}
        designers={designers}
        knownClients={knownClients}
        pastNotes={pastNotes}
        onSubmit={handleSaveRecordEdits}
        loading={loading}
        lang={lang}
      />

      {/* 2. Delete Confirmation Dialog */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-950 uppercase font-mono">Delete Walk-in Record</h3>
                  <span className="text-xs text-rose-600 font-mono font-bold">{recordToDelete.bookingCode}</span>
                </div>
              </div>

              <p className="text-xs text-stone-600">
                Are you sure you want to permanently delete this walk-in record for <strong className="text-stone-900">{recordToDelete.customerName}</strong> ({recordToDelete.date} • {recordToDelete.timeSlot})? This action cannot be undone.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  onClick={() => setRecordToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer font-mono"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs font-mono uppercase tracking-wider cursor-pointer shadow-xs"
                >
                  {loading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Active Booking Quick Detail Modal */}
      <AnimatePresence>
        {activeBookingDetail && (
          <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border border-stone-200 rounded-3xl p-6 shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-stone-950 uppercase font-mono">Session Details</h3>
                    <span className="text-[10px] font-mono text-stone-500">{activeBookingDetail.bookingCode}</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveBookingDetail(null)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Customer:</span>
                  <span className="font-bold text-stone-900">{activeBookingDetail.customerName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Phone:</span>
                  <span className="font-mono text-stone-900">{activeBookingDetail.customerPhone || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Stylist:</span>
                  <span className="font-bold text-stone-900">{activeBookingDetail.designerName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Service:</span>
                  <span className="text-stone-900">{activeBookingDetail.serviceName}</span>
                </div>
                {activeBookingDetail.retailItems && activeBookingDetail.retailItems.length > 0 && (
                  <div className="py-1 border-b border-stone-100">
                    <span className="text-stone-500 block mb-1">POS Products:</span>
                    <div className="space-y-1 pl-2">
                      {activeBookingDetail.retailItems.map((prod, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] font-mono">
                          <span>🛍️ {prod.quantity}x {prod.productName}</span>
                          <span className="font-bold">{formatPrice(prod.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Time:</span>
                  <span className="font-mono text-stone-900">{activeBookingDetail.date} • {activeBookingDetail.timeSlot}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Price:</span>
                  <span className="font-mono font-bold text-emerald-900">{formatPrice(activeBookingDetail.servicePrice)}</span>
                </div>
                {activeBookingDetail.notes && (
                  <div className="flex justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-500">Note:</span>
                    <span className="text-stone-800 font-medium">{activeBookingDetail.notes}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-stone-100 items-center">
                  <span className="text-stone-500">Barber Rating:</span>
                  {activeBookingDetail.rating ? (
                    <span className="font-mono font-bold text-amber-600 flex items-center space-x-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{activeBookingDetail.rating} / 5 Stars</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeBookingDetail;
                        setActiveBookingDetail(null);
                        setRatingBooking(target);
                      }}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Star className="w-3 h-3 fill-white text-white" />
                      <span>{lang === 'my' ? 'Rating ပေးမည်' : 'Rate Stylist'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Status Buttons */}
              <div className="pt-2">
                <span className="text-[10px] font-mono font-bold text-stone-500 uppercase block mb-1.5">Quick Status Change:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['confirmed', 'completed'] as BookingStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleQuickStatusChange(activeBookingDetail.id, st)}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-mono font-bold capitalize transition-colors cursor-pointer border ${
                        activeBookingDetail.status === st
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-stone-200">
                <button
                  onClick={() => setActiveBookingDetail(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-mono font-bold text-stone-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Direct Barber Rating Modal for Walk-in */}
      <BarberRatingModal
        isOpen={Boolean(ratingBooking)}
        booking={ratingBooking}
        role="admin"
        lang={lang}
        onClose={() => setRatingBooking(null)}
        onSuccess={(_ratedBooking, rating) => {
          showToast(
            lang === 'my'
              ? `Barber Rating ${rating}⭐️ ပေးပြီးပါပြီ (အောင်မြင်ပါသည်)`
              : `Stylist rated ${rating}⭐️ successfully!`
          );
          setRatingBooking(null);
          onRefresh();
        }}
      />

    </div>
  );
};
