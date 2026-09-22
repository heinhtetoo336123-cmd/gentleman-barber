export type MemberTier = 'Bronze' | 'Silver' | 'Gold' | 'VIP';

export interface TierStyleConfig {
  tier: MemberTier;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBgGradient: string;
  cardBorder: string;
  accentColor: string;
  glowColor: string;
  icon: string; // '🥉' | '🥈' | '🥇' | '👑'
  perks: string[];
}

export const TIER_CONFIGS: Record<MemberTier, TierStyleConfig> = {
  Bronze: {
    tier: 'Bronze',
    label: 'Bronze Member',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-300',
    cardBgGradient: 'from-emerald-50 via-white to-emerald-100/50',
    cardBorder: 'border-emerald-200',
    accentColor: '#059669',
    glowColor: 'rgba(5, 150, 105, 0.1)',
    icon: '🥉',
    perks: ['Standard Booking', 'Earn 5% Points', 'Basic Support'],
  },
  Silver: {
    tier: 'Silver',
    label: 'Silver Member',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-300',
    cardBgGradient: 'from-emerald-50 via-white to-slate-50',
    cardBorder: 'border-emerald-300/80',
    accentColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.12)',
    icon: '🥈',
    perks: ['5% Service Discount', 'Earn 10% Points', 'Priority Waitlist'],
  },
  Gold: {
    tier: 'Gold',
    label: 'Gold Member',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-400',
    cardBgGradient: 'from-emerald-100/70 via-emerald-50/50 to-white',
    cardBorder: 'border-emerald-300',
    accentColor: '#047857',
    glowColor: 'rgba(4, 120, 87, 0.15)',
    icon: '🥇',
    perks: ['10% Service Discount', 'Free Hot Towel', 'Fast-Track Booking'],
  },
  VIP: {
    tier: 'VIP',
    label: 'VIP Platinum Lounge',
    badgeBg: 'bg-emerald-700',
    badgeText: 'text-white',
    badgeBorder: 'border-emerald-800',
    cardBgGradient: 'from-emerald-100 via-emerald-50 to-white',
    cardBorder: 'border-emerald-400',
    accentColor: '#065f46',
    glowColor: 'rgba(6, 95, 70, 0.18)',
    icon: '👑',
    perks: ['15% VIP Discount', 'Complimentary Grooming Drinks', 'Master Stylist Priority'],
  },
};

export function getTierConfig(tier?: string): TierStyleConfig {
  if (!tier) return TIER_CONFIGS.Bronze;
  const key = (tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()) as MemberTier;
  return TIER_CONFIGS[key] || TIER_CONFIGS.Bronze;
}

/**
 * Strict, deterministic member level determination based on Royalty Points:
 * - Bronze: 0 - 499 PTS
 * - Silver: 500 - 999 PTS
 * - Gold: 1,000 - 1,999 PTS
 * - VIP: 2,000+ PTS
 */
export const TIER_POINT_THRESHOLDS = {
  Bronze: { min: 0, max: 499, label: '0 - 499 PTS' },
  Silver: { min: 500, max: 999, label: '500 - 999 PTS' },
  Gold: { min: 1000, max: 1999, label: '1,000 - 1,999 PTS' },
  VIP: { min: 2000, max: Infinity, label: '2,000+ PTS' },
};

export function calculateTierFromPoints(points: number): MemberTier {
  const p = Math.max(0, Number(points) || 0);
  if (p >= 2000) return 'VIP';
  if (p >= 1000) return 'Gold';
  if (p >= 500) return 'Silver';
  return 'Bronze';
}

