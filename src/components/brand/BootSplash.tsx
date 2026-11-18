import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface BootSplashProps {
  /** Called once the exit animation has finished and the splash may unmount. */
  onFinish: () => void;
}

/** How long the splash stays on screen before it begins to fade out. */
const HOLD_MS = 3000;
/** Must match the fade-out transition duration. */
const EXIT_MS = 500;

/**
 * Minimal boot splash - clean centered logo on light background.
 */
export const BootSplash: React.FC<BootSplashProps> = ({ onFinish }) => {
  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);

  const beginExit = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);
    window.setTimeout(onFinish, EXIT_MS);
  }, [onFinish]);

  useEffect(() => {
    const holdTimer = window.setTimeout(beginExit, HOLD_MS);
    const onTap = () => beginExit();
    window.addEventListener('click', onTap);
    window.addEventListener('keydown', onTap);
    return () => {
      window.clearTimeout(holdTimer);
      window.removeEventListener('click', onTap);
      window.removeEventListener('keydown', onTap);
    };
  }, [beginExit]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center cursor-pointer transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={beginExit}
      role="presentation"
    >
      {/* Centered logo */}
      <div className="relative z-10">
        <img
          src="/assets/Logo.png"
          alt="Growing Minds Academy"
          className="h-32 w-auto animate-[fadeInUp_0.6s_ease-out]"
        />
      </div>

      {/* Bottom decorative pattern */}
      <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden opacity-20">
        <svg
          className="w-full h-full"
          viewBox="0 0 200 100"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Abstract curved shapes inspired by the reference */}
          <path
            d="M 10,60 Q 20,40 40,50 T 80,60"
            fill="none"
            stroke="#6CABDD"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 50,80 Q 70,60 90,75 T 130,80"
            fill="none"
            stroke="#D6A21E"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 100,50 Q 120,30 140,45 T 180,55"
            fill="none"
            stroke="#0F1736"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="30" cy="70" r="3" fill="#6CABDD" />
          <circle cx="90" cy="90" r="2.5" fill="#D6A21E" />
          <circle cx="150" cy="65" r="3" fill="#0F1736" />
        </svg>
      </div>
    </div>
  );
};

export default BootSplash;
