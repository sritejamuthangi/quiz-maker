import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

export default function PageLoader({ label = 'Loading…' }) {
  return (
    <Box role="status" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 10 }}>
      <CircularProgress />
      <Typography sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}
