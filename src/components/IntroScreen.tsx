import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface IntroScreenProps {
  onContinue: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onContinue }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onContinue();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div 
      onClick={onContinue}
      className="relative w-full h-screen bg-[#040273] flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
    >
      {/* Top right "Made by Erudites" */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute top-6 right-8 text-white flex items-baseline gap-2 z-10"
      >
        <span className="text-white/80 text-sm md:text-base font-sans tracking-wide">Made by</span>
        <h1 className="text-white text-3xl md:text-5xl font-lobster font-normal tracking-wide">
          Erudites
        </h1>
      </motion.div>

      {/* Centre Object */}
      <div className="flex flex-col items-center justify-center gap-6 z-10 px-4 pointer-events-none">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-48 sm:w-64 h-32 sm:h-40 rounded-3xl overflow-hidden shadow-2xl flex flex-col flag-glow border border-white/20"
        >
          {/* Saffron */}
          <div className="h-1/3 w-full bg-[#FF9933]" />
          {/* White with Ashoka Chakra Logo */}
          <div className="h-1/3 w-full bg-white flex items-center justify-center py-0.5">
            <img
              src="/logo.jpeg"
              alt="Ashoka Chakra Logo"
              className="h-full object-contain aspect-square rounded-full drop-shadow-sm"
              onError={(e) => {
                // Fallback Chakra SVG if logo fails to render
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          {/* Green */}
          <div className="h-1/3 w-full bg-[#138808]" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-white font-quicksand text-4xl sm:text-5xl font-bold tracking-[3px] drop-shadow-md">
            Tracport
          </h1>
          <p className="text-white/60 text-xs sm:text-sm mt-1 tracking-wider uppercase font-poppins">
            Inspection & Verification Platform
          </p>
        </motion.div>
      </div>
    </div>
  );
};
