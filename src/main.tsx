import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializePWAUpdateService } from './utils/swUpdate.ts';
import './index.css';

// Register service worker for PWA installation, auto-updates, and background notifications
if (typeof window !== 'undefined') {
  initializePWAUpdateService().catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


