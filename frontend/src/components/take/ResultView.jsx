import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ReplayIcon from '@mui/icons-material/Replay';
import QuestionReview from './QuestionReview.jsx';
import { formatDateTime, formatDuration, formatPercent } from '../../lib/format.js';

/** The score screen shown right after submitting (and when coming back later on the same device). */
export default function ResultView({ result, questions, title, name, notice, onRetake, actions }) {
  const [filter, setFilter] = useState('all');
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const numbered = useMemo(
    () => result.review.map((item, i) => ({ item, number: i + 1, question: byId.get(item.id) })).filter((x) => x.question),
    [result.review, byId],
  );
  const wrongCount = numbered.filter((x) => !x.item.correct).length;
  const visible = filter === 'wrong' ? numbered.filter((x) => !x.item.correct) : numbered;
  const showAnswers = result.visibility === 'full';
  const barColor = result.passed === false ? 'error' : result.percent >= 50 ? 'success' : 'warning';

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      {notice && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', borderRadius: 4 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          {title}
        </Typography>
        {name && <Typography sx={{ color: 'text.secondary' }}>{name}</Typography>}
        <Typography variant="h2" component="p" sx={{ mt: 1, fontSize: { xs: '3rem', sm: '3.75rem' } }} aria-label={`Score ${result.score} out of ${result.maxScore}`}>
          {result.score}
          <Box component="span" sx={{ fontSize: '0.45em', color: 'text.secondary', fontWeight: 600 }}>
            {' '}
            / {result.maxScore}
          </Box>
        </Typography>
        <Typography variant="h5" component="p" sx={{ fontWeight: 700 }}>
          {formatPercent(result.percent)}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, result.percent)}
          color={barColor}
          aria-hidden
          sx={{ height: 10, borderRadius: 5, my: 2, maxWidth: 360, mx: 'auto' }}
        />
        {result.passed != null && (
          <Chip
            color={result.passed ? 'success' : 'error'}
            label={result.passed ? `Passed (pass mark ${result.passPercent}%)` : `Not passed (pass mark ${result.passPercent}%)`}
          />
        )}
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          Time taken: {formatDuration(result.durationSeconds)}
          {result.submittedAt ? ` · Submitted ${formatDateTime(result.submittedAt)}` : ''}
        </Typography>
        {result.overtime && (
          <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
            This was submitted after the time limit. The test creator can see that.
          </Alert>
        )}
      </Paper>

      {result.visibility === 'score' ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          The test creator chose to show only your score, not the individual answers.
        </Alert>
      ) : (
        <Box component="section" aria-label="Review your answers">
          <Stack direction="row" sx={{ mt: 4, mb: 1.5, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" component="h2">
              Review your answers
            </Typography>
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_e, value) => value && setFilter(value)}>
              <ToggleButton value="all">All ({numbered.length})</ToggleButton>
              <ToggleButton value="wrong">Wrong or skipped ({wrongCount})</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {!showAnswers && (
            <Alert severity="info" sx={{ mb: 2 }}>
              The test creator chose not to show the correct answers.
            </Alert>
          )}
          {visible.length === 0 && (
            <Alert severity="success">Nothing to review here: every answer was correct.</Alert>
          )}
          <Stack spacing={2}>
            {visible.map(({ item, number, question }) => (
              <QuestionReview key={item.id} number={number} question={question} item={item} showAnswers={showAnswers} />
            ))}
          </Stack>
        </Box>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4, justifyContent: 'center', alignItems: 'center' }}>
        {onRetake && (
          <Button variant="contained" startIcon={<ReplayIcon />} onClick={onRetake}>
            Take it again
          </Button>
        )}
        {actions}
      </Stack>
    </Container>
  );
}
