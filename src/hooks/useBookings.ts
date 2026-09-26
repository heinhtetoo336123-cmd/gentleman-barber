import { useState, useEffect, useCallback, useMemo } from 'react';
import { Booking, BookingStatus } from '../types';
import { api } from '../api/client';

export interface UseBookingsOptions {
  statusFilter?: BookingStatus | 'all';
  dateFilter?: string; // "YYYY-MM-DD"
  designerId?: string;
  limitCount?: number;
}

export interface UseBookingsReturn {
  bookings: Booking[];
  filteredBookings: Booking[];
  isLoading: boolean;
  createBooking: (data: Parameters<typeof api.createBooking>[0]) => Promise<Booking>;
  createWalkinBooking: (data: Parameters<typeof api.createWalkinBooking>[0]) => Promise<Booking>;
  updateStatus: (id: string, newStatus: BookingStatus, note?: string, newDate?: string, newTimeSlot?: string, adminReply?: string) => Promise<Booking>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<Booking>;
  deleteBooking: (id: string) => Promise<boolean>;
  refresh: () => Promise<Booking[]>;
}

/**
 * Custom Hook: useBookings
 * Universal hook for accessing real-time, local-first cached bookings with synchronous hydration and delta-sync.
 */
export function useBookings(options: UseBookingsOptions = {}): UseBookingsReturn {
  // 1. Synchronous Hydration from Local Storage (0ms Render, 0 initial network reads)
  const [bookings, setBookings] = useState<Booking[]>(() => api.getCachedBookings());
  const [isLoading, setIsLoading] = useState<boolean>(bookings.length === 0);

  useEffect(() => {
    // Subscribe to restricted today's listener with automatic background delta sync
    const unsubscribe = api.subscribeToBookings((updatedBookings) => {
      setBookings(updatedBookings);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Filtered in-memory computation without triggering network reads
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (options.statusFilter && options.statusFilter !== 'all' && b.status !== options.statusFilter) {
        return false;
      }
      if (options.dateFilter && b.date !== options.dateFilter) {
        return false;
      }
      if (options.designerId && b.designerId !== options.designerId && (b as any).walkinBarberId !== options.designerId) {
        return false;
      }
      return true;
    }).slice(0, options.limitCount || undefined);
  }, [bookings, options.statusFilter, options.dateFilter, options.designerId, options.limitCount]);

  const createBooking = useCallback(async (data: Parameters<typeof api.createBooking>[0]) => {
    return await api.createBooking(data);
  }, []);

  const createWalkinBooking = useCallback(async (data: Parameters<typeof api.createWalkinBooking>[0]) => {
    return await api.createWalkinBooking(data);
  }, []);

  const updateStatus = useCallback(
    async (
      id: string,
      newStatus: BookingStatus,
      note?: string,
      newDate?: string,
      newTimeSlot?: string,
      adminReply?: string
    ): Promise<Booking> => {
      return await api.updateBookingStatus(id, newStatus, note, newDate, newTimeSlot, adminReply);
    },
    []
  );

  const updateBooking = useCallback(async (id: string, updates: Partial<Booking>): Promise<Booking> => {
    return await api.updateBooking(id, updates);
  }, []);

  const deleteBooking = useCallback(async (id: string): Promise<boolean> => {
    return await api.deleteBooking(id);
  }, []);

  const refresh = useCallback(async (): Promise<Booking[]> => {
    const res = await api.getBookings();
    setBookings(res);
    return res;
  }, []);

  return {
    bookings,
    filteredBookings,
    isLoading,
    createBooking,
    createWalkinBooking,
    updateStatus,
    updateBooking,
    deleteBooking,
    refresh,
  };
}

