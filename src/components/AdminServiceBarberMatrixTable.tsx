import React, { useState, useEffect, useMemo } from 'react';
import { Service, Designer, Booking, ShopExpense, RetailSale } from '../types';
import { formatPrice } from '../utils/formatters';
import { getLocalTodayStr } from '../utils/timeSlots';
import { api } from '../api/client';
import {
  Calendar,
  Download,
  Printer,
  Search,
  Scissors,
  Award,
  Phone,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  User,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ShoppingBag,
  Receipt,
  Wallet,
  Coins,
  Minus,
  Plus,
  Equal,
  CreditCard,
  DollarSign
} from 'lucide-react';

interface AdminServiceBarberMatrixTableProps {
  services: Service[];
  designers: Designer[];
  bookings: Booking[];
  lang?: 'en' | 'my';
}

type ValueDisplayMode = 'both' | 'count' | 'revenue';
type StatusFilterMode = 'all_valid' | 'completed_only';
type MatrixLayoutMode = 'auto' | 'cards' | 'table';

export const AdminServiceBarberMatrixTable: React.FC<AdminServiceBarberMatrixTableProps> = ({
  services,
  designers,
  bookings,
  lang = 'en'
}) => {
  const todayStr = getLocalTodayStr();

  // Filter States: Clean Date Range (defaults to today)
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Live Expenses & Retail Sales Subscriptions
  const [allExpenses, setAllExpenses] = useState<ShopExpense[]>([]);
  const [allRetailSales, setAllRetailSales] = useState<RetailSale[]>([]);

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

  // View & Layout Options
  const [displayMode, setDisplayMode] = useState<ValueDisplayMode>('both');
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all_valid');
  const [matrixLayout, setMatrixLayout] = useState<MatrixLayoutMode>('auto');
  const [serviceScope, setServiceScope] = useState<'used_only' | 'all'>('used_only');
  const [searchServiceQuery, setSearchServiceQuery] = useState<string>('');

  // Stylist Specific Filter States (Below Matrix)
  const [selectedStylistFilter, setSelectedStylistFilter] = useState<string>('all');
  const [stylistChannelFilter, setStylistChannelFilter] = useState<'all' | 'walkin' | 'booking'>('all');
  const [stylistSearchQuery, setStylistSearchQuery] = useState<string>('');

  // Active stylists list
  const activeDesigners = useMemo(() => {
    return designers.filter((d) => d.active !== false);
  }, [designers]);

  // Filtered Bookings for the Matrix
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Status Filter
      if (statusFilter === 'completed_only') {
        if (b.status !== 'completed') return false;
      } else {
        // all_valid: exclude cancelled
        if (b.status === 'cancelled') return false;
      }

      // Date Filtering
      const bDate = b.date || '';
      if (startDate && bDate < startDate) return false;
      if (endDate && bDate > endDate) return false;

      return true;
    });
  }, [bookings, startDate, endDate, statusFilter]);

  // Build Matrix Data: Map [serviceId][designerId] -> { count, revenue }
  const matrixData = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();

    for (const b of filteredBookings) {
      const dId = b.designerId;
      if (!dId) continue;
      const isCompleted = b.status === 'completed';

      if (b.servicesList && b.servicesList.length > 0) {
        // Multi-service booking calculation
        const totalGross = b.servicesList.reduce((acc, s) => acc + (s.servicePrice || 0), 0);
        const discountRatio = totalGross > 0 ? (b.discountAmount || 0) / totalGross : 0;

        for (const srvItem of b.servicesList) {
          const sId = srvItem.serviceId || `service_${(srvItem.serviceName || '').trim().toLowerCase()}`;
          if (!sId) continue;
          const key = `${sId}___${dId}`;
          const itemNet = Math.max(0, (srvItem.servicePrice || 0) * (1 - discountRatio));

          const existing = map.get(key) || { count: 0, revenue: 0 };
          existing.count += 1;
          if (isCompleted) {
            existing.revenue += Math.round(itemNet);
          }
          map.set(key, existing);
        }
      } else {
        const sId = b.serviceId || `service_${(b.serviceName || '').trim().toLowerCase()}`;
        if (!sId) continue;

        const key = `${sId}___${dId}`;
        const price = b.servicePrice || b.price || 0;
        const discount = b.discountAmount || 0;
        const net = Math.max(0, price - discount);

        const existing = map.get(key) || { count: 0, revenue: 0 };
        existing.count += 1;
        if (isCompleted) {
          existing.revenue += net;
        }
        map.set(key, existing);
      }
    }

    return map;
  }, [filteredBookings]);

  // Channel breakdown metrics (Walk-in vs Online Booking - strictly completed bookings count revenue)
  const channelBreakdown = useMemo(() => {
    let walkinCount = 0;
    let onlineCount = 0;
    let walkinRevenue = 0;
    let onlineRevenue = 0;

    filteredBookings.forEach((b) => {
      const isWlk = b.isWalkin === true || b.bookingCode.startsWith('WLK-') || (b.notes && b.notes.toLowerCase().includes('walk-in'));
      const net = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));
      const isCompleted = b.status === 'completed';
      if (isWlk) {
        walkinCount += 1;
        if (isCompleted) walkinRevenue += net;
      } else {
        onlineCount += 1;
        if (isCompleted) onlineRevenue += net;
      }
    });

    return { walkinCount, onlineCount, walkinRevenue, onlineRevenue };
  }, [filteredBookings]);

  // Unified list of all possible services (catalog + any ad-hoc services in bookings)
  const allAvailableServices = useMemo(() => {
    const list: Service[] = [...services];
    const knownIds = new Set(services.map((s) => s.id));

    filteredBookings.forEach((b) => {
      if (b.servicesList && b.servicesList.length > 0) {
        b.servicesList.forEach((item) => {
          const sId = item.serviceId || `service_${(item.serviceName || '').trim().toLowerCase()}`;
          if (sId && !knownIds.has(sId)) {
            knownIds.add(sId);
            list.push({
              id: sId,
              name: item.serviceName || 'Custom Service',
              description: '',
              imageUrl: '',
              price: item.servicePrice || 0,
              durationMinutes: 30,
              category: 'General',
              active: true
            });
          }
        });
      } else {
        const sId = b.serviceId || `service_${(b.serviceName || '').trim().toLowerCase()}`;
        if (sId && !knownIds.has(sId)) {
          knownIds.add(sId);
          list.push({
            id: sId,
            name: b.serviceName || 'Custom Service',
            description: '',
            imageUrl: '',
            price: b.servicePrice || b.price || 0,
            durationMinutes: 30,
            category: 'General',
            active: true
          });
        }
      }
    });

    return list;
  }, [services, filteredBookings]);

  // Calculate usage totals per service
  const serviceUsageMap = useMemo(() => {
    const usage = new Map<string, { totalCount: number; totalRevenue: number }>();

    for (const [key, cell] of matrixData.entries()) {
      const [sId] = key.split('___');
      if (!sId) continue;
      const current = usage.get(sId) || { totalCount: 0, totalRevenue: 0 };
      current.totalCount += cell.count;
      current.totalRevenue += cell.revenue;
      usage.set(sId, current);
    }

    return usage;
  }, [matrixData]);

  // Count of services actually performed today / in selected period
  const usedServicesCount = useMemo(() => {
    let count = 0;
    for (const [, val] of serviceUsageMap.entries()) {
      if (val.totalCount > 0) count += 1;
    }
    return count;
  }, [serviceUsageMap]);

  // Filtered and Dynamically displayed services
  const displayedServices = useMemo(() => {
    return allAvailableServices
      .filter((s) => {
        if (s.active === false && serviceScope === 'all') return false;

        // Dynamic Used-only filtering (default mode)
        const usage = serviceUsageMap.get(s.id);
        const hasUsage = (usage?.totalCount || 0) > 0;
        if (serviceScope === 'used_only' && !hasUsage) {
          return false;
        }

        // Search query filter
        if (!searchServiceQuery.trim()) return true;
        const q = searchServiceQuery.toLowerCase().trim();
        const matchEn = (s.name || '').toLowerCase().includes(q);
        const matchCategory = (s.category || '').toLowerCase().includes(q);
        return matchEn || matchCategory;
      })
      .sort((a, b) => {
        const usageA = serviceUsageMap.get(a.id)?.totalCount || 0;
        const usageB = serviceUsageMap.get(b.id)?.totalCount || 0;
        // Sort by most used first when looking at services
        if (usageB !== usageA) return usageB - usageA;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [allAvailableServices, serviceScope, serviceUsageMap, searchServiceQuery]);

  // Totals per Stylist across all filtered bookings
  const designerTotals = useMemo(() => {
    const totals: Record<string, { count: number; revenue: number }> = {};
    activeDesigners.forEach((d) => {
      totals[d.id] = { count: 0, revenue: 0 };
    });

    for (const [key, cell] of matrixData.entries()) {
      const [, dId] = key.split('___');
      if (dId && totals[dId]) {
        totals[dId].count += cell.count;
        totals[dId].revenue += cell.revenue;
      }
    }

    return totals;
  }, [activeDesigners, matrixData]);

  // Grand Total
  const grandTotal = useMemo(() => {
    let totalCount = 0;
    let totalRevenue = 0;
    Object.values(designerTotals).forEach((t) => {
      totalCount += t.count;
      totalRevenue += t.revenue;
    });
    return { totalCount, totalRevenue };
  }, [designerTotals]);

  // Formatted Period Description Label
  const periodLabel = useMemo(() => {
    if (startDate === endDate) {
      if (startDate === todayStr) {
        return lang === 'my' ? `ယနေ့ (${startDate})` : `Today (${startDate})`;
      }
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      if (startDate === yStr) {
        return lang === 'my' ? `မနေ့က (${startDate})` : `Yesterday (${startDate})`;
      }
      return startDate;
    }
    return `${startDate || 'Start'} ~ ${endDate || 'End'}`;
  }, [startDate, endDate, todayStr, lang]);

  // Filter expenses according to selected period
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter((e) => {
      const eDate = e.date || '';
      if (startDate && eDate < startDate) return false;
      if (endDate && eDate > endDate) return false;
      return true;
    });
  }, [allExpenses, startDate, endDate]);

  // Filter retail sales according to selected period
  const filteredRetailSales = useMemo(() => {
    return allRetailSales.filter((s) => {
      const sDate = s.date || '';
      if (startDate && sDate < startDate) return false;
      if (endDate && sDate > endDate) return false;
      return true;
    });
  }, [allRetailSales, startDate, endDate]);

  // Comprehensive Drawer Financial Settlement (Strictly completed services count toward drawer revenue)
  const drawerFinancials = useMemo(() => {
    // 1. Services Revenue (Cash + Digital) - ONLY COMPLETED BOOKINGS
    let servicesCash = 0;
    let servicesDigital = 0;
    let servicesTotal = 0;
    let servicesCount = filteredBookings.filter(b => b.status === 'completed').length;

    filteredBookings.forEach((b) => {
      if (b.status !== 'completed') return;
      const net = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));
      servicesTotal += net;

      const pMethod = (b.paymentMethod || 'cash').toLowerCase();
      if (pMethod === 'cash' || pMethod === 'pay_at_shop' || !b.paymentMethod) {
        servicesCash += net;
      } else {
        servicesDigital += net;
      }
    });

    // 2. Retail Product Sales (Cash + Digital)
    let retailCash = 0;
    let retailDigital = 0;
    let retailTotal = 0;
    let retailCount = 0;

    filteredRetailSales.forEach((s) => {
      const amt = Number(s.totalPrice) || 0;
      retailTotal += amt;
      retailCount += Number(s.quantity) || 1;

      const pMethod = (s.paymentMethod || 'cash').toLowerCase();
      if (pMethod === 'cash' || pMethod === 'pay_at_shop' || !s.paymentMethod) {
        retailCash += amt;
      } else {
        retailDigital += amt;
      }
    });

    // 3. Shop Expenses (-)
    let expensesTotal = 0;
    filteredExpenses.forEach((e) => {
      expensesTotal += Number(e.amount) || 0;
    });

    // 4. Net Value in Drawer (Barber commission is NOT deducted per user directive)
    const totalInflow = servicesTotal + retailTotal;
    const netValueInDrawer = totalInflow - expensesTotal;
    const totalCashInflow = servicesCash + retailCash;
    const cashInDrawer = totalCashInflow - expensesTotal;
    const totalDigitalInflow = servicesDigital + retailDigital;

    return {
      servicesCash,
      servicesDigital,
      servicesTotal,
      servicesCount,
      retailCash,
      retailDigital,
      retailTotal,
      retailCount,
      expensesTotal,
      expensesCount: filteredExpenses.length,
      totalInflow,
      netValueInDrawer,
      totalCashInflow,
      cashInDrawer,
      totalDigitalInflow
    };
  }, [filteredBookings, filteredRetailSales, filteredExpenses]);

  // Stylist Detailed Appointments Log (Below Matrix)
  const stylistDetailedBookings = useMemo(() => {
    return filteredBookings.filter((b) => {
      // 1. Stylist Filter
      if (selectedStylistFilter !== 'all' && b.designerId !== selectedStylistFilter) {
        return false;
      }
      // 2. Channel Filter
      if (stylistChannelFilter === 'walkin' && !b.isWalkin) {
        return false;
      }
      if (stylistChannelFilter === 'booking' && b.isWalkin) {
        return false;
      }
      // 3. Search Query
      if (stylistSearchQuery.trim()) {
        const q = stylistSearchQuery.toLowerCase().trim();
        const matchName = (b.customerName || '').toLowerCase().includes(q);
        const matchPhone = (b.customerPhone || '').toLowerCase().includes(q);
        const matchBarber = (b.designerName || '').toLowerCase().includes(q);
        const matchService = (b.serviceName || '').toLowerCase().includes(q);
        const matchCode = (b.bookingCode || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchBarber && !matchService && !matchCode) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const dComp = (b.date || '').localeCompare(a.date || '');
      if (dComp !== 0) return dComp;
      return (b.timeSlot || '').localeCompare(a.timeSlot || '');
    });
  }, [filteredBookings, selectedStylistFilter, stylistChannelFilter, stylistSearchQuery]);

  // Stylist Detailed Summary Totals (Only completed services count toward total service value and commission)
  const stylistDetailedTotals = useMemo(() => {
    let totalAppointments = stylistDetailedBookings.length;
    let walkinCount = 0;
    let bookingCount = 0;
    let totalServiceValue = 0;
    let totalCommission = 0;

    stylistDetailedBookings.forEach((b) => {
      const isCompleted = b.status === 'completed';
      const finalPrice = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));

      if (b.isWalkin) walkinCount += 1;
      else bookingCount += 1;

      if (isCompleted) {
        totalServiceValue += finalPrice;
        const des = designers.find((d) => d.id === b.designerId);
        const commRate = des?.commissionPercent ?? 50;
        const comm = typeof b.commissionAmount === 'number' && b.commissionAmount > 0
          ? b.commissionAmount
          : Math.round((finalPrice * commRate) / 100);
        totalCommission += comm;
      }
    });

    return { totalAppointments, walkinCount, bookingCount, totalServiceValue, totalCommission };
  }, [stylistDetailedBookings, designers]);

  // Comprehensive Export to CSV (Includes Matrix Summary & Detailed Stylist Breakdown)
  const handleExportCSV = () => {
    // 1. Matrix Summary Section
    const matrixHeaders = [
      'No.',
      'Service Name',
      'Price (MMK)',
      ...activeDesigners.map((d) => `${d.name} (Jobs)`),
      ...activeDesigners.map((d) => `${d.name} (Revenue MMK)`),
      'Total Jobs',
      'Total Revenue (MMK)'
    ];

    const matrixRows = displayedServices.map((s, idx) => {
      let rowJobs = 0;
      let rowRev = 0;
      const dJobCounts = activeDesigners.map((d) => {
        const cell = matrixData.get(`${s.id}___${d.id}`) || { count: 0, revenue: 0 };
        rowJobs += cell.count;
        return cell.count;
      });
      const dRevCounts = activeDesigners.map((d) => {
        const cell = matrixData.get(`${s.id}___${d.id}`) || { count: 0, revenue: 0 };
        rowRev += cell.revenue;
        return cell.revenue;
      });

      return [
        idx + 1,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        s.price,
        ...dJobCounts,
        ...dRevCounts,
        rowJobs,
        rowRev
      ];
    });

    const totalJobsPerDesigner = activeDesigners.map((d) => designerTotals[d.id]?.count || 0);
    const totalRevPerDesigner = activeDesigners.map((d) => designerTotals[d.id]?.revenue || 0);
    const matrixSummaryRow = [
      'TOTAL',
      '"Summary Matrix Total"',
      '',
      ...totalJobsPerDesigner,
      ...totalRevPerDesigner,
      grandTotal.totalCount,
      grandTotal.totalRevenue
    ];

    // 2. Stylist Detailed Individual Appointments Section
    const detailedHeaders = [
      'No.',
      'Stylist (Barber)',
      'Date (ရက်စွဲ)',
      'Time (အချိန်)',
      'Services (ဝန်ဆောင်မှုများ)',
      'Type (Walk-in / Booking)',
      'Customer Name',
      'Customer Phone',
      'Service Value (MMK)',
      'Commission (MMK)',
      'Payment Method',
      'Status'
    ];

    const detailedRows = stylistDetailedBookings.map((b, idx) => {
      const des = designers.find((d) => d.id === b.designerId);
      const commRate = des?.commissionPercent ?? 50;
      const finalPrice = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));
      const comm = typeof b.commissionAmount === 'number' && b.commissionAmount > 0
        ? b.commissionAmount
        : Math.round((finalPrice * commRate) / 100);

      const servicesText = b.servicesList && b.servicesList.length > 0
        ? b.servicesList.map(s => s.serviceName).join(' + ')
        : b.serviceName;

      return [
        idx + 1,
        `"${(b.designerName || des?.name || 'Stylist').replace(/"/g, '""')}"`,
        `"${b.date}"`,
        `"${b.timeSlot}"`,
        `"${(servicesText || '').replace(/"/g, '""')}"`,
        b.isWalkin ? 'Walk-in' : 'Online Booking',
        `"${(b.customerName || 'Walk-in Guest').replace(/"/g, '""')}"`,
        `"${b.customerPhone || ''}"`,
        finalPrice,
        comm,
        b.paymentMethod || 'cash',
        b.status
      ];
    });

    const detailedSummaryRow = [
      'TOTAL',
      'Selected Stylist Summary',
      `"${periodLabel}"`,
      '',
      `${stylistDetailedTotals.totalAppointments} jobs`,
      `Walk-ins: ${stylistDetailedTotals.walkinCount} | Bookings: ${stylistDetailedTotals.bookingCount}`,
      '',
      '',
      stylistDetailedTotals.totalServiceValue,
      stylistDetailedTotals.totalCommission,
      '',
      ''
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      `"REPORT: SERVICE & STYLIST PERFORMANCE MATRIX (${periodLabel})"`,
      matrixHeaders.join(','),
      ...matrixRows.map((r) => r.join(',')),
      matrixSummaryRow.join(','),
      '',
      '',
      `"REPORT: INDIVIDUAL STYLIST PERFORMANCE & COMMISSION BREAKDOWN (${periodLabel})"`,
      detailedHeaders.join(','),
      ...detailedRows.map((r) => r.join(',')),
      detailedSummaryRow.join(',')
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stylist_Performance_Report_${startDate === endDate ? startDate : (startDate + '_to_' + endDate)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Table
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl p-3.5 sm:p-5 shadow-xs space-y-3.5 font-sans print:p-0 print:border-none print:shadow-none">
      
      {/* ========================================================================= */}
      {/* TOP ULTRA-COMPACT DATE RANGE PICKER BAR                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5 print:hidden">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500 text-stone-950 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-mono font-bold text-stone-800">
            {periodLabel}
          </span>
        </div>

        {/* Compact Mini Date Inputs */}
        <div className="flex items-center flex-wrap gap-1.5">
          <div className="flex items-center space-x-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-0.5 font-mono text-xs shadow-2xs">
            <span className="text-stone-400 font-bold text-[10px] shrink-0">{lang === 'my' ? 'မှ:' : 'From:'}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const val = e.target.value;
                setStartDate(val);
                if (endDate && val > endDate) setEndDate(val);
              }}
              className="w-[98px] sm:w-[108px] bg-white border border-stone-200 rounded px-1 py-0.5 text-[10px] text-stone-900 font-bold focus:outline-hidden cursor-pointer"
            />
            <span className="text-stone-300 font-bold text-[10px] shrink-0">~</span>
            <span className="text-stone-400 font-bold text-[10px] shrink-0">{lang === 'my' ? 'ထိ:' : 'To:'}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                const val = e.target.value;
                setEndDate(val);
                if (startDate && val < startDate) setStartDate(val);
              }}
              className="w-[98px] sm:w-[108px] bg-white border border-stone-200 rounded px-1 py-0.5 text-[10px] text-stone-900 font-bold focus:outline-hidden cursor-pointer"
            />
          </div>

          <button
            onClick={() => {
              setStartDate(todayStr);
              setEndDate(todayStr);
            }}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors border shrink-0 ${
              startDate === todayStr && endDate === todayStr
                ? 'bg-emerald-500 text-stone-950 border-emerald-500 shadow-2xs'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
            title="Reset to Today"
          >
            {lang === 'my' ? 'ယနေ့' : 'Today'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FINANCIAL SUMMARY (CLEAN & SIMPLE)                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Metric 1: Cash+Digital Payment (services) */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3 sm:p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider font-mono">
              Cash+Digital (services)
            </span>
            <Scissors className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-stone-900 font-mono">
            {formatPrice(drawerFinancials.servicesTotal)}
          </div>
          <div className="text-[10px] font-mono text-stone-500 flex items-center gap-1 flex-wrap">
            <span>Cash: {formatPrice(drawerFinancials.servicesCash)}</span>
            <span>•</span>
            <span>Digital: {formatPrice(drawerFinancials.servicesDigital)}</span>
          </div>
        </div>

        {/* Metric 2: RETAIL PRODUCT SALES */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3 sm:p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider font-mono">
              RETAIL PRODUCT SALES
            </span>
            <ShoppingBag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-stone-900 font-mono">
            {formatPrice(drawerFinancials.retailTotal)}
          </div>
          <div className="text-[10px] font-mono text-stone-500 flex items-center gap-1 flex-wrap">
            <span>Cash: {formatPrice(drawerFinancials.retailCash)}</span>
            <span>•</span>
            <span>Digital: {formatPrice(drawerFinancials.retailDigital)}</span>
          </div>
        </div>

        {/* Metric 3: Expenses (-) */}
        <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-3 sm:p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider font-mono">
              Expenses (-)
            </span>
            <Receipt className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-600 font-mono">
            - {formatPrice(drawerFinancials.expensesTotal)}
          </div>
          <div className="text-[10px] font-mono text-rose-500/90">
            {drawerFinancials.expensesCount} {drawerFinancials.expensesCount === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Metric 4: Net value in drawer */}
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 sm:p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-950 uppercase tracking-wider font-mono">
              Net value in drawer
            </span>
            <Wallet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-950 font-mono">
            {formatPrice(drawerFinancials.netValueInDrawer)}
          </div>
          <div className="text-[10px] font-mono text-emerald-900 flex items-center gap-1 flex-wrap">
            <span>Cash: {formatPrice(drawerFinancials.cashInDrawer)}</span>
            <span>•</span>
            <span>Digital: {formatPrice(drawerFinancials.totalDigitalInflow)}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HEADER & TOP CONTROL BAR                                                  */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-stone-100 pb-2.5 pt-1">
        
        {/* Title and High-Level Summary */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <Scissors className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-black text-stone-950 uppercase tracking-tight font-mono">
              {lang === 'my' ? 'ဝန်ဆောင်မှု & Stylist စာရင်း' : 'Service & Stylist Matrix'}
            </h3>
          </div>
        </div>

        {/* Quick Export & Actions */}
        <div className="flex items-center space-x-1.5 shrink-0 print:hidden flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-mono font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
            title="Download CSV Spreadsheet"
          >
            <Download className="w-3 h-3 text-stone-600" />
            <span>CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-mono font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
            title="Print Matrix View"
          >
            <Printer className="w-3 h-3 text-stone-600" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DYNAMIC MATRIX CONTROLS: VALUE DISPLAY, LAYOUT & SEARCH                   */}
      {/* ========================================================================= */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 space-y-2 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          
          {/* Value Display Mode: Count vs Revenue vs Both */}
          <div className="flex items-center space-x-1 bg-white border border-stone-200 rounded-lg p-0.5 text-xs font-mono font-bold shadow-2xs">
            <span className="text-[10px] text-stone-400 uppercase px-1">Show:</span>
            <button
              onClick={() => setDisplayMode('both')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                displayMode === 'both' ? 'bg-emerald-500 text-stone-950 font-black' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {lang === 'my' ? 'အားလုံး' : 'Both'}
            </button>
            <button
              onClick={() => setDisplayMode('count')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                displayMode === 'count' ? 'bg-emerald-500 text-stone-950 font-black' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {lang === 'my' ? 'ခေါင်းရေ' : 'Jobs'}
            </button>
            <button
              onClick={() => setDisplayMode('revenue')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                displayMode === 'revenue' ? 'bg-emerald-500 text-stone-950 font-black' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {lang === 'my' ? 'ငွေပမာဏ' : 'Revenue'}
            </button>
          </div>

          {/* Layout Mode Switcher: Cards vs Table */}
          <div className="flex items-center space-x-1 bg-white border border-stone-200 rounded-lg p-0.5 text-xs font-mono font-bold shadow-2xs">
            <button
              onClick={() => setMatrixLayout('cards')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer flex items-center space-x-1 ${
                matrixLayout === 'cards' ? 'bg-stone-900 text-emerald-300 font-black shadow-2xs' : 'text-stone-600 hover:bg-stone-100'
              }`}
              title="Card list view (Mobile friendly)"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Cards</span>
            </button>

            <button
              onClick={() => setMatrixLayout('table')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer flex items-center space-x-1 ${
                matrixLayout === 'table' ? 'bg-stone-900 text-emerald-300 font-black shadow-2xs' : 'text-stone-600 hover:bg-stone-100'
              }`}
              title="Full Matrix Table view"
            >
              <TableIcon className="w-3 h-3" />
              <span>Table</span>
            </button>

            <button
              onClick={() => setMatrixLayout('auto')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                matrixLayout === 'auto' ? 'bg-emerald-500 text-stone-950 font-black shadow-2xs' : 'text-stone-600 hover:bg-stone-100'
              }`}
              title="Auto switch (Cards on mobile phone, Table on desktop)"
            >
              Auto
            </button>
          </div>
        </div>

        {/* Dynamic Search & Service Scope Filter Sub-Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-stone-200/60 text-xs">
          {/* Service Scope Toggle: Used Only vs All Catalog */}
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            <div className="flex items-center space-x-1 bg-stone-100 p-0.5 rounded-lg font-mono text-xs font-bold border border-stone-200/80">
              <button
                type="button"
                onClick={() => setServiceScope('used_only')}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer flex items-center space-x-1.5 ${
                  serviceScope === 'used_only'
                    ? 'bg-emerald-500 text-stone-950 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{lang === 'my' ? 'ယနေ့အသုံးပြုသော ဝန်ဆောင်မှုများ' : 'Used Services Only'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  serviceScope === 'used_only' ? 'bg-stone-950 text-emerald-300 font-mono font-black' : 'bg-stone-200 text-stone-700'
                }`}>
                  {usedServicesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setServiceScope('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer flex items-center space-x-1.5 ${
                  serviceScope === 'all'
                    ? 'bg-stone-900 text-emerald-300 font-black shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                }`}
              >
                <span>{lang === 'my' ? 'ဝန်ဆောင်မှု အားလုံး' : 'All Catalog'}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  serviceScope === 'all' ? 'bg-emerald-600 text-stone-950 font-mono font-black' : 'bg-stone-200 text-stone-700'
                }`}>
                  {allAvailableServices.length}
                </span>
              </button>
            </div>

            <span className="text-stone-400 text-[11px] font-mono hidden sm:inline">
              ({filteredBookings.length} {lang === 'my' ? 'မှတ်တမ်း' : 'appointments in period'})
            </span>
          </div>

          {/* Quick Search Service Input */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder={lang === 'my' ? 'ဝန်ဆောင်မှု အမည်ဖြင့် ရှာပါ...' : 'Search service name...'}
              value={searchServiceQuery}
              onChange={(e) => setSearchServiceQuery(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg py-1 pl-8 pr-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUICK HIGHLIGHT STRIP & WALK-IN VS BOOKING DIFFERENTIATOR                */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-300 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-950 uppercase font-extrabold flex items-center space-x-1">
              <span>🚶</span>
              <span>Walk-in (ဆိုင်ရောက်)</span>
            </span>
            <span className="bg-emerald-500 text-stone-950 text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full">
              WLK
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-lg font-black text-emerald-950 font-mono">{channelBreakdown.walkinCount} <span className="text-xs font-normal text-emerald-900">ဦး</span></span>
            <span className="text-[10px] font-mono text-emerald-900 font-bold">{formatPrice(channelBreakdown.walkinRevenue)}</span>
          </div>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-sky-900 uppercase font-extrabold flex items-center space-x-1">
              <span>📱</span>
              <span>Booking (အွန်လိုင်း)</span>
            </span>
            <span className="bg-sky-500 text-white text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full">
              APP
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-lg font-black text-sky-950 font-mono">{channelBreakdown.onlineCount} <span className="text-xs font-normal text-sky-800">ဦး</span></span>
            <span className="text-[10px] font-mono text-sky-800 font-bold">{formatPrice(channelBreakdown.onlineRevenue)}</span>
          </div>
        </div>

        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3">
          <span className="text-[10px] font-mono text-stone-500 uppercase block font-bold">Total Service Jobs</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-lg font-black text-stone-900 font-mono">{grandTotal.totalCount}</span>
            <span className="text-[10px] font-mono text-stone-500">services completed</span>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
          <span className="text-[10px] font-mono text-emerald-900 uppercase block font-bold">Total Net Revenue</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-lg font-black text-emerald-950 font-mono">{formatPrice(grandTotal.totalRevenue)}</span>
            <span className="text-[10px] font-mono text-emerald-700 font-bold">Grand Total</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* THE DYNAMIC MATRIX: CARD LIST (MOBILE) & TABLE (DESKTOP)                  */}
      {/* ========================================================================= */}

      {/* 1. MOBILE CARD LIST DESIGN */}
      {(matrixLayout === 'cards' || matrixLayout === 'auto') && (
        <div className={`space-y-3.5 ${matrixLayout === 'auto' ? 'block md:hidden' : 'block'}`}>
          {/* Section Subtitle */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono font-bold text-stone-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'my' ? 'ဝန်ဆောင်မှု ကတ်ပြားများ' : 'Service Cards Overview'}</span>
            </span>
            <span className="text-[11px] font-mono text-stone-400">
              {displayedServices.length} {lang === 'my' ? 'ခု' : 'services'}
            </span>
          </div>

          {displayedServices.length === 0 ? (
            <div className="p-8 text-center bg-white border border-stone-200 rounded-2xl text-stone-500 font-mono text-xs space-y-3">
              <p>
                {serviceScope === 'used_only'
                  ? (lang === 'my' ? 'ယနေ့ (သို့မဟုတ် ရွေးချယ်ထားသော ကာလတွင်) အသုံးပြုထားသော ဝန်ဆောင်မှု မှတ်တမ်း မရှိသေးပါ' : 'No services were performed yet in this selected period.')
                  : (lang === 'my' ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဝန်ဆောင်မှု မရှိပါ' : 'No matching services found.')}
              </p>
              {serviceScope === 'used_only' && allAvailableServices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setServiceScope('all')}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 text-emerald-300 font-bold hover:bg-stone-800 transition-colors inline-block cursor-pointer shadow-xs"
                >
                  {lang === 'my' ? 'ဝန်ဆောင်မှု အားလုံးပြရန် (Show All Catalog)' : 'Show All Catalog Services'}
                </button>
              )}
            </div>
          ) : (
            displayedServices.map((service, index) => {
              let rowTotalCount = 0;
              let rowTotalRevenue = 0;

              // Calculate active stylists who performed this service
              const stylistBreakdowns = activeDesigners.map((designer) => {
                const cell = matrixData.get(`${service.id}___${designer.id}`) || { count: 0, revenue: 0 };
                rowTotalCount += cell.count;
                rowTotalRevenue += cell.revenue;
                return { designer, cell };
              });

              const performedBreakdowns = stylistBreakdowns.filter((b) => b.cell.count > 0);

              return (
                <div
                  key={service.id}
                  className="bg-white border border-stone-200/90 rounded-2xl p-3.5 space-y-3 shadow-2xs hover:border-emerald-400 transition-all"
                >
                  {/* Service Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2.5">
                    <div className="flex items-start space-x-2.5">
                      <span className="w-6 h-6 rounded-lg bg-stone-900 text-emerald-300 font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-stone-950 text-sm leading-tight">
                          {service.name}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1 text-[11px] font-mono text-stone-500 flex-wrap gap-y-0.5">
                          {service.category && (
                            <span className="bg-stone-100 text-stone-700 font-bold px-2 py-0.5 rounded-md text-[10px] uppercase">
                              {service.category}
                            </span>
                          )}
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>{service.durationMinutes || 30} mins</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block">
                        Base Price
                      </span>
                      <span className="font-mono font-black text-xs sm:text-sm text-stone-900">
                        {formatPrice(service.price)}
                      </span>
                    </div>
                  </div>

                  {/* Total Performance Ribbon for this Service */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-200 text-xs font-mono">
                    <span className="text-emerald-950 font-extrabold flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Total Performance:</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-lg bg-stone-900 text-emerald-300 font-black text-xs">
                        {rowTotalCount} {rowTotalCount === 1 ? 'cut' : 'cuts'}
                      </span>
                      <span className="font-black text-emerald-950 text-xs sm:text-sm">
                        {formatPrice(rowTotalRevenue)}
                      </span>
                    </div>
                  </div>

                  {/* Stylist Breakdown Grid / List */}
                  <div className="space-y-1.5 pt-0.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold block px-0.5">
                      {lang === 'my' ? 'ဆံသပညာရှင်များ၏ ဆောင်ရွက်မှု' : 'Stylists Breakdown'}
                    </span>

                    {performedBreakdowns.length === 0 ? (
                      <div className="p-2.5 bg-stone-50 border border-dashed border-stone-200 rounded-xl text-center text-stone-400 text-xs font-mono">
                        {lang === 'my' ? 'ဤကာလအတွင်း လုပ်ဆောင်ထားခြင်းမရှိပါ' : 'No cuts performed in this period.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {performedBreakdowns.map(({ designer, cell }) => (
                          <div
                            key={designer.id}
                            className="flex items-center justify-between p-2 bg-stone-50/80 border border-stone-200/70 rounded-xl text-xs"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <img
                                src={designer.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                                alt={designer.name}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-full object-cover border border-emerald-300 shrink-0"
                              />
                              <div className="truncate">
                                <span className="font-bold text-stone-900 block truncate">{designer.name}</span>
                                <span className="text-[10px] font-mono text-stone-400">
                                  {designer.commissionPercent ?? 50}% comm
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 font-black text-[11px] inline-block">
                                {cell.count} {cell.count > 1 ? 'cuts' : 'cut'}
                              </span>
                              <span className="block text-[11px] font-black text-stone-800 mt-0.5">
                                {formatPrice(cell.revenue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Stylist Totals Summary Cards on Mobile */}
          <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h4 className="font-mono text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 text-stone-900">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>{lang === 'my' ? 'Stylist တစ်ဦးချင်း စုစုပေါင်း' : 'Stylists Total Summary'}</span>
              </h4>
              <span className="text-[10px] font-mono text-stone-500 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                {activeDesigners.length} Stylists
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeDesigners.map((designer) => {
                const t = designerTotals[designer.id] || { count: 0, revenue: 0 };
                const comm = Math.round((t.revenue * (designer.commissionPercent ?? 50)) / 100);

                return (
                  <div
                    key={designer.id}
                    className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs font-mono shadow-2xs"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <img
                        src={designer.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                        alt={designer.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-emerald-300 shrink-0"
                      />
                      <div className="truncate">
                        <span className="font-bold text-stone-900 block truncate">{designer.name}</span>
                        <span className="text-[10px] text-stone-500">{designer.commissionPercent ?? 50}% comm</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 border border-emerald-200 font-black text-xs inline-block">
                        {t.count} cuts
                      </span>
                      <span className="block text-[11px] font-bold text-stone-900 mt-0.5">
                        {formatPrice(t.revenue)}
                      </span>
                      <span className="block text-[10px] font-bold text-emerald-600">
                        comm: {formatPrice(comm)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Grand Total Bottom Strip */}
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl p-3 font-mono">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider block text-emerald-900">
                  GRAND TOTAL
                </span>
                <span className="text-base font-black text-emerald-950">
                  {grandTotal.totalCount} cuts
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-900 block">Total Revenue</span>
                <span className="text-base font-black text-emerald-950">
                  {formatPrice(grandTotal.totalRevenue)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. DESKTOP FULL MATRIX TABLE */}
      {(matrixLayout === 'table' || matrixLayout === 'auto') && (
        <div className={`border border-stone-200 rounded-2xl shadow-xs overflow-hidden bg-white ${matrixLayout === 'auto' ? 'hidden md:block' : 'block'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              
              {/* Table Header */}
              <thead>
                <tr className="bg-stone-900 text-emerald-300 font-mono text-[11px] uppercase tracking-wider divide-x divide-stone-800">
                  <th className="p-3 w-12 text-center shrink-0">No.</th>
                  <th className="p-3 min-w-[200px] sticky left-0 z-10 bg-stone-900 text-emerald-300 shadow-xs">
                    {lang === 'my' ? 'ဝန်ဆောင်မှု အမည် (Services List)' : 'Services List'}
                  </th>
                  <th className="p-3 w-28 text-right shrink-0">
                    {lang === 'my' ? 'သတ်မှတ်ဈေး (Prices)' : 'Prices'}
                  </th>

                  {/* Dynamic Columns for each Master Barber */}
                  {activeDesigners.map((designer) => (
                    <th key={designer.id} className="p-3 text-center min-w-[130px]">
                      <div className="flex items-center justify-center space-x-1.5">
                        <img
                          src={designer.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400'}
                          alt={designer.name}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover border border-emerald-300"
                        />
                        <span className="truncate">{designer.name}</span>
                      </div>
                    </th>
                  ))}

                  {/* Row Total per Service Column */}
                  <th className="p-3 text-right min-w-[140px] bg-stone-950 text-emerald-200 font-black">
                    {lang === 'my' ? 'စုစုပေါင်း (Total)' : 'Total'}
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-stone-200 font-sans">
                {displayedServices.length === 0 ? (
                  <tr>
                    <td colSpan={4 + activeDesigners.length} className="p-8 text-center text-stone-500 font-mono text-xs">
                      <div className="space-y-3">
                        <p>
                          {serviceScope === 'used_only'
                            ? (lang === 'my' ? 'ယနေ့ (သို့မဟုတ် ရွေးချယ်ထားသော ကာလတွင်) အသုံးပြုထားသော ဝန်ဆောင်မှု မှတ်တမ်း မရှိသေးပါ' : 'No services were performed yet in this selected period.')
                            : (lang === 'my' ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဝန်ဆောင်မှု မရှိပါ' : 'No matching services found.')}
                        </p>
                        {serviceScope === 'used_only' && allAvailableServices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setServiceScope('all')}
                            className="px-3 py-1.5 rounded-xl bg-stone-900 text-emerald-300 font-bold hover:bg-stone-800 transition-colors inline-block cursor-pointer shadow-xs"
                          >
                            {lang === 'my' ? 'ဝန်ဆောင်မှု အားလုံးပြရန် (Show All Catalog)' : 'Show All Catalog Services'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedServices.map((service, index) => {
                    let rowTotalCount = 0;
                    let rowTotalRevenue = 0;

                    return (
                      <tr key={service.id} className="hover:bg-emerald-50/40 transition-colors divide-x divide-stone-100">
                        
                        {/* 1. No. */}
                        <td className="p-3 text-center font-mono font-bold text-stone-500 bg-stone-50/50">
                          {index + 1}
                        </td>

                        {/* 2. Service Name & Category */}
                        <td className="p-3 sticky left-0 z-10 bg-white hover:bg-emerald-50/40 font-medium text-stone-950">
                          <div className="font-bold text-stone-900">
                            {service.name}
                          </div>
                          {service.category && (
                            <span className="text-[10px] font-mono text-stone-400 uppercase">
                              {service.category} • {service.durationMinutes || 30} mins
                            </span>
                          )}
                        </td>

                        {/* 3. Catalog Price */}
                        <td className="p-3 text-right font-mono font-bold text-stone-700 bg-stone-50/30">
                          {formatPrice(service.price)}
                        </td>

                        {/* 4. Cells for each Barber */}
                        {activeDesigners.map((designer) => {
                          const cell = matrixData.get(`${service.id}___${designer.id}`) || { count: 0, revenue: 0 };
                          rowTotalCount += cell.count;
                          rowTotalRevenue += cell.revenue;

                          if (cell.count === 0) {
                            return (
                              <td key={designer.id} className="p-3 text-center font-mono text-stone-300">
                                -
                              </td>
                            );
                          }

                          return (
                            <td key={designer.id} className="p-3 text-center font-mono">
                              {displayMode === 'count' && (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-950 font-black text-xs">
                                  {cell.count}
                                </span>
                              )}

                              {displayMode === 'revenue' && (
                                <span className="font-bold text-stone-900 block text-xs">
                                  {formatPrice(cell.revenue)}
                                </span>
                              )}

                              {displayMode === 'both' && (
                                <div>
                                  <span className="px-2 py-0.2 rounded-md bg-emerald-100 text-emerald-950 font-black text-[11px] inline-block">
                                    {cell.count} {cell.count > 1 ? 'cuts' : 'cut'}
                                  </span>
                                  <span className="block text-[10px] font-bold text-stone-600 mt-0.5">
                                    {formatPrice(cell.revenue)}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* 5. Row Total Column for this service */}
                        <td className="p-3 text-right font-mono bg-emerald-50/60 font-bold text-stone-950">
                          {rowTotalCount === 0 ? (
                            <span className="text-stone-300">-</span>
                          ) : (
                            <div>
                              {displayMode === 'count' && (
                                <span className="px-2 py-0.5 rounded-lg bg-stone-900 text-emerald-300 font-black text-xs">
                                  {rowTotalCount} cuts
                                </span>
                              )}

                              {displayMode === 'revenue' && (
                                <span className="font-black text-emerald-950 text-xs">
                                  {formatPrice(rowTotalRevenue)}
                                </span>
                              )}

                              {displayMode === 'both' && (
                                <div>
                                  <span className="px-2 py-0.2 rounded-md bg-stone-900 text-emerald-300 font-black text-[11px] inline-block">
                                    {rowTotalCount} {rowTotalCount > 1 ? 'cuts' : 'cut'}
                                  </span>
                                  <span className="block text-[10px] font-black text-emerald-950 mt-0.5">
                                    {formatPrice(rowTotalRevenue)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer: Total Summary List Row (အချုပ် total list) */}
              <tfoot>
                <tr className="bg-stone-950 text-white font-mono font-black text-xs divide-x divide-stone-800 border-t-2 border-emerald-400">
                  <td className="p-3.5 text-center text-emerald-300">
                    ∑
                  </td>
                  <td className="p-3.5 sticky left-0 z-10 bg-stone-950 text-emerald-300 uppercase tracking-wider">
                    {lang === 'my' ? 'စုစုပေါင်း အချုပ် (TOTAL LIST)' : 'TOTAL SUMMARY LIST'}
                  </td>
                  <td className="p-3.5 text-right text-stone-400 text-[11px]">
                    {displayedServices.length} items
                  </td>

                  {/* Total per Designer */}
                  {activeDesigners.map((designer) => {
                    const t = designerTotals[designer.id] || { count: 0, revenue: 0 };
                    return (
                      <td key={designer.id} className="p-3.5 text-center bg-stone-900/80">
                        {t.count === 0 ? (
                          <span className="text-stone-500">-</span>
                        ) : (
                          <div>
                            {displayMode === 'count' && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-stone-950 font-black text-xs">
                                {t.count} cuts
                              </span>
                            )}

                            {displayMode === 'revenue' && (
                              <span className="text-emerald-300 font-black text-xs">
                                {formatPrice(t.revenue)}
                              </span>
                            )}

                            {displayMode === 'both' && (
                              <div>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-stone-950 font-black text-[11px] inline-block">
                                  {t.count} cuts
                                </span>
                                <span className="block text-[10px] text-emerald-200 font-bold mt-0.5">
                                  {formatPrice(t.revenue)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Grand Total Column */}
                  <td className="p-3.5 text-right bg-emerald-500 text-stone-950 font-black">
                    <div>
                      <span className="text-xs uppercase block tracking-wider text-[10px] text-stone-900">
                        Grand Total
                      </span>
                      <span className="text-sm font-black block">
                        {grandTotal.totalCount} cuts
                      </span>
                      <span className="text-xs block font-mono font-bold text-stone-900">
                        {formatPrice(grandTotal.totalRevenue)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: INDIVIDUAL STYLIST PERFORMANCE & COMMISSION BREAKDOWN TABLE     */}
      {/* ========================================================================= */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
        
        {/* Section Header */}
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-emerald-300 flex items-center justify-center font-black shrink-0">
              <Award className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center space-x-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-stone-950 uppercase tracking-wider font-mono">
                {lang === 'my' ? 'Stylist မှတ်တမ်း & ကော်မရှင်' : 'Stylist Log & Commission'}
              </h3>
              <span className="text-[10px] font-mono text-stone-500 hidden sm:inline-block">
                ({periodLabel})
              </span>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-950 text-[11px] font-mono font-black border border-emerald-300 shrink-0">
            {stylistDetailedBookings.length} {lang === 'my' ? 'ခု' : 'Records'}
          </span>
        </div>

        {/* Filter Controls: Stylist Selector Pills + Channel Filter + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Stylist Selector Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedStylistFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                selectedStylistFilter === 'all'
                  ? 'bg-stone-900 text-emerald-300 shadow-xs'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              ★ {lang === 'my' ? 'Stylists အားလုံး (All)' : 'All Stylists'}
            </button>

            {activeDesigners.map((designer) => (
              <button
                key={designer.id}
                onClick={() => setSelectedStylistFilter(designer.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shrink-0 cursor-pointer ${
                  selectedStylistFilter === designer.id
                    ? 'bg-emerald-500 text-stone-950 font-black shadow-xs'
                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                <img
                  src={designer.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                  alt={designer.name}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span>{designer.name}</span>
                <span className="text-[10px] opacity-75">({designer.commissionPercent ?? 50}%)</span>
              </button>
            ))}
          </div>

          {/* Channel Filter & Search */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Channel filter pills */}
            <div className="flex items-center space-x-1 bg-white border border-stone-200 p-0.5 rounded-xl font-mono text-xs">
              <button
                onClick={() => setStylistChannelFilter('all')}
                className={`px-2 py-1 rounded-lg font-bold cursor-pointer ${
                  stylistChannelFilter === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStylistChannelFilter('walkin')}
                className={`px-2 py-1 rounded-lg font-bold cursor-pointer flex items-center space-x-1 ${
                  stylistChannelFilter === 'walkin' ? 'bg-emerald-500 text-stone-950 font-black' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span>🚶 Walk-in</span>
              </button>
              <button
                onClick={() => setStylistChannelFilter('booking')}
                className={`px-2 py-1 rounded-lg font-bold cursor-pointer flex items-center space-x-1 ${
                  stylistChannelFilter === 'booking' ? 'bg-sky-500 text-white font-black' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span>📱 Booking</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder={lang === 'my' ? 'ဧည့်သည်/ဖုန်း...' : 'Customer/phone...'}
                value={stylistSearchQuery}
                onChange={(e) => setStylistSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl py-1 pl-8 pr-2 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Summary Metric Ribbon for the selected stylist(s) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-white border border-stone-200 rounded-2xl p-2.5">
            <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block">Total Appointments</span>
            <span className="text-base font-black font-mono text-stone-950">{stylistDetailedTotals.totalAppointments} <span className="text-xs font-normal text-stone-500">jobs</span></span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5">
            <span className="text-[10px] font-mono text-emerald-950 uppercase font-bold block">🚶 Walk-ins</span>
            <span className="text-base font-black font-mono text-emerald-950">{stylistDetailedTotals.walkinCount} <span className="text-xs font-normal text-emerald-900">jobs</span></span>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-2.5">
            <span className="text-[10px] font-mono text-sky-900 uppercase font-bold block">📱 Online Bookings</span>
            <span className="text-base font-black font-mono text-sky-950">{stylistDetailedTotals.bookingCount} <span className="text-xs font-normal text-sky-800">jobs</span></span>
          </div>

          <div className="bg-stone-100 border border-stone-200 rounded-2xl p-2.5">
            <span className="text-[10px] font-mono text-stone-700 uppercase font-bold block">Gross Service Value</span>
            <span className="text-base font-black font-mono text-stone-950">{formatPrice(stylistDetailedTotals.totalServiceValue)}</span>
          </div>

          <div className="bg-emerald-500/15 border border-emerald-300 rounded-2xl p-2.5">
            <span className="text-[10px] font-mono text-emerald-950 uppercase font-extrabold block">Stylist Commission</span>
            <span className="text-base font-black font-mono text-emerald-950">{formatPrice(stylistDetailedTotals.totalCommission)}</span>
          </div>
        </div>

        {/* Detailed Appointments View: Mobile Cards & Desktop Table */}
        {/* 1. Mobile Appointments Card List */}
        {(matrixLayout === 'cards' || matrixLayout === 'auto') && (
          <div className={`space-y-3 ${matrixLayout === 'auto' ? 'block md:hidden' : 'block'}`}>
            {stylistDetailedBookings.length === 0 ? (
              <div className="p-8 text-center bg-white border border-stone-200 rounded-2xl text-stone-400 font-mono text-xs">
                {lang === 'my' ? 'ရွေးချယ်ထားသော ရက်စွဲ/ဆံသပညာရှင်အတွက် မှတ်တမ်း မရှိပါ' : 'No appointment records found for the selected filter.'}
              </div>
            ) : (
              stylistDetailedBookings.map((b, index) => {
                const des = designers.find((d) => d.id === b.designerId);
                const commRate = des?.commissionPercent ?? 50;
                const finalPrice = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));
                const comm = typeof b.commissionAmount === 'number' && b.commissionAmount > 0
                  ? b.commissionAmount
                  : Math.round((finalPrice * commRate) / 100);

                return (
                  <div
                    key={b.id}
                    className="bg-white border border-stone-200/90 rounded-2xl p-3.5 space-y-3 shadow-2xs hover:border-emerald-400 transition-all"
                  >
                    {/* Top Row: Stylist & Status */}
                    <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                      <div className="flex items-center space-x-2 min-w-0">
                        <img
                          src={b.designerAvatar || des?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                          alt={b.designerName}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full object-cover border border-emerald-300 shrink-0"
                        />
                        <div className="truncate">
                          <span className="font-bold text-stone-950 text-xs block truncate">
                            {b.designerName || des?.name || 'Stylist'}
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">
                            {commRate}% Commission
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] font-mono border ${
                          b.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : b.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : b.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : b.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-stone-100 text-stone-800 border-stone-300'
                        }`}>
                          {b.status}
                        </span>
                        <span className="w-5 h-5 rounded-md bg-stone-100 text-stone-600 font-mono text-[10px] font-bold flex items-center justify-center">
                          #{index + 1}
                        </span>
                      </div>
                    </div>

                    {/* Middle Info: Channel, Code & Date/Time */}
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center space-x-1.5">
                        {b.isWalkin ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-950 border border-emerald-300">
                            <span>🚶</span>
                            <span>Walk-in</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-100 text-sky-950 border border-sky-300">
                            <span>📱</span>
                            <span>Online</span>
                          </span>
                        )}

                        {b.bookingCode && (
                          <span className="text-emerald-900 font-bold text-[11px]">
                            #{b.bookingCode}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 text-stone-600 text-[11px]">
                        <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>{b.date} • {b.timeSlot}</span>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-center justify-between text-xs bg-stone-50/70 p-2 rounded-xl">
                      <span className="font-bold text-stone-900 truncate">
                        {b.customerName || 'Walk-in Guest'}
                      </span>
                      {b.customerPhone ? (
                        <a
                          href={`tel:${b.customerPhone}`}
                          className="text-[11px] text-stone-600 hover:text-emerald-900 font-mono font-bold flex items-center space-x-1 shrink-0 bg-white px-2 py-0.5 rounded-md border border-stone-200"
                        >
                          <Phone className="w-2.5 h-2.5 text-emerald-700 inline" />
                          <span>{b.customerPhone}</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-stone-400 font-mono">No phone</span>
                      )}
                    </div>

                    {/* Services Performed */}
                    <div>
                      {b.servicesList && b.servicesList.length > 0 ? (
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          {b.servicesList.map((s, i) => (
                            <span
                              key={i}
                              className="bg-emerald-50 text-emerald-950 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold"
                            >
                              {s.serviceName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="font-bold text-stone-900 text-xs">
                          {b.serviceName}
                        </div>
                      )}
                    </div>

                    {/* Financial Footer */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-stone-500 block font-bold">Gross Service Value</span>
                        <span className="font-black text-stone-900 text-sm">
                          {formatPrice(finalPrice)}
                        </span>
                        {b.discountAmount ? (
                          <span className="block text-[9px] text-rose-500">
                            (-{formatPrice(b.discountAmount)} disc)
                          </span>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-stone-500 block font-bold">Commission ({commRate}%)</span>
                        <span className="font-black text-emerald-600 text-sm">
                          {formatPrice(comm)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Appointments Summary Footer Card */}
            {stylistDetailedBookings.length > 0 && (
              <div className="p-3.5 bg-stone-50 text-stone-900 rounded-2xl space-y-2 border border-stone-200 font-mono text-xs shadow-2xs">
                <div className="flex items-center justify-between text-stone-900 font-black border-b border-stone-200 pb-1.5">
                  <span className="uppercase tracking-wider text-emerald-900">TOTAL SUMMARY</span>
                  <span className="bg-white px-2 py-0.5 rounded border border-stone-200">{stylistDetailedBookings.length} Jobs</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-700">
                  <div>Walk-ins: <span className="text-stone-900 font-bold">{stylistDetailedTotals.walkinCount}</span></div>
                  <div>Bookings: <span className="text-stone-900 font-bold">{stylistDetailedTotals.bookingCount}</span></div>
                  <div>Gross: <span className="text-stone-900 font-bold">{formatPrice(stylistDetailedTotals.totalServiceValue)}</span></div>
                  <div>Commission: <span className="text-emerald-600 font-bold">{formatPrice(stylistDetailedTotals.totalCommission)}</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Desktop Detailed Appointments Table */}
        {(matrixLayout === 'table' || matrixLayout === 'auto') && (
          <div className={`border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs ${matrixLayout === 'auto' ? 'hidden md:block' : 'block'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-900 text-emerald-300 font-mono text-[11px] uppercase tracking-wider divide-x divide-stone-800">
                    <th className="p-3 w-10 text-center">No.</th>
                    <th className="p-3 min-w-[130px]">Stylist (Barber)</th>
                    <th className="p-3 min-w-[110px]">Date & Time (ရက်စွဲ/အချိန်)</th>
                    <th className="p-3 min-w-[180px]">Services (ဝန်ဆောင်မှုများ)</th>
                    <th className="p-3 min-w-[100px] text-center">Channel (Walk-in?)</th>
                    <th className="p-3 min-w-[140px]">Customer</th>
                    <th className="p-3 min-w-[110px] text-right">Service Value</th>
                    <th className="p-3 min-w-[120px] text-right bg-emerald-950/70 text-emerald-300 font-black">Commission</th>
                    <th className="p-3 min-w-[90px] text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100 font-sans">
                  {stylistDetailedBookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-stone-400 font-mono">
                        {lang === 'my' ? 'ရွေးချယ်ထားသော ရက်စွဲ/ဆံသပညာရှင်အတွက် မှတ်တမ်း မရှိပါ' : 'No appointment records found for the selected filter.'}
                      </td>
                    </tr>
                  ) : (
                    stylistDetailedBookings.map((b, index) => {
                      const des = designers.find((d) => d.id === b.designerId);
                      const commRate = des?.commissionPercent ?? 50;
                      const finalPrice = Math.max(0, (b.servicePrice || b.price || 0) - (b.discountAmount || 0));
                      const comm = typeof b.commissionAmount === 'number' && b.commissionAmount > 0
                        ? b.commissionAmount
                        : Math.round((finalPrice * commRate) / 100);

                      return (
                        <tr key={b.id} className="hover:bg-emerald-50/40 transition-colors divide-x divide-stone-100">
                          {/* 1. No */}
                          <td className="p-3 text-center font-mono font-bold text-stone-400 bg-stone-50/40">
                            {index + 1}
                          </td>

                          {/* 2. Stylist */}
                          <td className="p-3 font-medium text-stone-900">
                            <div className="flex items-center space-x-2">
                              <img
                                src={b.designerAvatar || des?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                                alt={b.designerName}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-full object-cover border border-emerald-300 shrink-0"
                              />
                              <div>
                                <span className="font-bold block truncate">{b.designerName || des?.name || 'Stylist'}</span>
                                <span className="text-[10px] text-stone-400 font-mono">{commRate}% comm</span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Date & Time */}
                          <td className="p-3 font-mono text-stone-800">
                            <div className="font-bold">{b.date}</div>
                            <div className="text-[11px] text-stone-500 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-emerald-700 inline shrink-0" />
                              <span>{b.timeSlot}</span>
                            </div>
                          </td>

                          {/* 4. Services */}
                          <td className="p-3 text-stone-900">
                            {b.servicesList && b.servicesList.length > 0 ? (
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                  {b.servicesList.map((s, i) => (
                                    <span
                                      key={i}
                                      className="bg-emerald-50 text-emerald-950 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold"
                                    >
                                      {s.serviceName}
                                    </span>
                                  ))}
                                </div>
                                <span className="text-[10px] text-stone-400 font-mono block">
                                  {b.servicesList.length} services combined
                                </span>
                              </div>
                            ) : (
                              <div className="font-bold text-stone-900">
                                {b.serviceName}
                              </div>
                            )}
                            {b.bookingCode && (
                              <span className="text-[10px] font-mono text-emerald-800 font-bold block mt-0.5">
                                #{b.bookingCode}
                              </span>
                            )}
                          </td>

                          {/* 5. Channel (Walk-in vs Booking) */}
                          <td className="p-3 text-center">
                            {b.isWalkin ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-950 border border-emerald-300">
                                <span>🚶</span>
                                <span>Walk-in</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-sky-100 text-sky-950 border border-sky-300">
                                <span>📱</span>
                                <span>Booking</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Customer */}
                          <td className="p-3 text-stone-900">
                            <div className="font-bold truncate">{b.customerName || 'Walk-in Guest'}</div>
                            {b.customerPhone ? (
                              <a
                                href={`tel:${b.customerPhone}`}
                                className="text-[11px] text-stone-500 hover:text-emerald-800 font-mono flex items-center space-x-1 mt-0.5"
                              >
                                <Phone className="w-2.5 h-2.5 text-emerald-700 inline" />
                                <span>{b.customerPhone}</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-stone-400 font-mono">No phone</span>
                            )}
                          </td>

                          {/* 7. Service Value */}
                          <td className="p-3 text-right font-mono font-bold text-stone-950">
                            {formatPrice(finalPrice)}
                            {b.discountAmount ? (
                              <span className="block text-[10px] text-rose-600 font-normal">
                                -{formatPrice(b.discountAmount)} disc
                              </span>
                            ) : null}
                          </td>

                          {/* 8. Commission */}
                          <td className="p-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                            {formatPrice(comm)}
                            <span className="block text-[10px] text-stone-400 font-normal">
                              ({commRate}%)
                            </span>
                          </td>

                          {/* 9. Status */}
                          <td className="p-3 text-center font-mono text-[10px]">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase border ${
                              b.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : b.status === 'in-progress'
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : b.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : b.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-stone-100 text-stone-800 border-stone-300'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Detailed Table Footer */}
                {stylistDetailedBookings.length > 0 && (
                  <tfoot>
                    <tr className="bg-stone-950 text-white font-mono font-black text-xs divide-x divide-stone-800 border-t-2 border-emerald-400">
                      <td className="p-3 text-center text-emerald-300">∑</td>
                      <td colSpan={5} className="p-3 text-emerald-300 uppercase tracking-wider">
                        TOTAL SUMMARY ({stylistDetailedBookings.length} APPOINTMENTS • {stylistDetailedTotals.walkinCount} WALK-INS, {stylistDetailedTotals.bookingCount} BOOKINGS)
                      </td>
                      <td className="p-3 text-right text-stone-200">
                        {formatPrice(stylistDetailedTotals.totalServiceValue)}
                      </td>
                      <td className="p-3 text-right bg-emerald-950 text-emerald-300">
                        {formatPrice(stylistDetailedTotals.totalCommission)}
                      </td>
                      <td className="p-3 text-center text-stone-400 text-[10px]">
                        {periodLabel}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
