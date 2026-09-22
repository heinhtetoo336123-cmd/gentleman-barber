import React from 'react';
import { motion } from 'motion/react';
import { Scissors, Sparkles } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface MaterialLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  variant?: 'spinner' | 'barber-pole' | 'pulse';
  className?: string;
}

export const MaterialSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-7 h-7 border-2.5',
    lg: 'w-10 h-10 border-3',
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
        className={`${sizeMap[size]} rounded-full border-white/20 border-t-[#D4AF37] border-r-[#D4AF37]`}
      />
    </div>
  );
};

export const BarberPoleLoader: React.FC<{ className?: string; label?: string }> = ({
  className = '',
  label = 'Loading...',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-6 space-y-3 ${className}`}>
      {/* Barber Pole animated cylinder */}
      <div className="relative w-12 h-20 rounded-2xl bg-black border-2 border-[#D4AF37] overflow-hidden shadow-md flex items-center justify-center">
        {/* Animated diagonal stripes */}
        <motion.div
          animate={{ y: [0, -32] }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="absolute inset-0 w-full h-[200%]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              #ffffff 0px,
              #ffffff 8px,
              #121212 8px,
              #121212 16px,
              #D4AF37 16px,
              #D4AF37 24px,
              #121212 24px,
              #121212 32px
            )`,
          }}
        />
        {/* Glass gloss reflection overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-black/40 pointer-events-none rounded-2xl" />
        
        {/* Center Icon Badge */}
        <div className="relative z-10 w-8 h-8 rounded-full bg-black/90 border border-[#D4AF37]/50 flex items-center justify-center text-white shadow-xs">
          <Scissors className="w-4 h-4 text-[#D4AF37] transform -rotate-45" />
        </div>
      </div>

      {/* Label and pulse text */}
      <div className="flex items-center space-x-1.5 text-xs font-sans font-bold text-white">
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
        >
          {label}
        </motion.span>
      </div>
    </div>
  );
};

export const ServiceCardSkeleton: React.FC = () => {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-3xl p-4 space-y-3 animate-pulse shadow-md">
      <div className="h-40 bg-[#242424] rounded-2xl w-full" />
      <div className="space-y-2">
        <div className="h-4 bg-[#2a2a2a] rounded-md w-3/4" />
        <div className="h-3 bg-[#202020] rounded-md w-full" />
        <div className="h-3 bg-[#202020] rounded-md w-2/3" />
      </div>
      <div className="pt-2 border-t border-[#2a2a2a] flex items-center justify-between">
        <div className="h-5 bg-[#2a2a2a] rounded-md w-20" />
        <div className="h-8 bg-[#D4AF37]/30 rounded-xl w-24" />
      </div>
    </div>
  );
};

export const FullScreenLoader: React.FC<{ message?: string }> = ({
  message = 'ကျေးဇူးပြု၍ ခေတ္တစောင့်ဆိုင်းပေးပါ...',
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-8 max-w-xs w-full shadow-2xl flex flex-col items-center text-center space-y-4"
      >
        <div className="relative">
          <BrandLogo size={68} className="animate-pulse" />
        </div>

        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
            GENTLEMAN
          </h3>
          <p className="text-xs text-stone-300 mt-1 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="w-1/2 h-full bg-[#D4AF37] rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
};
