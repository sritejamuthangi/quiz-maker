import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
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
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { LIMITS, RESULTS_VISIBILITY_LABELS } from '@shared/limits.js';
import ErrorState from '../components/ErrorState.jsx';
import PageLoader from '../components/PageLoader.jsx';
import ResultView from '../components/take/ResultView.jsx';
import TestRunner from '../components/take/TestRunner.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, plural } from '../lib/format.js';
import { attempts, results, taker } from '../lib/storage.js';
import { APP_NAME } from '../config.js';

const UNAVAILABLE = {
  closed: { title: 'This test is closed', message: "It isn't accepting responses anymore. Ask the person who shared it if you think this is a mistake.", icon: EventBusyIcon },
  full: { title: 'This test is full', message: 'It has reached the maximum number of responses.', icon: EventBusyIcon },
  expired: { title: 'This test has expired', message: 'Tests are deleted automatically after a while, and this one is gone.', icon: EventBusyIcon },
  not_found: { title: 'Test not found', message: 'Check that you copied the whole link. The test may also have been deleted.', icon: HelpOutlinedIcon },
};

function Intro({ meta, defaults, starting, startError, onStart, lastResult, onShowLastResult }) {
  const { settings } = meta;
  const [name, setName] = useState(defaults.name ?? '');
  const [extra, setExtra] = useState(defaults.extra ?? '');
  const [touched, setTouched] = useState(false);
  const nameMissing = settings.requireName && !name.trim();
  const extraMissing = Boolean(settings.extraFieldLabel) && !extra.trim();

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (nameMissing || extraMissing) return;
    onStart({ name: settings.requireName ? name.trim() : '', extra: settings.extraFieldLabel ? extra.trim() : '' });
  };

  const facts = [
    plural(meta.questionCount, 'question'),
    meta.totalPoints != null ? plural(meta.totalPoints, 'point') : null,
    settings.timeLimitMinutes ? `${settings.timeLimitMinutes} min time limit` : 'No time limit',
    settings.allowRetakes ? 'Retakes allowed' : 'One attempt per browser',
  ].filter(Boolean);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
      <Paper component="form" onSubmit={submit} noValidate variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4 }}>
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere', fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
          {meta.title}
        </Typography>
        {meta.description && (
          <Typography sx={{ mt: 1.5, color: 'text.secondary', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {meta.description}
          </Typography>
        )}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, my: 2.5 }}>
          {facts.map((fact) => (
            <Chip key={fact} label={fact} />
          ))}
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          After you submit you'll see: {RESULTS_VISIBILITY_LABELS[settings.resultsVisibility].toLowerCase()}.
          {settings.closesAt ? ` Open until ${formatDateTime(settings.closesAt)}.` : ''}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          The creator can see how often you switch away from this screen. This does not affect your score.
        </Typography>
        {settings.timeLimitMinutes && (
          <Alert severity="info" sx={{ my: 2 }}>
            The timer starts when you press Start and keeps running if you leave the page. When it reaches zero,
            your answers are locked and submission is attempted automatically. If the browser is closed or asleep,
            submission resumes when you reopen it.
          </Alert>
        )}

        <Stack spacing={2} sx={{ mt: 2 }}>
          {settings.requireName && (
            <TextField
              label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              error={touched && nameMissing}
              helperText={touched && nameMissing ? 'Please enter your name' : 'Shown to the person who made the test'}
              slotProps={{ htmlInput: { maxLength: LIMITS.nameMax } }}
            />
          )}
          {settings.extraFieldLabel && (
            <TextField
              label={settings.extraFieldLabel}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              required
              error={touched && extraMissing}
              helperText={touched && extraMissing ? `Please fill in ${settings.extraFieldLabel}` : ' '}
              slotProps={{ htmlInput: { maxLength: LIMITS.extraMax } }}
            />
          )}
        </Stack>

        {startError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {startError}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          startIcon={starting ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
          disabled={starting}
          sx={{ mt: 3, minHeight: 52, fontSize: '1.05rem' }}
        >
          {starting ? 'Starting…' : 'Start'}
        </Button>
        {lastResult && (
          <Button fullWidth onClick={onShowLastResult} sx={{ mt: 1 }}>
            See my last result
          </Button>
        )}
      </Paper>
    </Container>
  );
}

export default function Take() {
  const { publicId } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | intro | running | result | unavailable | error
  const [meta, setMeta] = useState(null);
  const [unavailable, setUnavailable] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(() => attempts.get(publicId));
  const [record, setRecord] = useState(null);
  const [notice, setNotice] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [leaveNotice, setLeaveNotice] = useState(0);
  const [storageFailed, setStorageFailed] = useState(false);
  const attemptRef = useRef(attempt);
  const submittingRef = useRef(false);
  const loadIdRef = useRef(0);

  const saveAttempt = useCallback(
    (updater) => {
      const current = attemptRef.current;
      if (!current) return;
      const next = typeof updater === 'function' ? updater(current) : updater;
      attemptRef.current = next;
      setAttempt(next);
      if (!attempts.set(publicId, next)) setStorageFailed(true);
    },
    [publicId],
  );

  const loadMeta = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setPhase(attemptRef.current ? 'running' : 'loading');
    setLoadError(null);
    try {
      const { data } = await api.getTest(publicId);
      if (loadId !== loadIdRef.current) return;
      setMeta(data);
      document.title = `${data.title} · ${APP_NAME}`;
      if (attemptRef.current) return; // resuming: stay on the test
      const saved = results.get(publicId);
      if (saved && (!data.settings.allowRetakes || data.status !== 'open')) {
        setRecord(saved);
        setNotice('You already submitted this test on this device. Here is your result.');
        setPhase('result');
      } else if (data.status !== 'open') {
        setUnavailable(data.status);
        setPhase('unavailable');
      } else {
        setPhase('intro');
      }
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      if (attemptRef.current) return;
      const saved = results.get(publicId);
      if (saved) {
        setRecord(saved);
        setNotice('This is your saved result from this device.');
        setPhase('result');
      } else if (error.status === 404) {
        setUnavailable('not_found');
        setPhase('unavailable');
      } else if (error.status === 410) {
        setUnavailable('expired');
        setPhase('unavailable');
      } else {
        setLoadError(error.message);
        setPhase('error');
      }
    }
  }, [publicId]);

  useEffect(() => {
    if (attemptRef.current) setPhase('running');
    loadMeta();
    return () => { loadIdRef.current += 1; };
  }, [loadMeta]);

  async function start({ name, extra }) {
    loadIdRef.current += 1;
    setStarting(true);
    setStartError(null);
    taker.set({ name, extra });
    try {
      const now = Date.now();
      const { data } = await api.startTest(publicId);
      // Metadata may have been cached before the creator changed required fields.
      if ((data.settings.requireName && !name) || (data.settings.extraFieldLabel &&
          (!extra || data.settings.extraFieldLabel !== meta.settings.extraFieldLabel))) {
        setMeta((m) => ({ ...m, settings: data.settings }));
        setStartError('The creator updated the details needed to start. Please fill them in and try again.');
        return;
      }
      const next = {
        token: data.token,
        title: data.title,
        settings: data.settings,
        questions: data.questions,
        deadline: data.settings.timeLimitMinutes ? now + data.settings.timeLimitMinutes * 60_000 : null,
        answers: {},
        index: 0,
        tabLeaves: 0,
        name: data.settings.requireName ? name : '',
        extra: data.settings.extraFieldLabel ? extra : '',
        pending: false,
      };
      if (!attempts.set(publicId, next)) setStorageFailed(true);
      attemptRef.current = next;
      setAttempt(next);
      setNotice(null);
      setPhase('running');
    } catch (error) {
      if (['closed', 'full', 'expired'].includes(error.code)) {
        setUnavailable(error.code);
        setPhase('unavailable');
      } else {
        setStartError(error.message);
      }
    } finally {
      setStarting(false);
    }
  }

  const submit = useCallback(async () => {
    let current = attemptRef.current;
    if (!current || submittingRef.current) return;
    submittingRef.current = true;
    // Persist the submission intent before the request. Retrying/reloading sends
    // this same answer snapshot, even if the response was lost on the network.
    if (!current.pending) {
      current = { ...current, pending: true };
      saveAttempt(current);
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data } = await api.submitTest(publicId, {
        token: current.token,
        name: current.name,
        extra: current.extra,
        answers: current.answers,
        tabLeaves: current.tabLeaves,
      });
      const saved = { result: data.result, questions: current.questions, title: current.title, name: current.name };
      if (!results.set(publicId, saved)) setStorageFailed(true);
      attempts.clear(publicId);
      attemptRef.current = null;
      loadIdRef.current += 1;
      setRecord(saved);
      setAttempt(null);
      setOffline(false);
      setPhase('result');
      window.scrollTo({ top: 0 });
    } catch (error) {
      if (error.isNetwork) setOffline(true);
      else {
        setOffline(false);
        setSubmitError(error);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [publicId, saveAttempt]);

  useEffect(() => {
    if (phase === 'running' && attempt?.pending) submit();
  }, [phase, attempt?.token, attempt?.pending, submit]);

  // Offline when submitting: keep answers on the device and retry automatically.
  useEffect(() => {
    if (!offline) return undefined;
    const retry = () => submit();
    window.addEventListener('online', retry);
    const timer = setInterval(retry, 15_000);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, [offline, submit]);

  // Count how often the person leaves the test screen (shown to the creator as a hint).
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveAttempt((a) => a.pending ? a : { ...a, tabLeaves: (a.tabLeaves ?? 0) + 1 });
      } else {
        setLeaveNotice(attemptRef.current?.tabLeaves ?? 0);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase, saveAttempt]);

  function discardAttempt() {
    attempts.clear(publicId);
    attemptRef.current = null;
    setAttempt(null);
    setOffline(false);
    setSubmitError(null);
    loadMeta();
  }

  function retake() {
    setRecord(null);
    setNotice(null);
    if (meta?.status === 'open') setPhase('intro');
    else loadMeta();
  }

  if (phase === 'loading') return <PageLoader label="Loading the test…" />;

  if (phase === 'error') {
    return (
      <ErrorState title="Couldn't load the test" message={loadError} icon={CloudOffIcon}>
        <Button variant="contained" onClick={loadMeta}>
          Try again
        </Button>
      </ErrorState>
    );
  }

  if (phase === 'unavailable') {
    const info = UNAVAILABLE[unavailable] ?? UNAVAILABLE.not_found;
    return (
      <ErrorState title={info.title} message={info.message} icon={info.icon}>
        <Button variant="contained" component={RouterLink} to="/">
          Go to the home page
        </Button>
      </ErrorState>
    );
  }

  if (phase === 'result' && record) {
    return (
      <ResultView
        result={record.result}
        questions={record.questions}
        title={record.title}
        name={record.name}
        notice={storageFailed ? 'Your result is shown below, but this browser could not save it for later. Keep this page open or save a copy.' : notice}
        onRetake={meta?.settings.allowRetakes && meta.status === 'open' ? retake : undefined}
        actions={
          <Button component={RouterLink} to="/create">
            Make your own test
          </Button>
        }
      />
    );
  }

  if (phase === 'running' && attempt) {
    const fatal = submitError && !['rate_limited', 'quota_submit', 'server_error', 'error'].includes(submitError.code);
    return (
      <>
        <TestRunner
          title={attempt.title}
          questions={attempt.questions}
          answers={attempt.answers}
          onAnswer={(id, value) => saveAttempt((a) =>
            a.pending || (a.deadline && a.deadline <= Date.now()) ? a : { ...a, answers: { ...a.answers, [id]: value } },
          )}
          index={Math.min(attempt.index ?? 0, attempt.questions.length - 1)}
          onIndexChange={(index) => saveAttempt((a) => ({ ...a, index }))}
          deadline={attempt.deadline}
          onTimeUp={submit}
          onSubmit={submit}
          submitting={submitting}
          readOnly={Boolean(attempt.pending)}
          banner={
            <>
              {storageFailed && <Alert severity="warning" sx={{ mb: 2 }}>
                This browser cannot save your progress. Keep this page open until your result appears.
              </Alert>}
              {offline ? (
                <Alert severity="warning" icon={<CloudOffIcon />} sx={{ mb: 2 }}
                  action={<Button color="inherit" disabled={submitting} onClick={submit}>Retry</Button>}>
                  Can't reach the server. Your answers are locked for submission; we'll retry when connected.
                  Keep this page open, or reopen the same test link in this browser to resume.
                </Alert>
              ) : attempt.pending && !submitting && !submitError ? (
                <Alert severity="info" sx={{ mb: 2 }} action={<Button onClick={submit}>Retry</Button>}>
                  Your answers are locked. Retry to finish submitting.
                </Alert>
              ) : null}
            </>
          }
        />
        <Dialog open={submitting && !offline} aria-labelledby="submitting-title">
          <DialogContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
            <CircularProgress size={28} />
            <Typography id="submitting-title">Submitting your answers…</Typography>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(submitError)} fullWidth maxWidth="xs">
          <DialogTitle>Couldn't submit</DialogTitle>
          <DialogContent>
            <Typography>{submitError?.message}</Typography>
            {fatal && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                This attempt can't be submitted anymore.
        </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            {fatal ? (
              <Button variant="contained" onClick={discardAttempt}>
                OK
              </Button>
            ) : (
              <>
                <Button onClick={() => setSubmitError(null)}>View answers</Button>
                <Button variant="contained" onClick={submit}>
                  Try again
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>
        <Snackbar
          open={leaveNotice > 0}
          autoHideDuration={5000}
          onClose={() => setLeaveNotice(0)}
          message={`You left the test screen (${plural(leaveNotice, 'time')}). The test creator can see this.`}
        />
      </>
    );
  }

  if (meta) {
    return (
      <Box>
        <Intro
          meta={meta}
          defaults={taker.get()}
          starting={starting}
          startError={startError}
          onStart={start}
          lastResult={results.get(publicId)}
          onShowLastResult={() => {
            setRecord(results.get(publicId));
            setNotice('This is your last result on this device.');
            setPhase('result');
          }}
        />
      </Box>
    );
  }

  return <PageLoader />;
}
