import { useState, useEffect, useMemo } from 'react';
import { Booking, Designer, Service, ShopExpense, RetailSale } from '../types';
import { api } from '../api/client';

export interface StylistReportSummary {
  designerId: string;
  designerName: string;
  designerAvatar: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  totalCommission: number;
  netShopProfit: number;
  averageRating: number;
}

export interface AdminReportData {
  totalRevenue: number;
  totalBookingsCount: number;
  completedCount: number;
  pendingCount: number;
  cancelledCount: number;
  totalExpenses: number;
  totalRetailSales: number;
  netProfit: number;
  stylistSummaries: StylistReportSummary[];
  popularServices: { name: string; count: number; revenue: number }[];
  dailyRevenueMap: Record<string, number>;
}

export interface UseAdminReportsOptions {
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"
  designerId?: string; // Specific designer filter
}

/**
 * Custom Hook: useAdminReports
 * In-Memory computation for Admin Reports, Revenue Matrix, Stylist Breakdown, and Charts.
 * Switching tabs, date ranges, or filters triggers 0 Firestore network reads.
 */
export function useAdminReports(options: UseAdminReportsOptions = {}): {
  report: AdminReportData;
  isLoading: boolean;
  refresh: () => void;
} {
  const [bookings, setBookings] = useState<Booking[]>(() => api.getCachedBookings());
  const [designers, setDesigners] = useState<Designer[]>(() => api.getCachedDesigners());
  const [services, setServices] = useState<Service[]>(() => api.getCachedServices());
  const [expenses, setExpenses] = useState<ShopExpense[]>([]);
  const [retailSales, setRetailSales] = useState<RetailSale[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(bookings.length === 0);

  useEffect(() => {
    // 1. Subscribe to shared bookings cache
    const unsubBookings = api.subscribeToBookings((updatedBookings) => {
      setBookings(updatedBookings);
      setIsLoading(false);
    });

    // 2. Subscribe to designers & services
    const unsubDesigners = api.subscribeToDesigners((updatedDesigners) => {
      setDesigners(updatedDesigners);
    });

    const unsubServices = api.subscribeToServices((updatedServices) => {
      setServices(updatedServices);
    });

    // 3. Subscribe to expenses & retail
    const unsubExpenses = api.subscribeToExpenses((updatedExpenses) => {
      setExpenses(updatedExpenses);
    });

    const unsubRetail = api.subscribeToRetailSales((updatedSales) => {
      setRetailSales(updatedSales);
    });

    return () => {
      unsubBookings();
      unsubDesigners();
      unsubServices();
      unsubExpenses();
      unsubRetail();
    };
  }, []);

  // Filter bookings in-memory according to the date range and designer options
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (options.startDate && b.date < options.startDate) return false;
      if (options.endDate && b.date > options.endDate) return false;
      if (options.designerId && b.designerId !== options.designerId && (b as any).walkinBarberId !== options.designerId) {
        return false;
      }
      return true;
    });
  }, [bookings, options.startDate, options.endDate, options.designerId]);

  // Compute full analytics report strictly in-memory
  const report = useMemo<AdminReportData>(() => {
    let totalRevenue = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    const dailyRevenueMap: Record<string, number> = {};
    const serviceMap: Record<string, { count: number; revenue: number }> = {};
    const designerMap: Record<string, {
      total: number;
      completed: number;
      cancelled: number;
      revenue: number;
      commission: number;
      ratings: number[];
    }> = {};

    // Initialize designer map
    designers.forEach(d => {
      designerMap[d.id] = {
        total: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
        commission: 0,
        ratings: [],
      };
    });

    filteredBookings.forEach((b) => {
      const bPrice = b.price || b.servicePrice || (b as any).totalPrice || 0;
      const bDesignerId = b.designerId || (b as any).walkinBarberId;

      if (b.status === 'completed') {
        completedCount++;
        totalRevenue += bPrice;
        dailyRevenueMap[b.date] = (dailyRevenueMap[b.date] || 0) + bPrice;

        // Service aggregation
        const sName = b.serviceName || 'Standard Service';
        if (!serviceMap[sName]) serviceMap[sName] = { count: 0, revenue: 0 };
        serviceMap[sName].count += 1;
        serviceMap[sName].revenue += bPrice;
      } else if (b.status === 'pending' || b.status === 'confirmed' || b.status === 'in-progress') {
        pendingCount++;
      } else if (b.status === 'cancelled') {
        cancelledCount++;
      }

      // Designer aggregation
      if (bDesignerId && designerMap[bDesignerId]) {
        designerMap[bDesignerId].total += 1;
        if (b.status === 'completed') {
          designerMap[bDesignerId].completed += 1;
          designerMap[bDesignerId].revenue += bPrice;
          const comm = b.commissionAmount !== undefined ? b.commissionAmount : Math.round(bPrice * 0.5);
          designerMap[bDesignerId].commission += comm;
        } else if (b.status === 'cancelled') {
          designerMap[bDesignerId].cancelled += 1;
        }

        if (b.rating && b.rating > 0) {
          designerMap[bDesignerId].ratings.push(b.rating);
        }
      }
    });

    // Expenses in date range
    const filteredExpenses = expenses.filter(e => {
      if (options.startDate && e.date < options.startDate) return false;
      if (options.endDate && e.date > options.endDate) return false;
      return true;
    });
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Retail sales in date range
    const filteredRetail = retailSales.filter(r => {
      if (options.startDate && r.date < options.startDate) return false;
      if (options.endDate && r.date > options.endDate) return false;
      return true;
    });
    const totalRetailSales = filteredRetail.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    const netProfit = (totalRevenue + totalRetailSales) - totalExpenses;

    const stylistSummaries: StylistReportSummary[] = designers.map(d => {
      const stats = designerMap[d.id] || { total: 0, completed: 0, cancelled: 0, revenue: 0, commission: 0, ratings: [] };
      const avgRating = stats.ratings.length > 0
        ? Number((stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length).toFixed(1))
        : (d.rating || 5.0);

      return {
        designerId: d.id,
        designerName: d.name,
        designerAvatar: d.avatarUrl,
        totalBookings: stats.total,
        completedBookings: stats.completed,
        cancelledBookings: stats.cancelled,
        totalRevenue: stats.revenue,
        totalCommission: stats.commission,
        netShopProfit: stats.revenue - stats.commission,
        averageRating: avgRating,
      };
    });

    const popularServices = Object.entries(serviceMap)
      .map(([name, val]) => ({ name, count: val.count, revenue: val.revenue }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRevenue,
      totalBookingsCount: filteredBookings.length,
      completedCount,
      pendingCount,
      cancelledCount,
      totalExpenses,
      totalRetailSales,
      netProfit,
      stylistSummaries,
      popularServices,
      dailyRevenueMap,
    };
  }, [filteredBookings, designers, expenses, retailSales, options.startDate, options.endDate]);

  const refresh = () => {
    setBookings(api.getCachedBookings());
  };

  return {
    report,
    isLoading,
    refresh,
  };
}
