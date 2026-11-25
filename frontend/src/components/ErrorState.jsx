import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/** Friendly full-page message (closed test, bad link, offline…). */
export default function ErrorState({ title, message, icon, children }) {
  const Icon = icon ?? InfoOutlinedIcon;
  return (
    <Box sx={{ textAlign: 'center', py: { xs: 6, sm: 10 }, px: 2 }}>
      <Icon sx={{ fontSize: 56, color: 'text.secondary', mb: 1 }} aria-hidden />
      <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {message && (
        <Typography sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', mb: 3 }}>{message}</Typography>
      )}
      {children && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center', alignItems: 'center' }}>
          {children}
        </Stack>
      )}
    </Box>
  );
}
