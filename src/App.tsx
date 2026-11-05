import React, { useCallback, useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './app/AuthContext';
import { router } from './app/router';
import { BootSplash } from './components/brand/BootSplash';

/** Set once the boot splash has played, so a mid-session refresh doesn't replay it. */
const SPLASH_SESSION_KEY = 'gma_boot_splash_shown';

function shouldShowSplash(): boolean {
  if (typeof window === 'undefined') return false;
  // Never animate for users who have asked for reduced motion.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  // Always replay during local development so the animation can be reviewed.
  if (import.meta.env.DEV) return true;
  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowSplash);

  useEffect(() => {
    // Register service worker for PWA offline caching if supported
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('[PWA] Service Worker registered'))
        .catch((err) => console.warn('[PWA] SW registration failed:', err));
    }
  }, []);

  const finishSplash = useCallback(() => {
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    } catch {
      /* storage unavailable — splash simply replays next load */
    }
    setShowSplash(false);
  }, []);

  return (
    <>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      {showSplash && <BootSplash onFinish={finishSplash} />}
    </>
  );
}
