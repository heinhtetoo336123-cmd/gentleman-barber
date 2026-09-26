import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Booking, BookingStatus, AppStats } from '../types';
import { api } from '../api/client';

export interface BookingContextValue {
  bookings: Booking[];
  todayBookings: Booking[];
  pendingBookings: Booking[];
  stats: AppStats | null;
  isLoading: boolean;
  createBooking: (data: Parameters<typeof api.createBooking>[0]) => Promise<Booking>;
  createWalkinBooking: (data: Parameters<typeof api.createWalkinBooking>[0]) => Promise<Booking>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<Booking>;
  updateBookingStatus: (
    id: string,
    status: BookingStatus,
    note?: string,
    newDate?: string,
    newTimeSlot?: string,
    adminReply?: string
  ) => Promise<Booking>;
  deleteBooking: (id: string) => Promise<boolean>;
  refreshBookings: () => Promise<Booking[]>;
}

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

export const BookingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. SYNCHRONOUS HYDRATION FROM LOCALSTORAGE (0ms Render, Zero Initial Network Calls)
  const [bookings, setBookings] = useState<Booking[]>(() => api.getCachedBookings());
  const [stats, setStats] = useState<AppStats | null>(() => api.getCachedStats());
  const [isLoading, setIsLoading] = useState<boolean>(bookings.length === 0);

  // 2. DELTA-ONLY SYNC & RESTRICTED REAL-TIME SUBSCRIPTION
  useEffect(() => {
    // Initial emission from cache + restricted today's active listener + background delta-sync
    const unsubscribe = api.subscribeToBookings((updatedBookings) => {
      setBookings(updatedBookings);
      setStats(api.getCachedStats());
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 3. OPTIMISTIC IN-MEMORY DERIVED STATES
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const todayBookings = useMemo(() => {
    return bookings.filter((b) => b.date === todayStr);
  }, [bookings, todayStr]);

  const pendingBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'pending');
  }, [bookings]);

  // 4. SEAMLESS MUTATION HANDLERS (LOCAL-FIRST WITH IMMEDIATE DISPATCH)
  const createBooking = useCallback(async (data: Parameters<typeof api.createBooking>[0]) => {
    const created = await api.createBooking(data);
    setBookings(api.getCachedBookings());
    setStats(api.getCachedStats());
    return created;
  }, []);

  const createWalkinBooking = useCallback(async (data: Parameters<typeof api.createWalkinBooking>[0]) => {
    const created = await api.createWalkinBooking(data);
    setBookings(api.getCachedBookings());
    setStats(api.getCachedStats());
    return created;
  }, []);

  const updateBooking = useCallback(async (id: string, updates: Partial<Booking>) => {
    const updated = await api.updateBooking(id, updates);
    setBookings(api.getCachedBookings());
    setStats(api.getCachedStats());
    return updated;
  }, []);

  const updateBookingStatus = useCallback(
    async (
      id: string,
      status: BookingStatus,
      note?: string,
      newDate?: string,
      newTimeSlot?: string,
      adminReply?: string
    ) => {
      const updated = await api.updateBookingStatus(id, status, note, newDate, newTimeSlot, adminReply);
      setBookings(api.getCachedBookings());
      setStats(api.getCachedStats());
      return updated;
    },
    []
  );

  const deleteBooking = useCallback(async (id: string) => {
    const success = await api.deleteBooking(id);
    setBookings(api.getCachedBookings());
    setStats(api.getCachedStats());
    return success;
  }, []);

  const refreshBookings = useCallback(async () => {
    const res = await api.getBookings();
    setBookings(res);
    setStats(api.getCachedStats());
    return res;
  }, []);

  const value = useMemo(
    () => ({
      bookings,
      todayBookings,
      pendingBookings,
      stats,
      isLoading,
      createBooking,
      createWalkinBooking,
      updateBooking,
      updateBookingStatus,
      deleteBooking,
      refreshBookings,
    }),
    [
      bookings,
      todayBookings,
      pendingBookings,
      stats,
      isLoading,
      createBooking,
      createWalkinBooking,
      updateBooking,
      updateBookingStatus,
      deleteBooking,
      refreshBookings,
    ]
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

export function useBookingContext(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBookingContext must be used within a BookingProvider');
  }
  return context;
}
