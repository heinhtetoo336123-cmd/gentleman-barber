import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Booking, Designer, Service, UserProfile, AuditLog, PaymentSettings } from '../types';
import { api } from '../api/client';
import { formatPrice } from '../utils/formatters';
import { getLocalTodayStr } from '../utils/timeSlots';
import {
  exportBookingsToCsv,
  exportClientsToCsv,
  exportBarbersToCsv,
  exportMonthlyStatementToCsv,
  exportAuditLogsToCsv,
  exportMasterJsonBackup,
} from '../utils/exportHelpers';
import { playSuccessChime } from '../utils/audio';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  DollarSign,
  Users,
  Scissors,
  TrendingUp,
  Award,
  Sparkles,
  BarChart3,
  Clock,
  PieChart,
  CheckCircle2,
  FileText,
  Building,
  Layers,
  ShieldCheck,
  Crown,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpRight,
  HelpCircle,
  Database,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SuperAdminReportsManagerProps {
  bookings: Booking[];
  designers: Designer[];
  services: Service[];
  clients: UserProfile[];
  settings?: PaymentSettings;
  lang?: 'en' | 'my';
}

export const SuperAdminReportsManager: React.FC<SuperAdminReportsManagerProps> = ({
  bookings,
  designers,
  services,
  clients: initialClients = [],
  settings,
  lang = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'statements' | 'analytics' | 'print'>('export');
  const [liveClients, setLiveClients] = useState<UserProfile[]>(initialClients || []);
  const [isExportingClients, setIsExportingClients] = useState(false);

  useEffect(() => {
    if (initialClients && initialClients.length > 0) {
      setLiveClients(initialClients);
    }
  }, [initialClients]);

  useEffect(() => {
    // Keep live clients in sync with database
    api.getClients().then((data) => {
      if (data && data.length > 0) {
        setLiveClients(data);
      }
    }).catch(() => {});

    const unsub = api.subscribeToClients((updatedClients) => {
      if (updatedClients && updatedClients.length > 0) {
        setLiveClients(updatedClients);
      }
    });
    return () => unsub();
  }, []);

  const currentClients = liveClients.length > 0 ? liveClients : (initialClients || []);
  
  // Statement Month & Year Selection
  const todayStr = getLocalTodayStr();
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = todayStr.substring(0, 7); // e.g. "2026-09"
  
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [statementViewType, setStatementViewType] = useState<'monthly' | 'yearly'>('monthly');

  // Print mode styling ref
  const printRef = useRef<HTMLDivElement>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 1. Monthly Financial Computation
  const monthlyStats = useMemo(() => {
    const monthBookings = bookings.filter((b) => (b.date || '').startsWith(selectedMonth) && b.status !== 'cancelled');
    const completedBookings = monthBookings.filter((b) => b.status === 'completed');
    
    let grossRev = 0;
    let totalDiscount = 0;
    let cashRev = 0;
    let kpayRev = 0;
    let waveRev = 0;
    let commTotal = 0;

    completedBookings.forEach((b) => {
      const originalPrice = Number(
        b.price ??
        b.servicePrice ??
        (b.servicesList && b.servicesList.length > 0
          ? b.servicesList.reduce((acc, s) => acc + (Number(s.servicePrice) || 0), 0)
          : 0)
      );
      const discount = Number(b.discountAmount || 0);
      const finalPaid = Math.max(0, originalPrice - discount);

      grossRev += finalPaid;
      totalDiscount += discount;

      if (b.paymentMethod === 'cash' || b.paymentMethod === 'pay_at_shop') {
        cashRev += finalPaid;
      } else if (b.paymentMethod === 'kpay') {
        kpayRev += finalPaid;
      } else if (b.paymentMethod === 'wave') {
        waveRev += finalPaid;
      } else {
        kpayRev += finalPaid;
      }

      const des = designers.find((d) => d.id === b.designerId);
      const cRate = des?.commissionPercent !== undefined ? des.commissionPercent : 50;
      commTotal += Math.round((finalPaid * cRate) / 100);
    });

    const netShopProfit = grossRev - commTotal;
    const avgTicket = completedBookings.length > 0 ? Math.round(grossRev / completedBookings.length) : 0;

    // Daily breakdown mapping
    const dailyMap: Record<string, { bookingsCount: number; gross: number; cash: number; digital: number; commission: number; shopNet: number }> = {};
    monthBookings.forEach((b) => {
      const d = b.date;
      if (!dailyMap[d]) {
        dailyMap[d] = { bookingsCount: 0, gross: 0, cash: 0, digital: 0, commission: 0, shopNet: 0 };
      }
      dailyMap[d].bookingsCount += 1;

      if (b.status === 'completed') {
        const rawP = Number(
          b.price ??
          b.servicePrice ??
          (b.servicesList && b.servicesList.length > 0
            ? b.servicesList.reduce((acc, s) => acc + (Number(s.servicePrice) || 0), 0)
            : 0)
        );
        const disc = Number(b.discountAmount || 0);
        const netVal = Math.max(0, rawP - disc);

        dailyMap[d].gross += netVal;
        if (b.paymentMethod === 'cash' || b.paymentMethod === 'pay_at_shop') {
          dailyMap[d].cash += netVal;
        } else {
          dailyMap[d].digital += netVal;
        }

        const des = designers.find((desItem) => desItem.id === b.designerId);
        const cRate = des?.commissionPercent !== undefined ? des.commissionPercent : 50;
        const cVal = Math.round((netVal * cRate) / 100);
        dailyMap[d].commission += cVal;
        dailyMap[d].shopNet += netVal - cVal;
      }
    });

    // Stylist breakdown mapping
    const stylistMap: Record<string, { name: string; title: string; count: number; gross: number; commission: number; shopNet: number; rate: number }> = {};
    designers.forEach((d) => {
      stylistMap[d.id] = {
        name: d.name,
        title: d.title || 'Barber',
        count: 0,
        gross: 0,
        commission: 0,
        shopNet: 0,
        rate: d.commissionPercent !== undefined ? d.commissionPercent : 50,
      };
    });

    completedBookings.forEach((b) => {
      const dId = b.designerId;
      if (stylistMap[dId]) {
        const rawP = Number(
          b.price ??
          b.servicePrice ??
          (b.servicesList && b.servicesList.length > 0
            ? b.servicesList.reduce((acc, s) => acc + (Number(s.servicePrice) || 0), 0)
            : 0)
        );
        const disc = Number(b.discountAmount || 0);
        const netVal = Math.max(0, rawP - disc);

        stylistMap[dId].count += 1;
        stylistMap[dId].gross += netVal;
        const comm = Math.round((netVal * stylistMap[dId].rate) / 100);
        stylistMap[dId].commission += comm;
        stylistMap[dId].shopNet += netVal - comm;
      }
    });

    return {
      monthBookings,
      completedBookings,
      grossRev,
      totalDiscount,
      cashRev,
      kpayRev,
      waveRev,
      commTotal,
      netShopProfit,
      avgTicket,
      dailyMap,
      stylistMap,
    };
  }, [bookings, designers, selectedMonth]);

  // 2. Yearly Statement Computation (12 months)
  const yearlyStats = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const mNum = (i + 1).toString().padStart(2, '0');
      return `${selectedYear}-${mNum}`;
    });

    return months.map((mStr) => {
      const monthBookings = bookings.filter((b) => (b.date || '').startsWith(mStr) && b.status !== 'cancelled');
      const completed = monthBookings.filter((b) => b.status === 'completed');
      
      let gross = 0;
      let comm = 0;
      completed.forEach((b) => {
        const rawP = Number(
          b.price ??
          b.servicePrice ??
          (b.servicesList && b.servicesList.length > 0
            ? b.servicesList.reduce((acc, s) => acc + (Number(s.servicePrice) || 0), 0)
            : 0)
        );
        const disc = Number(b.discountAmount || 0);
        const netVal = Math.max(0, rawP - disc);

        gross += netVal;
        const des = designers.find((d) => d.id === b.designerId);
        const cRate = des?.commissionPercent !== undefined ? des.commissionPercent : 50;
        comm += Math.round((netVal * cRate) / 100);
      });

      const dateObj = new Date(`${mStr}-01`);
      const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

      return {
        monthCode: mStr,
        monthName,
        totalBookings: monthBookings.length,
        completedCount: completed.length,
        grossRevenue: gross,
        commissionPaid: comm,
        shopNetProfit: gross - comm,
      };
    });
  }, [bookings, designers, selectedYear]);

  // 3. Business Analytics & Intelligence Metrics
  const analyticsData = useMemo(() => {
    const validBookings = bookings.filter((b) => b.status === 'completed');

    // Peak hours calculation (09:00 - 20:00)
    const hourCounts: Record<string, number> = {};
    validBookings.forEach((b) => {
      const slot = b.timeSlot || '12:00';
      const hour = slot.split(':')[0] + ':00';
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const topRushHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    // Customer loyalty & repeat visits
    const phoneMap: Record<string, number> = {};
    validBookings.forEach((b) => {
      const p = (b.customerPhone || '').replace(/[^0-9]/g, '');
      if (p.length >= 7) {
        phoneMap[p] = (phoneMap[p] || 0) + 1;
      }
    });

    const uniqueClients = Object.keys(phoneMap).length;
    const repeatClients = Object.values(phoneMap).filter((count) => count > 1).length;
    const repeatRate = uniqueClients > 0 ? Math.round((repeatClients / uniqueClients) * 100) : 0;

    // Service Profitability
    const serviceMap: Record<string, { name: string; count: number; gross: number }> = {};
    validBookings.forEach((b) => {
      const sName = b.serviceName || 'General';
      if (!serviceMap[sName]) serviceMap[sName] = { name: sName, count: 0, gross: 0 };
      serviceMap[sName].count += 1;
      serviceMap[sName].gross += Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0));
    });

    const topServices = Object.values(serviceMap).sort((a, b) => b.gross - a.gross);

    // Barber Leaderboard
    const barberRankings = designers.map((d) => {
      const dBookings = validBookings.filter((b) => b.designerId === d.id);
      const gross = dBookings.reduce(
        (sum, b) => sum + Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0)),
        0
      );
      const ratings = dBookings.filter((b) => b.rating).map((b) => b.rating!);
      const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '4.9';

      return {
        id: d.id,
        name: d.name,
        title: d.title,
        completedCount: dBookings.length,
        grossRevenue: gross,
        avgRating,
      };
    }).sort((a, b) => b.grossRevenue - a.grossRevenue);

    return {
      topRushHours,
      uniqueClients,
      repeatClients,
      repeatRate,
      topServices,
      barberRankings,
    };
  }, [bookings, designers]);

  // Direct Print Trigger
  const handlePrint = () => {
    playSuccessChime();
    window.print();
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50 bg-neutral-900 border border-emerald-500 text-amber-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <span className="text-sm font-medium">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Top Header */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" />
              SuperAdmin Executive Reporting &amp; Data Hub
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              အစီရင်ခံစာများ နှင့် ဒေတာ ထုတ်ယူမှု (Executive Reports)
            </h1>
            <p className="text-xs text-neutral-400">
              Application တစ်ခုလုံး၏ ဒေတာများကို Excel ဖြင့် ထုတ်ယူခြင်း၊ လချုပ်/နှစ်ချုပ်များ ပရင့်ထုတ်ခြင်း နှင့် စီးပွားရေးသုံးသပ်မှု အစီရင်ခံစာများ
            </p>
          </div>

          {/* Direct Print Button */}
          <button
            onClick={() => {
              setActiveTab('print');
              setTimeout(handlePrint, 300);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            လချုပ်/နှစ်ချုပ် ပရင့်ထုတ်ရန် (Print)
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-neutral-800 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('export')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'export'
                ? 'bg-emerald-500 text-neutral-950 shadow-md'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            📊 Excel / CSV ဒေတာ ထုတ်ယူခြင်း
          </button>

          <button
            onClick={() => setActiveTab('statements')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'statements'
                ? 'bg-emerald-500 text-neutral-950 shadow-md'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            📑 လချုပ်၊ နှစ်ချုပ် စာရင်းများ
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-emerald-500 text-neutral-950 shadow-md'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            📈 စီးပွားရေးသုံးသပ်မှု (Insights)
          </button>

          <button
            onClick={() => setActiveTab('print')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'print'
                ? 'bg-emerald-500 text-neutral-950 shadow-md'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300'
            }`}
          >
            <Printer className="w-4 h-4" />
            🖨️ ပရင့်ထုတ်ရန် သီးသန့် View
          </button>
        </div>
      </div>

      {/* TAB 1: EXCEL / CSV DATA EXPORT */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Complete Bookings Master Sheet */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">ဘိုကင်စာရင်း အပြည့်အစုံ (Bookings)</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  ဘိုကင်ကုဒ်၊ ဧည့်သည်အမည်၊ ဖုန်း၊ ဝန်ဆောင်မှု၊ စျေးနှုန်း၊ ဆံသဆရာ၊ ရက်စွဲ၊ ငွေပေးချေမှု နှင့် Feedback များ အားလုံးပါဝင်သည့် Excel/CSV ဖိုင်
                </p>
                <div className="text-[11px] text-emerald-300 font-mono">
                  စုစုပေါင်း: {bookings.length} Records
                </div>
              </div>
              <button
                onClick={() => {
                  exportBookingsToCsv(bookings);
                  showToast('✅ Bookings Master Sheet အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ');
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-emerald-500 hover:text-neutral-950 text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 border border-neutral-700 transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Bookings Excel Export (.csv)
              </button>
            </div>

            {/* 2. Clients & VIP Loyalty Directory */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Client &amp; VIP မန်ဘာ စာရင်း</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  အကောင့်ဖွင့်ထားသော client များအားလုံးနှင့် booking မှတ်တမ်းရှိသူများ၏ အမည်၊ ဖုန်းနံပါတ်၊ VIP အဆင့်၊ Points နှင့် သုံးစွဲငွေ စာရင်းချုပ်
                </p>
                <div className="text-[11px] text-purple-400 font-mono">
                  စုစုပေါင်း: {currentClients.length} Registered Clients
                </div>
              </div>
              <button
                disabled={isExportingClients}
                onClick={async () => {
                  try {
                    setIsExportingClients(true);
                    let clientsToExport = currentClients;
                    try {
                      const freshClients = await api.getClients();
                      if (freshClients && freshClients.length > 0) {
                        clientsToExport = freshClients;
                        setLiveClients(freshClients);
                      }
                    } catch {}
                    
                    exportClientsToCsv(clientsToExport, bookings);
                    playSuccessChime();
                    showToast('✅ အကောင့်ဖွင့်ထားသော client စာရင်းအားလုံး အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ');
                  } finally {
                    setIsExportingClients(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-purple-500 hover:text-neutral-950 text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 border border-neutral-700 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isExportingClients ? 'Exporting...' : 'Clients Excel Export (.csv)'}
              </button>
            </div>

            {/* 3. Barbers Commission Ledger */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Scissors className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Stylist ကော်မရှင် စာရင်း (Ledger)</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  ဆံသပညာရှင် တစ်ဦးချင်းစီ၏ ဝန်ဆောင်မှုပေးမှု အရေအတွက်၊ ရှာဖွေပေးငွေ၊ ကော်မရှင် ရာခိုင်နှုန်း (%) နှင့် ပေးချေရမည့် ကော်မရှင် စုစုပေါင်း
                </p>
                <div className="text-[11px] text-emerald-400 font-mono">
                  စုစုပေါင်း: {designers.length} Stylists
                </div>
              </div>
              <button
                onClick={() => {
                  exportBarbersToCsv(designers, bookings);
                  showToast('✅ Barbers Ledger အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ');
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-emerald-500 hover:text-neutral-950 text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 border border-neutral-700 transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Barbers Ledger Export (.csv)
              </button>
            </div>

            {/* 4. Monthly Financial Statement Dataset */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">ဒီလ လချုပ် စာရင်းဇယား (Monthly)</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {selectedMonth} လအတွက် နေ့စဉ် ဝင်ငွေ၊ ငွေသား/KPay/Wave ခွဲခြားမှု၊ ကော်မရှင် စုစုပေါင်း နှင့် ဆိုင်အသားတင် ကျန်ငွေ ဇယား
                </p>
                <div className="text-[11px] text-cyan-400 font-mono">
                  ရွေးချယ်ထားသောလ: {selectedMonth}
                </div>
              </div>
              <button
                onClick={() => {
                  exportMonthlyStatementToCsv(selectedMonth, bookings, designers);
                  showToast(`✅ ${selectedMonth} Monthly Statement ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ`);
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-cyan-500 hover:text-neutral-950 text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 border border-neutral-700 transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Monthly Statement Export (.csv)
              </button>
            </div>

            {/* 5. Master JSON Backup Bundle */}
            <div className="bg-neutral-900 border border-emerald-500/40 rounded-2xl p-5 space-y-4 hover:border-emerald-400 transition-all flex flex-col justify-between bg-gradient-to-b from-amber-500/5 to-transparent">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-emerald-200">1-Click Master Application Data Bundle</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Bookings, Clients, Stylists, Services, Audit Logs နှင့် ဆိုင် Settings အားလုံးကို တစ်နေရာတည်းတွင် Master JSON Backup ဖြင့် ထုတ်ယူသိမ်းဆည်းခြင်း
                </p>
                <div className="text-[11px] text-emerald-300 font-semibold">
                  Full System Archival Snapshot
                </div>
              </div>
              <button
                onClick={async () => {
                  const auditLogs = await api.getAuditLogs();
                  exportMasterJsonBackup(services, designers, bookings, currentClients, auditLogs, settings);
                  showToast('📦 Master Application Backup အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ');
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Download className="w-4 h-4" />
                Download Master Data Pack (.json)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY & YEARLY STATEMENTS */}
      {activeTab === 'statements' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-neutral-300">ကာလ ရွေးချယ်မှု:</span>
              <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                <button
                  onClick={() => setStatementViewType('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statementViewType === 'monthly' ? 'bg-emerald-500 text-neutral-950' : 'text-neutral-400'
                  }`}
                >
                  လချုပ် (Monthly)
                </button>
                <button
                  onClick={() => setStatementViewType('yearly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statementViewType === 'yearly' ? 'bg-emerald-500 text-neutral-950' : 'text-neutral-400'
                  }`}
                >
                  နှစ်ချုပ် (Yearly)
                </button>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-3">
              {statementViewType === 'monthly' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">လ ရွေးချယ်ရန်:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">နှစ် ရွေးချယ်ရန်:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              )}

              <button
                onClick={() => {
                  setActiveTab('print');
                  setTimeout(handlePrint, 300);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-300" />
                ပရင့်ထုတ်ရန်
              </button>
            </div>
          </div>

          {/* MONTHLY STATEMENT VIEW */}
          {statementViewType === 'monthly' && (
            <div className="space-y-6">
              {/* Top Monthly Metrics Card Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <span className="text-xs text-neutral-400 font-medium">လစဉ် စုစုပေါင်း ဝင်ငွေ (Gross)</span>
                  <p className="text-xl font-extrabold text-emerald-300 mt-1">
                    {formatPrice(monthlyStats.grossRev)}
                  </p>
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    {monthlyStats.completedBookings.length} Appointments Completed
                  </span>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <span className="text-xs text-neutral-400 font-medium">Stylist ကော်မရှင် ပေးချေငွေ</span>
                  <p className="text-xl font-extrabold text-red-400 mt-1">
                    {formatPrice(monthlyStats.commTotal)}
                  </p>
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    Barbers Commission Total
                  </span>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <span className="text-xs text-neutral-400 font-medium">ဆိုင် အသားတင် ကျန်ငွေ (Net)</span>
                  <p className="text-xl font-extrabold text-emerald-400 mt-1">
                    {formatPrice(monthlyStats.netShopProfit)}
                  </p>
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    Shop Net Margin
                  </span>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <span className="text-xs text-neutral-400 font-medium">ပျမ်းမျှ သုံးစွဲငွေ (ARPU)</span>
                  <p className="text-xl font-extrabold text-cyan-400 mt-1">
                    {formatPrice(monthlyStats.avgTicket)}
                  </p>
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    Avg Revenue per Customer
                  </span>
                </div>
              </div>

              {/* Payment Methods Split */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-300" />
                  <span className="text-xs font-bold text-white">ငွေပေးချေမှု ခွဲခြမ်းစိတ်ဖြာချက် ({selectedMonth}):</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="text-neutral-400">ငွေသား (Cash):</span>
                    <strong className="text-white">{formatPrice(monthlyStats.cashRev)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <span className="text-neutral-400">KBZPay:</span>
                    <strong className="text-white">{formatPrice(monthlyStats.kpayRev)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <span className="text-neutral-400">WavePay:</span>
                    <strong className="text-white">{formatPrice(monthlyStats.waveRev)}</strong>
                  </div>
                </div>
              </div>

              {/* Stylist Breakdown Table for the Month */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-neutral-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-emerald-300" />
                    Stylist တစ်ဦးချင်းစီ၏ ဒီလ စွမ်းဆောင်ရည် နှင့် ကော်မရှင် ခွဲဝေမှု
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-neutral-950 text-neutral-400 font-semibold border-b border-neutral-800">
                        <th className="py-3 px-4">Stylist Name</th>
                        <th className="py-3 px-4">Completed Appointments</th>
                        <th className="py-3 px-4">Gross Revenue Produced</th>
                        <th className="py-3 px-4">Commission Rate</th>
                        <th className="py-3 px-4">Barber Payout (MMK)</th>
                        <th className="py-3 px-4">Shop Net (MMK)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {Object.values(monthlyStats.stylistMap).map((s, idx) => (
                        <tr key={idx} className="hover:bg-neutral-800/50">
                          <td className="py-3 px-4 font-bold text-white">
                            {s.name} <span className="text-[11px] font-normal text-neutral-400 block">{s.title}</span>
                          </td>
                          <td className="py-3 px-4 text-neutral-300 font-mono">{s.count} times</td>
                          <td className="py-3 px-4 text-emerald-300 font-mono font-bold">{formatPrice(s.gross)}</td>
                          <td className="py-3 px-4 text-neutral-300">{s.rate}%</td>
                          <td className="py-3 px-4 text-red-300 font-mono font-bold">{formatPrice(s.commission)}</td>
                          <td className="py-3 px-4 text-emerald-400 font-mono font-bold">{formatPrice(s.shopNet)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daily Breakdown Table for the Month */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-neutral-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    နေ့စဉ် ဝင်ငွေနှင့် လုပ်ဆောင်ချက် စာရင်းဇယား ({selectedMonth})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-neutral-950 text-neutral-400 font-semibold border-b border-neutral-800">
                        <th className="py-3 px-4">ရက်စွဲ (Date)</th>
                        <th className="py-3 px-4">ဘိုကင် ဦးရေ</th>
                        <th className="py-3 px-4">ငွေသား (Cash)</th>
                        <th className="py-3 px-4">Digital (KPay/Wave)</th>
                        <th className="py-3 px-4">စုစုပေါင်း (Gross)</th>
                        <th className="py-3 px-4">ကော်မရှင် (Comm)</th>
                        <th className="py-3 px-4">ဆိုင်အသားတင် (Net)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {Object.keys(monthlyStats.dailyMap).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            ဤလအတွက် ဘိုကင်စာရင်း မရှိသေးပါ
                          </td>
                        </tr>
                      ) : (
                        Object.keys(monthlyStats.dailyMap).sort().map((dateStr) => {
                          const d = monthlyStats.dailyMap[dateStr];
                          return (
                            <tr key={dateStr} className="hover:bg-neutral-800/50">
                              <td className="py-3 px-4 font-mono text-white">{dateStr}</td>
                              <td className="py-3 px-4 text-neutral-300 font-mono">{d.bookingsCount}</td>
                              <td className="py-3 px-4 text-neutral-300 font-mono">{formatPrice(d.cash)}</td>
                              <td className="py-3 px-4 text-neutral-300 font-mono">{formatPrice(d.digital)}</td>
                              <td className="py-3 px-4 text-emerald-300 font-mono font-bold">{formatPrice(d.gross)}</td>
                              <td className="py-3 px-4 text-red-300 font-mono">{formatPrice(d.commission)}</td>
                              <td className="py-3 px-4 text-emerald-400 font-mono font-bold">{formatPrice(d.shopNet)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* YEARLY STATEMENT VIEW (12 MONTHS) */}
          {statementViewType === 'yearly' && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-300" />
                  {selectedYear} ခုနှစ် (၁၂) လ စာရင်းချုပ် နှိုင်းယှဉ်ချက် (Yearly Overview)
                </h3>
                <span className="text-xs text-neutral-400 font-mono">12-Month Fiscal Analysis</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-950 text-neutral-400 font-semibold border-b border-neutral-800">
                      <th className="py-3 px-4">လ (Month)</th>
                      <th className="py-3 px-4">စုစုပေါင်း ဘိုကင်</th>
                      <th className="py-3 px-4">ပြီးမြောက်မှု</th>
                      <th className="py-3 px-4">Gross Revenue (MMK)</th>
                      <th className="py-3 px-4">Commission Paid (MMK)</th>
                      <th className="py-3 px-4">Shop Net Profit (MMK)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {yearlyStats.map((item) => (
                      <tr key={item.monthCode} className="hover:bg-neutral-800/50">
                        <td className="py-3 px-4 font-bold text-white">
                          {item.monthName} ({item.monthCode})
                        </td>
                        <td className="py-3 px-4 text-neutral-300 font-mono">{item.totalBookings}</td>
                        <td className="py-3 px-4 text-neutral-300 font-mono">{item.completedCount}</td>
                        <td className="py-3 px-4 text-emerald-300 font-mono font-bold">{formatPrice(item.grossRevenue)}</td>
                        <td className="py-3 px-4 text-red-300 font-mono">{formatPrice(item.commissionPaid)}</td>
                        <td className="py-3 px-4 text-emerald-400 font-mono font-bold">{formatPrice(item.shopNetProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-950 font-bold text-white border-t border-neutral-700">
                      <td className="py-3.5 px-4">နှစ်ချုပ် စုစုပေါင်း (Total)</td>
                      <td className="py-3.5 px-4 font-mono">{yearlyStats.reduce((s, i) => s + i.totalBookings, 0)}</td>
                      <td className="py-3.5 px-4 font-mono">{yearlyStats.reduce((s, i) => s + i.completedCount, 0)}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-300">
                        {formatPrice(yearlyStats.reduce((s, i) => s + i.grossRevenue, 0))}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-red-400">
                        {formatPrice(yearlyStats.reduce((s, i) => s + i.commissionPaid, 0))}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        {formatPrice(yearlyStats.reduce((s, i) => s + i.shopNetProfit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BUSINESS INTELLIGENCE & ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Analytics Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Retention Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Customer Retention Rate</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-3xl font-extrabold text-purple-400">{analyticsData.repeatRate}%</p>
              <div className="text-xs text-neutral-400 leading-relaxed">
                ထပ်မံလာရောက်အားပေးသည့် ဖောက်သည်: <strong>{analyticsData.repeatClients}</strong> ဦး / Unique Clients: <strong>{analyticsData.uniqueClients}</strong> ဦး
              </div>
            </div>

            {/* Peak Hours Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Peak Rush Hours (လူစည်ကားချိန်)</span>
                <Clock className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {analyticsData.topRushHours.map(([hour, count]) => (
                  <span key={hour} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs font-bold font-mono">
                    {hour} ({count} cuts)
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500">ဤအချိန်များတွင် ဆံသဆရာ အင်အား အပြည့်ထားရှိသင့်ပါသည်</p>
            </div>

            {/* Top Profit Service */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Most Popular Service</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-white truncate">
                {analyticsData.topServices[0]?.name || 'GENTLEMAN Signature Haircut'}
              </p>
              <div className="text-xs text-emerald-400 font-mono font-bold">
                {formatPrice(analyticsData.topServices[0]?.gross || 0)} Revenue Generated
              </div>
            </div>
          </div>

          {/* Strategic Recommendations Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-neutral-900 to-amber-500/5 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-300" />
              စီးပွားရေး တိုးတက်မှု အကြံပြုချက်များ (Executive Growth Insights)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-300 leading-relaxed">
              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800">
                <strong className="text-emerald-200 block mb-1">🎯 Off-Peak Slot Promotion Strategy:</strong>
                နေ့လယ် ၁၂:၀၀ နာရီမှ ၂:၀၀ နာရီကြား အားလပ်ချိန်များတွင် Flash Promo (15% Off) ပေး၍ ဧည့်သည်အဝင် မျှတစေရန် အကြံပြုပါသည်။
              </div>
              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800">
                <strong className="text-emerald-300 block mb-1">💎 High-Margin Service Up-selling:</strong>
                Perming နှင့် Dreadlock ကဲ့သို့သော အခကြေးမြင့် ဝန်ဆောင်မှုများကို VIP မန်ဘာများအား Royalty Points ၂ ဆ ပေး၍ ဆွဲဆောင်နိုင်ပါသည်။
              </div>
              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800">
                <strong className="text-cyan-300 block mb-1">💈 Stylist Shift Optimization:</strong>
                ညနေ ၄:၀၀ နာရီမှ ၇:၀၀ နာရီအထိ Peak Rush Hour ဖြစ်သဖြင့် အလှည့်ကျ ဆံသဆရာဦးရေ တိုးမြှင့်တာဝန်ချထားသင့်ပါသည်။
              </div>
              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800">
                <strong className="text-purple-300 block mb-1">👑 VIP Loyalty Program:</strong>
                {analyticsData.repeatClients} ဦးသော Returning Clients များအတွက် Exclusive VIP Member Tier သတ်မှတ်ပေးပြီး အမြဲမပြတ် ဆက်သွယ်ထိန်းသိမ်းပါ။
              </div>
            </div>
          </div>

          {/* Barber Productivity Rankings */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-300" />
                Stylist Leaderboard &amp; Customer Satisfaction Scorecard
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 font-semibold border-b border-neutral-800">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Stylist Name</th>
                    <th className="py-3 px-4">Completed Appointments</th>
                    <th className="py-3 px-4">Gross Revenue</th>
                    <th className="py-3 px-4">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {analyticsData.barberRankings.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-neutral-800/50">
                      <td className="py-3 px-4 font-bold text-emerald-300">#{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-white">{b.name}</td>
                      <td className="py-3 px-4 font-mono text-neutral-300">{b.completedCount} cuts</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-200">{formatPrice(b.grossRevenue)}</td>
                      <td className="py-3 px-4 text-emerald-300 font-bold">⭐ {b.avgRating} / 5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4 / PRINT PREVIEW: OFFICIAL PRINTABLE STATEMENT */}
      {activeTab === 'print' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <span className="text-xs text-neutral-300">
              အောက်ပါ စာရွက်ပုံစံသည် Print / PDF ထုတ်ယူရန် သီးသန့် ပြင်ဆင်ထားသော Official Statement ဖြစ်ပါသည်။
            </span>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-extrabold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Now (ပရင့်ထုတ်ပါ)
            </button>
          </div>

          {/* Printable Sheet Layout */}
          <div
            ref={printRef}
            className="bg-white text-neutral-900 p-8 md:p-12 rounded-2xl shadow-2xl border border-neutral-300 print:border-none print:shadow-none print:p-0 max-w-4xl mx-auto space-y-8"
          >
            {/* Header Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-6">
              <div>
                <h2 className="text-2xl font-black tracking-wider uppercase text-neutral-950">
                  {settings?.shopName || 'GENTLEMAN'}
                </h2>
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mt-0.5">
                  {settings?.tagline || 'Barber & Grooming Lounge'}
                </p>
                <p className="text-xs text-neutral-600 mt-2 max-w-sm">
                  {settings?.shopAddress || 'No. 123, Pyay Road, Kamayut, Yangon'}
                </p>
                <p className="text-xs text-neutral-600">Hotline: {settings?.shopPhone || '09263188228'}</p>
              </div>

              <div className="text-right space-y-1">
                <span className="inline-block px-3 py-1 bg-neutral-900 text-white text-xs font-bold uppercase rounded">
                  Official Statement
                </span>
                <p className="text-xs font-bold text-neutral-800 mt-2">Report ID: GTM-RPT-{Date.now().toString().slice(-6)}</p>
                <p className="text-xs text-neutral-600">Period: {selectedMonth}</p>
                <p className="text-[11px] text-neutral-500">Generated: {new Date().toLocaleString()}</p>
              </div>
            </div>

            {/* Executive Financial Summary Grid */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800 mb-3">
                1. Financial Executive Summary ({selectedMonth})
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 border border-neutral-300 rounded-lg bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Gross Revenue</span>
                  <p className="text-base font-extrabold text-neutral-950 mt-1">{formatPrice(monthlyStats.grossRev)}</p>
                </div>
                <div className="p-3 border border-neutral-300 rounded-lg bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Total Completed</span>
                  <p className="text-base font-extrabold text-neutral-950 mt-1">{monthlyStats.completedBookings.length} Cuts</p>
                </div>
                <div className="p-3 border border-neutral-300 rounded-lg bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Staff Commission</span>
                  <p className="text-base font-extrabold text-neutral-950 mt-1">{formatPrice(monthlyStats.commTotal)}</p>
                </div>
                <div className="p-3 border border-neutral-300 rounded-lg bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase font-semibold">Shop Net Margin</span>
                  <p className="text-base font-extrabold text-neutral-950 mt-1">{formatPrice(monthlyStats.netShopProfit)}</p>
                </div>
              </div>
            </div>

            {/* Stylist Breakdown Table */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800 mb-3">
                2. Stylist Performance &amp; Commission Breakdown
              </h3>
              <table className="w-full text-left text-xs border border-neutral-300 border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-300 font-bold text-neutral-800">
                    <th className="py-2 px-3 border-r border-neutral-300">Stylist Name</th>
                    <th className="py-2 px-3 border-r border-neutral-300">Appointments</th>
                    <th className="py-2 px-3 border-r border-neutral-300">Gross (MMK)</th>
                    <th className="py-2 px-3 border-r border-neutral-300">Rate</th>
                    <th className="py-2 px-3 border-r border-neutral-300">Commission (MMK)</th>
                    <th className="py-2 px-3">Shop Net (MMK)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 font-mono">
                  {Object.values(monthlyStats.stylistMap).map((s, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 border-r border-neutral-200 font-sans font-bold text-neutral-950">{s.name}</td>
                      <td className="py-2 px-3 border-r border-neutral-200">{s.count}</td>
                      <td className="py-2 px-3 border-r border-neutral-200">{formatPrice(s.gross)}</td>
                      <td className="py-2 px-3 border-r border-neutral-200">{s.rate}%</td>
                      <td className="py-2 px-3 border-r border-neutral-200 font-bold">{formatPrice(s.commission)}</td>
                      <td className="py-2 px-3 font-bold">{formatPrice(s.shopNet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature & Verification Lines */}
            <div className="pt-12 grid grid-cols-2 gap-12 text-xs">
              <div className="border-t border-neutral-400 pt-2 text-center">
                <p className="font-bold text-neutral-800">Prepared By: Shop Manager</p>
                <p className="text-[11px] text-neutral-500 mt-1">Signature &amp; Date</p>
              </div>
              <div className="border-t border-neutral-400 pt-2 text-center">
                <p className="font-bold text-neutral-800">Approved By: SuperAdmin / Owner</p>
                <p className="text-[11px] text-neutral-500 mt-1">Signature &amp; Date</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
