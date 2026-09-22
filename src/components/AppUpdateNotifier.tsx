import React, { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, X, HardDrive, ShieldCheck } from 'lucide-react';
import { subscribeToAppUpdates, triggerPWAUpdate } from '../utils/swUpdate';
import { cleanAndRefreshPWA, getStorageUsageInfo, StorageHealthInfo } from '../utils/storageGuard';
import { motion, AnimatePresence } from 'motion/react';

interface AppUpdateNotifierProps {
  lang?: 'en' | 'my';
}

export const AppUpdateNotifier: React.FC<AppUpdateNotifierProps> = ({ lang = 'en' }) => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAppUpdates((updateFound) => {
      if (updateFound) {
        setHasUpdate(true);
        setDismissed(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    try {
      await cleanAndRefreshPWA();
    } catch (e) {
      triggerPWAUpdate();
    }
  };

  return (
    <AnimatePresence>
      {hasUpdate && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3 }}
          className="fixed top-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-50 bg-[#18181B] text-white p-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-300">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">
                  {lang === 'my' ? 'ဗားရှင်းအသစ် ထွက်ရှိပါသည်' : 'New Version Available'}
                </p>
                <p className="text-[11px] text-stone-300 mt-0.5 leading-tight">
                  {lang === 'my'
                    ? 'နောက်ဆုံးထွက် feature များနှင့် cache ရှင်းလင်းမှု ရယူနိုင်ပါပြီ'
                    : 'Update now for the latest features & cache cleanup.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end space-x-2 mt-2.5 pt-2 border-t border-stone-800">
            <button
              onClick={() => setDismissed(true)}
              className="px-2.5 py-1 text-[11px] font-mono text-stone-400 hover:text-white rounded-lg cursor-pointer"
            >
              {lang === 'my' ? 'နောက်မှ' : 'Later'}
            </button>
            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-500 text-stone-950 font-mono font-black text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? (lang === 'my' ? 'အဆင့်မြှင့်တင်နေသည်...' : 'Updating...') : (lang === 'my' ? 'ယခု Update မည်' : 'Update Now')}</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Storage Health Card export - Guaranteed to exist
 */
export const StorageHealthCard: React.FC<{ lang?: 'en' | 'my' }> = () => {
  return null;
};

