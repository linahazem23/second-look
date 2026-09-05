import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { AdminAuthProvider } from './AdminAuthContext.js';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AdminAuthProvider>
      <App />
    </AdminAuthProvider>
  </React.StrictMode>
);
