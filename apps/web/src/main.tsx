import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { AuthProvider } from './AuthContext.js';
import { App } from './App.js';

// CSS dvh alone doesn't reliably track mobile Safari's address bar showing/
// hiding across every version — visualViewport does. This keeps --app-height
// authoritative so #phone's locked height (and the fixed header/nav around
// the scrollable content) never falls out of sync with what's actually
// visible, including right after switching tabs.
function syncAppHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
}
syncAppHeight();
window.addEventListener('resize', syncAppHeight);
window.visualViewport?.addEventListener('resize', syncAppHeight);

// Installed as a home-screen app (standalone display mode), iOS/Android keep
// the same page instance alive in the background instead of re-navigating to
// it — so unlike a browser tab, reopening it shows whatever was on screen
// minutes or hours ago with no built-in refresh. Force one after a real gap.
let hiddenAt: number | null = null;
const REFRESH_AFTER_HIDDEN_MS = 60 * 1000;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
  } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
    const wasHiddenFor = Date.now() - hiddenAt;
    hiddenAt = null;
    if (wasHiddenFor > REFRESH_AFTER_HIDDEN_MS) window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
