import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import IosShareIcon from '@mui/icons-material/IosShare';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ShareIcon from '@mui/icons-material/Share';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import { APP_NAME } from '../config.js';
import { daysUntil, formatDate } from '../lib/format.js';
import { useInstallPrompt } from '../lib/install.js';
import { managePath, parseTestCode } from '../lib/links.js';
import { drafts, myTests } from '../lib/storage.js';

const STEPS = [
  { icon: EditNoteIcon, title: '1. Create', text: 'Add multiple choice, checkbox, true/false or fill-in-the-blank questions, or import them from Excel.' },
  { icon: QrCode2Icon, title: '2. Share', text: 'Send the link on WhatsApp, email or anywhere, or show a QR code in class.' },
  { icon: BarChartIcon, title: '3. See results', text: 'Everyone gets their score instantly. You get live results and an Excel download.' },
];

const FEATURES = [
  'Explanations shown for wrong answers',
  'Timer, shuffling and random questions per person',
  'Works on any phone. Install it like an app',
  'No sign-up for you or your students',
];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canInstall, install, showIOSHint } = useInstallPrompt();
  const [tests, setTests] = useState(() => myTests.list());
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [sharing, setSharing] = useState(null);
  const [forgetting, setForgetting] = useState(null);
  const [snack, setSnack] = useState(location.state?.deleted ? `"${location.state.deleted}" was deleted.` : '');
  const draft = drafts.get('new');
  const hasDraft = Boolean(draft && (draft.title?.trim() || draft.questions?.some((q) => q.text?.trim())));

  useEffect(() => {
    document.title = `${APP_NAME}: create a test, share a link, see scores instantly`;
  }, []);

  const openCode = (event) => {
    event.preventDefault();
    const parsed = parseTestCode(code);
    if (!parsed) {
      setCodeError('Paste the whole test link, or the 10-character code at the end of it.');
      return;
    }
    navigate(`/t/${parsed}`);
  };

  return (
    <>
      <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="md" sx={{ py: { xs: 5, sm: 8 } }}>
          <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '2.1rem', sm: '3rem' }, lineHeight: 1.15 }}>
            Make a test in minutes.
            <Box component="span" sx={{ display: 'block', color: 'primary.main' }}>
              Share a link. See scores instantly.
            </Box>
          </Typography>
          <Typography sx={{ mt: 2, fontSize: { xs: '1.05rem', sm: '1.2rem' }, color: 'text.secondary', maxWidth: 640 }}>
            Quizzes and tests with multiple choice, checkboxes, true/false and fill-in-the-blank questions. Free, no
            sign-up, works on every device.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
            <Button variant="contained" size="large" component={RouterLink} to="/create" startIcon={<AddIcon />} sx={{ minHeight: 52, px: 3 }}>
              {hasDraft ? 'Continue your draft' : 'Create a test'}
            </Button>
            {canInstall && (
              <Button variant="outlined" size="large" onClick={install} startIcon={<InstallMobileIcon />} sx={{ minHeight: 52 }}>
                Install the app
              </Button>
            )}
          </Stack>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 3 }}>
            {FEATURES.map((f) => (
              <Chip key={f} icon={<CheckCircleIcon />} label={f} variant="outlined" sx={{ height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal' } }} />
            ))}
          </Stack>
          {showIOSHint && (
            <Alert severity="info" icon={<IosShareIcon />} sx={{ mt: 3 }}>
              To install on iPhone or iPad: tap the Share button, then "Add to Home Screen".
            </Alert>
          )}
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
        <Card component="form" onSubmit={openCode} sx={{ borderRadius: 3, mb: 4 }}>
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
              Taking a test?
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                placeholder="Paste the test link or code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError('');
                }}
                error={Boolean(codeError)}
                helperText={codeError || ' '}
                slotProps={{ htmlInput: { 'aria-label': 'Test link or code', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } }}
              />
              <Button type="submit" variant="outlined" sx={{ flexShrink: 0, alignSelf: 'flex-start' }}>
                Open test
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {tests.length > 0 && (
          <Box component="section" sx={{ mb: 5 }}>
            <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
              My tests
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Saved on this device only. To open them elsewhere, use each test's private results link.
            </Typography>
            <Stack spacing={1.5}>
              {tests.map((t) => {
                const days = t.expiresAt ? daysUntil(t.expiresAt) : null;
                return (
                  <Card key={t.publicId} sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', '&:last-child': { pb: 2 } }}>
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{t.title || 'Untitled test'}</Typography>
                        <Typography variant="body2" sx={{ color: days != null && days <= 3 ? 'error.main' : 'text.secondary' }}>
                          {t.createdAt ? `Created ${formatDate(t.createdAt)}` : ''}
                          {days != null ? (days > 0 ? ` · deleted in ${days} day${days === 1 ? '' : 's'}` : ' · expired') : ''}
                        </Typography>
                      </Box>
                      <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                        <Button variant="contained" size="small" component={RouterLink} to={managePath(t.publicId, t.adminKey)} startIcon={<BarChartIcon />}>
                          Results
                        </Button>
                        <Button size="small" startIcon={<ShareIcon />} onClick={() => setSharing(t)}>
                          Share
                        </Button>
                        <Tooltip title="Remove from this device">
                          <IconButton size="small" aria-label={`Remove ${t.title} from this device`} onClick={() => setForgetting(t)}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        <Box component="section">
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
            How it works
          </Typography>
          <Grid container spacing={2}>
            {STEPS.map(({ icon: Icon, title, text }) => (
              <Grid key={title} size={{ xs: 12, sm: 4 }}>
                <Card sx={{ height: '100%', borderRadius: 3 }}>
                  <CardContent>
                    <Icon color="primary" sx={{ fontSize: 36 }} aria-hidden />
                    <Typography variant="h6" component="h3" sx={{ mt: 1 }}>
                      {title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {text}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>

      {sharing && (
        <ShareDialog
          open
          onClose={() => setSharing(null)}
          publicId={sharing.publicId}
          adminKey={sharing.adminKey}
          title={sharing.title}
        />
      )}
      <ConfirmDialog
        open={Boolean(forgetting)}
        title="Remove from this device?"
        message="The test itself is not deleted. You'll need its private results link to open the results again, so save it first if you haven't."
        confirmLabel="Remove"
        onClose={() => setForgetting(null)}
        onConfirm={() => {
          myTests.remove(forgetting.publicId);
          setTests(myTests.list());
          setForgetting(null);
        }}
      />
      <Snackbar open={Boolean(snack)} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </>
  );
}
