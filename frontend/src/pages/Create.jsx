import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import SaveIcon from '@mui/icons-material/Save';
import ShortTextIcon from '@mui/icons-material/ShortText';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { answerKeyChanges } from '@shared/grading.js';
import { LIMITS, QUESTION_TYPE_LABELS } from '@shared/limits.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ErrorState from '../components/ErrorState.jsx';
import PageLoader from '../components/PageLoader.jsx';
import ImportDialog from '../components/builder/ImportDialog.jsx';
import PreviewDialog from '../components/builder/PreviewDialog.jsx';
import QuestionEditor from '../components/builder/QuestionEditor.jsx';
import SettingsPanel from '../components/builder/SettingsPanel.jsx';
import TemplatePicker from '../components/builder/TemplatePicker.jsx';
import { api } from '../lib/api.js';
import { draftFromTest, duplicateQuestion, newDraft, newQuestion, validateDraft } from '../lib/draft.js';
import { plural } from '../lib/format.js';
import { managePath } from '../lib/links.js';
import { drafts, myTests } from '../lib/storage.js';
import { renderTurnstile, turnstileEnabled } from '../lib/turnstile.js';
import { APP_NAME } from '../config.js';

const ADD_BUTTONS = [
  { type: 'single', icon: RadioButtonCheckedIcon },
  { type: 'multiple', icon: CheckBoxIcon },
  { type: 'truefalse', icon: ToggleOnIcon },
  { type: 'blank', icon: ShortTextIcon },
];

function TurnstileBox({ onToken, resetRef }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let widget;
    let cancelled = false;
    renderTurnstile(containerRef.current, {
      onToken,
      onError: () => setError('The bot check could not run. Reload the page and try again.'),
    })
      .then((w) => {
        if (cancelled) w.remove();
        else {
          widget = w;
          resetRef.current = w.reset;
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      widget?.remove();
    };
  }, [onToken, resetRef]);
  return (
    <Box>
      <div ref={containerRef} />
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
}

export default function Create({ mode = 'new' }) {
  const editing = mode === 'edit';
  const { publicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const adminKey = editing ? new URLSearchParams(location.hash.slice(1)).get('key') || myTests.get(publicId)?.adminKey : null;
  const draftKey = editing ? `edit:${publicId}` : 'new';

  const [draft, setDraft] = useState(() => (editing ? null : drafts.get('new')));
  const [original, setOriginal] = useState(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [snack, setSnack] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(null);
  const turnstileReset = useRef(null);
  const honeypotRef = useRef(null);
  const dirtyRef = useRef(false);
  const finishedRef = useRef(false);
  const draftRef = useRef(draft);
  const [storageFailed, setStorageFailed] = useState(false);
  draftRef.current = draft;

  useEffect(() => {
    document.title = `${editing ? 'Edit test' : 'Create a test'} · ${APP_NAME}`;
  }, [editing]);

  // Load the test when editing.
  useEffect(() => {
    if (!editing) return;
    if (!adminKey) {
      setLoadError('missing_key');
      setLoading(false);
      return;
    }
    api
      .getDashboard(publicId, adminKey)
      .then(({ data }) => {
        const saved = drafts.get(draftKey);
        setDraft(saved || draftFromTest(data.test, { copy: false }));
        if (saved) {
          dirtyRef.current = true;
          setSnack('Restored your unsaved edits from this browser. Review them before saving.');
        }
        setOriginal(data.test);
        setLocked(data.test.locked);
      })
      .catch((error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, [editing, publicId, adminKey, draftKey]);

  // Autosave both new drafts and unpublished edits.
  useEffect(() => {
    if (!draft) return undefined;
    const timer = setTimeout(() => {
      if (!finishedRef.current && !drafts.set(draftKey, draft)) setStorageFailed(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, draftKey]);

  useEffect(() => {
    const flush = () => {
      if (draftRef.current && !finishedRef.current) drafts.set(draftKey, draftRef.current);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [draftKey]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!editing) return undefined;
    const handler = (event) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editing]);

  const validation = useMemo(() => (draft ? validateDraft(draft) : null), [draft]);
  const errors = showErrors && validation ? validation.errors : { settings: {}, questions: {}, general: [] };

  const update = (patch) => {
    dirtyRef.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setQuestions = (fn) => {
    dirtyRef.current = true;
    setDraft((d) => ({ ...d, questions: fn(d.questions) }));
  };

  function addQuestion(type) {
    setQuestions((qs) => [...qs, newQuestion(type)]);
    setTimeout(() => {
      const cards = document.querySelectorAll('section[aria-label^="Question "]');
      cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function importQuestions(imported) {
    setQuestions((qs) => {
      const onlyEmpty = qs.length === 1 && !qs[0].text?.trim();
      return [...(onlyEmpty ? [] : qs), ...imported].slice(0, LIMITS.questionsMax);
    });
    setSnack(`Added ${plural(imported.length, 'question')}. Check them, then publish.`);
  }

  function scrollToFirstError() {
    setTimeout(() => {
      const target = document.querySelector('[data-has-error="true"], .Mui-error');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  async function publish() {
    setShowErrors(true);
    setServerError(null);
    if (!validation.valid) {
      setSnack(`Fix ${plural(validation.count, 'problem')} before ${editing ? 'saving' : 'publishing'} (marked in red).`);
      scrollToFirstError();
      return;
    }
    if (editing && locked && original) {
      const problems = answerKeyChanges(original.questions, validation.input.questions);
      if (problems.length) {
        setServerError({ message: problems[0] });
        return;
      }
    }
    if (!editing && turnstileEnabled && !turnstileToken) {
      setSnack('The bot check is still running. Try again in a moment.');
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await api.updateTest(publicId, adminKey, validation.input);
        dirtyRef.current = false;
        finishedRef.current = true;
        drafts.clear(draftKey);
        navigate(managePath(publicId, adminKey), { state: { saved: true } });
      } else {
        const { data } = await api.createTest({
          ...validation.input,
          expiryDays: draft.expiryDays,
          turnstileToken: turnstileToken ?? undefined,
          website: honeypotRef.current?.value ?? '',
        });
        myTests.save({
          publicId: data.publicId,
          adminKey: data.adminKey,
          title: validation.input.title,
          createdAt: new Date().toISOString(),
          expiresAt: data.expiresAt,
        });
        finishedRef.current = true;
        drafts.clear('new');
        navigate(managePath(data.publicId, data.adminKey), { state: { justPublished: true } });
      }
    } catch (error) {
      setServerError(error);
      if (turnstileReset.current) {
        setTurnstileToken(null);
        turnstileReset.current();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader label="Loading your test…" />;

  if (editing && loadError) {
    return (
      <ErrorState
        title="Can't edit this test here"
        message={
          loadError === 'missing_key'
            ? "This device doesn't have the private results link for this test. Open your private link first, then choose Edit."
            : loadError
        }
      >
        <Button variant="contained" component={RouterLink} to="/">
          Go to the home page
        </Button>
      </ErrorState>
    );
  }

  if (!draft) {
    return (
      <TemplatePicker
        onPick={(templateId) => {
          finishedRef.current = false;
          setDraft(newDraft(templateId));
        }}
        onImport={() => {
          finishedRef.current = false;
          setDraft({ ...newDraft('blank'), questions: [] });
          setImportOpen(true);
        }}
      />
    );
  }

  const totalPoints = draft.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const remaining = LIMITS.questionsMax - draft.questions.length;

  return (
    <>
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h4" component="h1" sx={{ mr: 'auto', fontSize: { xs: '1.6rem', sm: '2.1rem' } }}>
            {editing ? 'Edit test' : 'New test'}
          </Typography>
          {!locked && (
            <Button startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)} disabled={remaining <= 0}>
              Import Excel / CSV
            </Button>
          )}
          {!editing && (
            <Button color="inherit" onClick={() => setConfirmReset(true)}>
              Start over
            </Button>
          )}
        </Stack>

        {storageFailed ? <Alert severity="warning" sx={{ mb: 2 }}>
          This browser cannot save your draft. Keep this page open until you publish or save changes.
        </Alert> : (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Your {editing ? 'unsaved edits are' : 'draft is'} saved on this device as you type.
          </Typography>
        )}
        {editing && <Alert severity="info" sx={{ mb: 2 }}>
          Changing question text, options, selection or timing rules requires people already taking the test to
          restart. Title, explanation and result-display edits let them continue.
        </Alert>}
        {locked && (
          <Alert severity="info" sx={{ mb: 2 }}>
            People have already answered this test, so the correct answers, points and the list of questions are
            locked (changing them would change everyone's scores). You can still fix wording, option text and
            explanations. To change answers, duplicate the test instead.
          </Alert>
        )}

        <Card sx={{ borderRadius: 3, mb: 2 }} data-has-error={Boolean(errors.title) || undefined}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <TextField
                label="Test title"
                placeholder="e.g. Chapter 3 quiz"
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                required
                fullWidth
                error={Boolean(errors.title)}
                helperText={errors.title}
                slotProps={{ htmlInput: { maxLength: LIMITS.titleMax } }}
              />
              <TextField
                label="Instructions (optional)"
                placeholder="Shown before starting, e.g. what to revise or the rules."
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                multiline
                minRows={2}
                maxRows={8}
                fullWidth
                error={Boolean(errors.description)}
                helperText={errors.description}
                slotProps={{ htmlInput: { maxLength: LIMITS.descriptionMax } }}
              />
            </Stack>
          </CardContent>
        </Card>

        {errors.general.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.general.join(' ')}
          </Alert>
        )}

        <Stack spacing={2}>
          {draft.questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              total={draft.questions.length}
              errors={errors.questions[question.id]}
              locked={locked}
              onChange={(next) => setQuestions((qs) => qs.map((q) => (q.id === question.id ? next : q)))}
              onRemove={() => setQuestions((qs) => qs.filter((q) => q.id !== question.id))}
              onDuplicate={() =>
                setQuestions((qs) => {
                  const copy = [...qs];
                  copy.splice(index + 1, 0, duplicateQuestion(question));
                  return copy;
                })
              }
              onMove={(delta) =>
                setQuestions((qs) => {
                  const target = index + delta;
                  if (target < 0 || target >= qs.length) return qs;
                  const copy = [...qs];
                  [copy[index], copy[target]] = [copy[target], copy[index]];
                  return copy;
                })
              }
            />
          ))}
        </Stack>

        {!locked && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 3, borderStyle: 'dashed' }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              {remaining > 0 ? 'Add a question' : `You've reached the limit of ${LIMITS.questionsMax} questions.`}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1 }}>
              {ADD_BUTTONS.map(({ type, icon: Icon }) => (
                <Button key={type} variant="outlined" startIcon={<Icon />} onClick={() => addQuestion(type)} disabled={remaining <= 0}>
                  {QUESTION_TYPE_LABELS[type]}
                </Button>
              ))}
            </Box>
          </Paper>
        )}

        <Box sx={{ mt: 3 }}>
          <SettingsPanel
            settings={draft.settings}
            onChange={(settings) => update({ settings })}
            errors={errors.settings}
            questionCount={draft.questions.length}
            expiryDays={draft.expiryDays}
            onExpiryChange={editing ? undefined : (expiryDays) => update({ expiryDays })}
          />
        </Box>

        {/* Honeypot: hidden from people, bots tend to fill it in. */}
        <Box aria-hidden sx={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
          <label>
            Website
            <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </Box>

        {!editing && turnstileEnabled && (
          <Box sx={{ mt: 2 }}>
            <TurnstileBox onToken={setTurnstileToken} resetRef={turnstileReset} />
          </Box>
        )}

        {serverError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {serverError.message}
            {serverError.issues?.length > 1 && (
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {serverError.issues.slice(1, 6).map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </Box>
            )}
          </Alert>
        )}
      </Container>

      <Paper
        square
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          borderTop: 1,
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <Container maxWidth="md" sx={{ py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mr: 'auto' }}>
            {plural(draft.questions.length, 'question')} · {plural(totalPoints, 'point')}
          </Typography>
          <Button
            startIcon={<VisibilityOutlinedIcon />}
            onClick={() => {
              if (!validation.valid) {
                setShowErrors(true);
                setSnack('Fix the problems marked in red to preview.');
                scrollToFirstError();
                return;
              }
              setPreviewOpen(true);
            }}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            onClick={publish}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : editing ? <SaveIcon /> : <RocketLaunchOutlinedIcon />}
          >
            {editing ? 'Save changes' : 'Publish'}
          </Button>
        </Container>
      </Paper>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={importQuestions}
        remaining={remaining + (draft.questions.length === 1 && !draft.questions[0].text?.trim() ? 1 : 0)} />
      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} test={validation?.valid ? validation.input : null} />
      <ConfirmDialog
        open={confirmReset}
        title="Start over?"
        message="This deletes your current draft from this device."
        confirmLabel="Delete draft"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          finishedRef.current = true;
          draftRef.current = null;
          drafts.clear('new');
          setDraft(null);
          setShowErrors(false);
          setConfirmReset(false);
        }}
      />
      <Snackbar open={Boolean(snack)} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </>
  );
}
