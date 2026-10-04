/**
 * Native Haptic & Tactile Feedback Utility
 * Provides subtle physical vibration on touch devices
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export function triggerHapticFeedback(type: HapticType | number = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      if (typeof type === 'number') {
        navigator.vibrate(type);
        return;
      }

      switch (type) {
        case 'light':
        case 'selection':
          navigator.vibrate(8);
          break;
        case 'medium':
          navigator.vibrate(15);
          break;
        case 'heavy':
          navigator.vibrate(25);
          break;
        case 'success':
          navigator.vibrate([10, 30, 15]);
          break;
        case 'warning':
          navigator.vibrate([15, 40, 15]);
          break;
        case 'error':
          navigator.vibrate([30, 50, 30, 50, 30]);
          break;
        default:
          navigator.vibrate(8);
      }
    }
  } catch {
    // Graceful fallback for non-supporting browsers
  }
}
