import { Link as RouterLink, useLocation } from 'react-router';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import { APP_NAME } from '../config.js';
import { useInstallPrompt } from '../lib/install.js';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { canInstall, install } = useInstallPrompt();
  const taking = pathname.startsWith('/t/');
  const building = pathname === '/create' || pathname.endsWith('/edit');

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
          <Box
            component={RouterLink}
            to="/"
            aria-label={`${APP_NAME} home`}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 'auto', color: 'text.primary', textDecoration: 'none' }}
          >
            <Box component="img" src="/favicon.svg" alt="" sx={{ width: 32, height: 32, display: 'block' }} />
            <Typography component="span" sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', sm: '1.2rem' } }}>
              {APP_NAME}
            </Typography>
          </Box>
          {canInstall && !taking && (
            <Button onClick={install} startIcon={<InstallMobileIcon />} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              Install app
            </Button>
          )}
          {!taking && !building && (
            <Button variant="contained" component={RouterLink} to="/create" startIcon={<AddIcon />}>
              Create test
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, pb: 'env(safe-area-inset-bottom)' }}>
        {children}
      </Box>

      {!taking && (
        <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 3, mt: 4 }}>
          <Container
            maxWidth="md"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {APP_NAME}: no sign-up, free to use. Tests are deleted automatically when they expire.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Link component={RouterLink} to="/privacy" variant="body2">
                Privacy
              </Link>

              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                 Built by{' '}
                <Link
                  href="https://www.linkedin.com/in/sritejamuthangi/"
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                >
                  Sriteja Muthangi
                </Link>
              </Typography>
            </Box>
          </Container>
        </Box>
      )}
    </Box>
  );
}
