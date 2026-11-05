import React, { useId } from 'react';

export interface GmaLogoProps {
  /** Height of the (square) mark in pixels. */
  size?: number;
  /** Play the intro sequence (book rises, stem draws, leaves unfurl, spark blooms). */
  animated?: boolean;
  className?: string;
  /** Accessible name. Pass an empty string to render the mark as decorative. */
  title?: string;
}

/**
 * Growing Minds Academy brand mark — "Open Book Bloom".
 *
 * An open book whose pages curl upward into leaves, crowned by a glowing spark
 * and surrounded by neural nodes: knowledge growing into intelligence.
 *
 * Built as inline SVG (not a raster asset) so it stays crisp at any size and
 * can be animated with pure CSS. The intro timeline and idle loops live in
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
          <stop offset="0%" stopColor="#FFF9EC" />
          <stop offset="100%" stopColor="#EFC463" />
        </linearGradient>
        <linearGradient id={id('spine')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8B62F" />
          <stop offset="100%" stopColor="#B8891A" />
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
          <stop offset="0%" stopColor="#FFD977" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FFC24D" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#FFC24D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('spark')} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#FFFDF3" />
          <stop offset="46%" stopColor="#FFDE7A" />
          <stop offset="100%" stopColor="#F0A21C" />
        </radialGradient>
      </defs>

      {/* Halo behind the bloom */}
      <g className="gma-glow">
        <circle cx="60" cy="34" r="36" fill={`url(#${id('glow')})`} />
      </g>

      {/* Neural connectors (drawn) */}
      <g
        className="gma-connector"
        stroke="#EFC463"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      >
        <path pathLength={1} d="M25 57 L41 40" />
        <path pathLength={1} d="M95 50 L79 37" />
        <path pathLength={1} d="M41 40 L56 30" />
        <path pathLength={1} d="M79 37 L64 30" />
      </g>

      {/* Open book */}
      <g className="gma-book">
        <path
          d="M60 95 C46 88 30 86 18 91 L18 104 C30 99 46 101 60 108 Z"
          fill={`url(#${id('book')})`}
          stroke="#E0AE3C"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path
          d="M60 95 C74 88 90 86 102 91 L102 104 C90 99 74 101 60 108 Z"
          fill={`url(#${id('book')})`}
          stroke="#E0AE3C"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </g>
      <path className="gma-spine" d="M60 95 L60 108" stroke={`url(#${id('spine')})`} strokeWidth="1.6" strokeLinecap="round" />

      {/* Stem, blooming out of the spine */}
      <path
        className="gma-stem"
        pathLength={1}
        d="M60 95 C56 84 64 72 60 58"
        stroke={`url(#${id('stem')})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Leaves — the pages curling upward */}
      <path className="gma-leaf-1" d="M60 79 C47 79 39 70 38 59 C50 59 58 67 60 79 Z" fill={`url(#${id('leaf')})`} />
      <path className="gma-leaf-2" d="M60 70 C73 70 81 60 82 49 C70 49 62 58 60 70 Z" fill={`url(#${id('leaf')})`} />
      <path className="gma-leaf-3" d="M60 57 C53 55 49 49 50 42 C57 44 60 50 60 57 Z" fill={`url(#${id('leaf')})`} />
      <path className="gma-leaf-4" d="M60 57 C67 55 71 49 70 42 C63 44 60 50 60 57 Z" fill={`url(#${id('leaf')})`} />

      {/* Neural nodes */}
      <g fill="#6CABDD">
        <circle className="gma-node-1" cx="25" cy="57" r="2.3" />
        <circle className="gma-node-2" cx="95" cy="50" r="2.3" />
      </g>
      <g fill="#EFB93C">
        <circle className="gma-node-3" cx="41" cy="40" r="1.9" />
        <circle className="gma-node-4" cx="79" cy="37" r="1.9" />
        <circle className="gma-node-5" cx="60" cy="11" r="2" />
        <circle className="gma-node-6" cx="70" cy="20" r="1.5" />
      </g>

      {/* Crown spark */}
      <path
        className="gma-bloom"
        d="M60 17 L63.2 27.8 L74 31 L63.2 34.2 L60 45 L56.8 34.2 L46 31 L56.8 27.8 Z"
        fill={`url(#${id('spark')})`}
      />

      {/* Secondary sparks */}
      <path
        className="gma-spark-1"
        d="M32 24 L33.6 28.9 L38.5 30.5 L33.6 32.1 L32 37 L30.4 32.1 L25.5 30.5 L30.4 28.9 Z"
        fill="#FFE08A"
      />
      <path
        className="gma-spark-2"
        d="M88 27 L89.3 30.7 L93 32 L89.3 33.3 L88 37 L86.7 33.3 L83 32 L86.7 30.7 Z"
        fill="#FFE08A"
      />
    </svg>
  );
};

export default GmaLogo;
