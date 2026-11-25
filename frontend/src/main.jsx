import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import { captureInstallPrompt } from './lib/install.js';

captureInstallPrompt();

// After a new deployment, files from the previous version disappear. If a lazily loaded
// page fails to load for that reason, reload once to pick up the new version.
const RELOAD_FLAG = 'qm:reloaded-for-update';
window.addEventListener('vite:preloadError', (event) => {
  if (!sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.setItem(RELOAD_FLAG, '1');
    event.preventDefault();
    window.location.reload();
  }
});
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10_000));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
