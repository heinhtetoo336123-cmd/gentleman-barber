import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Wrench, HardDrive, ShieldCheck } from 'lucide-react';
import { cleanAndRefreshPWA, emergencyStorageCleanup } from '../utils/storageGuard';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  lang?: 'en' | 'my';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRepairing: boolean;
  repairStatus: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isRepairing: false,
    repairStatus: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
    // Also perform emergency storage trim in background in case error was storage-related
    try {
      emergencyStorageCleanup();
    } catch {}
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isRepairing: false, repairStatus: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleSelfRepair = async () => {
    this.setState({
      isRepairing: true,
      repairStatus: this.props.lang === 'en'
        ? 'Purging stale caches, fixing storage quota & reloading latest app...'
        : 'Cache များ ရှင်းလင်းပြီး Storage Error အလိုအလျောက် ပြုပြင်နေပါသည်...'
    });

    try {
      setTimeout(async () => {
        await cleanAndRefreshPWA();
      }, 500);
    } catch (err) {
      console.error('Self repair error:', err);
      window.location.reload();
    }
  };

  public handleHardReload = () => {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn(e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      const isMy = this.props.lang !== 'en'; // default to Burmese or check prop

      return (
        <div className="min-h-[380px] w-full bg-stone-100/90 text-stone-900 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-lg w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Error Message Header */}
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-stone-900 font-mono">
                {this.props.fallbackTitle || 'အမှားအယွင်း တစ်ခု ဖြစ်ပေါ်သွားပါသည်'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-medium">
                System error ကာကွယ်ထားပြီး အောက်ပါ ခလုပ်များဖြင့် ပုံမှန် ပြန်လည်အသုံးပြုနိုင်ပါသည်။
              </p>
            </div>

            {/* Detailed Error Line if available */}
            {this.state.error && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl text-left overflow-hidden">
                <p className="text-[11px] font-mono text-emerald-900 break-words line-clamp-3">
                  {this.state.error.message || this.state.error.toString()}
                </p>
              </div>
            )}

            {/* Live Repair Status Message */}
            {this.state.repairStatus && (
              <p className="text-xs font-mono font-bold text-emerald-700 animate-pulse bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                {this.state.repairStatus}
              </p>
            )}

            {/* Action Buttons Box */}
            <div className="space-y-2.5 pt-1">
              
              {/* Primary 1-Click Self Repair Button */}
              <button
                type="button"
                onClick={this.handleSelfRepair}
                disabled={this.state.isRepairing}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-500 text-stone-950 font-black text-xs sm:text-sm font-mono uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md hover:shadow-lg cursor-pointer transition-all active:scale-98 disabled:opacity-50"
              >
                <Wrench className={`w-4 h-4 ${this.state.isRepairing ? 'animate-spin' : ''}`} />
                <span>
                  {this.state.isRepairing
                    ? 'စနစ်ကို ပြုပြင်နေပါသည်...'
                    : '🔄 အက်ပ်အား Self-Repair လုပ်ပြီး ပြန်ဖွင့်မည် (Self Repair & Clear Cache)'}
                </span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Secondary: Try Again Reset */}
                <button
                  type="button"
                  onClick={this.handleReset}
                  disabled={this.state.isRepairing}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 border border-stone-200 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-stone-600" />
                  <span>ပြန်လည်စမ်းသပ်မည်</span>
                </button>

                {/* Tertiary: Reload Page */}
                <button
                  type="button"
                  onClick={this.handleHardReload}
                  disabled={this.state.isRepairing}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 border border-stone-300 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                  <span>Reload Page</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 font-mono">
              Self-Repair သည် PWA ပြန်သွင်းစရာမလိုဘဲ Cache အဟောင်းများနှင့် Storage Error များကို ရှင်းလင်းပေးပါသည်။
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
