import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface BootSplashProps {
  /** Called once the exit animation has finished and the splash may unmount. */
  onFinish: () => void;
}

/** How long the splash stays on screen before it begins to fade out. */
const HOLD_MS = 3000;
/** Must match the `gma-splash-out` animation duration in index.css. */
const EXIT_MS = 500;

interface Orb {
  size: number;
  top: string;
  left: string;
  color: string;
  delay: number;
}

/**
 * Full-screen cinematic boot sequence shown when the app opens.
 *
 * Layout (inspired by a premium product-launch splash, adapted to GMA):
 *   • top:     large bold "GROWING MINDS" wordmark
 *   • middle:  the school's real logo floating with a soft halo
 *   • bottom:  a frosted bottom-sheet with headline, subtitle, a 3-dot page
 *              indicator and a "Get Started" button that enters the app.
 * No loading bar. Only the locked GMA palette (navy / sky / gold / white).
 */
export const BootSplash: React.FC<BootSplashProps> = ({ onFinish }) => {
  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);

  const orbs = useMemo<Orb[]>(
    () => [
      { size: 600, top: '-22%', left: '-20%', color: 'rgba(108,171,221,0.55)', delay: 0 },
      { size: 500, top: '40%', left: '55%', color: 'rgba(214,162,30,0.32)', delay: -7 },
      { size: 380, top: '0%', left: '62%', color: 'rgba(255,255,255,0.14)', delay: -13 },
      { size: 340, top: '66%', left: '2%', color: 'rgba(108,171,221,0.28)', delay: -18 },
    ],
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
      className={`gma-splash gma-splash-v2 ${leaving ? 'is-leaving' : ''}`}
      role="presentation"
    >
      {/* Deep navy backdrop + slowly rotating light sheen */}
      <div className="gma-splash-bg" />
      <div className="gma-splash-sheen" />

      {/* Ambient colour orbs */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {orbs.map((o, i) => (
          <span
            key={i}
            className="gma-app-orb"
            style={{
              width: o.size,
              height: o.size,
              top: o.top,
              left: o.left,
              background: `radial-gradient(circle, ${o.color} 0%, rgba(0,0,0,0) 70%)`,
              animationDelay: `${o.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ── Top wordmark ─────────────────────────────────────────────── */}
      <div className="absolute top-10 left-0 right-0 z-20 px-6 text-center sm:top-14">
        <h1
          className="text-[2.6rem] sm:text-6xl font-black leading-none tracking-tight text-white"
          style={{ animation: 'gma-rise 0.6s cubic-bezier(0.2,0.8,0.2,1) 0.05s both' }}
        >
          GROWING MINDS
        </h1>
        <p
          className="mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.42em] text-gma-sky"
          style={{ animation: 'gma-fade-in 0.6s ease 0.30s both' }}
        >
          Academy
        </p>
      </div>

      {/* ── Floating logo ────────────────────────────────────────────── */}
      <div
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-[58%]"
        style={{ animation: 'gma-rise 0.8s cubic-bezier(0.2,0.8,0.2,1) 0.15s both' }}
      >
        <div className="gma-splash-logo-halo" aria-hidden="true" />
        <img
          src="/assets/Logo.png"
          alt="Growing Minds Academy"
          className="relative h-32 w-auto drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)] sm:h-40"
        />
      </div>

      {/* ── Bottom sheet ─────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6 sm:px-6 sm:pb-10">
        <div
          className="gma-splash-sheet mx-auto w-full max-w-md"
          style={{ animation: 'gma-sheet-up 0.6s cubic-bezier(0.2,0.8,0.2,1) 0.35s both' }}
        >
          {/* Page indicator dots */}
          <div className="flex items-center justify-center gap-1.5 py-3" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <span className="h-1.5 w-6 rounded-full bg-gma-sky" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
          </div>

          <div className="px-6 pb-7 text-center">
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
              Next-Gen <span className="italic font-light">Learning</span>.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75 sm:text-[15px]">
              AI-powered quizzes, offline-ready assessments and
              real-time analytics — made for African classrooms.
            </p>

            <button
              type="button"
              onClick={beginExit}
              className="gma-splash-cta mt-6 w-full cursor-pointer"
            >
              Get Started
            </button>

            <button
              type="button"
              onClick={beginExit}
              className="mt-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40 transition-colors hover:text-white/70 cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BootSplash;
