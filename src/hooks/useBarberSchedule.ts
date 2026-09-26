import { useState, useEffect, useMemo, useCallback } from 'react';
import { Booking, BookingStatus } from '../types';
import { api } from '../api/client';

export interface UseBarberScheduleReturn {
  allBarberBookings: Booking[];
  todayBookings: Booking[];
  activeQueue: Booking[]; // In-progress / Pending / Confirmed for today
  completedToday: Booking[];
  todayEarnings: number;
  todayCommission: number;
  isLoading: boolean;
  toggleStatus: (bookingId: string, newStatus: BookingStatus, note?: string) => Promise<Booking>;
  startService: (bookingId: string) => Promise<Booking>;
  completeService: (bookingId: string, note?: string) => Promise<Booking>;
}

/**
 * Custom Hook: useBarberSchedule
 * Barber/Stylist scoped queue & commission computation strictly calculated in memory from the shared cache.
 * Executes 0 redundant Firestore network reads.
 */
export function useBarberSchedule(barberId: string, selectedDate?: string): UseBarberScheduleReturn {
  const [bookings, setBookings] = useState<Booking[]>(() => api.getCachedBookings());
  const [isLoading, setIsLoading] = useState<boolean>(bookings.length === 0);

  useEffect(() => {
    if (!barberId) return;

    // Use shared singleton subscription - 0ms memory hydration, zero extra full-collection sweep
    const unsubscribe = api.subscribeToBookings((updatedBookings) => {
      setBookings(updatedBookings);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [barberId]);

  // Target date string YYYY-MM-DD
  const targetDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, [selectedDate]);

  // Filter all bookings assigned to this barber in memory
  const allBarberBookings = useMemo(() => {
    if (!barberId) return [];
    return bookings.filter(b => b.designerId === barberId || (b as any).walkinBarberId === barberId);
  }, [bookings, barberId]);

  // Today's appointments for this barber
  const todayBookings = useMemo(() => {
    return allBarberBookings.filter(b => b.date === targetDate);
  }, [allBarberBookings, targetDate]);

  // Active in-progress/waiting queue
  const activeQueue = useMemo(() => {
    return todayBookings.filter(b => b.status === 'in-progress' || b.status === 'confirmed' || b.status === 'pending');
  }, [todayBookings]);

  // Completed today
  const completedToday = useMemo(() => {
    return todayBookings.filter(b => b.status === 'completed');
  }, [todayBookings]);

  // Financial calculations computed 100% in-memory
  const todayEarnings = useMemo(() => {
    return completedToday.reduce((sum, b) => sum + (b.price || b.servicePrice || (b as any).totalPrice || 0), 0);
  }, [completedToday]);

  const todayCommission = useMemo(() => {
    return completedToday.reduce((sum, b) => {
      if (b.commissionAmount !== undefined && b.commissionAmount !== null) {
        return sum + b.commissionAmount;
      }
      const total = b.price || b.servicePrice || (b as any).totalPrice || 0;
      return sum + Math.round(total * 0.5); // Default 50% commission if unspecified
    }, 0);
  }, [completedToday]);

  // Optimistic single-doc mutations
  const toggleStatus = useCallback(async (bookingId: string, newStatus: BookingStatus, note?: string) => {
    return await api.updateBookingStatus(bookingId, newStatus, note);
  }, []);

  const startService = useCallback(async (bookingId: string) => {
    return await api.updateBookingStatus(bookingId, 'in-progress', 'Service started in chair');
  }, []);

  const completeService = useCallback(async (bookingId: string, note?: string) => {
    return await api.updateBookingStatus(bookingId, 'completed', note || 'Service successfully completed');
  }, []);

  return {
    allBarberBookings,
    todayBookings,
    activeQueue,
    completedToday,
    todayEarnings,
    todayCommission,
    isLoading,
    toggleStatus,
    startService,
    completeService,
  };
}
