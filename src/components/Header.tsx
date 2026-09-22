import React, { useState, useEffect, useRef } from 'react';
import { UserRole } from '../types';
import { Language } from '../data/i18n';
import { BrandLogo } from './BrandLogo';
import { Wrench, LogOut } from 'lucide-react';

interface HeaderProps {
  role?: UserRole;
  lang?: Language;
  shopName?: string;
  tagline?: string;
  logoUrl?: string;
  onSelectLang?: (lang: Language) => void;
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onOpenBookingModal?: () => void;
  onShowPwaPrompt?: () => void;
  onSwitchRoleScreen?: () => void;
  onLogout?: () => void;
  onRepair?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role = 'user',
  lang = 'en',
  shopName = 'GENTLEMAN',
  tagline = 'Barber Shop',
  logoUrl,
  onSwitchRoleScreen,
  onLogout,
  onRepair,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Secret 5-Tap Gesture on Logo in Header
  const [tapCount, setTapCount] = useState(0);
  const lastTapRef = useRef<number>(0);

  const handleHeaderLogoTap = () => {
    const now = Date.now();
    let count = tapCount;
    if (now - lastTapRef.current > 2200) {
      count = 1;
    } else {
      count += 1;
    }
    lastTapRef.current = now;
    setTapCount(count);

    if (count >= 5) {
      setTapCount(0);
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([40, 60, 40]);
        }
      } catch {}
      if (onSwitchRoleScreen) {
        onSwitchRoleScreen();
      }
    }
  };

  useEffect(() => {
    let lastY = window.scrollY || document.documentElement.scrollTop || 0;

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
          const delta = currentScrollY - lastY;

          // Always show header when at or near the top
          if (currentScrollY <= 15) {
            setIsVisible(true);
          } else if (delta > 4 && currentScrollY > 40) {
            // Pushing up / scrolling down -> smoothly hide header
            setIsVisible(false);
          } else if (delta < -3) {
            // Pulling down / scrolling up -> smoothly show header
            setIsVisible(true);
          }

          setIsScrolled(currentScrollY > 10);
          lastY = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md text-[#18181B] font-sans transition-all duration-300 ease-in-out select-none header-safe-top ${
        isScrolled ? 'border-b border-[#E4E4E7] shadow-xs' : 'border-b border-[#E4E4E7]/60'
      } ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        
        {/* Brand with logo positioned safely below the phone's status bar / notch */}
        <div
          onClick={handleHeaderLogoTap}
          className="flex items-center space-x-2.5 cursor-pointer transition-transform active:scale-95"
          title={shopName}
        >
          <BrandLogo size={36} logoUrl={logoUrl} shopName={shopName} tagline={tagline} />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-sm tracking-wider uppercase text-[#18181B] font-sans">
                {shopName}
              </span>
              {role === 'admin' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#18181B] text-[#D4AF37] border border-[#18181B] text-[9px] font-sans font-black tracking-wider">
                  ADMIN
                </span>
              )}
              {role === 'superadmin' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#18181B] text-[#D4AF37] border border-[#D4AF37] text-[9px] font-sans font-black tracking-wider shadow-xs">
                  👑 SUPERADMIN
                </span>
              )}
            </div>
            <span className="hidden sm:inline-block text-[10px] uppercase font-sans tracking-widest text-[#D4AF37] font-bold">
              {tagline}
            </span>
          </div>
        </div>

        {/* Right Action Controls: Repair & Logout for Admin / Superadmin */}
        {(role === 'admin' || role === 'superadmin') && (
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {onRepair && (
              <button
                type="button"
                onClick={onRepair}
                className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-200 text-xs font-mono font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="PWA Cache ရှင်းလင်းပြီး Cloud Data အား ပြန်လည်ချိန်ညှိရန် (Repair & Sync)"
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Repair</span>
              </button>
            )}

            {(onLogout || onSwitchRoleScreen) && (
              <button
                type="button"
                onClick={onLogout || onSwitchRoleScreen}
                className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black text-emerald-300 border border-stone-900 text-xs font-mono font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
