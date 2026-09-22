import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

interface BrandLogoProps {
  size?: number | string;
  className?: string;
  showText?: boolean;
  logoUrl?: string;
  shopName?: string;
  tagline?: string;
}

const getStoredLogo = (): string => {
  if (typeof window === 'undefined') return '/logo.svg';
  try {
    const directStored = localStorage.getItem('gentleman_shop_logo');
    if (directStored && directStored.trim().length > 0) return directStored;

    const settingsRaw = localStorage.getItem('babashop_settings_v2');
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed?.logoUrl && parsed.logoUrl.trim().length > 0) {
        return parsed.logoUrl;
      }
    }
  } catch {
    // ignore
  }
  return '/logo.svg';
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 40,
  className = '',
  showText = false,
  logoUrl,
  shopName = 'GENTLEMAN',
  tagline = 'Barber Shop',
}) => {
  const [activeLogo, setActiveLogo] = useState<string>(() => {
    if (logoUrl && logoUrl.trim().length > 0) return logoUrl;
    return getStoredLogo();
  });

  const [hasError, setHasError] = useState(false);

  // Sync when logoUrl prop changes
  useEffect(() => {
    if (logoUrl && logoUrl.trim().length > 0) {
      setActiveLogo(logoUrl);
      setHasError(false);
      try {
        localStorage.setItem('gentleman_shop_logo', logoUrl);
      } catch {}
    } else if (!logoUrl) {
      // If prop is not provided, use stored or default
      const stored = getStoredLogo();
      if (stored !== '/logo.png') {
        setActiveLogo(stored);
        setHasError(false);
      }
    }
  }, [logoUrl]);

  // Subscribe to real-time shop settings and custom events
  useEffect(() => {
    const handleLogoUpdate = (e: CustomEvent<{ logoUrl?: string }>) => {
      if (e.detail?.logoUrl) {
        setActiveLogo(e.detail.logoUrl);
        setHasError(false);
      } else {
        const stored = getStoredLogo();
        setActiveLogo(stored);
        setHasError(false);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'gentleman_shop_logo' || e.key === 'babashop_settings_v2') {
        const stored = getStoredLogo();
        setActiveLogo(stored);
        setHasError(false);
      }
    };

    // Listen to live Cloud Firestore settings
    const unsubSettings = api.subscribeToSettings((settings) => {
      if (settings?.logoUrl && settings.logoUrl.trim().length > 0) {
        setActiveLogo(settings.logoUrl);
        setHasError(false);
        try {
          localStorage.setItem('gentleman_shop_logo', settings.logoUrl);
        } catch {}
      }
    });

    window.addEventListener('shop-logo-updated' as any, handleLogoUpdate as any);
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubSettings();
      window.removeEventListener('shop-logo-updated' as any, handleLogoUpdate as any);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const imageSrc = hasError || !activeLogo ? '/logo.svg' : activeLogo;

  return (
    <div className={`inline-flex items-center space-x-2.5 select-none ${className}`}>
      <div
        style={{ width: size, height: size }}
        className="shrink-0 relative rounded-xl overflow-hidden shadow-2xs border border-emerald-600/30 bg-[#059669] flex items-center justify-center"
      >
        <img
          src={imageSrc}
          alt={shopName}
          className="w-full h-full object-contain rounded-xl"
          onError={() => {
            if (!hasError) {
              setHasError(true);
            }
          }}
        />
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <span className="font-sans font-black text-stone-900 uppercase tracking-wider text-sm leading-none">
            {shopName}
          </span>
          <span className="text-[10px] font-sans font-bold text-emerald-700 uppercase tracking-widest leading-tight mt-0.5">
            {tagline}
          </span>
        </div>
      )}
    </div>
  );
};

