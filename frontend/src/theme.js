import { createTheme } from '@mui/material/styles';

// System fonts: no web-font download, fast on slow phones.
const fontFamily =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

export function buildTheme(mode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#5cc3d8' : '#0b5a72', contrastText: dark ? '#05232b' : '#ffffff' },
      secondary: { main: dark ? '#ffb38a' : '#b4441c' },
      success: { main: dark ? '#6fcf75' : '#2e7d32' },
      error: { main: dark ? '#ff8a80' : '#c62828' },
      warning: { main: dark ? '#ffcc66' : '#a15c00' },
      background: dark ? { default: '#0e1417', paper: '#151d21' } : { default: '#f3f6f7', paper: '#ffffff' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily,
      h1: { fontWeight: 800, letterSpacing: '-0.02em' },
      h2: { fontWeight: 800, letterSpacing: '-0.02em' },
      h3: { fontWeight: 800, letterSpacing: '-0.01em' },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minHeight: 44, borderRadius: 10 } },
      },
      MuiCard: { defaultProps: { variant: 'outlined' } },
      MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTooltip: { defaultProps: { enterTouchDelay: 300 } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    },
  });
}
