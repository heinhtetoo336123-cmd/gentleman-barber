export type UserRole = 'user' | 'admin' | 'barber' | 'superadmin';

export type BookingStatus = 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'held';

export type MainCategory = 'Hair Cut' | 'Shampoo' | 'Colour' | 'Perming' | 'Dreadlock';

export const MAIN_CATEGORIES: MainCategory[] = [
  'Hair Cut',
  'Shampoo',
  'Colour',
  'Perming',
  'Dreadlock',
];

export interface Service {
  id: string;
  name: string;
  category: MainCategory | string;
  price: number;
  durationMinutes: number;
  description: string;
  imageUrl: string;
  popular?: boolean;
  isRecommended?: boolean;
  recommendBadge?: string; // 'Featured' | '🏆 Best in class' | '🔥 Trending' | '⭐ Top Pick'
  active: boolean;
  pointsEarned?: number;
  displayOrder?: number; // Custom display order set by admin for client side
}

export interface Designer {
  id: string;
  name: string;
  title: string;
  experienceYears: number;
  specialties: string[];
  specialty?: string;
  avatarUrl: string;
  images?: string[];
  bio: string;
  availableDays: string[]; // e.g., ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  workingHours: {
    start: string; // e.g. "09:00"
    end: string;   // e.g. "18:00"
  };
  commissionPercent?: number; // Custom commission percentage, e.g. 50%
  featured?: boolean;
  active?: boolean; // Admin can toggle/disable barber account
  phone?: string; // Barber login phone number (e.g. "09000000000")
  loginPin?: string; // Barber login PIN (e.g. "1234")
  rating?: number;
  reviewsCount?: number;
}

export interface BookingServiceItem {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  category?: string;
}

export interface BookingRetailItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  barberCommissionAmount?: number;
}

export interface Booking {
  id: string;
  bookingCode: string; // e.g., "GTM-8921"
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  price?: number; // Total / final price field compatible with schema
  serviceDuration: number;
  servicesList?: BookingServiceItem[];
  retailItems?: BookingRetailItem[];
  additionalServices?: { name: string; price: number }[];
  designerId: string;
  designerName: string;
  designerAvatar: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string; // "YYYY-MM-DD"
  timeSlot: string; // e.g., "14:30"
  notes?: string;
  adminReply?: string; // Admin's direct response or confirmation note
  completionNote?: string; // Barber's service completion note
  rating?: number; // 1-5 star rating given by customer
  reviewNote?: string; // Review feedback text
  ratedAt?: string; // Timestamp when customer rated
  promoCode?: string;
  status: BookingStatus;
  paymentMethod?: 'pay_at_shop' | 'kpay_wave' | 'cash' | 'kpay' | 'wave';
  paymentTxnId?: string;
  paymentSlipUrl?: string;
  paymentStatus?: 'unpaid' | 'paid_advance' | 'verified';
  discountAmount?: number;
  pointsUsed?: number;
  commissionAmount?: number;
  isWalkin?: boolean;
  holdExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: {
    status: BookingStatus;
    timestamp: string;
    note?: string;
  }[];
}

export type NotificationType =
  | 'new_booking'
  | 'status_change'
  | 'completion'
  | 'cancellation'
  | 'reschedule'
  | 'broadcast'
  | 'promo'
  | 'announcement'
  | 'notice'
  | 'client_registered';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  readAt?: string | number;
  type: NotificationType;
  bookingId?: string;
  designerId?: string;
  designerName?: string;
  forRole: 'admin' | 'user' | 'all' | 'barber' | 'superadmin';
  customerName?: string;
  customerPhone?: string;
  targetClientPhone?: string;
  targetClientId?: string;
  targetMemberTier?: string;
  imageUrl?: string;
}

export interface BranchLocation {
  id: string;
  name: string;
  desc: string;
  address?: string;
  phone?: string;
  active: boolean;
}

export interface PaymentSettings {
  shopName?: string;
  tagline?: string;
  logoUrl?: string; // Custom uploaded shop logo dataURL or URL
  brandPreset?: string;
  kpayAccountName: string;
  kpayNumber: string;
  kpayQrUrl?: string;
  waveAccountName: string;
  waveNumber: string;
  waveQrUrl?: string;
  viberLink: string;
  viberPhone: string;
  shopPhone: string;
  shopAddress: string;
  shopLocations?: BranchLocation[];
  // Shop Schedule & 1-Click Open/Close Control
  isShopOpen?: boolean; // true = Open, false = Closed
  shopClosedReason?: string; // e.g. "ယနေ့ ဆိုင်ခေတ္တ ပိတ်ထားပါသည် / Temporarily Closed"
  openDays?: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  openingTime?: string; // e.g. "09:00"
  closingTime?: string; // e.g. "20:00"
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  photoBonusClaimed?: boolean;
  avatarPointsAwarded?: boolean;
  preferredBarberId?: string;
  preferredBarberName?: string;
  memberTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  points: number;
  joinedDate: string;
  notes?: string;
  customDiscountPercent?: number;
  active?: boolean;
  kicked?: boolean;
  kickedAt?: string;
  lastActiveAt?: string;
}

export type ClientProfile = UserProfile;

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percent' | 'amount';
  discountValue: number;
  minOrderAmount?: number;
  memberTierRequired?: 'All' | 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  maxUses?: number;
  usedCount: number;
  expiryDate?: string;
  active: boolean;
  description?: string;
  pointsCost?: number;
}

export interface AppStats {
  totalBookings: number;
  pendingRequests: number;
  todayBookings: number;
  estimatedRevenue: number;
  activeServicesCount: number;
  activeDesignersCount: number;
}

export interface AuditLog {
  id: string;
  adminName: string;
  actorRole?: 'superadmin' | 'admin' | 'barber' | 'user' | 'system';
  action: string;
  actionType?: 'booking' | 'auth' | 'settings' | 'staff' | 'financial' | 'service' | 'promo' | 'system';
  details: string;
  targetId?: string;
  timestamp: string;
  ipAddress?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Styling Products' | 'Equipment & Blades' | 'Shampoo & Care' | 'Shop Consumables' | 'General';
  stockQuantity: number;
  unit: string; // e.g. 'pcs', 'bottles', 'boxes'
  unitCost: number; // Cost Price in MMK
  retailPrice?: number; // Retail Selling Price if sold
  minThreshold: number; // Low stock alert threshold
  lastRestocked: string;
  supplier?: string;
  monthlyUsageEstimate?: number;
}

export interface ShopExpense {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string; // e.g. "ရေ/မီးဖိုး", "သန့်ရှင်းရေးသုံးပစ္စည်း", "ဝန်ထမ်းနေ့လယ်စာ"
  amount: number; // in MMK
  category?: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ExpensePreset {
  id: string;
  title: string;
  defaultAmount?: number;
  category?: string;
  createdAt?: string;
}

export interface RetailProduct {
  id: string;
  name: string; // e.g. "Pomade (Strong Hold)", "Hair Wax", "Beard Oil"
  price: number; // in MMK
  category?: string;
  inStock?: boolean;
  stockCount?: number;
  barberCommissionPercent?: number; // Optional % if barber sold it
  description?: string;
  createdAt?: string;
}

export interface RetailSale {
  id: string;
  date: string; // "YYYY-MM-DD"
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  barberId?: string;
  barberName?: string;
  barberCommissionAmount?: number;
  paymentMethod?: 'cash' | 'kpay' | 'wave' | 'pay_at_shop';
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: string;
}

