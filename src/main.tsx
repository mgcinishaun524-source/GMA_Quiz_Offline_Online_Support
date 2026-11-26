import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root = document.getElementById('root')!;
const prerenderedPaths = new Set(['/mgcini-shaun-moyo', '/projects/gma-quiz-system']);
const hasPrerenderedPublicPage = prerenderedPaths.has(window.location.pathname)
  && Boolean(root.querySelector('main.brand-page'));

if (hasPrerenderedPublicPage) {
  // The profile pages are complete static HTML generated at build time. Keep
  // that markup intact rather than calling createRoot(), which clears the
  // container and would cause an avoidable flash/replacement. Their links are
  // ordinary anchors, so navigation remains functional without React hydration.
  // Register the existing offline service worker here as App is not mounted.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] SW registration failed:', err);
    });
  }
} else {
  createRoot(root).render(<App />);
}
