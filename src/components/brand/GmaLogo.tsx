import React, { useId } from 'react';

export interface GmaLogoProps {
  /** Height of the (square) mark in pixels. */
  size?: number;
  /** Play the intro sequence (book rises, head rises, stem draws, leaves unfurl). */
  animated?: boolean;
  className?: string;
  /** Accessible name. Pass an empty string to render the mark as decorative. */
  title?: string;
}

/**
 * Growing Minds Academy — animated boot mark, "Growing Mind".
 *
 * A learner's head rising out of an open book, with a leafy sprout growing from
 * the crown. Studying (the book) + the mind (the head) + growth (the sprout).
 * Deliberately organic rather than engineered: no circuitry, no chips, no robot.
 *
 * Used only for the full-screen boot splash — the school's own logo is used
 * everywhere inside the app.
 *
 * Built as inline SVG (not a raster asset) so it stays crisp at any size and can
 * be animated with pure CSS. The intro timeline and idle loops live in
 * `src/index.css` under the "BRAND MOTION" section and are automatically
 * disabled by the global `prefers-reduced-motion` rule.
 */
export const GmaLogo: React.FC<GmaLogoProps> = ({
  size = 40,
  animated = true,
  className = '',
  title = 'Growing Minds Academy',
}) => {
  // useId() returns a value containing colons (":r0:") which are unsafe inside
  // SVG url(#...) references, so strip them.
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `gma-${name}-${uid}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`gma-logo ${animated ? 'is-animated' : ''} ${className}`.trim()}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={id('book')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3C868" />
          <stop offset="100%" stopColor="#C9922A" />
        </linearGradient>
        <linearGradient id={id('spine')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8B62F" />
          <stop offset="100%" stopColor="#B8891A" />
        </linearGradient>
        <linearGradient id={id('head')} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#FFF8EA" />
          <stop offset="55%" stopColor="#FBE4B0" />
          <stop offset="100%" stopColor="#EFC77E" />
        </linearGradient>
        <linearGradient id={id('leaf')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#2E8B57" />
          <stop offset="100%" stopColor="#66D194" />
        </linearGradient>
        <linearGradient id={id('stem')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#2E8B57" />
          <stop offset="100%" stopColor="#57C384" />
        </linearGradient>
        <radialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD977" stopOpacity="0.80" />
          <stop offset="60%" stopColor="#FFC24D" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#FFC24D" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Warm halo behind the growing crown */}
      <g className="gma-glow">
        <circle cx="58" cy="40" r="38" fill={`url(#${id('glow')})`} />
      </g>

      {/* Faint thought lines linking the mind to the growing ideas */}
      <g
        className="gma-connector"
        stroke="#EFC463"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.42"
      >
        <path pathLength={1} d="M36 20 L50 14" />
        <path pathLength={1} d="M82 18 L66 12" />
        <path pathLength={1} d="M28 34 L32 46" />
      </g>

      {/* The mind — a learner in profile, looking forward */}
      <path
        className="gma-head"
        d="M46 87 L44 70
           C34 65 31 56 31 48
           C31 35 43 26 58 26
           C71 26 81 34 83 45
           C84 50 85 53 87 57
           C88 59 86 61 83 60
           C85 64 85 67 81 70
           C77 75 70 78 63 79
           L63 87 Z"
        fill={`url(#${id('head')})`}
      />

      {/* The sprout growing out of the crown */}
      <path
        className="gma-stem"
        pathLength={1}
        d="M58 26 C57.5 21 58.5 16 58 10"
        stroke={`url(#${id('stem')})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path className="gma-leaf-1" d="M58 21 C50 21 45 16 45 10 C52 10 57 15 58 21 Z" fill={`url(#${id('leaf')})`} />
      <path className="gma-leaf-2" d="M58 17 C65 17 70 13 70 7 C64 7 59 11 58 17 Z" fill={`url(#${id('leaf')})`} />
      <path className="gma-leaf-3" d="M58 12 C54 12 51 9 51 6 C55 6 58 9 58 12 Z" fill={`url(#${id('leaf')})`} />
      <path className="gma-leaf-4" d="M58 12 C62 12 65 9 65 6 C61 6 58 9 58 12 Z" fill={`url(#${id('leaf')})`} />

      {/* Ideas taking shape around the mind */}
      <g fill="#6CABDD">
        <circle className="gma-node-1" cx="28" cy="34" r="2.2" />
        <circle className="gma-node-2" cx="92" cy="38" r="2.2" />
      </g>
      <g fill="#EFB93C">
        <circle className="gma-node-3" cx="36" cy="20" r="1.7" />
        <circle className="gma-node-4" cx="82" cy="18" r="1.7" />
        <circle className="gma-node-5" cx="58" cy="3" r="1.8" />
        <circle className="gma-node-6" cx="22" cy="56" r="1.6" />
      </g>

      {/* The open book — the foundation of all that growth */}
      <g className="gma-book">
        <path
          d="M60 87 C46 80 30 78 18 83 L18 96 C30 91 46 93 60 100 Z"
          fill={`url(#${id('book')})`}
          stroke="#E0AE3C"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path
          d="M60 87 C74 80 90 78 102 83 L102 96 C90 91 74 93 60 100 Z"
          fill={`url(#${id('book')})`}
          stroke="#E0AE3C"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </g>
      <path className="gma-spine" d="M60 87 L60 100" stroke={`url(#${id('spine')})`} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};

export default GmaLogo;
