import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, CheckCircle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PWA_DISMISSED_KEY = 'baba_pwa_banner_dismissed_v1';

export const InstallPwaBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PWA_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [installed, setInstalled] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(PWA_DISMISSED_KEY, 'true');
    } catch (e) {
      console.warn('Could not save PWA banner dismissal:', e);
    }
  };

  const handleInstallClick = () => {
    setInstalled(true);
    try {
      localStorage.setItem(PWA_DISMISSED_KEY, 'true');
    } catch (e) {
      console.warn('Could not save PWA banner dismissal:', e);
    }
    setTimeout(() => {
      setDismissed(true);
    }, 2500);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-stone-100 border-b border-emerald-200 text-stone-800 px-4 py-2 text-xs"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-stone-900">Install GENTLEMAN Web App</span>
                  <span className="flex items-center space-x-1 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                    <Zap className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Instant Mobile Booking</span>
                  </span>
                </div>
                <p className="text-stone-600 text-[11px] hidden sm:block">Add to home screen for offline status tracking and 1-tap bookings.</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {installed ? (
                <div className="flex items-center space-x-1.5 text-emerald-800 font-medium px-3 py-1 bg-emerald-100 border border-emerald-300 rounded-xl">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>App Installed!</span>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleInstallClick}
                  className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-500 text-stone-950 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App</span>
                </motion.button>
              )}

              <button
                onClick={handleDismiss}
                className="p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

