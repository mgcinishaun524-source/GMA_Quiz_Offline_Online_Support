import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GmaLogo } from './GmaLogo';

export interface BootSplashProps {
  /** Called once the exit animation has finished and the splash may unmount. */
  onFinish: () => void;
}

/** How long the splash stays on screen before it begins to fade out. */
const HOLD_MS = 2500;
/** Must match the `gma-splash-out` animation duration in index.css. */
const EXIT_MS = 500;

interface Particle {
  left: string;
  bottom: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
}

/**
 * Full-screen cinematic boot sequence shown when the app opens.
 *
 * Timeline: book rises → stem draws → leaves unfurl → spark ignites → wordmark
 * shimmer sweeps in. Click, tap or any keypress skips straight to the app.
 */
export const BootSplash: React.FC<BootSplashProps> = ({ onFinish }) => {
  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);

  // Stable per-mount particle field for the drifting motes of light.
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 18 }, () => ({
        left: `${Math.random() * 100}%`,
        bottom: `${Math.random() * 45}%`,
        size: 3 + Math.random() * 7,
        delay: Math.random() * 3,
        duration: 4.5 + Math.random() * 5,
        drift: (Math.random() - 0.5) * 120,
      })),
    [],
  );

  const beginExit = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);
    window.setTimeout(onFinish, EXIT_MS);
  }, [onFinish]);

  useEffect(() => {
    const holdTimer = window.setTimeout(beginExit, HOLD_MS);
    const onKey = () => beginExit();

    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(holdTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [beginExit]);

  return (
    <div
      className={`gma-splash ${leaving ? 'is-leaving' : ''}`}
      onClick={beginExit}
      role="presentation"
    >
      {/* Warm branded backdrop + slowly rotating light sheen */}
      <div className="gma-splash-bg" />
      <div className="gma-splash-sheen" />

      {/* Drifting motes */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {particles.map((p, i) => (
          <span
            key={i}
            className="gma-particle"
            style={{
              left: p.left,
              bottom: p.bottom,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--gma-dx' as string]: `${p.drift}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Centre lockup */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <GmaLogo size={176} animated className="drop-shadow-[0_18px_45px_rgba(255,196,80,0.35)]" />

        <h1
          className="gma-shimmer-text mt-8 text-2xl sm:text-3xl font-black tracking-[0.14em] uppercase"
          style={{ animation: 'gma-rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 1.15s both' }}
        >
          Growing Minds Academy
        </h1>

        <p
          className="mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-[0.34em] text-[#D6A21E]"
          style={{ animation: 'gma-fade-in 0.6s ease 1.55s both' }}
        >
          AI-Powered Quiz &amp; Learning Analytics
        </p>

        <div className="gma-load-track mt-10 w-44 sm:w-56" style={{ animation: 'gma-fade-in 0.5s ease 0.9s both' }}>
          <div className="gma-load-fill" />
        </div>

        <p
          className="mt-4 text-[10px] font-medium tracking-[0.22em] uppercase text-white/45"
          style={{ animation: 'gma-fade-in 0.6s ease 1.85s both' }}
        >
          Growing your learning environment
        </p>
      </div>

      <p
        className="absolute bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/30"
        style={{ animation: 'gma-fade-in 0.8s ease 1.9s both' }}
      >
        Click anywhere to skip
      </p>
    </div>
  );
};

export default BootSplash;
