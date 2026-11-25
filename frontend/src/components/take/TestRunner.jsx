import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GridViewIcon from '@mui/icons-material/GridView';
import SendIcon from '@mui/icons-material/Send';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { isAnswered } from '@shared/grading.js';
import QuestionInput, { QUESTION_HINTS } from './QuestionInput.jsx';
import { useCountdown } from './useCountdown.js';
import { formatDuration, plural } from '../../lib/format.js';

function Timer({ secondsLeft }) {
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (secondsLeft === 300) setAnnouncement('5 minutes left');
    else if (secondsLeft === 60) setAnnouncement('1 minute left');
  }, [secondsLeft]);
  const color = secondsLeft <= 60 ? 'error' : secondsLeft <= 300 ? 'warning' : 'default';
  return (
    <>
      <Chip
        icon={<TimerOutlinedIcon />}
        color={color}
        variant={color === 'default' ? 'outlined' : 'filled'}
        label={formatDuration(secondsLeft)}
        aria-label={`Time left: ${formatDuration(secondsLeft)}`}
        sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '1rem' }}
      />
      <Box aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {announcement}
      </Box>
    </>
  );
}

/**
 * Shows one question per screen with navigation, progress and an optional timer.
 * Fully controlled: the parent owns answers/index (so it can save them).
 */
export default function TestRunner({
  title,
  questions,
  answers,
  onAnswer,
  index,
  onIndexChange,
  deadline,
  onTimeUp,
  onSubmit,
  submitting = false,
  readOnly = false,
  banner,
}) {
  const [gridOpen, setGridOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const headingRef = useRef(null);
  const firstRender = useRef(true);
  const secondsLeft = useCountdown(deadline, onTimeUp);

  const question = questions[index];
  const answeredFlags = useMemo(() => questions.map((q) => isAnswered(q, answers[q.id])), [questions, answers]);
  const answeredCount = answeredFlags.filter(Boolean).length;
  const unanswered = answeredFlags.map((a, i) => (a ? null : i)).filter((i) => i !== null);
  const isLast = index === questions.length - 1;

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  const go = (i) => onIndexChange(Math.min(questions.length - 1, Math.max(0, i)));
  const labelId = `question-${question.id}-text`;

  return (
    <Box>
      <Paper
        square
        sx={{ position: 'sticky', top: { xs: 56, sm: 64 }, zIndex: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Container maxWidth="md" sx={{ py: 1.25 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {answeredCount} of {questions.length} answered
              </Typography>
            </Box>
            {secondsLeft != null && <Timer secondsLeft={secondsLeft} />}
          </Stack>
        </Container>
        <LinearProgress
          variant="determinate"
          value={(answeredCount / questions.length) * 100}
          aria-label="Progress"
          sx={{ height: 4 }}
        />
      </Paper>

      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 } }}>
        {banner}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="overline" sx={{ fontWeight: 700, lineHeight: 1.5 }}>
              Question {index + 1} of {questions.length}
            </Typography>
            <Chip size="small" label={plural(question.points, 'point')} />
          </Stack>
          {question.type !== 'blank' && (
            <Typography
              id={labelId}
              ref={headingRef}
              tabIndex={-1}
              variant="h6"
              component="h2"
              sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mb: 0.5, outline: 'none', fontSize: { xs: '1.15rem', sm: '1.3rem' } }}
            >
              {question.text}
            </Typography>
          )}
          {question.type === 'blank' && (
            <Typography id={labelId} ref={headingRef} tabIndex={-1} component="h2" sx={{ position: 'absolute', left: -9999, outline: 'none' }}>
              Question {index + 1}: fill in the blank
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {QUESTION_HINTS[question.type]}
          </Typography>
          <QuestionInput
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={(value) => onAnswer(question.id, value)}
            disabled={submitting || readOnly || secondsLeft === 0}
            labelledBy={labelId}
          />
        </Paper>

        <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center' }}>
          <Button onClick={() => go(index - 1)} disabled={index === 0} startIcon={<ChevronLeftIcon />} variant="outlined">
            Back
          </Button>
          <Button onClick={() => setGridOpen(true)} startIcon={<GridViewIcon />} sx={{ mx: 'auto' }}>
            All
          </Button>
          {isLast ? (
            <Button variant="contained" endIcon={<SendIcon />} onClick={() => setConfirmOpen(true)} disabled={submitting || readOnly}>
              Submit
            </Button>
          ) : (
            <Button variant="contained" endIcon={<ChevronRightIcon />} onClick={() => go(index + 1)}>
              Next
            </Button>
          )}
        </Stack>
      </Container>

      <Dialog open={gridOpen} onClose={() => setGridOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>All questions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Filled = answered. Tap a number to jump to it.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: 1 }}>
            {questions.map((q, i) => (
              <Button
                key={q.id}
                variant={answeredFlags[i] ? 'contained' : 'outlined'}
                color={i === index ? 'secondary' : 'primary'}
                onClick={() => {
                  go(i);
                  setGridOpen(false);
                }}
                aria-label={`Question ${i + 1}${answeredFlags[i] ? ', answered' : ', not answered'}`}
                sx={{ minWidth: 0, px: 0 }}
              >
                {i + 1}
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGridOpen(false)}>Close</Button>
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            disabled={submitting || readOnly}
            onClick={() => {
              setGridOpen(false);
              setConfirmOpen(true);
            }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen && !submitting && !readOnly} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Submit your answers?</DialogTitle>
        <DialogContent>
          {unanswered.length > 0 ? (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You haven't answered {plural(unanswered.length, 'question')}.
              </Alert>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {unanswered.slice(0, 30).map((i) => (
                  <Chip
                    key={i}
                    label={`Q${i + 1}`}
                    onClick={() => {
                      go(i);
                      setConfirmOpen(false);
                    }}
                  />
                ))}
              </Stack>
            </>
          ) : (
            <Typography>You answered every question. You can't change your answers after submitting.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Keep working</Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmOpen(false);
              onSubmit();
            }}
          >
            {unanswered.length > 0 ? 'Submit anyway' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
