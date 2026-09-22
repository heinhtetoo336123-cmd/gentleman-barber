/**
 * Export Helper Utilities for Excel, CSV and Printable Reports
 * Includes UTF-8 BOM (\uFEFF) for 100% flawless Burmese & English font encoding in MS Excel
 */

import { Booking, Designer, Service, UserProfile, AuditLog, ShopExpense, RetailSale } from '../types';
import { formatPrice } from './formatters';
import { normalizePhoneNumber, phonesMatch } from './notifications';

/**
 * Clean string for safe CSV / Excel cell value
 * Formats phone numbers starting with '0' as ="09..." so Excel does NOT strip leading zeros
 */
function escapeCsvCell(val: any, isPhone = false): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
  
  // If explicitly phone column and starts with '0', format as formula string ="09..." for MS Excel
  if (isPhone && str.startsWith('0') && /^[0-9\s\-\+]+$/.test(str)) {
    return `="${str}"`;
  }

  // If value contains quotes, commas, or semicolons, escape quotes and wrap in quotes
  if (str.includes('"') || str.includes(',') || str.includes(';') || str.includes('\t') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  } else {
    str = `"${str}"`;
  }
  return str;
}

/**
 * Generic CSV downloader with UTF-8 BOM (\uFEFF)
 */
export function downloadCsvFile(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  filename: string,
  phoneColIndices: number[] = []
) {
  const headerRow = headers.map((h) => escapeCsvCell(h, false)).join(',');
  const dataRows = rows.map((row) =>
    row
      .map((cell, colIdx) => escapeCsvCell(cell, phoneColIndices.includes(colIdx)))
      .join(',')
  );
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 1. Export Bookings Master Dataset to CSV / Excel
 */
export function exportBookingsToCsv(bookings: Booking[], filenamePrefix = 'Gentleman_Bookings_Master') {
  const headers = [
    'Booking Code (ဘိုကင်ကုဒ်)',
    'Client Name (ဧည့်သည်အမည်)',
    'Phone (ဖုန်းနံပါတ်)',
    'Email (အီးမေးလ်)',
    'Service Name (ဝန်ဆောင်မှု)',
    'Service Price MMK (ဈေးနှုန်း)',
    'Discount MMK (လျှော့ဈေး)',
    'Final Paid MMK (ကျသင့်ငွေ)',
    'Stylist / Barber (ဆံသဆရာ)',
    'Date (ရက်စွဲ)',
    'Time Slot (အချိန်)',
    'Status (အခြေအနေ)',
    'Payment Method (ငွေပေးချေနည်း)',
    'Payment Status (ငွေလက်ခံမှု)',
    'Transaction ID (လွှဲငွေ Txn ID)',
    'Walk-in (Walk-in ဟုတ်/မဟုတ်)',
    'Client Notes (ဧည့်သည်မှတ်ချက်)',
    'Admin Reply (ဆိုင်ဘက်မှ စာပြန်ချက်)',
    'Barber Notes (Barber မှတ်ချက်)',
    'Star Rating (ကြယ်ပွင့်)',
    'Review Feedback (သုံးသပ်ချက်)',
    'Created At (စာရင်းသွင်းချိန်)',
  ];

  const rows = bookings.map((b) => {
    const finalPaid = Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0));
    return [
      b.bookingCode || b.id,
      b.customerName || 'Guest',
      b.customerPhone || '-',
      b.customerEmail || '-',
      b.serviceName || '-',
      b.servicePrice || 0,
      b.discountAmount || 0,
      finalPaid,
      b.designerName || '-',
      b.date || '-',
      b.timeSlot || '-',
      b.status || 'pending',
      b.paymentMethod || 'cash',
      b.paymentStatus || 'unpaid',
      b.paymentTxnId || '-',
      b.isWalkin ? 'Yes (Walk-in)' : 'No (Online)',
      b.notes || '',
      b.adminReply || '',
      b.completionNote || '',
      b.rating ? `${b.rating} / 5` : '-',
      b.reviewNote || '',
      b.createdAt || '',
    ];
  });

  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsvFile(headers, rows, `${filenamePrefix}_${timestamp}.csv`, [2]);
}

/**
 * 2. Export Clients Directory to CSV / Excel
 * Accurately merges all registered client profiles with booking history records
 */
export function exportClientsToCsv(
  clientsInput: UserProfile[] = [],
  bookings: Booking[] = [],
  filenamePrefix = 'Gentleman_Clients_Directory'
) {
  const headers = [
    'Client ID (ကုဒ်)',
    'Client Name (အမည်)',
    'Phone Number (ဖုန်းနံပါတ်)',
    'Email (အီးမေးလ်)',
    'Account Type (အကောင့်အမျိုးအစား)',
    'Member Tier (VIP အဆင့်)',
    'Royalty Points (စုဆောင်းရမှတ်)',
    'Total Completed Visits (စုစုပေါင်း လာရောက်မှု)',
    'Total Lifetime Spend MMK (စုစုပေါင်း သုံးစွဲငွေ ကျပ်)',
    'Preferred Barber (စိတ်ကြိုက် ဆံသဆရာ)',
    'Last Visit Date (နောက်ဆုံးရက်စွဲ)',
    'Joined / Register Date (စတင်ရက်စွဲ)',
    'Status (အခြေအနေ)',
    'Notes (မှတ်ချက် / အထူးသတိပြုရန်)',
  ];

  // 1. Gather all registered client profiles from input + local cache fallback
  const allRegisteredClients: UserProfile[] = [...(clientsInput || [])];
  
  try {
    const cachedClientsStr = localStorage.getItem('babashop_clients_v2');
    if (cachedClientsStr) {
      const parsed: UserProfile[] = JSON.parse(cachedClientsStr);
      if (Array.isArray(parsed)) {
        parsed.forEach((pc) => {
          if (pc && pc.id && !allRegisteredClients.some((c) => c.id === pc.id || phonesMatch(c.phone, pc.phone))) {
            allRegisteredClients.push(pc);
          }
        });
      }
    }
  } catch {}

  try {
    const savedActiveUserStr = localStorage.getItem('baba_user_profile_v1');
    if (savedActiveUserStr) {
      const activeUser: UserProfile = JSON.parse(savedActiveUserStr);
      if (activeUser && activeUser.phone) {
        if (!allRegisteredClients.some((c) => phonesMatch(c.phone, activeUser.phone))) {
          allRegisteredClients.push(activeUser);
        }
      }
    }
  } catch {}

  interface MergedClientRecord {
    id: string;
    name: string;
    phone: string;
    email: string;
    isRegistered: boolean;
    memberTier: string;
    points: number;
    preferredBarberName: string;
    joinedDate: string;
    active: boolean;
    kicked: boolean;
    notes: string;
  }

  const clientMap = new Map<string, MergedClientRecord>();

  // 2. Add all registered client accounts first
  allRegisteredClients.forEach((c) => {
    const normPhone = normalizePhoneNumber(c.phone);
    const key = normPhone || c.id || (c.name || '').trim().toLowerCase();
    if (!key) return;

    const calcTier =
      c.memberTier ||
      (c.points >= 2000 ? 'VIP' : c.points >= 1000 ? 'Gold' : c.points >= 500 ? 'Silver' : 'Bronze');

    clientMap.set(key, {
      id: c.id || `client-${key}`,
      name: (c.name || 'Client').trim(),
      phone: c.phone || (normPhone ? normPhone : '-'),
      email: c.email || '-',
      isRegistered: true,
      memberTier: calcTier,
      points: c.points || 0,
      preferredBarberName: c.preferredBarberName || '-',
      joinedDate: c.joinedDate || '-',
      active: c.active !== false,
      kicked: c.kicked === true,
      notes: c.notes || 'Registered App Account',
    });
  });

  // 3. Merge walk-in & booking clients who don't have separate registered profile accounts yet
  (bookings || []).forEach((b) => {
    const normPhone = normalizePhoneNumber(b.customerPhone);
    const bName = (b.customerName || '').trim();
    
    // Find if already present in map by phone or existing key
    let matchedKey: string | null = null;
    if (normPhone && clientMap.has(normPhone)) {
      matchedKey = normPhone;
    } else {
      // Check via phone matching against all existing map entries
      for (const [k, v] of clientMap.entries()) {
        if (normPhone && v.phone && phonesMatch(v.phone, b.customerPhone)) {
          matchedKey = k;
          break;
        }
      }
    }

    if (!matchedKey) {
      // Create new record for walk-in / guest booking client
      const newKey = normPhone || (bName && !['guest', 'client', 'walk-in', 'walkin', 'user'].includes(bName.toLowerCase()) ? `name-${bName.toLowerCase()}` : `bk-${b.id}`);
      
      if (!clientMap.has(newKey)) {
        clientMap.set(newKey, {
          id: (b as any).customerId || (b as any).userId || `client-walkin-${newKey}`,
          name: bName || 'Walk-in Guest',
          phone: b.customerPhone || '-',
          email: b.customerEmail || '-',
          isRegistered: false,
          memberTier: 'Bronze',
          points: 0,
          preferredBarberName: b.designerName || '-',
          joinedDate: b.date || '-',
          active: true,
          kicked: false,
          notes: b.isWalkin ? 'Walk-in Customer' : 'Online Booking Guest',
        });
      }
    }
  });

  const mergedList = Array.from(clientMap.values());

  // 4. Calculate total visits, total spend, last visit date, and preferred barber for each client
  const rows = mergedList.map((c) => {
    const clientBookings = (bookings || []).filter((b) => {
      // Priority 1: Phone match
      if (c.phone && c.phone !== '-' && b.customerPhone && b.customerPhone !== '-') {
        if (phonesMatch(c.phone, b.customerPhone)) return true;
      }
      // Priority 2: Customer ID match
      if (c.id && ((b as any).customerId === c.id || (b as any).userId === c.id)) {
        return true;
      }
      // Priority 3: Non-generic exact name match if phone was absent
      const cName = c.name.trim().toLowerCase();
      const bName = (b.customerName || '').trim().toLowerCase();
      if (
        cName &&
        bName &&
        cName === bName &&
        !['guest', 'client', 'walk-in', 'walkin', 'user'].includes(cName)
      ) {
        return true;
      }
      return false;
    });

    const completedBookings = clientBookings.filter(
      (b) => b.status === 'completed'
    );
    const completedCount = completedBookings.length;
    const totalSpend = completedBookings.reduce(
      (sum, b) => sum + Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0)),
      0
    );

    // Find most recent visit date
    const sortedDates = clientBookings
      .map((b) => b.date)
      .filter(Boolean)
      .sort((a, b) => (b || '').localeCompare(a || ''));
    const lastVisitDate = sortedDates.length > 0 ? sortedDates[0] : '-';

    // Find preferred barber (if not set in profile, use most frequently booked barber)
    let preferredBarber = c.preferredBarberName !== '-' ? c.preferredBarberName : '';
    if (!preferredBarber && clientBookings.length > 0) {
      const barberCounts: Record<string, number> = {};
      clientBookings.forEach((b) => {
        if (b.designerName) {
          barberCounts[b.designerName] = (barberCounts[b.designerName] || 0) + 1;
        }
      });
      const topBarber = Object.entries(barberCounts).sort((a, b) => b[1] - a[1])[0];
      if (topBarber) preferredBarber = topBarber[0];
    }
    if (!preferredBarber) preferredBarber = '-';

    const accountTypeLabel = c.isRegistered
      ? '📱 Registered Account (အကောင့်ဖွင့်ထားသူ)'
      : '📝 Walk-in / Guest Booking (ဧည့်သည်)';

    const statusLabel = c.kicked
      ? 'Kicked / Blocked (ပိတ်ထားသည်)'
      : c.active !== false
      ? 'Active (ပုံမှန်)'
      : 'Inactive (ရပ်နားထားသည်)';

    return [
      c.id,
      c.name,
      c.phone,
      c.email,
      accountTypeLabel,
      c.memberTier,
      c.points,
      completedCount,
      totalSpend,
      preferredBarber,
      lastVisitDate,
      c.joinedDate,
      statusLabel,
      c.notes,
    ];
  });

  const timestamp = new Date().toISOString().split('T')[0];
  // Column 2 is Phone Number
  downloadCsvFile(headers, rows, `${filenamePrefix}_${timestamp}.csv`, [2]);
}

/**
 * 3. Export Barbers Performance & Commission Ledger to CSV / Excel
 */
export function exportBarbersToCsv(designers: Designer[], bookings: Booking[], filenamePrefix = 'Gentleman_Barbers_Ledger') {
  const headers = [
    'Barber ID',
    'Stylist Name (အမည်)',
    'Title (ရာထူး)',
    'Phone (ဖုန်းနံပါတ်)',
    'Commission % (ကော်မရှင် ရာခိုင်နှုန်း)',
    'Total Completed Cuts (ပြီးမြောက်သည့် ဝန်ဆောင်မှု)',
    'Walk-in Cuts (Walk-in ဦးရေ)',
    'Gross Revenue Generated MMK (ရှာဖွေပေးငွေ)',
    'Total Commission Earned MMK (ရရှိသည့် ကော်မရှင်)',
    'Shop Net Revenue MMK (ဆိုင်ကျန်ငွေ)',
    'Average Customer Rating (ကြယ်ပွင့် ပျမ်းမျှ)',
    'Status (အကောင့် အခြေအနေ)',
  ];

  const rows = designers.map((d) => {
    const dBookings = bookings.filter((b) => b.designerId === d.id);
    const completedBookings = dBookings.filter((b) => b.status === 'completed');
    const walkinCount = completedBookings.filter((b) => b.isWalkin).length;
    const grossRev = completedBookings.reduce(
      (sum, b) => sum + Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0)),
      0
    );
    const commPercent = d.commissionPercent !== undefined ? d.commissionPercent : 50;
    const commEarned = Math.round((grossRev * commPercent) / 100);
    const shopNet = grossRev - commEarned;

    // Average rating
    const ratedBookings = dBookings.filter((b) => b.rating && b.rating > 0);
    const avgRating =
      ratedBookings.length > 0
        ? (ratedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / ratedBookings.length).toFixed(1)
        : (d.rating || 4.9).toFixed(1);

    return [
      d.id,
      d.name,
      d.title || 'Master Stylist',
      d.phone || '-',
      `${commPercent}%`,
      completedBookings.length,
      walkinCount,
      grossRev,
      commEarned,
      shopNet,
      `${avgRating} / 5`,
      d.active !== false ? 'Active' : 'Disabled',
    ];
  });

  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsvFile(headers, rows, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * 4. Export Monthly Financial Statement to CSV / Excel
 */
export function exportMonthlyStatementToCsv(
  yearMonth: string, // "YYYY-MM"
  bookings: Booking[],
  designers: Designer[],
  filenamePrefix = 'Gentleman_Monthly_Statement'
) {
  const monthBookings = bookings.filter((b) => (b.date || '').startsWith(yearMonth) && b.status !== 'cancelled');

  const headers = [
    'Date (ရက်စွဲ)',
    'Day (နေ့)',
    'Appointments Count (ဘိုကင် ဦးရေ)',
    'Completed Count (ပြီးမြောက် ဦးရေ)',
    'Cash Revenue MMK (ငွေသား)',
    'KBZPay Revenue MMK (KPay)',
    'WavePay Revenue MMK (WavePay)',
    'Gross Revenue MMK (စုစုပေါင်း ဝင်ငွေ)',
    'Barber Commission MMK (ကော်မရှင် ပေးချေငွေ)',
    'Shop Net Profit MMK (ဆိုင် အသားတင် ကျန်ငွေ)',
  ];

  // Group by date
  const dateMap: Record<string, Booking[]> = {};
  monthBookings.forEach((b) => {
    if (!dateMap[b.date]) dateMap[b.date] = [];
    dateMap[b.date].push(b);
  });

  const sortedDates = Object.keys(dateMap).sort();
  const rows = sortedDates.map((dateStr) => {
    const dayBookings = dateMap[dateStr];
    const completed = dayBookings.filter((b) => b.status === 'completed');
    
    let cash = 0;
    let kpay = 0;
    let wave = 0;
    let gross = 0;
    let commTotal = 0;

    completed.forEach((b) => {
      const netVal = Math.max(0, (b.servicePrice || 0) - (b.discountAmount || 0));
      gross += netVal;

      if (b.paymentMethod === 'cash' || b.paymentMethod === 'pay_at_shop') {
        cash += netVal;
      } else if (b.paymentMethod === 'kpay') {
        kpay += netVal;
      } else if (b.paymentMethod === 'wave') {
        wave += netVal;
      } else {
        kpay += netVal; // digital fallback
      }

      // Barber commission
      const des = designers.find((d) => d.id === b.designerId);
      const cRate = des?.commissionPercent !== undefined ? des.commissionPercent : 50;
      commTotal += Math.round((netVal * cRate) / 100);
    });

    const dObj = new Date(dateStr);
    const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });

    return [
      dateStr,
      dayName,
      dayBookings.length,
      completed.length,
      cash,
      kpay,
      wave,
      gross,
      commTotal,
      gross - commTotal,
    ];
  });

  downloadCsvFile(headers, rows, `${filenamePrefix}_${yearMonth}.csv`);
}

/**
 * 5. Export Audit Logs Dataset to CSV / Excel
 */
export function exportAuditLogsToCsv(logs: AuditLog[], filenamePrefix = 'Gentleman_Audit_Logs') {
  const headers = [
    'Log ID',
    'Timestamp (အချိန်)',
    'Actor Name (လုပ်ဆောင်သူ)',
    'Actor Role (ရာထူး / Role)',
    'Action (လုပ်ဆောင်ချက်)',
    'Action Type (အမျိုးအစား)',
    'Details (အသေးစိတ် အချက်အလက်)',
  ];

  const rows = logs.map((l) => [
    l.id,
    l.timestamp,
    l.adminName || 'System',
    (l as any).actorRole || 'admin',
    l.action || '-',
    (l as any).actionType || 'system',
    l.details || '',
  ]);

  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsvFile(headers, rows, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * 6. Export Shop Expenses to CSV / Excel
 */
export function exportExpensesToCsv(expenses: ShopExpense[], filenamePrefix = 'Gentleman_Expenses_Ledger') {
  const headers = [
    'Expense ID',
    'Date (ရက်စွဲ)',
    'Title (အသုံးစရိတ် ခေါင်းစဉ်)',
    'Category (အမျိုးအစား)',
    'Amount MMK (ကျသင့်ငွေ)',
    'Notes (မှတ်ချက်)',
    'Recorded By (စာရင်းသွင်းသူ)',
    'Created At'
  ];

  const rows = expenses.map(e => [
    e.id,
    e.date,
    e.title,
    e.category || 'General',
    e.amount || 0,
    e.notes || '-',
    e.recordedBy || 'Admin',
    e.createdAt || '-'
  ]);

  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsvFile(headers, rows, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * 7. Export Retail Product Sales to CSV / Excel
 */
export function exportRetailSalesToCsv(sales: RetailSale[], filenamePrefix = 'Gentleman_Retail_Sales_Ledger') {
  const headers = [
    'Sale ID',
    'Date (ရက်စွဲ)',
    'Product Name (ပစ္စည်းအမည်)',
    'Quantity (အရေအတွက်)',
    'Unit Price MMK (နှုန်းထား)',
    'Total Price MMK (စုစုပေါင်းရောင်းရငွေ)',
    'Barber Sold (ရောင်းချသူ Barber)',
    'Barber Commission MMK (Barber ကော်မရှင်)',
    'Payment Method (ငွေပေးချေမှု)',
    'Customer Name (ဝယ်ယူသူ)',
    'Customer Phone (ဖုန်း)',
    'Notes (မှတ်ချက်)',
    'Created At'
  ];

  const rows = sales.map(s => [
    s.id,
    s.date,
    s.productName,
    s.quantity || 1,
    s.unitPrice || 0,
    s.totalPrice || 0,
    s.barberName || 'Shop Counter',
    s.barberCommissionAmount || 0,
    s.paymentMethod || 'cash',
    s.customerName || '-',
    s.customerPhone || '-',
    s.notes || '-',
    s.createdAt || '-'
  ]);

  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsvFile(headers, rows, `${filenamePrefix}_${timestamp}.csv`, [10]);
}

/**
 * 8. Export Complete Master Pack (All Collections in 1 JSON bundle)
 */
export function exportMasterJsonBackup(
  services: Service[],
  designers: Designer[],
  bookings: Booking[],
  clients: UserProfile[],
  auditLogs: AuditLog[],
  settings?: any,
  expenses?: ShopExpense[],
  retailSales?: RetailSale[]
) {
  const masterData = {
    exportDate: new Date().toISOString(),
    system: 'GENTLEMAN Barber & Grooming Lounge',
    version: '2.5.0',
    totalRecords: {
      services: services.length,
      designers: designers.length,
      bookings: bookings.length,
      clients: clients.length,
      auditLogs: auditLogs.length,
      expenses: expenses?.length || 0,
      retailSales: retailSales?.length || 0,
    },
    services,
    designers,
    bookings,
    clients,
    auditLogs,
    expenses: expenses || [],
    retailSales: retailSales || [],
    settings,
  };

  const jsonStr = JSON.stringify(masterData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `Gentleman_Master_Backup_${timestamp}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

