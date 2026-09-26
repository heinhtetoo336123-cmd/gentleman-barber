/**
 * Format price in Myanmar Kyats (ကျပ်)
 */
export function formatPrice(price: number | string): string {
  const num = Number(price) || 0;
  return `${num.toLocaleString('en-US')} ကျပ်`;
}

/**
 * Format time string into 12-hour AM/PM format (e.g. "14:30" -> "02:30 PM", "09:00" -> "09:00 AM")
 */
export function formatTo12Hour(timeStr: string): string {
  if (!timeStr) return '';
  // If already in 12-hour format with AM/PM, return normalized
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    return timeStr.trim();
  }

  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;

  let hour = parseInt(parts[0], 10);
  const minute = parts[1].padStart(2, '0');

  if (isNaN(hour)) return timeStr;

  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
}

/**
 * Parse 12-hour time back into 24-hour HH:MM format if needed
 */
export function parseTo24Hour(time12Str: string): string {
  if (!time12Str) return '';
  if (!time12Str.includes('AM') && !time12Str.includes('PM')) {
    return time12Str.trim();
  }

  const isPM = time12Str.toUpperCase().includes('PM');
  const isAM = time12Str.toUpperCase().includes('AM');
  const cleanTime = time12Str.replace(/(AM|PM)/gi, '').trim();
  const [hStr, mStr] = cleanTime.split(':');

  let hour = parseInt(hStr, 10);
  const minute = (mStr || '00').padStart(2, '0');

  if (isNaN(hour)) return time12Str;

  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, '0')}:${minute}`;
}

/**
 * Calculates dynamic Barber Rating based on:
 * Default 5.0 Stars + 50% weighted blend with customer ratings.
 * Formula: If customer ratings exist: (5.0 * 0.5) + (Average Customer Rating * 0.5) = (5.0 + AvgCustomerRating) / 2
 * If no customer ratings yet: Default 5.0 Stars.
 */
export function calculateBarberRating(
  designer: { id: string; rating?: number; reviewsCount?: number },
  bookings?: { designerId: string; rating?: number }[]
): { rating: number; reviewsCount: number; ratingDisplay: string } {
  if (!bookings || bookings.length === 0) {
    const directRating = designer.rating ?? 5.0;
    const count = designer.reviewsCount ?? 0;
    return {
      rating: Number(directRating.toFixed(1)),
      reviewsCount: count,
      ratingDisplay: directRating.toFixed(1),
    };
  }

  const ratedBookings = bookings.filter(
    (b) => b.designerId === designer.id && typeof b.rating === 'number' && b.rating > 0
  );

  if (ratedBookings.length === 0) {
    const directRating = designer.rating ?? 5.0;
    return {
      rating: Number(directRating.toFixed(1)),
      reviewsCount: 0,
      ratingDisplay: directRating.toFixed(1),
    };
  }

  const sum = ratedBookings.reduce((acc, curr) => acc + (curr.rating || 5), 0);
  const avgCustomer = sum / ratedBookings.length;
  // Blend 50% default 5.0 with 50% real customer reviews
  const blendedRating = (5.0 + avgCustomer) / 2;
  const rounded = Number(blendedRating.toFixed(1));

  return {
    rating: rounded,
    reviewsCount: ratedBookings.length,
    ratingDisplay: rounded.toFixed(1),
  };
}

/**
 * Restricts rating submissions & modifications to within 12 hours of the booking completion or time.
 */
export function isRatingWithin12Hours(booking: {
  date?: string;
  timeSlot?: string;
  updatedAt?: string;
  createdAt?: string;
  status?: string;
}): { eligible: boolean; hoursRemaining: number; reason?: string } {
  try {
    let targetTimeMs = 0;
    if (booking.updatedAt) {
      targetTimeMs = new Date(booking.updatedAt).getTime();
    } else if (booking.date) {
      const slot = (booking.timeSlot || '12:00').split(' - ')[0].trim();
      const [h = '12', m = '00'] = slot.split(':');
      const d = new Date(`${booking.date}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`);
      targetTimeMs = isNaN(d.getTime()) ? Date.now() : d.getTime();
    } else {
      targetTimeMs = Date.now();
    }

    const elapsedMs = Date.now() - targetTimeMs;
    const twelveHoursMs = 12 * 60 * 60 * 1000;

    if (elapsedMs > twelveHoursMs) {
      return {
        eligible: false,
        hoursRemaining: 0,
        reason: 'ဝန်ဆောင်မှုပြီးစီးပြီး ၁၂ နာရီ ကျော်လွန်သွားသဖြင့် Rating ပေးရန် အချိန်ကုန်ဆုံးသွားပါပြီ (Rating window expired after 12 hours)',
      };
    }

    const remainingMs = Math.max(0, twelveHoursMs - elapsedMs);
    const hoursRemaining = Math.max(0, Number((remainingMs / (60 * 60 * 1000)).toFixed(1)));

    return {
      eligible: true,
      hoursRemaining,
    };
  } catch (err) {
    return { eligible: true, hoursRemaining: 12 };
  }
}

/**
 * Helper to parse timeSlot string (e.g. "14:30", "02:30 PM", "9:00 AM", "09:00 - 10:00") into minutes from midnight (0 - 1439).
 */
export function parseTimeSlotToMinutes(slotStr: string | undefined): number {
  if (!slotStr) return 0;
  try {
    const cleanSlot = slotStr.split('-')[0].trim();
    const isPM = /pm/i.test(cleanSlot);
    const isAM = /am/i.test(cleanSlot);
    const digitsOnly = cleanSlot.replace(/(am|pm)/gi, '').trim();
    const parts = digitsOnly.split(':');
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + m;
    }
  } catch {}
  return 0;
}

/**
 * Sorts bookings with primary focus on appointment timeline (most recent first):
 * 1. Appointment Date (YYYY-MM-DD) descending (Today and upcoming dates first).
 * 2. Time Slot descending (later time slots of the day first, e.g. 05:00 PM before 02:00 PM before 10:00 AM).
 * 3. Created/Updated timestamps descending (latest registered booking first).
 * 4. Booking Code descending as tie-breaker.
 */
export function sortBookingsMostRecentFirst<T extends { createdAt?: string; updatedAt?: string; date?: string; timeSlot?: string; status?: string; bookingCode?: string; id?: string }>(
  bookings: T[]
): T[] {
  if (!bookings || !Array.isArray(bookings)) return [];

  return [...bookings].sort((a, b) => {
    // 1. Primary: Compare appointment date (YYYY-MM-DD) descending
    const dateA = (a.date || '').replace(/\//g, '-').split('T')[0];
    const dateB = (b.date || '').replace(/\//g, '-').split('T')[0];
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    // 2. Secondary: Compare appointment timeSlot descending (by actual 24-hour minutes)
    const minsA = parseTimeSlotToMinutes(a.timeSlot);
    const minsB = parseTimeSlotToMinutes(b.timeSlot);
    if (minsA !== minsB) {
      return minsB - minsA;
    }

    // 3. Tertiary: Compare createdAt / updatedAt timestamps descending
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
    if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA;
    }

    // 4. Stable tie-breaker: bookingCode / ID descending
    const codeA = a.bookingCode || a.id || '';
    const codeB = b.bookingCode || b.id || '';
    return codeB.localeCompare(codeA);
  });
}

/**
 * Sorts services for display across the client-side UI:
 * 1. Explicit displayOrder configured by admin (1, 2, 3...)
 * 2. Default fallback: Haircut ('Hair Cut') category services first, followed by Shampoo, Colour, Perming, Dreadlock
 * 3. Stable name sorting as tiebreaker.
 */
export function sortServicesForClient<T extends { category?: string; name?: string; displayOrder?: number; id?: string }>(
  services: T[]
): T[] {
  if (!services || !Array.isArray(services)) return [];

  const categoryPriority: Record<string, number> = {
    'hair cut': 1,
    'haircut': 1,
    'shampoo': 2,
    'colour': 3,
    'color': 3,
    'perming': 4,
    'perm': 4,
    'dreadlock': 5,
    'dreadlocks': 5,
  };

  return [...services].sort((a, b) => {
    const hasOrderA = typeof a.displayOrder === 'number' && !isNaN(a.displayOrder) && a.displayOrder > 0;
    const hasOrderB = typeof b.displayOrder === 'number' && !isNaN(b.displayOrder) && b.displayOrder > 0;

    if (hasOrderA && hasOrderB) {
      if (a.displayOrder !== b.displayOrder) {
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      }
    } else if (hasOrderA) {
      return -1;
    } else if (hasOrderB) {
      return 1;
    }

    // Default category fallback: Hair Cut category always first!
    const catA = (a.category || '').toLowerCase().trim();
    const catB = (b.category || '').toLowerCase().trim();

    const prioA = categoryPriority[catA] ?? 20;
    const prioB = categoryPriority[catB] ?? 20;

    if (prioA !== prioB) {
      return prioA - prioB;
    }

    return (a.name || '').localeCompare(b.name || '');
  });
}


