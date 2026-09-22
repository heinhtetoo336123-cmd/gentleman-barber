import { BookingStatus, NotificationItem } from '../types';

export function getBurmeseStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending':
      return '⏳ အတည်ပြုရန် စောင့်ဆိုင်းဆဲ (Pending)';
    case 'confirmed':
      return '✅ အတည်ပြုပြီး (Confirmed)';
    case 'in-progress':
      return '✂️ ဆံပင်ညှပ်နေဆဲ (In Chair)';
    case 'completed':
      return '🎉 ပြီးစီးပါပြီ (Completed)';
    case 'cancelled':
      return '❌ ပယ်ဖျက်လိုက်သည် (Cancelled)';
    default:
      return status;
  }
}

export function formatHistoryLogBurmese(note?: string, status?: BookingStatus): string {
  if (!note) {
    return status ? getBurmeseStatusLabel(status) : 'အခြေအနေ ပြောင်းလဲခဲ့သည်';
  }

  // Handle Rescheduled log
  if (note.toLowerCase().includes('rescheduled')) {
    const timeMatch = note.match(/to\s+([0-9\-]+)\s*@?\s*([0-9:]+)?/i);
    if (timeMatch) {
      const d = timeMatch[1] || '';
      const t = timeMatch[2] || '';
      return `📅 အက်ဒမင်မှ ရက်စွဲ/အချိန် ပြောင်းလဲလိုက်ပါသည် - ${d} ${t} (Rescheduled)`;
    }
    return `📅 အက်ဒမင်မှ ရက်စွဲနှင့် အချိန် ပြောင်းလဲပြင်ဆင်ထားပါသည် (Rescheduled)`;
  }

  // Handle Approved/Confirmed log
  if (note.toLowerCase().includes('approved') || note.toLowerCase().includes('confirmed')) {
    return `✅ အက်ဒမင်မှ ဘိုကင် အတည်ပြုပေးလိုက်ပါသည် (${note})`;
  }

  // Handle Rejected/Cancelled
  if (note.toLowerCase().includes('rejected') || note.toLowerCase().includes('cancelled')) {
    return `❌ ဘိုကင် ပယ်ဖျက်လိုက်ပါသည် (${note})`;
  }

  // Handle Finished/Completed
  if (note.toLowerCase().includes('finished') || note.toLowerCase().includes('completed')) {
    return `🎉 ဆန်းသစ်လှပသော ဆံပင်ဒီဇိုင်း ဝန်ဆောင်မှု ပြီးစီးပါပြီ`;
  }

  // Handle Started
  if (note.toLowerCase().includes('chair') || note.toLowerCase().includes('start')) {
    return `✂️ ဆံပင်စတင် ညှပ်ပေးနေပါပြီ`;
  }

  return note;
}

export function formatNotificationTitleBurmese(type: NotificationItem['type'], bookingCode?: string): string {
  switch (type) {
    case 'new_booking':
      return `🔔 ဘိုကင်အသစ် တင်သွင်းလာပါသည် (${bookingCode || ''})`;
    case 'status_change':
      return `📢 ဘိုကင် အခြေအနေ အကြောင်းပြန်ချက် (${bookingCode || ''})`;
    case 'reschedule':
      return `📅 အချိန်ရွှေ့ဆိုင်းမှု အကြောင်းကြားစာ (${bookingCode || ''})`;
    case 'cancellation':
      return `❌ ဘိုကင် ပယ်ဖျက်မှု အကြောင်းကြားစာ (${bookingCode || ''})`;
    default:
      return `🔔 အသိပေးချက် (${bookingCode || ''})`;
  }
}
