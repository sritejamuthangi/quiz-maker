import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ShareIcon from '@mui/icons-material/Share';
import QrCode from './QrCode.jsx';
import { canNativeShare, copyText, mailtoLink, manageUrl, nativeShare, shareUrl } from '../lib/links.js';
import { myTests } from '../lib/storage.js';

function LinkField({ label, value, copied, onCopy }) {
  return (
    <TextField
      value={value}
      fullWidth
      size="small"
      onFocus={(event) => event.target.select()}
      slotProps={{
        htmlInput: { readOnly: true, 'aria-label': label },
        input: {
          sx: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.85rem' },
          endAdornment: (
            <InputAdornment position="end">
              <Button size="small" onClick={onCopy} startIcon={copied ? <DoneIcon /> : <ContentCopyIcon />} sx={{ minHeight: 32 }}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

export default function ShareDialog({ open, onClose, publicId, adminKey, title, justPublished = false }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [copied, setCopied] = useState('');
  const [showPrivateQr, setShowPrivateQr] = useState(false);
  const link = shareUrl(publicId);
  const privateLink = adminKey ? manageUrl(publicId, adminKey) : null;

  async function copy(text, which) {
    if (await copyText(text)) {
      setCopied(which);
      setTimeout(() => setCopied(''), 2000);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{justPublished ? 'Your test is live!' : 'Share your test'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={4}>
          <Box component="section">
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
              Link for people taking the test
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Anyone with this link can take the test. No sign-up needed.
            </Typography>
            <LinkField label="Test link" value={link} copied={copied === 'share'} onCopy={() => copy(link, 'share')} />
            <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
              {canNativeShare() && (
                <Button
                  variant="contained"
                  startIcon={<ShareIcon />}
                  onClick={() => nativeShare({ title, text: `Take the test "${title}"`, url: link })}
                >
                  Share…
                </Button>
              )}
              <Button startIcon={<OpenInNewIcon />} href={link} target="_blank" rel="noopener">
                Open test
              </Button>
            </Stack>
            <Stack sx={{ mt: 2, alignItems: 'center', gap: 1 }}>
              <QrCode value={link} label="QR code for the test link" />
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                Show this QR code on a screen or print it. People scan it to start.
              </Typography>
            </Stack>
          </Box>

          {privateLink && (
            <Box component="section">
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockOutlinedIcon fontSize="small" aria-hidden /> Your private results link
              </Typography>
              <Alert severity="warning" sx={{ my: 1.5 }}>
                Treat this like a password: anyone with it can see the results and edit or delete the test. Don't
                give it to test takers. Save it somewhere safe: it's the only way to open your results on another
                device.
              </Alert>
              <LinkField
                label="Private results link"
                value={privateLink}
                copied={copied === 'private'}
                onCopy={() => copy(privateLink, 'private')}
              />
              <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Button
                  startIcon={<EmailOutlinedIcon />}
                  href={mailtoLink({
                    subject: `Results link for "${title}"`,
                    body: `Private results link (keep it secret):\n${privateLink}\n\nLink for test takers:\n${link}\n`,
                  })}
                >
                  Email it to myself
                </Button>
                <Button startIcon={<QrCode2Icon />} onClick={() => setShowPrivateQr((v) => !v)}>
                  {showPrivateQr ? 'Hide QR code' : 'Open on another device'}
                </Button>
              </Stack>
              {showPrivateQr && (
                <Stack sx={{ mt: 2, alignItems: 'center', gap: 1 }}>
                  <QrCode value={privateLink} label="QR code for your private results link" />
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    Scan with your phone to open your results there. Keep this QR code private.
                  </Typography>
                </Stack>
              )}
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                {myTests.isPersistent() ? 'It is also saved under "My tests" on this device.'
                  : 'This browser could not save your private link. Copy it now so you can return to your results.'}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
