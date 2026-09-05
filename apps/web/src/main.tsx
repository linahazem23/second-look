import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { AuthProvider } from './AuthContext.js';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
