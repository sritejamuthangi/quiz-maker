import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { toPublicQuestion } from '@shared/grading.js';
import ConfirmDialog from '../ConfirmDialog.jsx';
import PageLoader from '../PageLoader.jsx';
import QuestionReview from '../take/QuestionReview.jsx';
import { api } from '../../lib/api.js';
import { formatDateTime, formatDuration, formatPercent } from '../../lib/format.js';

/** One person's full answer sheet, with the option to delete it. */
export default function ResponseDialog({ publicId, adminKey, responseId, test, onClose, onDeleted }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const questions = useMemo(() => new Map(test.questions.map((q) => [q.id, toPublicQuestion(q)])), [test.questions]);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, data: null, error: null });
    api
      .getResponse(publicId, adminKey, responseId)
      .then(({ data }) => !cancelled && setState({ loading: false, data, error: null }))
      .catch((error) => !cancelled && setState({ loading: false, data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [publicId, adminKey, responseId]);

  async function remove() {
    setDeleting(true);
    try {
      await api.deleteResponse(publicId, adminKey, responseId);
      setConfirmOpen(false);
      onDeleted();
    } catch (error) {
      setState((s) => ({ ...s, error }));
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  const r = state.data?.response;
  const extraLabel = test.settings.extraFieldLabel;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1 }}>{r ? r.name || '(no name)' : 'Response'}</DialogTitle>
      <DialogContent dividers>
        {state.loading && <PageLoader />}
        {state.error && <Alert severity="error">{state.error.message}</Alert>}
        {r && (
          <>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip color="primary" label={`${r.score}/${r.maxScore} · ${formatPercent(r.percent)}`} />
              {r.passed != null && <Chip color={r.passed ? 'success' : 'error'} label={r.passed ? 'Passed' : 'Not passed'} />}
              <Chip variant="outlined" label={`Time ${formatDuration(r.durationSeconds)}`} />
              {r.overtime && <Chip color="warning" label="Submitted after the time limit" />}
              {r.tabLeaves > 0 && <Chip variant="outlined" label={`Left the screen ${r.tabLeaves}×`} />}
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {extraLabel && r.extra ? `${extraLabel}: ${r.extra} · ` : ''}Submitted {formatDateTime(r.submittedAt)}
            </Typography>
            <Stack spacing={2}>
              {state.data.review.map((item, i) => {
                const question = questions.get(item.id);
                return question ? <QuestionReview key={item.id} number={i + 1} question={question} item={item} showAnswers /> : null;
              })}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => setConfirmOpen(true)} disabled={!r} sx={{ mr: 'auto' }}>
          Delete response
        </Button>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this response?"
        message="It will be removed from your results and statistics. This can't be undone."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </Dialog>
  );
}
