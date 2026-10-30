import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './app/AuthContext';
import { router } from './app/router';

export default function App() {
  useEffect(() => {
    // Register service worker for PWA offline caching if supported
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('[PWA] Service Worker registered'))
        .catch((err) => console.warn('[PWA] SW registration failed:', err));
    }
  }, []);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
