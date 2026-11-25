import { Suspense, lazy, useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider } from '@mui/material/styles';
import { buildTheme } from './theme.js';
import Layout from './components/Layout.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import PageLoader from './components/PageLoader.jsx';

// Pages load on demand so people opening a shared test link download as little as possible.
const Home = lazy(() => import('./pages/Home.jsx'));
const Create = lazy(() => import('./pages/Create.jsx'));
const Take = lazy(() => import('./pages/Take.jsx'));
const Manage = lazy(() => import('./pages/Manage.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const UpdatePrompt = import.meta.env.PROD ? lazy(() => import('./components/UpdatePrompt.jsx')) : () => null;

export default function App() {
  const location = useLocation();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const theme = useMemo(() => buildTheme(prefersDark ? 'dark' : 'light'), [prefersDark]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Layout>
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<Create />} />
              <Route path="/t/:publicId" element={<Take />} />
              <Route path="/manage/:publicId" element={<Manage />} />
              <Route path="/manage/:publicId/edit" element={<Create mode="edit" />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
      <Suspense fallback={null}>
        <UpdatePrompt />
      </Suspense>
    </ThemeProvider>
  );
}
