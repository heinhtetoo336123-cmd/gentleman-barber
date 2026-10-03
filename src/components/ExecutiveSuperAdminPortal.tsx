import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Booking, Designer, Service, DayLedger, YearlyReport } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import { downloadCsvFile } from '../utils/exportHelpers';
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
  Download,
  Printer,
  LogOut,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Building,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ExecutiveSuperAdminPortalProps {
  lang?: 'en' | 'my';
  onLogout: () => void;
  designers?: Designer[];
  services?: Service[];
}

type SuperAdminTab = 'records' | 'finance';
type FinancePeriod = 'daily' | 'monthly' | 'yearly';

export const ExecutiveSuperAdminPortal: React.FC<ExecutiveSuperAdminPortalProps> = ({
  lang = 'my',
  onLogout,
  designers = [],
  services = [],
}) => {
  // Top level active tab: Record Cleaner vs Financial Ledger & Reports
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('records');

  // Today string helper (local YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // IN-MEMORY CACHE (STRICT LOW-READ ARCHITECTURE):
  // Navigating between tabs or dates already loaded consumes ZERO additional Firestore reads!
  const ledgerCache = useRef<Map<string, DayLedger>>(new Map());
  const yearlyReportCache = useRef<Map<string, YearlyReport>>(new Map());
  const allBookingsCache = useRef<Booking[] | null>(null);

  // -------------------------------------------------------------
  // TAB 1: RECORD CLEANER STATE
  // -------------------------------------------------------------
  const [recordDateFilter, setRecordDateFilter] = useState<'today' | 'yesterday' | 'custom' | 'all'>('today');
  const [customRecordDate, setCustomRecordDate] = useState<string>(todayStr);
  const [recordSearchQuery, setRecordSearchQuery] = useState<string>('');
  const [currentBookings, setCurrentBookings] = useState<Booking[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState<boolean>(false);
  const [recordToDelete, setRecordToDelete] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deletePasswordError, setDeletePasswordError] = useState<string>('');

  // -------------------------------------------------------------
  // TAB 2: FINANCIAL AUDITOR STATE
  // -------------------------------------------------------------
  const [financePeriod, setFinancePeriod] = useState<FinancePeriod>('daily');
  const [financeDate, setFinanceDate] = useState<string>(todayStr);
  const [financeMonth, setFinanceMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM
  const [financeYear, setFinanceYear] = useState<string>(todayStr.slice(0, 4)); // YYYY
  const [dailyLedgerData, setDailyLedgerData] = useState<DayLedger | null>(null);
  const [yearlyReportData, setYearlyReportData] = useState<YearlyReport | null>(null);
  const [isFinanceLoading, setIsFinanceLoading] = useState<boolean>(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // -------------------------------------------------------------
  // FETCH RECORD CLEANER DATA (LOW-READ OPTIMIZED)
  // -------------------------------------------------------------
  const loadRecordCleanerData = useCallback(async () => {
    setIsRecordsLoading(true);
    try {
      if (recordDateFilter === 'all') {
        if (allBookingsCache.current) {
          setCurrentBookings(allBookingsCache.current);
          setIsRecordsLoading(false);
          return;
        }
        const data = await api.getAllBookings({ limitCount: 500 });
        allBookingsCache.current = data;
        setCurrentBookings(data || []);
      } else {
        const targetDate = recordDateFilter === 'today'
          ? todayStr
          : recordDateFilter === 'yesterday'
          ? yesterdayStr
          : customRecordDate;

        if (ledgerCache.current.has(targetDate)) {
          const cached = ledgerCache.current.get(targetDate)!;
          setCurrentBookings(cached.bookings || []);
          setIsRecordsLoading(false);
          return;
        }

        // Single document read for days/{date}
        const ledger = await api.getDayLedger(targetDate);
        ledgerCache.current.set(targetDate, ledger);
        setCurrentBookings(ledger.bookings || []);
      }
    } catch (err: any) {
      console.warn('Record cleaner load error:', err);
    } finally {
      setIsRecordsLoading(false);
    }
  }, [recordDateFilter, customRecordDate, todayStr, yesterdayStr]);

  // Load records whenever date filter changes
  useEffect(() => {
    if (activeTab === 'records') {
      loadRecordCleanerData();
    }
  }, [activeTab, loadRecordCleanerData]);

  // -------------------------------------------------------------
  // FETCH FINANCIAL AUDITOR DATA (LOW-READ OPTIMIZED)
  // -------------------------------------------------------------
  const loadFinancialData = useCallback(async () => {
    setIsFinanceLoading(true);
    try {
      if (financePeriod === 'daily') {
        if (ledgerCache.current.has(financeDate)) {
          setDailyLedgerData(ledgerCache.current.get(financeDate)!);
          setIsFinanceLoading(false);
          return;
        }
        // Single document read for days/{financeDate}
        const ledger = await api.getDayLedger(financeDate);
        ledgerCache.current.set(financeDate, ledger);
        setDailyLedgerData(ledger);
      } else {
        const targetYear = financePeriod === 'monthly' ? financeMonth.slice(0, 4) : financeYear;
        if (yearlyReportCache.current.has(targetYear)) {
          setYearlyReportData(yearlyReportCache.current.get(targetYear)!);
          setIsFinanceLoading(false);
          return;
        }
        // Single document read for reports/{targetYear}
        const rep = await api.getYearlyReport(targetYear);
        yearlyReportCache.current.set(targetYear, rep);
        setYearlyReportData(rep);
      }
    } catch (err: any) {
      console.warn('Finance data load error:', err);
    } finally {
      setIsFinanceLoading(false);
    }
  }, [financePeriod, financeDate, financeMonth, financeYear]);

  // Load finance data whenever period or date changes
  useEffect(() => {
    if (activeTab === 'finance') {
      loadFinancialData();
    }
  }, [activeTab, loadFinancialData]);

  // -------------------------------------------------------------
  // ATOMIC DELETION LOGIC (TAB 1 - PASSWORD PROTECTED)
  // -------------------------------------------------------------
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
    const cleanDate = (target.date || todayStr).split('T')[0];

    // Optimistic UI update: instantly remove from list
    setCurrentBookings((prev) => prev.filter((r) => r.id !== target.id));
    if (allBookingsCache.current) {
      allBookingsCache.current = allBookingsCache.current.filter((r) => r.id !== target.id);
    }
    setRecordToDelete(null);
    setDeletePassword('');
    setDeletePasswordError('');
    setIsDeleting(true);

    try {
      // a) Determines appointment date
      // b) Atomically removes from days/{cleanDate}.bookings
      // c) Recalculates summary inside days/{cleanDate} (decrements revenue, counts)
      // d) Runs deleteDoc(doc(db, 'bookings', target.id))
      await api.deleteBooking(target.id, cleanDate);

      // Invalidate / update in-memory ledger cache for this day
      if (ledgerCache.current.has(cleanDate)) {
        const cached = ledgerCache.current.get(cleanDate)!;
        const updatedBookings = (cached.bookings || []).filter((b) => b.id !== target.id);
        const price = Number(target.servicePrice ?? target.price ?? 0);
        const updatedLedger: DayLedger = {
          ...cached,
          bookings: updatedBookings,
          summary: {
            ...cached.summary,
            totalBookings: Math.max(0, (cached.summary?.totalBookings || 0) - 1),
            totalRevenue: Math.max(0, (cached.summary?.totalRevenue || 0) - (target.status !== 'cancelled' ? price : 0)),
            netProfit: Math.max(0, (cached.summary?.netProfit || 0) - (target.status !== 'cancelled' ? price : 0)),
          }
        };
        ledgerCache.current.set(cleanDate, updatedLedger);
      }

      playSuccessChime();
      showToast(
        lang === 'my'
          ? `မှတ်တမ်း (${target.bookingCode || target.id}) အား barber-db မှ အပြီးသတ် ဖျက်ပြီးပါပြီ`
          : `Record (${target.bookingCode || target.id}) permanently deleted from barber-db.`,
        'success'
      );
    } catch (err: any) {
      console.error('Superadmin delete error:', err);
      // Revert optimistic removal on failure
      setCurrentBookings((prev) => [target, ...prev]);
      playNotificationChime();
      showToast(`Delete failed: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Records (Tab 1)
  const filteredBookings = useMemo(() => {
    const q = recordSearchQuery.trim().toLowerCase();
    if (!q) return currentBookings;

    return currentBookings.filter((b) => {
      const matchCode = (b.bookingCode || '').toLowerCase().includes(q);
      const matchId = (b.id || '').toLowerCase().includes(q);
      const matchName = (b.customerName || '').toLowerCase().includes(q);
      const matchPhone = (b.customerPhone || '').toLowerCase().includes(q);
      const matchStylist = (b.designerName || '').toLowerCase().includes(q);
      const matchService = (b.serviceName || '').toLowerCase().includes(q);
      return matchCode || matchId || matchName || matchPhone || matchStylist || matchService;
    });
  }, [currentBookings, recordSearchQuery]);

  // Financial Metrics Summary (Tab 2)
  const financeMetrics = useMemo(() => {
    if (financePeriod === 'daily') {
      const summary = dailyLedgerData?.summary;
      const bookings = dailyLedgerData?.bookings || [];
      const expenses = dailyLedgerData?.expenses || [];
      const retailSales = dailyLedgerData?.retailSales || [];

      const totalRevenue = summary?.totalRevenue || 0;
      const totalExpenses = summary?.totalExpenses || 0;
      const netProfit = summary?.netProfit || (totalRevenue - totalExpenses);
      const jobCount = bookings.filter((b) => b.status !== 'cancelled').length;

      return {
        totalRevenue,
        totalExpenses,
        netProfit,
        jobCount,
        bookings,
        expenses,
        retailSales,
      };
    } else if (financePeriod === 'monthly') {
      const monthStr = financeMonth.slice(5, 7); // MM
      const monthData = (yearlyReportData?.months as any)?.[monthStr];

      const totalRevenue = monthData?.revenue ?? monthData?.totalRevenue ?? 0;
      const totalExpenses = monthData?.expenses ?? monthData?.totalExpenses ?? 0;
      const netProfit = monthData?.netProfit ?? (totalRevenue - totalExpenses);
      const jobCount = monthData?.bookingsCount ?? monthData?.totalBookings ?? 0;
      const days = monthData?.days || {};

      return {
        totalRevenue,
        totalExpenses,
        netProfit,
        jobCount,
        daysBreakdown: Object.entries(days).sort(([a], [b]) => b.localeCompare(a)),
      };
    } else {
      // Yearly
      const totalRevenue = yearlyReportData?.totalRevenue ?? (yearlyReportData as any)?.revenue ?? 0;
      const totalExpenses = yearlyReportData?.totalExpenses ?? (yearlyReportData as any)?.expenses ?? 0;
      const netProfit = yearlyReportData?.netProfit ?? (totalRevenue - totalExpenses);
      const months = (yearlyReportData?.months as any) || {};

      let jobCount = 0;
      Object.values(months).forEach((m: any) => {
        jobCount += (m.bookingsCount ?? m.totalBookings ?? 0);
      });

      return {
        totalRevenue,
        totalExpenses,
        netProfit,
        jobCount: jobCount || (yearlyReportData as any)?.totalBookings || 0,
        monthsBreakdown: Object.entries(months).sort(([a], [b]) => a.localeCompare(b)),
      };
    }
  }, [financePeriod, dailyLedgerData, yearlyReportData, financeMonth]);

  // -------------------------------------------------------------
  // EXPORT TO EXCEL / CSV
  // -------------------------------------------------------------
  const handleExportCsv = () => {
    if (financePeriod === 'daily') {
      const bookings = dailyLedgerData?.bookings || [];
      const expenses = dailyLedgerData?.expenses || [];
      const retail = dailyLedgerData?.retailSales || [];

      const headers = ['Date', 'Time', 'Type', 'Code', 'Customer / Payee', 'Phone', 'Stylist / Category', 'Service / Description', 'Amount (MMK)', 'Status'];
      const rows: (string | number | boolean | null | undefined)[][] = [];

      // Bookings & Walkins
      bookings.forEach((b) => {
        const isWlk = b.isWalkin || b.bookingCode?.startsWith('WLK');
        rows.push([
          b.date || financeDate,
          b.timeSlot || '—',
          isWlk ? 'WALK-IN' : 'ONLINE',
          b.bookingCode || b.id.slice(0, 8),
          b.customerName || 'Walk-in Guest',
          b.customerPhone || '',
          b.designerName || 'Stylist',
          b.serviceName || 'Hair Service',
          Number(b.servicePrice ?? b.price ?? 0),
          b.status
        ]);
      });

      // Retail Sales
      retail.forEach((r) => {
        rows.push([
          financeDate,
          'POS',
          'RETAIL',
          r.id.slice(0, 8),
          r.customerName || 'Retail Customer',
          '',
          (r as any).sellerName || (r as any).staffName || 'Staff',
          r.productName || 'Product',
          Number(r.totalPrice || 0),
          'completed'
        ]);
      });

      // Expenses
      expenses.forEach((e) => {
        rows.push([
          financeDate,
          'EXPENSE',
          'EXPENSE',
          e.id.slice(0, 8),
          (e as any).payee || 'Expense',
          '',
          e.category || 'General',
          e.title || 'Shop Expense',
          -Math.abs(Number(e.amount || 0)),
          'paid'
        ]);
      });

      downloadCsvFile(headers, rows, `GENTLEMAN_Daily_Ledger_${financeDate}`);
      showToast('Daily Ledger exported to CSV!');
    } else if (financePeriod === 'monthly') {
      const headers = ['Date', 'Day Total Revenue (MMK)', 'Day Total Expenses (MMK)', 'Day Net Profit (MMK)', 'Completed Bookings'];
      const rows = (financeMetrics.daysBreakdown || []).map(([date, sum]: [string, any]) => {
        const rev = sum.revenue ?? sum.totalRevenue ?? 0;
        const exp = sum.expenses ?? sum.totalExpenses ?? 0;
        const profit = sum.netProfit ?? (rev - exp);
        const jobs = sum.bookingsCount ?? sum.totalBookings ?? 0;
        return [date, rev, exp, profit, jobs];
      });
      downloadCsvFile(headers, rows, `GENTLEMAN_Monthly_Report_${financeMonth}`);
      showToast('Monthly Report exported to CSV!');
    } else {
      const headers = ['Month', 'Monthly Revenue (MMK)', 'Monthly Expenses (MMK)', 'Monthly Net Profit (MMK)', 'Completed Bookings'];
      const rows = (financeMetrics.monthsBreakdown || []).map(([m, sum]: [string, any]) => {
        const rev = sum.revenue ?? sum.totalRevenue ?? 0;
        const exp = sum.expenses ?? sum.totalExpenses ?? 0;
        const profit = sum.netProfit ?? (rev - exp);
        const jobs = sum.bookingsCount ?? sum.totalBookings ?? 0;
        return [`${financeYear}-${m}`, rev, exp, profit, jobs];
      });
      downloadCsvFile(headers, rows, `GENTLEMAN_Yearly_Report_${financeYear}`);
      showToast('Yearly Report exported to CSV!');
    }
  };

  // -------------------------------------------------------------
  // PRINT REPORT (CLEAN A4 LAYOUT)
  // -------------------------------------------------------------
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto font-sans pb-10">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2.5 text-xs font-mono font-bold border print:hidden ${
              toast.type === 'success'
                ? 'bg-stone-900 text-emerald-400 border-emerald-500/40'
                : 'bg-rose-950 text-rose-300 border-rose-700/50'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-stone-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. MINIMAL EXECUTIVE TOP BAR */}
      <header className="bg-stone-950 text-white rounded-2xl p-3 sm:p-3.5 border border-stone-800 shadow-md space-y-2.5 md:space-y-0 md:flex md:items-center md:justify-between print:hidden">
        {/* Brand & Badge + Mobile Logout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono font-black text-xs sm:text-base tracking-wider uppercase">
              GENTLEMAN <span className="text-amber-400">👑 SUPERADMIN</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-stone-900 text-stone-400 text-[10px] font-mono border border-stone-800">
              barber-db
            </span>
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={onLogout}
              className="px-2.5 py-1 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 text-xs font-mono font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Primary View Tabs: [ 🗑️ Record Cleaner ] | [ 📊 Financial Ledger & Reports ] */}
        <div className="flex items-center p-1 bg-stone-900 border border-stone-800 rounded-xl w-full md:w-auto justify-center">
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`flex-1 md:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'records'
                ? 'bg-white text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Record Cleaner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={`flex-1 md:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-white text-stone-950 shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Financial Ledger & Reports</span>
          </button>
        </div>

        {/* Desktop Logout Button */}
        <div className="hidden md:flex items-center justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-95 text-stone-300 hover:text-white border border-stone-800 text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ============================================================= */}
      {/* TAB 1: RECORD CLEANER (DENSE FINANCIAL ROWS & ATOMIC DELETION) */}
      {/* ============================================================= */}
      {activeTab === 'records' && (
        <div className="space-y-3 print:hidden">
          {/* Controls Strip: Search & Inline Date Shortcuts */}
          <div className="bg-white border border-stone-200 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recordSearchQuery}
                onChange={(e) => setRecordSearchQuery(e.target.value)}
                placeholder="Search code, phone, name..."
                className="w-full pl-8 pr-7 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:outline-hidden focus:bg-white focus:border-stone-900"
              />
              {recordSearchQuery && (
                <button
                  onClick={() => setRecordSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Inline Date Shortcuts: [Today] [Yesterday] [Pick Date 📅] [All] */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-start md:justify-end text-xs font-mono">
              <button
                type="button"
                onClick={() => setRecordDateFilter('today')}
                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  recordDateFilter === 'today'
                    ? 'bg-stone-900 text-white border-stone-900 font-bold'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setRecordDateFilter('yesterday')}
                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  recordDateFilter === 'yesterday'
                    ? 'bg-stone-900 text-white border-stone-900 font-bold'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                Yesterday
              </button>

              {/* Inline Date Picker */}
              <div className="relative inline-flex items-center">
                <input
                  type="date"
                  value={customRecordDate}
                  onChange={(e) => {
                    setCustomRecordDate(e.target.value);
                    setRecordDateFilter('custom');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                    recordDateFilter === 'custom'
                      ? 'bg-stone-900 text-white border-stone-900 font-bold'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={() => setRecordDateFilter('all')}
                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  recordDateFilter === 'all'
                    ? 'bg-stone-900 text-white border-stone-900 font-bold'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                All (Max 500)
              </button>

              <button
                type="button"
                onClick={loadRecordCleanerData}
                disabled={isRecordsLoading}
                className="p-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 cursor-pointer ml-1"
                title="Reload current date"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecordsLoading ? 'animate-spin text-amber-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* DENSE FINANCIAL RECORD ROWS */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-stone-100/70 px-4 py-2 border-b border-stone-200 flex items-center justify-between text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider">
              <span>Time & Status • Code • Customer • Stylist • Service</span>
              <span>Amount • Action</span>
            </div>

            {isRecordsLoading ? (
              <div className="p-8 text-center text-xs font-mono text-stone-400 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-500" />
                <p>Loading records from barber-db...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-stone-400">
                No records found for the selected date filter.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredBookings.map((b) => {
                  const isWlk = b.isWalkin || b.bookingCode?.startsWith('WLK');
                  const price = Number(b.servicePrice ?? b.price ?? 0);

                  // Status Dot Indicator
                  const statusDotClass =
                    b.status === 'completed'
                      ? 'bg-emerald-500 ring-2 ring-emerald-200'
                      : b.status === 'confirmed'
                      ? 'bg-blue-500 ring-2 ring-blue-200'
                      : b.status === 'cancelled'
                      ? 'bg-rose-500 ring-2 ring-rose-200'
                      : 'bg-amber-400 ring-2 ring-amber-200';

                  return (
                    <div
                      key={b.id}
                      className="px-3.5 py-2.5 flex items-center justify-between hover:bg-stone-50/80 transition-colors text-xs font-mono gap-2"
                    >
                      {/* Left: Time dot, Code, Customer & Stylist, Service */}
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass}`} title={b.status} />

                        {/* Time */}
                        <span className="text-stone-500 shrink-0 text-[11px] w-14">
                          {b.timeSlot || 'Anytime'}
                        </span>

                        {/* Code Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            isWlk
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}
                        >
                          {b.bookingCode || (isWlk ? 'WLK' : 'GTM')}
                        </span>

                        {/* Customer & Stylist */}
                        <span className="font-bold text-stone-900 truncate max-w-[130px] sm:max-w-[180px]">
                          {b.customerName || 'Walk-in'}
                        </span>
                        <span className="text-stone-400 hidden sm:inline">•</span>
                        <span className="text-stone-500 text-[11px] truncate max-w-[100px] hidden sm:inline">
                          {b.designerName || 'Stylist'}
                        </span>

                        {/* Service Name */}
                        <span className="text-stone-400 hidden md:inline">•</span>
                        <span className="text-stone-600 truncate max-w-[150px] hidden md:inline">
                          {b.serviceName || 'Custom Service'}
                        </span>
                      </div>

                      {/* Right: Amount & Subtle Red Trash Icon */}
                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="font-bold text-stone-900 text-xs">
                          {formatPrice(price)}
                        </span>

                        <button
                          type="button"
                          onClick={() => setRecordToDelete(b)}
                          className="p-1 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: FINANCIAL AUDITOR & EXCEL/PRINT EXPORT */}
      {/* ============================================================= */}
      {activeTab === 'finance' && (
        <div className="space-y-3">
          {/* Controls Strip: Period Selector [Daily | Monthly | Yearly] + Date Controls + Export Actions */}
          <div className="bg-white border border-stone-200 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
            {/* Period Segmented Buttons */}
            <div className="flex items-center p-1 bg-stone-100 rounded-xl text-xs font-mono font-bold w-full md:w-auto">
              <button
                type="button"
                onClick={() => setFinancePeriod('daily')}
                className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  financePeriod === 'daily'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-black'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setFinancePeriod('monthly')}
                className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  financePeriod === 'monthly'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-black'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setFinancePeriod('yearly')}
                className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  financePeriod === 'yearly'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-black'
                }`}
              >
                Yearly
              </button>
            </div>

            {/* Period-specific Date Selector */}
            <div className="flex items-center space-x-2 text-xs font-mono w-full md:w-auto justify-start md:justify-center">
              {financePeriod === 'daily' && (
                <div className="flex items-center space-x-1.5">
                  <input
                    type="date"
                    value={financeDate}
                    onChange={(e) => setFinanceDate(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs font-mono bg-stone-50 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setFinanceDate(todayStr)}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              )}

              {financePeriod === 'monthly' && (
                <div className="flex items-center space-x-1.5">
                  <input
                    type="month"
                    value={financeMonth}
                    onChange={(e) => setFinanceMonth(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs font-mono bg-stone-50 cursor-pointer"
                  />
                </div>
              )}

              {financePeriod === 'yearly' && (
                <div className="flex items-center space-x-1.5">
                  <select
                    value={financeYear}
                    onChange={(e) => setFinanceYear(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs font-mono bg-stone-50 cursor-pointer"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                </div>
              )}
            </div>

            {/* Export Actions: Excel/CSV & Print */}
            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handlePrintReport}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5 text-stone-600" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* PRINT-ONLY HEADER (VISIBLE ONLY ON PRINT) */}
          <div className="hidden print:block text-center border-b border-black pb-4 mb-4">
            <h1 className="text-xl font-black uppercase tracking-wider font-mono">
              GENTLEMAN BARBER LOUNGE
            </h1>
            <p className="text-xs font-mono uppercase tracking-wider mt-1 text-stone-600">
              Executive Financial Audit Report • {financePeriod.toUpperCase()} • {financePeriod === 'daily' ? financeDate : financePeriod === 'monthly' ? financeMonth : financeYear}
            </p>
            <p className="text-[10px] font-mono text-stone-400 mt-0.5">
              Generated on {new Date().toLocaleString()} (barber-db Pure Cloud State)
            </p>
          </div>

          {/* SUMMARY STRIP: SIMPLE, ELEGANT TEXT-ONLY METRICS */}
          <div className="bg-stone-950 text-white rounded-2xl p-4 sm:p-5 border border-stone-800 shadow-md font-mono print:border-black print:text-black print:bg-stone-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center divide-y md:divide-y-0 md:divide-x divide-stone-800 print:divide-stone-300">
              <div className="pt-2 md:pt-0">
                <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Total Revenue</span>
                <span className="text-base sm:text-lg font-black text-emerald-400 print:text-black">
                  {formatPrice(financeMetrics.totalRevenue)}
                </span>
              </div>

              <div className="pt-2 md:pt-0">
                <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Total Expenses</span>
                <span className="text-base sm:text-lg font-black text-rose-400 print:text-black">
                  {formatPrice(financeMetrics.totalExpenses)}
                </span>
              </div>

              <div className="pt-2 md:pt-0">
                <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Net Profit</span>
                <span className="text-base sm:text-lg font-black text-amber-400 print:text-black">
                  {formatPrice(financeMetrics.netProfit)}
                </span>
              </div>

              <div className="pt-2 md:pt-0">
                <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Job Count</span>
                <span className="text-base sm:text-lg font-black text-white print:text-black">
                  {financeMetrics.jobCount} Jobs
                </span>
              </div>
            </div>
          </div>

          {/* ITEMIZED LEDGER BREAKDOWN TABLE */}
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs font-mono print:border-black">
            {isFinanceLoading ? (
              <div className="p-8 text-center text-xs text-stone-400 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-500" />
                <p>Loading financial data...</p>
              </div>
            ) : financePeriod === 'daily' ? (
              <div>
                <div className="bg-stone-100/70 px-4 py-2 border-b border-stone-200 flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <span>Transactions Breakdown ({financeDate})</span>
                  <span>Amount (MMK)</span>
                </div>

                <div className="divide-y divide-stone-100">
                  {/* Bookings & Walkins */}
                  {(financeMetrics.bookings || []).map((b: Booking) => {
                    const isWlk = b.isWalkin || b.bookingCode?.startsWith('WLK');
                    const price = Number(b.servicePrice ?? b.price ?? 0);
                    return (
                      <div key={b.id} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-stone-50/80">
                        <div className="flex items-center space-x-2 truncate">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              isWlk ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                            }`}
                          >
                            {b.bookingCode || (isWlk ? 'WLK' : 'GTM')}
                          </span>
                          <span className="font-bold text-stone-900">{b.customerName || 'Guest'}</span>
                          <span className="text-stone-400">•</span>
                          <span className="text-stone-600">{b.serviceName}</span>
                          <span className="text-stone-400 hidden sm:inline">({b.designerName || 'Stylist'})</span>
                        </div>
                        <span className="font-bold text-emerald-700">+{formatPrice(price)}</span>
                      </div>
                    );
                  })}

                  {/* Expenses */}
                  {(financeMetrics.expenses || []).map((e: any) => (
                    <div key={e.id} className="px-4 py-2.5 flex items-center justify-between text-xs bg-rose-50/30 hover:bg-rose-50/60">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-900">
                          EXPENSE
                        </span>
                        <span className="font-bold text-stone-900">{e.title || 'Shop Expense'}</span>
                        <span className="text-stone-400">•</span>
                        <span className="text-stone-600">{e.category || 'General'}</span>
                      </div>
                      <span className="font-bold text-rose-600">-{formatPrice(e.amount || 0)}</span>
                    </div>
                  ))}

                  {/* Empty state */}
                  {(!financeMetrics.bookings?.length && !financeMetrics.expenses?.length) && (
                    <div className="p-8 text-center text-xs text-stone-400">
                      No transactions recorded in ledger for {financeDate}.
                    </div>
                  )}
                </div>
              </div>
            ) : financePeriod === 'monthly' ? (
              <div>
                <div className="bg-stone-100/70 px-4 py-2 border-b border-stone-200 grid grid-cols-5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <span>Date</span>
                  <span className="text-right">Revenue</span>
                  <span className="text-right">Expense</span>
                  <span className="text-right">Net Profit</span>
                  <span className="text-right">Jobs</span>
                </div>

                <div className="divide-y divide-stone-100">
                  {(financeMetrics.daysBreakdown || []).map(([date, d]: [string, any]) => {
                    const rev = d.revenue ?? d.totalRevenue ?? 0;
                    const exp = d.expenses ?? d.totalExpenses ?? 0;
                    const profit = d.netProfit ?? (rev - exp);
                    const jobs = d.bookingsCount ?? d.totalBookings ?? 0;
                    return (
                      <div key={date} className="px-3 sm:px-4 py-2.5 grid grid-cols-5 text-[11px] sm:text-xs hover:bg-stone-50">
                        <span className="font-bold text-stone-900 truncate">{date}</span>
                        <span className="text-right text-emerald-700 font-bold">{formatPrice(rev)}</span>
                        <span className="text-right text-rose-600 font-bold">{formatPrice(exp)}</span>
                        <span className="text-right text-amber-700 font-extrabold">{formatPrice(profit)}</span>
                        <span className="text-right text-stone-600">{jobs}</span>
                      </div>
                    );
                  })}

                  {!(financeMetrics.daysBreakdown?.length) && (
                    <div className="p-8 text-center text-xs text-stone-400">
                      No days recorded for {financeMonth}.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="bg-stone-100/70 px-4 py-2 border-b border-stone-200 grid grid-cols-5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <span>Month</span>
                  <span className="text-right">Revenue</span>
                  <span className="text-right">Expense</span>
                  <span className="text-right">Net Profit</span>
                  <span className="text-right">Jobs</span>
                </div>

                <div className="divide-y divide-stone-100">
                  {(financeMetrics.monthsBreakdown || []).map(([m, data]: [string, any]) => {
                    const rev = data.revenue ?? data.totalRevenue ?? 0;
                    const exp = data.expenses ?? data.totalExpenses ?? 0;
                    const profit = data.netProfit ?? (rev - exp);
                    const jobs = data.bookingsCount ?? data.totalBookings ?? 0;
                    return (
                      <div key={m} className="px-3 sm:px-4 py-2.5 grid grid-cols-5 text-[11px] sm:text-xs hover:bg-stone-50">
                        <span className="font-bold text-stone-900">{financeYear}-{m}</span>
                        <span className="text-right text-emerald-700 font-bold">{formatPrice(rev)}</span>
                        <span className="text-right text-rose-600 font-bold">{formatPrice(exp)}</span>
                        <span className="text-right text-amber-700 font-extrabold">{formatPrice(profit)}</span>
                        <span className="text-right text-stone-600">{jobs}</span>
                      </div>
                    );
                  })}

                  {!(financeMetrics.monthsBreakdown?.length) && (
                    <div className="p-8 text-center text-xs text-stone-400">
                      No months recorded for {financeYear}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATOMIC DELETION CONFIRMATION MODAL */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="bg-white border border-rose-200 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl font-mono text-xs"
            >
              <div className="flex items-center space-x-2.5 text-rose-700 border-b border-rose-100 pb-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-rose-950">
                    👑 Atomic Record Deletion
                  </h3>
                  <p className="text-[10px] text-rose-600">
                    days/{recordToDelete.date} Ledger & bookings/{recordToDelete.id}
                  </p>
                </div>
              </div>

              {/* Summary of record */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Code:</span>
                  <span className="font-bold text-stone-900">{recordToDelete.bookingCode || recordToDelete.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Customer:</span>
                  <span className="font-bold text-stone-900">{recordToDelete.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Service:</span>
                  <span className="text-stone-900">{recordToDelete.serviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Amount to Deduct:</span>
                  <span className="font-extrabold text-emerald-800">
                    {formatPrice(recordToDelete.servicePrice ?? recordToDelete.price ?? 0)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-stone-600 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                ⚠️ ဤမှတ်တမ်းအား barber-db ၏ <span className="font-bold text-rose-700">days/{recordToDelete.date}</span> Daily Ledger ထဲမှ ဖယ်ထုတ်ကာ ဝင်ငွေစာရင်းမှ နုတ်ယူပြီး အပြီးတိုင် ဖျက်ပစ်ပါမည်။
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
                  className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all"
                  autoFocus
                />
                {deletePasswordError && (
                  <p className="text-[11px] font-bold text-rose-600 flex items-center space-x-1 mt-1 animate-in fade-in duration-150">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{deletePasswordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRecordToDelete(null);
                    setDeletePassword('');
                    setDeletePasswordError('');
                  }}
                  disabled={isDeleting}
                  className="w-1/2 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 font-bold uppercase transition-all"
                >
                  မဖျက်တော့ပါ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold uppercase flex items-center justify-center space-x-1 transition-all shadow-xs disabled:opacity-50"
                >
                  {isDeleting ? 'ဖျက်နေသည်...' : 'အတည်ပြု ဖျက်မည်'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
