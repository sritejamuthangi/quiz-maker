import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

/** QR code image (the library is loaded only when a QR code is shown). */
export default function QrCode({ value, size = 200, label }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    import('qrcode')
      .then(({ default: QR }) => QR.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' }))
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return <Skeleton variant="rounded" width={size} height={size} />;
  return (
    <Box
      component="img"
      src={src}
      alt={label}
      sx={{ width: size, height: size, bgcolor: '#fff', p: 1, borderRadius: 2, border: 1, borderColor: 'divider' }}
    />
  );
}
