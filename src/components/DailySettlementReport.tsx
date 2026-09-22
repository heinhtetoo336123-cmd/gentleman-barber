import React, { useState, useEffect, useMemo } from 'react';
import { Booking, Designer, Service, ShopExpense, RetailSale } from '../types';
import { api } from '../api/client';
import { getLocalTodayStr } from '../utils/timeSlots';
import { formatPrice } from '../utils/formatters';
import { verifySuperAdminPassword } from '../lib/authCrypto';
import { playSuccessChime } from '../utils/audio';
import {
  Banknote,
  Smartphone,
  Waves,
  Printer,
  Calendar,
  DollarSign,
  Users,
  Search,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Building,
  Crown,
  Unlock,
  AlertCircle,
  FileDown,
  Sparkles,
  ShoppingBag,
  TrendingDown,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DailySettlementReportProps {
  bookings: Booking[];
  designers: Designer[];
  services: Service[];
  onRefresh?: () => void;
  lang?: 'en' | 'my';
  role?: 'admin' | 'superadmin';
  initialTab?: SettlementTab;
}

type SettlementTab = 'overview' | 'expenses' | 'retail' | 'ledger';

export const DailySettlementReport: React.FC<DailySettlementReportProps> = ({
  bookings,
  designers,
  services,
  onRefresh,
  lang = 'en',
  role = 'admin',
  initialTab,
}) => {
  const isSuperAdmin = role === 'superadmin';
  const todayStr = getLocalTodayStr();
  
  // Date & Mode Filter
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [reportRangeMode, setReportRangeMode] = useState<'single' | 'month' | 'all'>('single');
  const [activeTab, setActiveTab] = useState<SettlementTab>(initialTab || 'overview');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'kpay' | 'wave' | 'pay_at_shop'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Live Expenses & Retail Sales Subscriptions
  const [allExpenses, setAllExpenses] = useState<ShopExpense[]>([]);
  const [allRetailSales, setAllRetailSales] = useState<RetailSale[]>([]);
  
  // Settlement tracking
  const [settledBarbers, setSettledBarbers] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('baba_settled_barbers_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Superadmin authorization modal if non-superadmin tries to export
  const [showSuperAuthModal, setShowSuperAuthModal] = useState(false);
  const [superPasswordInput, setSuperPasswordInput] = useState('');
  const [superAuthError, setSuperAuthError] = useState('');
  const [temporarySuperAccess, setTemporarySuperAccess] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const hasExportPermission = isSuperAdmin || temporarySuperAccess;

  useEffect(() => {
    const unsubExp = api.subscribeToExpenses((list) => {
      setAllExpenses(list || []);
    });
    const unsubSales = api.subscribeToRetailSales((list) => {
      setAllRetailSales(list || []);
    });
    return () => {
      unsubExp();
      unsubSales();
    };
  }, []);

  // Filter bookings according to range mode
  const activeBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      if (reportRangeMode === 'single') {
        return b.date === selectedDate;
      }
      if (reportRangeMode === 'month') {
        const currentMonth = selectedDate.substring(0, 7); // YYYY-MM
        return (b.date || '').startsWith(currentMonth);
      }
      return true;
    });
  }, [bookings, selectedDate, reportRangeMode]);

  // Filter expenses according to range mode
  const activeExpenses = useMemo(() => {
    return allExpenses.filter(e => {
      if (reportRangeMode === 'single') {
        return e.date === selectedDate;
      }
      if (reportRangeMode === 'month') {
        const currentMonth = selectedDate.substring(0, 7);
        return (e.date || '').startsWith(currentMonth);
      }
      return true;
    });
  }, [allExpenses, selectedDate, reportRangeMode]);

  // Filter retail sales according to range mode
  const activeRetailSales = useMemo(() => {
    return allRetailSales.filter(s => {
      if (reportRangeMode === 'single') {
        return s.date === selectedDate;
      }
      if (reportRangeMode === 'month') {
        const currentMonth = selectedDate.substring(0, 7);
        return (s.date || '').startsWith(currentMonth);
      }
      return true;
    });
  }, [allRetailSales, selectedDate, reportRangeMode]);

  // Aggregate Revenue & Comprehensive 360-Degree Financials
  const stats = useMemo(() => {
    // 1. Services Revenue
    let servicesGross = 0;
    let servicesCash = 0;
    let servicesKpay = 0;
    let servicesWave = 0;
    let servicesPayAtShop = 0;
    let totalDiscount = 0;
    let haircutBarberPayout = 0;

    for (const b of activeBookings) {
      if (b.status !== 'completed') continue;
      const price = b.servicePrice - (b.discountAmount || 0);
      servicesGross += price;
      totalDiscount += b.discountAmount || 0;

      const pMethod = b.paymentMethod || 'cash';
      if (pMethod === 'cash') {
        servicesCash += price;
      } else if (pMethod === 'kpay' || (pMethod === 'kpay_wave' && !b.paymentTxnId?.toLowerCase().includes('wave'))) {
        servicesKpay += price;
      } else if (pMethod === 'wave' || (pMethod === 'kpay_wave' && b.paymentTxnId?.toLowerCase().includes('wave'))) {
        servicesWave += price;
      } else {
        servicesPayAtShop += price;
      }

      const des = designers.find(d => d.id === b.designerId);
      const comm = des?.commissionPercent ?? 50;
      haircutBarberPayout += Math.round((price * comm) / 100);
    }

    // 2. Retail Product Sales Revenue
    let retailGross = 0;
    let retailCash = 0;
    let retailKpay = 0;
    let retailWave = 0;
    let retailBarberCommission = 0;

    for (const s of activeRetailSales) {
      const totalP = Number(s.totalPrice) || 0;
      retailGross += totalP;
      retailBarberCommission += Number(s.barberCommissionAmount) || 0;

      const pMethod = s.paymentMethod || 'cash';
      if (pMethod === 'cash') {
        retailCash += totalP;
      } else if (pMethod === 'kpay') {
        retailKpay += totalP;
      } else if (pMethod === 'wave') {
        retailWave += totalP;
      }
    }

    // 3. Shop Daily Expenses
    let totalExpenses = 0;
    for (const e of activeExpenses) {
      totalExpenses += Number(e.amount) || 0;
    }

    // 4. Totals
    const totalInflow = servicesGross + retailGross;
    const cashTotal = servicesCash + retailCash;
    const kpayTotal = servicesKpay + retailKpay;
    const waveTotal = servicesWave + retailWave;
    const totalBarberPayout = haircutBarberPayout + retailBarberCommission;
    const netShopRetained = totalInflow - totalBarberPayout - totalExpenses;

    return {
      servicesGross,
      retailGross,
      totalInflow,
      cashTotal,
      kpayTotal,
      waveTotal,
      servicesPayAtShop,
      totalDiscount,
      haircutBarberPayout,
      retailBarberCommission,
      totalBarberPayout,
      totalExpenses,
      netShopRetained,
      completedCount: activeBookings.filter(b => b.status === 'completed').length,
      totalBookings: activeBookings.length,
      retailUnitsSold: activeRetailSales.reduce((acc, curr) => acc + (curr.quantity || 1), 0)
    };
  }, [activeBookings, activeRetailSales, activeExpenses, designers]);

  // Stylist Commission & Payout Breakdown (combines Haircuts + Retail Commission)
  const stylistBreakdown = useMemo(() => {
    const map: Record<
      string,
      {
        designer: Designer | undefined;
        designerName: string;
        designerAvatar: string;
        cutsCount: number;
        haircutRevenue: number;
        commissionPercent: number;
        haircutPayout: number;
        retailSalesCount: number;
        retailRevenue: number;
        retailCommission: number;
        totalPayout: number;
        totalShopRetention: number;
      }
    > = {};

    // Initialize all active designers
    for (const d of designers) {
      map[d.id] = {
        designer: d,
        designerName: d.name,
        designerAvatar: d.avatarUrl,
        cutsCount: 0,
        haircutRevenue: 0,
        commissionPercent: d.commissionPercent ?? 50,
        haircutPayout: 0,
        retailSalesCount: 0,
        retailRevenue: 0,
        retailCommission: 0,
        totalPayout: 0,
        totalShopRetention: 0,
      };
    }

    // Add haircut bookings (only completed bookings count toward revenue and payout)
    for (const b of activeBookings) {
      if (b.status !== 'completed') continue;
      const price = b.servicePrice - (b.discountAmount || 0);
      if (!map[b.designerId]) {
        map[b.designerId] = {
          designer: designers.find(d => d.id === b.designerId),
          designerName: b.designerName,
          designerAvatar: b.designerAvatar,
          cutsCount: 0,
          haircutRevenue: 0,
          commissionPercent: 50,
          haircutPayout: 0,
          retailSalesCount: 0,
          retailRevenue: 0,
          retailCommission: 0,
          totalPayout: 0,
          totalShopRetention: 0,
        };
      }

      map[b.designerId].cutsCount += 1;
      map[b.designerId].haircutRevenue += price;
      const commRate = map[b.designerId].commissionPercent;
      const payout = Math.round((price * commRate) / 100);
      map[b.designerId].haircutPayout += payout;
    }

    // Add retail product commissions sold by barbers
    for (const s of activeRetailSales) {
      if (s.barberId && map[s.barberId]) {
        map[s.barberId].retailSalesCount += (s.quantity || 1);
        map[s.barberId].retailRevenue += (Number(s.totalPrice) || 0);
        map[s.barberId].retailCommission += (Number(s.barberCommissionAmount) || 0);
      }
    }

    // Calculate final totals per barber
    for (const key of Object.keys(map)) {
      const item = map[key];
      item.totalPayout = item.haircutPayout + item.retailCommission;
      const totalGenerated = item.haircutRevenue + item.retailRevenue;
      item.totalShopRetention = totalGenerated - item.totalPayout;
    }

    return Object.values(map).filter(
      item => item.cutsCount > 0 || item.haircutRevenue > 0 || item.retailRevenue > 0
    );
  }, [activeBookings, activeRetailSales, designers]);

  // Filtered transactions for the ledger table
  const filteredBookings = useMemo(() => {
    return activeBookings.filter(b => {
      // Payment filter
      if (paymentFilter === 'cash' && b.paymentMethod !== 'cash') return false;
      if (paymentFilter === 'kpay' && b.paymentMethod !== 'kpay' && !(b.paymentMethod === 'kpay_wave' && !b.paymentTxnId?.toLowerCase().includes('wave'))) return false;
      if (paymentFilter === 'wave' && b.paymentMethod !== 'wave' && !(b.paymentMethod === 'kpay_wave' && b.paymentTxnId?.toLowerCase().includes('wave'))) return false;
      if (paymentFilter === 'pay_at_shop' && b.paymentMethod !== 'pay_at_shop') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.customerName.toLowerCase().includes(q);
        const matchCode = b.bookingCode.toLowerCase().includes(q);
        const matchPhone = b.customerPhone?.toLowerCase().includes(q);
        const matchService = b.serviceName.toLowerCase().includes(q);
        const matchStylist = b.designerName.toLowerCase().includes(q);
        return matchName || matchCode || matchPhone || matchService || matchStylist;
      }

      return true;
    });
  }, [activeBookings, paymentFilter, searchQuery]);

  const handleToggleSettled = (stylistId: string) => {
    setSettledBarbers(prev => {
      const updated = {
        ...prev,
        [stylistId]: !prev[stylistId]
      };
      try {
        localStorage.setItem('baba_settled_barbers_v2', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    playSuccessChime();
    showToast(`✅ Commission settlement status updated for stylist`);
  };

  const handlePrint = () => {
    window.print();
  };

  /**
   * Generates a fully compliant, rich Microsoft Excel CSV with UTF-8 BOM
   * Includes 5 structured audit sections:
   * 1. 360-Degree Financial Revenue & Outflow Summary
   * 2. Stylist Commission & Payout Breakdown (Haircuts + Retail)
   * 3. Daily Shop Operational Expenses Ledger
   * 4. Retail Product Sales Ledger
   * 5. Services Transaction Audit Ledger
   */
  const handleExportExcel = () => {
    if (!hasExportPermission) {
      setShowSuperAuthModal(true);
      return;
    }

    const reportTitle = `GENTLEMEN Barber Lounge - Daily Settlement & Financial Executive Report`;
    const dateLabel = reportRangeMode === 'single' ? `Date: ${selectedDate}` : reportRangeMode === 'month' ? `Month: ${selectedDate.substring(0, 7)}` : `Period: All Time`;
    const generatedAt = `Generated At: ${new Date().toLocaleString()} by ${isSuperAdmin ? 'Superadmin' : 'Authorized Admin'}`;

    const lines: string[] = [];

    // --- SECTION 1: HEADER & FINANCIAL SUMMARY ---
    lines.push(`"${reportTitle}"`);
    lines.push(`"${dateLabel}"`);
    lines.push(`"${generatedAt}"`);
    lines.push(``);
    lines.push(`"=== 1. FINANCIAL REVENUE & OUTFLOW SUMMARY ==="`);
    lines.push(`"Metric","Amount (MMK) / Quantity","Description"`);
    lines.push(`"Total Inflow Revenue","${stats.totalInflow}","Services Gross + Retail Sales"`);
    lines.push(`"Services Gross Revenue","${stats.servicesGross}","Haircut & salon services"`);
    lines.push(`"Retail Product Sales","${stats.retailGross}","Pomade, wax & shop retail sales"`);
    lines.push(`"Cash in Cashier Drawer","${stats.cashTotal}","Physical cash collected (Services + Retail)"`);
    lines.push(`"KBZPay Digital Transfers","${stats.kpayTotal}","Verified KPay transactions"`);
    lines.push(`"WavePay Digital Transfers","${stats.waveTotal}","Verified WavePay transactions"`);
    lines.push(`"Total Barber Payouts","${stats.totalBarberPayout}","Haircut Commissions (${stats.haircutBarberPayout}) + Retail Commissions (${stats.retailBarberCommission})"`);
    lines.push(`"Shop Daily Expenses","${stats.totalExpenses}","Operational shop costs recorded"`);
    lines.push(`"Net Shop Retained Profit","${stats.netShopRetained}","True Net Profit (Total Inflow - Barber Payouts - Expenses)"`);
    lines.push(`"Completed Haircuts","${stats.completedCount}","Total successful cuts"`);
    lines.push(`"Total Retail Products Sold","${stats.retailUnitsSold}","Units of hair products sold"`);
    lines.push(``);

    // --- SECTION 2: BARBER COMMISSION BREAKDOWN ---
    lines.push(`"=== 2. STYLIST COMMISSION & PAYOUT BREAKDOWN ==="`);
    lines.push(`"Stylist Name","Title","Cuts","Haircut Rev (MMK)","Haircut Comm (%)","Haircut Payout (MMK)","Retail Sold Qty","Retail Comm (MMK)","Total Barber Payout (MMK)","Shop Retained (MMK)","Settlement Status"`);
    
    stylistBreakdown.forEach((item) => {
      const isSettled = settledBarbers[item.designer?.id || item.designerName] ? 'SETTLED / PAID' : 'PENDING';
      lines.push(
        `"${item.designerName}","${item.designer?.title || 'Stylist'}","${item.cutsCount}","${item.haircutRevenue}","${item.commissionPercent}%","${item.haircutPayout}","${item.retailSalesCount}","${item.retailCommission}","${item.totalPayout}","${item.totalShopRetention}","${isSettled}"`
      );
    });
    lines.push(``);

    // --- SECTION 3: DAILY SHOP EXPENSES LEDGER ---
    lines.push(`"=== 3. DAILY SHOP EXPENSES LEDGER ==="`);
    lines.push(`"Date","Expense Title","Category","Amount (MMK)","Notes","Recorded By"`);
    activeExpenses.forEach((exp) => {
      lines.push(
        `"${exp.date}","${exp.title}","${exp.category || 'General'}","${exp.amount}","${exp.notes || ''}","${exp.recordedBy || 'Admin'}"`
      );
    });
    lines.push(``);

    // --- SECTION 4: RETAIL PRODUCT SALES LEDGER ---
    lines.push(`"=== 4. RETAIL PRODUCT SALES LEDGER ==="`);
    lines.push(`"Date","Product Name","Qty","Unit Price (MMK)","Total Price (MMK)","Barber Sold","Barber Comm (MMK)","Payment Method","Customer"`);
    activeRetailSales.forEach((sale) => {
      lines.push(
        `"${sale.date}","${sale.productName}","${sale.quantity}","${sale.unitPrice}","${sale.totalPrice}","${sale.barberName || 'Shop Counter'}","${sale.barberCommissionAmount || 0}","${sale.paymentMethod || 'cash'}","${sale.customerName || ''}"`
      );
    });
    lines.push(``);

    // --- SECTION 5: SERVICES TRANSACTION AUDIT LEDGER ---
    lines.push(`"=== 5. SERVICES TRANSACTION AUDIT LEDGER ==="`);
    lines.push(`"Booking Code","Date","Time Slot","Customer Name","Customer Phone","Service Name","Stylist Assigned","Payment Channel","Service Price (MMK)","Discount (MMK)","Net Paid (MMK)","Status","Walk-In / Online"`);

    activeBookings.forEach((b) => {
      const finalPrice = b.servicePrice - (b.discountAmount || 0);
      const walkinType = b.isWalkin ? 'Walk-In' : 'Online Booking';
      lines.push(
        `"${b.bookingCode}","${b.date}","${b.timeSlot}","${b.customerName}","${b.customerPhone || ''}","${b.serviceName}","${b.designerName}","${b.paymentMethod || 'cash'}","${b.servicePrice}","${b.discountAmount || 0}","${finalPrice}","${b.status}","${walkinType}"`
      );
    });

    // UTF-8 BOM ensures Myanmar fonts render cleanly in Excel
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `gentlemen_financial_settlement_${reportRangeMode === 'single' ? selectedDate : reportRangeMode === 'month' ? selectedDate.substring(0, 7) : 'all_time'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    playSuccessChime();
    showToast('📊 Financial Excel (.csv) Report ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ');
  };

  const handleAuthorizeSuperAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setSuperAuthError('');
    if (verifySuperAdminPassword(superPasswordInput)) {
      setTemporarySuperAccess(true);
      setShowSuperAuthModal(false);
      setSuperPasswordInput('');
      playSuccessChime();
      showToast('👑 Superadmin အခွင့်အရေး အတည်ပြုပြီးပါပြီ။ Excel Export ပြုလုပ်နိုင်ပါပြီ။');
    } else {
      setSuperAuthError('SuperAdmin စကားဝှက် (Password) မှားယွင်းနေပါသည်');
    }
  };

  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-50 bg-stone-950 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-mono font-bold flex items-center space-x-2 border border-stone-800"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Controls & Financial Executive Summary Banner - Clean & Compact */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-950 text-white flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                {lang === 'my' ? 'နေ့စဉ် စာရင်းပိတ်ချုပ်နှင့် ဘဏ္ဍာရေး အစီရင်ခံစာ' : 'Settlement & Commissions Ledger'}
              </h3>
            </div>
          </div>

          {/* Action Buttons: Print & SuperAdmin Excel Export */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-mono font-bold flex items-center space-x-1.5 border border-stone-200 transition-all cursor-pointer"
              title="Print Settlement Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-2xl bg-stone-950 hover:bg-stone-800 text-emerald-300 text-xs font-mono font-black flex items-center space-x-1.5 transition-all cursor-pointer border border-stone-900"
              title="Export Full Excel (.csv) Report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{hasExportPermission ? 'Export Excel (.csv)' : 'SuperAdmin Export'}</span>
            </button>
          </div>
        </div>

        {/* Date Selector & Mode Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center space-x-1 bg-stone-100 border border-stone-200 p-1 rounded-2xl text-xs font-mono font-bold">
            <button
              onClick={() => setReportRangeMode('single')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                reportRangeMode === 'single'
                  ? 'bg-stone-950 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
              }`}
            >
              Single Date
            </button>
            <button
              onClick={() => setReportRangeMode('month')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                reportRangeMode === 'month'
                  ? 'bg-stone-950 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
              }`}
            >
              Monthly Rollup
            </button>
            <button
              onClick={() => setReportRangeMode('all')}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                reportRangeMode === 'all'
                  ? 'bg-stone-950 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200/60'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Date Picker with Prev/Next Controls */}
          <div className="flex items-center space-x-1.5">
            {reportRangeMode === 'single' && (
              <button
                onClick={() => handleShiftDate(-1)}
                className="p-1.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 hover:text-stone-950 hover:bg-stone-200 transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex items-center space-x-1.5 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-xl text-xs font-mono text-stone-800">
              <Calendar className="w-3.5 h-3.5 text-stone-600 shrink-0" />
              {reportRangeMode === 'single' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[110px] sm:w-[120px] bg-transparent text-[11px] sm:text-xs font-mono font-bold text-stone-900 focus:outline-hidden cursor-pointer"
                />
              ) : reportRangeMode === 'month' ? (
                <input
                  type="month"
                  value={selectedDate.substring(0, 7)}
                  onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
                  className="w-[110px] sm:w-[120px] bg-transparent text-[11px] sm:text-xs font-mono font-bold text-stone-900 focus:outline-hidden cursor-pointer"
                />
              ) : (
                <span className="font-bold text-stone-900 text-[11px]">All-Time Cumulative View</span>
              )}
            </div>

            {reportRangeMode === 'single' && (
              <button
                onClick={() => handleShiftDate(1)}
                className="p-1.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 hover:text-stone-950 hover:bg-stone-200 transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 5 Financial Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* Total Inflow Revenue */}
          <div className="col-span-2 sm:col-span-1 bg-stone-950 text-white rounded-2xl p-3.5 border border-stone-900 shadow-xs">
            <span className="text-[10px] font-mono text-emerald-300 uppercase font-bold tracking-wider block">
              Total Inflow Revenue
            </span>
            <div className="mt-1">
              <span className="text-xl font-black font-mono text-white">
                {formatPrice(stats.totalInflow)}
              </span>
            </div>
            <div className="text-[10px] text-stone-400 font-mono mt-0.5 flex items-center justify-between">
              <span>Cuts: {formatPrice(stats.servicesGross)}</span>
              <span>POS: {formatPrice(stats.retailGross)}</span>
            </div>
          </div>

          {/* Cash In Hand Total */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[10px] font-mono font-bold uppercase">💵 Cash in Drawer</span>
              <Banknote className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <div className="mt-1">
              <span className="text-base sm:text-lg font-black font-mono text-emerald-800">
                {formatPrice(stats.cashTotal)}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono mt-0.5 block">
              Physical Cash Inflow
            </span>
          </div>

          {/* Digital Transfers (KBZPay + WavePay) */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-blue-800">
              <span className="text-[10px] font-mono font-bold uppercase">📱 Digital Transfers</span>
              <Smartphone className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <div className="mt-1">
              <span className="text-base sm:text-lg font-black font-mono text-blue-800">
                {formatPrice(stats.kpayTotal + stats.waveTotal)}
              </span>
            </div>
            <div className="text-[10px] text-stone-500 font-mono mt-0.5 flex justify-between">
              <span>KPay: {formatPrice(stats.kpayTotal)}</span>
              <span>Wave: {formatPrice(stats.waveTotal)}</span>
            </div>
          </div>

          {/* Shop Expenses Outflow */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-rose-800">
              <span className="text-[10px] font-mono font-bold uppercase">💸 Shop Expenses</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-700" />
            </div>
            <div className="mt-1">
              <span className="text-base sm:text-lg font-black font-mono text-rose-800">
                {formatPrice(stats.totalExpenses)}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono mt-0.5 block">
              {activeExpenses.length} Expense Records
            </span>
          </div>

          {/* Net Retained Profit */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-stone-900">
              <span className="text-[10px] font-mono font-bold uppercase">🧾 Net Shop Retained</span>
              <Building className="w-3.5 h-3.5 text-stone-700" />
            </div>
            <div className="mt-1">
              <span className="text-base sm:text-lg font-black font-mono text-stone-900">
                {formatPrice(stats.netShopRetained)}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono mt-0.5 block">
              Shop Retention Net
            </span>
          </div>
        </div>
      </div>

      {/* Stylist Commission & Payout Split Table */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                {lang === 'my' ? 'ဆရာ ကော်မရှင်နှင့် ရှင်းတမ်း (Stylist Commissions & Payout Settlement)' : 'Stylist Commissions & Payout Settlement'}
              </h4>
            </div>
            <span className="text-xs font-mono text-stone-500">
              {stylistBreakdown.length} Stylists active in period
            </span>
          </div>

          {stylistBreakdown.length === 0 ? (
            <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-500 text-xs font-mono">
              No stylist services or retail sales recorded for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">Stylist (ဆံသဆရာ)</th>
                    <th className="py-2.5 px-3 text-center">Cuts</th>
                    <th className="py-2.5 px-3 text-right">Haircut Rev</th>
                    <th className="py-2.5 px-3 text-center">Comm %</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">Haircut Payout</th>
                    <th className="py-2.5 px-3 text-right text-blue-700 font-bold">Retail Comm</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Total Barber Payout</th>
                    <th className="py-2.5 px-3 text-right font-bold text-stone-950">Shop Retained</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {stylistBreakdown.map((item) => {
                    const isSettled = settledBarbers[item.designer?.id || item.designerName];
                    return (
                      <tr key={item.designerName} className="hover:bg-stone-50/80 transition-colors">
                        
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center space-x-2.5">
                            <img
                              src={item.designerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'}
                              alt={item.designerName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-xl object-cover border border-stone-200 shrink-0"
                            />
                            <div>
                              <span className="font-bold text-stone-950 block font-sans">{item.designerName}</span>
                              <span className="text-[10px] text-stone-500">{item.designer?.title || 'Stylist'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-stone-800">
                          {item.cutsCount} cuts
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-stone-950">
                          {formatPrice(item.haircutRevenue)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {item.commissionPercent}%
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-emerald-700">
                          {formatPrice(item.haircutPayout)}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-blue-700">
                          {item.retailCommission > 0 ? formatPrice(item.retailCommission) : '-'}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-emerald-800">
                          {formatPrice(item.totalPayout)}
                        </td>

                        <td className="py-3 px-3 text-right font-black text-stone-950">
                          {formatPrice(item.totalShopRetention)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleToggleSettled(item.designer?.id || item.designerName)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                              isSettled
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                            }`}
                          >
                            {isSettled ? '✓ Payout Settled' : 'Pending Payout'}
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transaction Audit Ledger (Searchable & Filterable) */}
        <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-xs space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-stone-700" />
              <h4 className="text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                Transaction Audit Ledger ({filteredBookings.length})
              </h4>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code, client, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Payment Filter Badges */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar text-xs font-mono">
            <button
              onClick={() => setPaymentFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                paymentFilter === 'all' ? 'bg-stone-950 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              All Methods ({activeBookings.length})
            </button>
            <button
              onClick={() => setPaymentFilter('cash')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                paymentFilter === 'cash' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              💵 Cash ({activeBookings.filter(b => b.paymentMethod === 'cash').length})
            </button>
            <button
              onClick={() => setPaymentFilter('kpay')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                paymentFilter === 'kpay' ? 'bg-blue-700 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              📱 KBZPay
            </button>
            <button
              onClick={() => setPaymentFilter('wave')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                paymentFilter === 'wave' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              🌊 WavePay
            </button>
          </div>

          {/* Transactions Table */}
          {filteredBookings.length === 0 ? (
            <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-500 text-xs font-mono">
              No transactions found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">Date/Time</th>
                    <th className="py-2.5 px-3">Code / Type</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3">Stylist</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {filteredBookings.map((b) => {
                    const finalPrice = b.servicePrice - (b.discountAmount || 0);
                    const isCash = b.paymentMethod === 'cash';
                    const isKpay = b.paymentMethod === 'kpay' || (b.paymentMethod === 'kpay_wave' && !b.paymentTxnId?.toLowerCase().includes('wave'));
                    const isWave = b.paymentMethod === 'wave' || (b.paymentMethod === 'kpay_wave' && b.paymentTxnId?.toLowerCase().includes('wave'));

                    return (
                      <tr key={b.id} className="hover:bg-stone-50/80 transition-colors">
                        
                        <td className="py-2.5 px-3 font-bold text-stone-900 whitespace-nowrap">
                          <div>{b.timeSlot}</div>
                          <span className="text-[10px] text-stone-400 font-normal">{b.date}</span>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-1">
                            <span className="font-extrabold text-stone-950">{b.bookingCode}</span>
                            {b.isWalkin && (
                              <span className="text-[9px] bg-purple-100 text-purple-800 px-1 rounded font-bold">
                                Walk-in
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 font-sans">
                          <span className="font-bold text-stone-950 block">{b.customerName}</span>
                          {b.customerPhone && (
                            <span className="text-[10px] text-stone-500 font-mono">{b.customerPhone}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-sans text-stone-800">
                          {b.serviceName}
                        </td>

                        <td className="py-2.5 px-3 text-emerald-900 font-bold">
                          {b.designerName}
                        </td>

                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isCash
                              ? 'bg-emerald-100 text-emerald-900'
                              : isKpay
                              ? 'bg-blue-100 text-blue-900'
                              : isWave
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-stone-100 text-stone-800'
                          }`}>
                            <span>
                              {isCash ? '💵 Cash' : isKpay ? '📱 KBZPay' : isWave ? '🌊 WavePay' : '🧾 Shop'}
                            </span>
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right font-black text-stone-950">
                          {formatPrice(finalPrice)}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            b.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {b.status.toUpperCase()}
                          </span>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      {/* SuperAdmin Password Authorization Modal for Export */}
      <AnimatePresence>
        {showSuperAuthModal && (
          <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-stone-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-stone-950 flex items-center justify-center font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-stone-950 uppercase font-mono">
                    Superadmin Export Authorization
                  </h4>
                  <p className="text-xs text-stone-500">
                    Daily settlement Excel export requires Superadmin credentials.
                  </p>
                </div>
              </div>

              {superAuthError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-800 text-xs font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{superAuthError}</span>
                </div>
              )}

              <form onSubmit={handleAuthorizeSuperAdmin} className="space-y-4">
                <div>
                  <label className="text-xs font-mono font-bold text-stone-700 block mb-1">
                    SuperAdmin Password
                  </label>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Enter SuperAdmin password"
                    value={superPasswordInput}
                    onChange={(e) => setSuperPasswordInput(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2 text-xs font-mono text-stone-950 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuperAuthModal(false);
                      setSuperPasswordInput('');
                      setSuperAuthError('');
                    }}
                    className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-mono font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 text-emerald-300 text-xs font-mono font-black cursor-pointer shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Authorize & Export</span>
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
