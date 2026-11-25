import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';

/** Offers new versions of the app, but never in the middle of taking a test. */
export default function UpdatePrompt() {
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  const taking = pathname.startsWith('/t/');
  return (
    <Snackbar
      open={needRefresh && !taking}
      message="A new version of the app is available."
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      action={
        <>
          <Button color="inherit" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button color="primary" variant="contained" onClick={() => updateServiceWorker(true)}>
            Update
          </Button>
        </>
      }
    />
  );
}
