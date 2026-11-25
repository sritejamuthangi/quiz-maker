import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import EventIcon from '@mui/icons-material/Event';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShareIcon from '@mui/icons-material/Share';
import { EXPIRY_DAYS } from '@shared/limits.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ErrorState from '../components/ErrorState.jsx';
import PageLoader from '../components/PageLoader.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import QuestionsTab from '../components/manage/QuestionsTab.jsx';
import ResponseDialog from '../components/manage/ResponseDialog.jsx';
import ResponsesTab from '../components/manage/ResponsesTab.jsx';
import SummaryTab from '../components/manage/SummaryTab.jsx';
import { api } from '../lib/api.js';
import { draftFromTest } from '../lib/draft.js';
import { daysUntil, formatDate, plural } from '../lib/format.js';
import { drafts, myTests } from '../lib/storage.js';
import { APP_NAME } from '../config.js';

const STATUS_CHIP = {
  open: { label: 'Open', color: 'success' },
  closed: { label: 'Closed', color: 'default' },
  full: { label: 'Full', color: 'warning' },
  expired: { label: 'Expired', color: 'error' },
};

/** Loads the dashboard and keeps it fresh (cheap 304 responses when nothing changed). */
function useDashboard(publicId, adminKey) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const etagRef = useRef(null);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!adminKey) {
        setState({ loading: false, data: null, error: { code: 'missing_key' } });
        return;
      }
      try {
        const res = await api.getDashboard(publicId, adminKey, silent ? etagRef.current : null);
        if (res.notModified) return;
        etagRef.current = res.etag;
        setState({ loading: false, data: res.data, error: null });
      } catch (error) {
        if (!silent) setState((s) => ({ loading: false, data: s.data, error }));
      }
    },
    [publicId, adminKey],
  );

  useEffect(() => {
    load();
    const refresh = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  return { ...state, reload: load };
}

function MissingKey() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const open = () => {
    const match = /\/manage\/([a-z0-9]{10})#key=([A-Za-z0-9_-]{32})/.exec(value.trim());
    if (!match) {
      setError('Paste the whole private link, including the part after #key=');
      return;
    }
    navigate(`/manage/${match[1]}#key=${match[2]}`);
  };
  return (
    <ErrorState
      icon={LockOutlinedIcon}
      title="Private results link needed"
      message="Results can only be opened with the private link you got when you published the test. Paste it below."
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%', maxWidth: 560 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="https://…/manage/…#key=…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={Boolean(error)}
          helperText={error || ' '}
          slotProps={{ htmlInput: { 'aria-label': 'Private results link' } }}
        />
        <Button variant="contained" onClick={open} sx={{ flexShrink: 0, alignSelf: 'flex-start' }}>
          Open
        </Button>
      </Stack>
    </ErrorState>
  );
}

export default function Manage() {
  const { publicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const hashKey = new URLSearchParams(location.hash.slice(1)).get('key');
  const adminKey = hashKey || myTests.get(publicId)?.adminKey || null;

  const { loading, data, error, reload } = useDashboard(publicId, adminKey);
  const [tab, setTab] = useState(0);
  const [focusQuestion, setFocusQuestion] = useState(null);
  const [shareOpen, setShareOpen] = useState(Boolean(location.state?.justPublished));
  const [responseId, setResponseId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [busy, setBusy] = useState('');
  const [snack, setSnack] = useState(location.state?.saved ? 'Changes saved.' : '');

  const test = data?.test;

  // Remember the test (and its key) on this device once the key is confirmed to work.
  useEffect(() => {
    if (!test || !adminKey) return;
    myTests.save({ publicId, adminKey, title: test.title, createdAt: test.createdAt, expiresAt: test.expiresAt });
    document.title = `Results: ${test.title} · ${APP_NAME}`;
  }, [test, publicId, adminKey]);

  async function patch(body, message) {
    setBusy('patch');
    try {
      await api.updateTest(publicId, adminKey, body);
      await reload();
      if (message) setSnack(message);
    } catch (e) {
      setSnack(e.message);
    } finally {
      setBusy('');
    }
  }

  async function exportExcel() {
    setBusy('export');
    try {
      const [{ data: exportData }, excel] = await Promise.all([api.exportResults(publicId, adminKey), import('../lib/excel.js')]);
      await excel.exportResultsToExcel(exportData);
    } catch (e) {
      setSnack(e.message || "Couldn't create the Excel file.");
    } finally {
      setBusy('');
    }
  }

  async function deleteTest() {
    setBusy('delete');
    try {
      await api.deleteTest(publicId, adminKey);
      myTests.remove(publicId);
      navigate('/', { state: { deleted: test.title } });
    } catch (e) {
      setSnack(e.message);
      setBusy('');
      setConfirmDelete(false);
    }
  }

  function duplicate(force = false) {
    const existing = drafts.get('new');
    const hasDraft = existing && (existing.title?.trim() || existing.questions?.some((q) => q.text?.trim()));
    if (hasDraft && !force) {
      setConfirmDuplicate(true);
      return;
    }
    drafts.set('new', draftFromTest(test));
    navigate('/create');
  }

  if (loading) return <PageLoader label="Loading results…" />;
  if (error?.code === 'missing_key') return <MissingKey />;
  if (error && !data) {
    return (
      <ErrorState
        icon={LockOutlinedIcon}
        title={error.status === 401 ? "This results link isn't valid" : "Couldn't load the results"}
        message={error.status === 401 ? 'The test may have been deleted, or the link was copied only partly.' : error.message}
      >
        {error.status === 401 ? (
          <Button variant="contained" component={RouterLink} to="/">
            Go to the home page
          </Button>
        ) : (
          <Button variant="contained" onClick={() => reload()}>
            Try again
          </Button>
        )}
      </ErrorState>
    );
  }

  const status = STATUS_CHIP[test.status] ?? STATUS_CHIP.open;
  const daysLeft = daysUntil(test.expiresAt);
  const responseCount = data.responses.length;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' }, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" color={status.color} label={status.label} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {plural(responseCount, 'response')}
            </Typography>
          </Stack>
          <Typography variant="h4" component="h1" sx={{ mt: 0.5, overflowWrap: 'anywhere', fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
            {test.title}
          </Typography>
          <Typography variant="body2" sx={{ color: daysLeft <= 3 ? 'error.main' : 'text.secondary', mt: 0.5 }}>
            {daysLeft > 0
              ? `Deleted automatically on ${formatDate(test.expiresAt)} (in ${plural(daysLeft, 'day')}).`
              : 'Expired: it will be deleted soon.'}{' '}
            <Button size="small" onClick={() => setExtendOpen(true)} sx={{ minHeight: 0, py: 0 }}>
              Keep it longer
            </Button>
          </Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="contained" startIcon={<ShareIcon />} onClick={() => setShareOpen(true)}>
            Share
          </Button>
          <Button
            variant="outlined"
            startIcon={busy === 'export' ? <CircularProgress size={18} /> : <FileDownloadOutlinedIcon />}
            onClick={exportExcel}
            disabled={busy === 'export' || responseCount === 0}
          >
            Download Excel
          </Button>
          <IconButton aria-label="More actions" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
        </Stack>
      </Stack>

      {test.status === 'expired' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          This test has expired and nobody can take it. Download your results now, or keep it longer.
        </Alert>
      )}
      {test.status === 'full' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This test reached the maximum of {test.limits.responsesPerTest} responses. Delete some responses or
          duplicate the test to collect more.
        </Alert>
      )}

      <FormControlLabel
        sx={{ mb: 1 }}
        control={
          <Switch
            checked={test.isOpen}
            disabled={busy === 'patch' || test.status === 'expired'}
            onChange={(e) =>
              patch(
                { isOpen: e.target.checked },
                e.target.checked ? 'The test is open again.' : 'Closed. People who already started can still submit.',
              )
            }
          />
        }
        label={test.isOpen ? 'Accepting responses' : 'Not accepting responses'}
      />

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label="Summary" />
        <Tab label={`Responses (${responseCount})`} />
        <Tab label="Questions" />
      </Tabs>

      {tab === 0 && (
        <SummaryTab
          test={test}
          stats={data.stats}
          onShare={() => setShareOpen(true)}
          onShowQuestion={(id) => {
            setFocusQuestion(id);
            setTab(2);
          }}
        />
      )}
      {tab === 1 && <ResponsesTab responses={data.responses} test={test} onOpen={setResponseId} />}
      {tab === 2 && <QuestionsTab test={test} stats={data.stats} focusId={focusQuestion} />}

      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 3 }}>
        Updates automatically every 30 seconds while this page is open.
      </Typography>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            navigate(`/manage/${publicId}/edit`);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit questions
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            duplicate();
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          Duplicate as a new test
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setExtendOpen(true);
          }}
        >
          <ListItemIcon>
            <EventIcon fontSize="small" />
          </ListItemIcon>
          Keep it longer
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setConfirmDelete(true);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteOutlinedIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete test
        </MenuItem>
      </Menu>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        publicId={publicId}
        adminKey={adminKey}
        title={test.title}
        justPublished={Boolean(location.state?.justPublished)}
      />

      {responseId != null && (
        <ResponseDialog
          publicId={publicId}
          adminKey={adminKey}
          responseId={responseId}
          test={test}
          onClose={() => setResponseId(null)}
          onDeleted={() => {
            setResponseId(null);
            setSnack('Response deleted.');
            reload();
          }}
        />
      )}

      <Dialog open={extendOpen} onClose={() => setExtendOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Keep the test longer</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>The test and its results will be kept for this long, starting today.</Typography>
          <TextField select fullWidth label="Keep for" value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))}>
            {EXPIRY_DAYS.map((d) => (
              <MenuItem key={d} value={d}>
                {d} days from today
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExtendOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy === 'patch'}
            onClick={async () => {
              setExtendOpen(false);
              await patch({ extendDays }, `It will be kept for ${extendDays} more days.`);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this test?"
        message={`The test and all ${plural(responseCount, 'response')} will be deleted for good. Download the Excel file first if you need the results.`}
        confirmLabel="Delete forever"
        danger
        busy={busy === 'delete'}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteTest}
      />
      <ConfirmDialog
        open={confirmDuplicate}
        title="Replace your draft?"
        message="You have an unpublished draft on this device. Duplicating will replace it with a copy of this test."
        confirmLabel="Replace draft"
        onClose={() => setConfirmDuplicate(false)}
        onConfirm={() => {
          setConfirmDuplicate(false);
          duplicate(true);
        }}
      />
      <Snackbar open={Boolean(snack)} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Container>
  );
}
