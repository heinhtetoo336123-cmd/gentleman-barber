import React, { useState, useEffect, useCallback } from 'react';
import { Delete, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { normalizePinInput } from '../lib/authCrypto';

interface PinKeypadProps {
  pin: string;
  onChange: (pin: string) => void;
  onSubmit?: (fullPin?: string) => void;
  maxLength?: number;
  disabled?: boolean;
  label?: string;
  error?: boolean;
  autoSubmitOnComplete?: boolean;
  showEyeToggle?: boolean;
}

export const PinKeypad: React.FC<PinKeypadProps> = ({
  pin,
  onChange,
  onSubmit,
  maxLength = 6,
  disabled = false,
  label,
  error = false,
  autoSubmitOnComplete = false,
  showEyeToggle = true,
}) => {
  const [showPlainPin, setShowPlainPin] = useState(false);

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (disabled) return;
      const normalizedDigit = normalizePinInput(digit);
      if (!normalizedDigit) return;

      if (pin.length < maxLength) {
        const nextPin = pin + normalizedDigit;
        onChange(nextPin);
        if (autoSubmitOnComplete && nextPin.length === maxLength && onSubmit) {
          setTimeout(() => {
            onSubmit(nextPin);
          }, 80);
        }
      }
    },
    [pin, maxLength, disabled, onChange, autoSubmitOnComplete, onSubmit]
  );

  const handleBackspace = useCallback(() => {
    if (disabled || pin.length === 0) return;
    onChange(pin.slice(0, -1));
  }, [disabled, pin, onChange]);

  const handleClear = useCallback(() => {
    if (disabled || pin.length === 0) return;
    onChange('');
  }, [disabled, pin, onChange]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' && pin.length >= 4 && onSubmit) {
        e.preventDefault();
        onSubmit(pin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, handleKeyPress, handleBackspace, handleClear, pin, onSubmit]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-[290px] sm:max-w-[320px] mx-auto flex flex-col items-center select-none">
      {label && (
        <div className="text-xs font-bold font-sans uppercase tracking-wider text-[#18181B] mb-2 text-center">
          {label}
        </div>
      )}

      {/* PIN Dots Indicator Container */}
      <div className="w-full mb-4 px-3 py-3 bg-[#F4F4F6] border border-[#E4E4E7] rounded-2xl flex flex-col items-center justify-center relative shadow-xs">
        <div className="flex items-center justify-center space-x-2.5 sm:space-x-3 my-1">
          {Array.from({ length: maxLength }).map((_, index) => {
            const isFilled = index < pin.length;
            const digitChar = pin[index] || '';

            return (
              <div
                key={index}
                className={`w-9 h-10 sm:w-10 sm:h-11 rounded-xl flex items-center justify-center font-sans font-black text-lg transition-all duration-150 ${
                  isFilled
                    ? error
                      ? 'bg-red-50 border-2 border-red-500 text-red-600 shadow-xs'
                      : 'bg-emerald-700 border-2 border-emerald-500 text-white shadow-xs scale-105'
                    : 'bg-white border border-stone-200 text-transparent'
                }`}
              >
                {isFilled ? (
                  showPlainPin ? (
                    digitChar
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-white inline-block shadow-xs" />
                  )
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-300 inline-block" />
                )}
              </div>
            );
          })}
        </div>

        {/* Visibility toggle & count info */}
        <div className="w-full flex items-center justify-between mt-2 pt-2 border-t border-stone-200 px-1 text-[11px] text-stone-500">
          <span className="font-sans font-bold">
            {pin.length} / {maxLength} Digits
          </span>

          {showEyeToggle && (
            <button
              type="button"
              onClick={() => setShowPlainPin(!showPlainPin)}
              className="flex items-center space-x-1 text-stone-700 hover:text-emerald-700 font-sans font-bold transition-colors cursor-pointer px-2 py-0.5 rounded-md hover:bg-stone-100"
              title={showPlainPin ? 'Hide PIN' : 'Show PIN'}
            >
              {showPlainPin ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Reveal</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 3x4 On-Screen Keypad Board */}
      <div className="w-full grid grid-cols-3 gap-2 sm:gap-2.5">
        {digits.map((num) => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => handleKeyPress(num)}
            className="h-13 sm:h-14 rounded-2xl bg-white hover:bg-emerald-50 active:bg-emerald-100 border border-stone-200 hover:border-emerald-500 active:scale-95 text-stone-900 font-sans font-black text-xl flex items-center justify-center transition-all duration-100 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {num}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleClear}
          className="h-13 sm:h-14 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-95 border border-stone-200 text-stone-600 hover:text-stone-900 font-sans font-bold text-xs uppercase tracking-wider flex flex-col items-center justify-center transition-all duration-100 cursor-pointer disabled:opacity-40"
        >
          <RotateCcw className="w-4 h-4 mb-0.5" />
          <span>Clear</span>
        </button>

        {/* Digit 0 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleKeyPress('0')}
          className="h-13 sm:h-14 rounded-2xl bg-[#FFFFFF] hover:bg-[#FDF8E2] active:bg-[#F5E8B7] border border-[#E4E4E7] hover:border-[#D4AF37] active:scale-95 text-[#18181B] font-sans font-black text-xl flex items-center justify-center transition-all duration-100 shadow-xs cursor-pointer disabled:opacity-50"
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="h-13 sm:h-14 rounded-2xl bg-[#F4F4F6] hover:bg-red-50 hover:border-red-200 active:scale-95 border border-[#E4E4E7] text-[#71717A] hover:text-red-600 font-sans font-bold flex flex-col items-center justify-center transition-all duration-100 cursor-pointer disabled:opacity-40"
        >
          <Delete className="w-5 h-5" />
          <span className="text-[9px] uppercase tracking-widest mt-0.5">Del</span>
        </button>
      </div>
    </div>
  );
};
