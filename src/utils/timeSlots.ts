/**
 * Time Slot Utilities for Dynamic Booking Calculations
 * Ensures that for the current date (today), passed time slots are disabled in real-time.
 */

export const TIME_SLOTS_12H: string[] = [
  '09:00 AM',
  '09:45 AM',
  '10:30 AM',
  '11:15 AM',
  '12:00 PM',
  '01:30 PM',
  '02:15 PM',
  '03:00 PM',
  '03:45 PM',
  '04:30 PM',
  '05:15 PM',
  '06:00 PM',
  '06:45 PM',
  '07:30 PM'
];

/**
 * Returns a date formatted in local YYYY-MM-DD format (avoids UTC timezone shift issues).
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's local date string in YYYY-MM-DD format based on local client clock.
 */
export function getLocalTodayStr(): string {
  return formatLocalDate(new Date());
}

/**
 * Converts a 12-hour formatted time string (e.g. "09:00 AM", "12:00 PM", "01:30 PM")
 * into the total number of minutes from midnight (0 to 1439).
 */
export function parse12HourToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

/**
 * Checks if a specific 12-hour time slot on a given date (YYYY-MM-DD) is in the past.
 * 
 * - If `dateStr < todayStr`: all slots have passed.
 * - If `dateStr > todayStr`: no slots have passed (future date).
 * - If `dateStr === todayStr`: checks if slot time <= current local time.
 * 
 * @param timeSlot12h 12-hour formatted time string (e.g., '09:00 AM', '12:00 PM')
 * @param dateStr ISO date string 'YYYY-MM-DD'
 * @param bufferMinutes Optional buffer in minutes (e.g. 0 to 5)
 */
export function isTimeSlotPassed(
  timeSlot12h: string,
  dateStr: string,
  bufferMinutes: number = 0
): boolean {
  if (!timeSlot12h || !dateStr) return false;
  const todayStr = getLocalTodayStr();

  if (dateStr < todayStr) {
    return true;
  }
  if (dateStr > todayStr) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = parse12HourToMinutes(timeSlot12h);

  return slotMinutes <= (currentMinutes + bufferMinutes);
}

/**
 * Finds the first valid, selectable time slot for a given date that has not passed
 * and is not in the locked/already booked list.
 */
export function getFirstAvailableTimeSlot(
  slots: string[] = TIME_SLOTS_12H,
  dateStr: string,
  lockedSlots: string[] = []
): string | null {
  for (const slot of slots) {
    if (!isTimeSlotPassed(slot, dateStr) && !lockedSlots.includes(slot)) {
      return slot;
    }
  }
  return null;
}

/**
 * Returns current local time in 12-hour format (e.g. "03:25 PM").
 */
export function getCurrentTime12H(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

/**
 * Returns current local time in 24-hour format (e.g. "15:25").
 */
export function getCurrentTime24H(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Converts 24-hour time "HH:MM" to 12-hour format "hh:mm AM/PM".
 */
export function formatTime24to12(hhmm: string): string {
  if (!hhmm) return '';
  const parts = hhmm.trim().split(':');
  if (parts.length < 2) return hhmm;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Converts 12-hour time "hh:mm AM/PM" to 24-hour format "HH:MM".
 */
export function formatTime12to24(time12: string): string {
  if (!time12) return '';
  const match = time12.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = (match[3] || 'AM').toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

/**
 * Checks whether all time slots for a given date have passed or are locked.
 */
export function areAllSlotsUnavailable(
  slots: string[] = TIME_SLOTS_12H,
  dateStr: string,
  lockedSlots: string[] = []
): boolean {
  return slots.every((slot) => isTimeSlotPassed(slot, dateStr) || lockedSlots.includes(slot));
}

