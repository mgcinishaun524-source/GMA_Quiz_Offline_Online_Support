import React from 'react';
import { BarChart3, Sparkles, WifiOff } from 'lucide-react';

const HIGHLIGHTS: { icon: React.ReactNode; label: string }[] = [
  { icon: <Sparkles size={13} strokeWidth={2.4} />, label: 'AI quiz studio' },
  { icon: <WifiOff size={13} strokeWidth={2.4} />, label: 'Works offline' },
  { icon: <BarChart3 size={13} strokeWidth={2.4} />, label: 'Instant analytics' },
];

/**
 * Left-hand brand panel of the split-screen login (desktop / large tablet only).
 *
 * Shows the school's real logo over a custom 3D illustration of African
 * learners, with a concise educational message and three capability chips.
 * The illustration is a bundled image asset (public/assets/login-learners.jpg),
 * so it renders offline with no external request.
 */
export const LoginBrandPanel: React.FC = () => (
  <div className="relative h-full w-full overflow-hidden rounded-[2rem] border border-white/60 shadow-[0_44px_100px_-46px_rgba(28,44,91,0.55)]">
    <img
      src="/assets/login-learners.jpg"
      alt="African students learning together with books, a tablet and digital study material"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />

    {/* Readability wash: light at the top (logo) → deep navy at the base (message) */}
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0)_32%,rgba(28,44,91,0.28)_60%,rgba(21,34,71,0.90)_100%)]"
    />

    <div className="relative flex h-full flex-col justify-between gap-8 p-8 xl:p-10">
      {/* Real GMA logo on a translucent pill so it stays legible over the art */}
      <div className="inline-flex w-fit items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-4 py-2.5 shadow-[0_12px_30px_-16px_rgba(28,44,91,0.5)]">
        <img src="/assets/Logo.png" alt="Growing Minds Academy" className="h-10 w-auto xl:h-11" />
      </div>

      <div className="max-w-md">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.3em] text-white/75">
          Growing Minds Academy
        </p>
        <h2 className="mt-3 text-3xl font-extrabold leading-[1.1] text-white xl:text-4xl">
          Where every mind grows.
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
          AI-assisted quizzes, offline-ready assessments and clear learning analytics —
          built for African classrooms.
        </p>

        <ul className="mt-6 flex flex-wrap gap-2">
          {HIGHLIGHTS.map((item) => (
            <li
              key={item.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-[0.7rem] font-semibold text-white backdrop-blur-sm"
            >
              <span aria-hidden="true" className="text-white/80">
                {item.icon}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

export default LoginBrandPanel;
