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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
