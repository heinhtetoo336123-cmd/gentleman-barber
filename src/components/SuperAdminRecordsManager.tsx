import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Booking, Designer, Service, UserProfile, BookingStatus } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import { playSuccessChime, playNotificationChime } from '../utils/audio';
import { verifySuperAdminPassword, verifySuperAdminPin } from '../lib/authCrypto';
import {
  Trash2,
  Search,
  Calendar,
  Clock,
  User,
  Phone,
  Scissors,
  DollarSign,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Zap,
  Tag,
  Database,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SuperAdminRecordsManagerProps {
  bookings?: Booking[];
  designers?: Designer[];
  services?: Service[];
  clients?: UserProfile[];
  onRefresh?: () => void;
  lang?: 'en' | 'my';
  onNavigateToClients?: () => void;
}

export const SuperAdminRecordsManager: React.FC<SuperAdminRecordsManagerProps> = ({
  bookings: propBookings = [],
  designers = [],
  services = [],
  clients = [],
  onRefresh,
  lang = 'my',
  onNavigateToClients,
}) => {
  const [records, setRecords] = useState<Booking[]>(() => {
    return propBookings.length > 0 ? propBookings : api.getCachedBookings();
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'walkin'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Deletion Modal
  const [recordToDelete, setRecordToDelete] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deletePasswordError, setDeletePasswordError] = useState<string>('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial & Date-change Data Loader from barber-db
  const fetchRecords = useCallback(async (targetDate?: string) => {
    setLoading(true);
    try {
      const data = await api.getAllBookings(targetDate ? { date: targetDate } : { limitCount: 500 });
      setRecords(data || []);
    } catch (err: any) {
      console.warn('SuperAdmin fetchRecords error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords(selectedDate || undefined);
  }, [fetchRecords, selectedDate]);

  // Keep records synced if parent prop changes and no date filter
  useEffect(() => {
    if (!selectedDate && propBookings && propBookings.length > 0) {
      setRecords(prev => {
        // Merge without losing any loaded historical records
        const map = new Map<string, Booking>();
        prev.forEach(b => map.set(b.id, b));
        propBookings.forEach(b => map.set(b.id, b));
        return Array.from(map.values()).sort((a, b) => {
          const dateDiff = (b.date || '').localeCompare(a.date || '');
          if (dateDiff !== 0) return dateDiff;
          return Number(b.createdAt || 0) - Number(a.createdAt || 0);
        });
      });
    }
  }, [propBookings, selectedDate]);

  // Filter & Search Logic
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return records.filter((b) => {
      // 1. Search Query Filter (name, phone, code, id, service, designer)
      if (q) {
        const matchesCode = (b.bookingCode || '').toLowerCase().includes(q);
        const matchesId = (b.id || '').toLowerCase().includes(q);
        const matchesName = (b.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (b.customerPhone || '').toLowerCase().includes(q);
        const matchesService = (b.serviceName || '').toLowerCase().includes(q);
        const matchesDesigner = (b.designerName || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesId && !matchesName && !matchesPhone && !matchesService && !matchesDesigner) {
          return false;
        }
      }

      // 2. Date Filter
      if (selectedDate) {
        const bDate = (b.date || '').split('T')[0];
        if (bDate !== selectedDate) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter !== 'all') {
        if (b.status !== statusFilter) {
          return false;
        }
      }

      // 4. Type Filter (Walk-in vs Online Booking)
      if (typeFilter === 'walkin') {
        const isWlk = b.isWalkin === true || (b.bookingCode && b.bookingCode.startsWith('WLK')) || (b.notes && b.notes.includes('Walk-in'));
        if (!isWlk) return false;
      } else if (typeFilter === 'online') {
        const isWlk = b.isWalkin === true || (b.bookingCode && b.bookingCode.startsWith('WLK')) || (b.notes && b.notes.includes('Walk-in'));
        if (isWlk) return false;
      }

      return true;
    });
  }, [records, searchQuery, selectedDate, statusFilter, typeFilter]);

  // Summary Metrics for the currently filtered set
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let walkinCount = 0;
    let onlineCount = 0;

    filteredRecords.forEach((b) => {
      const price = Number(b.servicePrice ?? b.price ?? 0);
      if (b.status !== 'cancelled' && b.status !== 'held') {
        totalRevenue += price;
      }
      if (b.status === 'completed') completedCount++;
      else if (b.status === 'pending') pendingCount++;
      else if (b.status === 'cancelled') cancelledCount++;

      const isWlk = b.isWalkin === true || (b.bookingCode && b.bookingCode.startsWith('WLK'));
      if (isWlk) walkinCount++;
      else onlineCount++;
    });

    return {
      totalRevenue,
      completedCount,
      pendingCount,
      cancelledCount,
      walkinCount,
      onlineCount,
      totalCount: filteredRecords.length
    };
  }, [filteredRecords]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDate, statusFilter, typeFilter, pageSize]);

  // ROBUST ATOMIC DELETION LOGIC (PASSWORD PROTECTED)
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    if (!deletePassword.trim()) {
      setDeletePasswordError(lang === 'my' ? 'Superadmin စကားဝှက် / PIN ထည့်သွင်းပါ' : 'Please enter Superadmin Password / PIN');
      return;
    }

    const isValid = verifySuperAdminPassword(deletePassword.trim()) || verifySuperAdminPin(deletePassword.trim());
    if (!isValid) {
      setDeletePasswordError(lang === 'my' ? 'စကားဝှက် / PIN မှားယွင်းနေပါသည်' : 'Incorrect Superadmin Password / PIN');
      playNotificationChime();
      return;
    }

    const target = recordToDelete;
    const cleanDate = (target.date || new Date().toISOString().split('T')[0]).split('T')[0];

    // Optimistically remove item from UI immediately without page refresh
    setRecords((prev) => prev.filter((r) => r.id !== target.id));
    setRecordToDelete(null);
    setDeletePassword('');
    setDeletePasswordError('');
    setIsDeleting(true);

    try {
      // a, b, c, d) Handled atomically in client api:
      // a) Reads target date (cleanDate)
      // b) Atomically filters item from days/{date}.bookings array in barber-db
      // c) Recalculates summary inside days/{date} (decrements revenue, booking count)
      // d) Runs deleteDoc(doc(db, 'bookings', id)) in barber-db
      await api.deleteBooking(target.id, cleanDate);
      playSuccessChime();
      showToast(
        lang === 'my'
          ? `မှတ်တမ်း (${target.bookingCode || target.id}) အား barber-db နှင့် Daily Ledger ထဲမှ အပြီးသတ် ဖျက်ပြီးပါပြီ`
          : `Record (${target.bookingCode || target.id}) permanently removed from barber-db & Daily Ledger.`,
        'success'
      );
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('SuperAdmin delete error:', err);
      // Revert optimistic removal on error
      setRecords((prev) => [target, ...prev]);
      playNotificationChime();
      showToast(
        lang === 'my'
          ? `မှတ်တမ်းဖျက်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err.message || 'Error'}`
          : `Failed to delete record: ${err.message || 'Error'}`,
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase font-mono bg-emerald-100 text-emerald-900 border border-emerald-300">
            Completed
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase font-mono bg-blue-100 text-blue-900 border border-blue-300">
            Confirmed
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase font-mono bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
            In-Progress
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase font-mono bg-rose-100 text-rose-900 border border-rose-300">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase font-mono bg-stone-100 text-stone-800 border border-stone-300">
            Pending
          </span>
        );
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-bold font-mono border ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
                : 'bg-rose-950 text-rose-100 border-rose-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-stone-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER: DEDICATED CLEAN SUPERADMIN BANNER */}
      <div className="bg-stone-950 border border-stone-800 rounded-3xl p-5 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider font-mono border border-amber-500/30 flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Superadmin Clearance</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/30 flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>barber-db</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider font-mono text-white">
              Booking & WLK Records Manager
            </h1>
            <p className="text-xs text-stone-400 font-mono">
              {lang === 'my'
                ? 'ဘိုကင်နှင့် Walk-in မှတ်တမ်းများ ရှာဖွေစစ်ဆေးခြင်းနှင့် အပြီးသတ် ဖျက်သိမ်းမှုစင်တာ (Real-time Day Ledger Sync)'
                : 'Centralized search, verification, and atomic deletion hub for all Bookings and Walk-in records.'}
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {onNavigateToClients && (
              <button
                type="button"
                onClick={onNavigateToClients}
                className="px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Client List ({clients.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchRecords(selectedDate || undefined)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-95 text-white border border-stone-700 text-xs font-mono font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Syncing...' : 'Reload DB'}</span>
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5 pt-4 border-t border-stone-800/80 text-xs font-mono">
          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-2.5">
            <span className="text-stone-400 text-[10px] uppercase block">Total Filtered</span>
            <span className="text-base font-extrabold text-white">{metrics.totalCount}</span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-2.5">
            <span className="text-stone-400 text-[10px] uppercase block">Revenue</span>
            <span className="text-base font-extrabold text-emerald-400">{formatPrice(metrics.totalRevenue)}</span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-2.5">
            <span className="text-stone-400 text-[10px] uppercase block">Walk-in (WLK)</span>
            <span className="text-base font-extrabold text-amber-400">{metrics.walkinCount}</span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-2.5">
            <span className="text-stone-400 text-[10px] uppercase block">Online (GTM)</span>
            <span className="text-base font-extrabold text-blue-400">{metrics.onlineCount}</span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-2.5">
            <span className="text-stone-400 text-[10px] uppercase block">Completed</span>
            <span className="text-base font-extrabold text-emerald-400">{metrics.completedCount}</span>
          </div>

          <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-2.5">
            <span className="text-stone-400 text-[10px] uppercase block">Cancelled</span>
            <span className="text-base font-extrabold text-rose-400">{metrics.cancelledCount}</span>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER CONTROLS */}
      <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* 1. Main Search Bar */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'my' ? 'အမည်၊ ဖုန်းနံပါတ်၊ GTM-... သို့မဟုတ် WLK-... ဖြင့် ရှာဖွေပါ' : 'Search name, phone, code (GTM/WLK)...'}
              className="w-full pl-9 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-mono text-stone-900 focus:outline-hidden focus:bg-white focus:border-stone-900 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Date Filter / Date Picker */}
          <div className="md:col-span-3 relative">
            <Calendar className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-mono text-stone-900 focus:outline-hidden focus:bg-white focus:border-stone-900 transition-colors cursor-pointer"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                title="Clear date filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 3. Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-mono text-stone-900 focus:outline-hidden focus:bg-white focus:border-stone-900 transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In-Progress</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* 4. Type Filter */}
          <div className="md:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm font-mono text-stone-900 focus:outline-hidden focus:bg-white focus:border-stone-900 transition-colors cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="walkin">Walk-in (WLK)</option>
              <option value="online">Online (GTM)</option>
            </select>
          </div>
        </div>

        {/* Date Shortcut Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs font-mono">
          <span className="text-stone-400 text-[11px] mr-1">Quick Dates:</span>
          <button
            type="button"
            onClick={() => setSelectedDate('')}
            className={`px-2.5 py-1 rounded-xl cursor-pointer border transition-colors ${
              !selectedDate ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
            }`}
          >
            All Dates
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className={`px-2.5 py-1 rounded-xl cursor-pointer border transition-colors ${
              selectedDate === todayStr ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
            }`}
          >
            Today ({todayStr})
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 cursor-pointer transition-colors"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate('2026-09-30')}
            className={`px-2.5 py-1 rounded-xl cursor-pointer border transition-colors ${
              selectedDate === '2026-09-30' ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
            }`}
          >
            2026-09-30
          </button>
        </div>
      </div>

      {/* RECORDS LIST: CLEAN PAGINATED TABLE & MOBILE CARDS */}
      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3 font-mono">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">
              Loading records from barber-db...
            </p>
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3 font-mono">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-400">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-700 uppercase">
              {lang === 'my' ? 'ကိုက်ညီသော မှတ်တမ်း မရှိပါ' : 'No matching records found'}
            </p>
            <p className="text-xs text-stone-400">
              {selectedDate || searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search query, date, or status filter.'
                : 'No booking or walk-in records currently in barber-db.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-100/80 border-b border-stone-200 text-stone-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Code / Type</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Designer</th>
                    <th className="py-3 px-4">Service & Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Delete Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {paginatedRecords.map((b) => {
                    const isWlk = b.isWalkin === true || (b.bookingCode && b.bookingCode.startsWith('WLK'));
                    const price = Number(b.servicePrice ?? b.price ?? 0);

                    return (
                      <tr key={b.id} className="hover:bg-stone-50/80 transition-colors">
                        {/* Code / Type */}
                        <td className="py-3.5 px-4 font-bold">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                isWlk ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-300'
                              }`}
                            >
                              {isWlk ? 'WLK' : 'GTM'}
                            </span>
                            <span className="text-stone-900">{b.bookingCode || b.id.slice(0, 8)}</span>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-4 text-stone-700 whitespace-nowrap">
                          <div className="flex items-center space-x-1 text-stone-900 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{b.date || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-[11px] text-stone-500 mt-0.5">
                            <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                            <span>{b.timeSlot || '—'}</span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-stone-950 flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{b.customerName || 'ဧည့်သည်တော်'}</span>
                          </div>
                          <div className="text-stone-500 text-[11px] mt-0.5 flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-stone-400 shrink-0" />
                            <span>{b.customerPhone || '—'}</span>
                          </div>
                        </td>

                        {/* Designer */}
                        <td className="py-3.5 px-4 font-semibold text-stone-800">
                          {b.designerName || 'Stylist'}
                        </td>

                        {/* Service & Price */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-stone-900 truncate max-w-[160px]">
                            {b.serviceName || 'Custom Service'}
                          </div>
                          <div className="font-bold text-emerald-700 text-[11px] mt-0.5">
                            {formatPrice(price)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(b.status)}
                        </td>

                        {/* Delete Action */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setRecordToDelete(b)}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 hover:text-rose-900 text-xs font-bold border border-rose-200/90 inline-flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
                            title="Delete permanently from barber-db"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete / ဖျက်မည်</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-stone-100 font-mono">
              {paginatedRecords.map((b) => {
                const isWlk = b.isWalkin === true || (b.bookingCode && b.bookingCode.startsWith('WLK'));
                const price = Number(b.servicePrice ?? b.price ?? 0);

                return (
                  <div key={b.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            isWlk ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}
                        >
                          {isWlk ? 'WLK' : 'GTM'}
                        </span>
                        <span className="font-extrabold text-xs text-stone-900">{b.bookingCode || b.id.slice(0, 8)}</span>
                      </div>
                      {getStatusBadge(b.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase">Customer</span>
                        <span className="font-bold text-stone-900 block truncate">{b.customerName || 'ဧည့်သည်တော်'}</span>
                        <span className="text-stone-500 text-[11px]">{b.customerPhone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block uppercase">Date & Time</span>
                        <span className="font-semibold text-stone-900 block">{b.date}</span>
                        <span className="text-stone-500 text-[11px]">{b.timeSlot || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs">
                      <div>
                        <span className="font-medium text-stone-800">{b.serviceName || 'Custom'}</span>
                        <span className="text-stone-400 text-[10px] ml-1.5">• {b.designerName || 'Stylist'}</span>
                        <div className="font-bold text-emerald-700">{formatPrice(price)}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setRecordToDelete(b)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 text-xs font-bold border border-rose-200 inline-flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>ဖျက်မည်</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PAGINATION CONTROLS */}
            <div className="bg-stone-50/90 border-t border-stone-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
              <div className="text-stone-500">
                Showing{' '}
                <span className="font-bold text-stone-900">
                  {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                </span>{' '}
                to{' '}
                <span className="font-bold text-stone-900">
                  {Math.min(currentPage * pageSize, filteredRecords.length)}
                </span>{' '}
                of <span className="font-bold text-stone-900">{filteredRecords.length}</span> records
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-stone-500 text-[11px]">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-800 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <div className="flex items-center space-x-1 ml-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 disabled:opacity-40 text-stone-700 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2.5 py-1 text-stone-800 font-bold">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 disabled:opacity-40 text-stone-700 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DEDICATED ATOMIC DELETION CONFIRMATION MODAL */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="bg-white border border-rose-200 rounded-3xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl font-mono"
            >
              <div className="flex items-center space-x-3 text-rose-700 border-b border-rose-100 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase text-rose-950">
                    👑 [Superadmin Delete Action]
                  </h3>
                  <p className="text-[11px] text-rose-600">
                    Permanent record removal from barber-db & Daily Ledger
                  </p>
                </div>
              </div>

              {/* Record Summary Card */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Booking Code:</span>
                  <span className="font-extrabold text-stone-900">
                    {recordToDelete.bookingCode || recordToDelete.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Customer:</span>
                  <span className="font-bold text-stone-900">
                    {recordToDelete.customerName} ({recordToDelete.customerPhone || 'No Phone'})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Appointment Date:</span>
                  <span className="font-bold text-stone-900">
                    {recordToDelete.date} • {recordToDelete.timeSlot || 'Anytime'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Service:</span>
                  <span className="font-semibold text-stone-900">{recordToDelete.serviceName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Revenue to Deduct:</span>
                  <span className="font-extrabold text-emerald-800">
                    {formatPrice(recordToDelete.servicePrice ?? recordToDelete.price ?? 0)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-stone-600 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                ⚠️ <span className="font-bold text-stone-900">အရေးကြီးသတိပေးချက်:</span> ဤမှတ်တမ်းအား barber-db ၏ <span className="font-bold text-rose-700">days/{recordToDelete.date}</span> Daily Ledger ထဲမှ ဖယ်ထုတ်ကာ နေ့စဉ်ဝင်ငွေမှ နုတ်ယူပြီး အပြီးတိုင် ဖျက်ပစ်ပါမည်။
              </div>

              {/* Password Protection Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
                  <span>🔒</span>
                  <span>{lang === 'my' ? 'Superadmin စကားဝှက် / PIN ရိုက်ထည့်ပါ:' : 'Enter Superadmin Password / PIN:'}</span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeletePasswordError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmDelete();
                  }}
                  placeholder="••••••••"
                  className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all"
                  autoFocus
                />
                {deletePasswordError && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center space-x-1 mt-1 animate-in fade-in duration-150">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{deletePasswordError}</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecordToDelete(null);
                    setDeletePassword('');
                    setDeletePasswordError('');
                  }}
                  disabled={isDeleting}
                  className="w-1/2 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 font-bold text-xs uppercase cursor-pointer transition-all"
                >
                  မဖျက်တော့ပါ (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs uppercase flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-xs disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>ဖျက်နေသည်...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>အတည်ပြု ဖျက်မည်</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
