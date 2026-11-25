import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import { buildReview, gradeAttempt, isPassed, prepareAttempt } from '@shared/grading.js';
import { randomSeed } from '@shared/random.js';
import ResultView from '../take/ResultView.jsx';
import TestRunner from '../take/TestRunner.jsx';

/** Runs the test exactly like a taker would, entirely in the browser (graded with the same code as the server). */
function PreviewRun({ test, seed, onRestart }) {
  const prepared = useMemo(() => prepareAttempt(test, seed), [test, seed]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [startedAt] = useState(() => Date.now());
  const [deadline] = useState(() =>
    test.settings.timeLimitMinutes ? Date.now() + test.settings.timeLimitMinutes * 60_000 : null,
  );

  const submit = () => {
    const graded = gradeAttempt(test, prepared.questionIds, answers);
    const visibility = test.settings.resultsVisibility;
    setResult({
      score: graded.score,
      maxScore: graded.maxScore,
      percent: graded.percent,
      passPercent: test.settings.passPercent,
      passed: isPassed(graded.percent, test.settings.passPercent),
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      overtime: false,
      visibility,
      review: buildReview(test, prepared.questionIds, graded.answers, graded.results, visibility),
    });
  };

  if (result) {
    return (
      <ResultView
        result={result}
        questions={prepared.questions}
        title={test.title}
        notice="Preview: this is what people see right after submitting."
        onRetake={onRestart}
      />
    );
  }

  return (
    <TestRunner
      title={test.title}
      questions={prepared.questions}
      answers={answers}
      onAnswer={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
      index={index}
      onIndexChange={setIndex}
      deadline={deadline}
      onTimeUp={submit}
      onSubmit={submit}
      banner={
        <Alert severity="info" sx={{ mb: 2 }}>
          Preview: nothing is saved or sent. Try answering some questions wrong to see the explanations.
        </Alert>
      }
    />
  );
}

export default function PreviewDialog({ open, onClose, test }) {
  const [seed, setSeed] = useState(() => randomSeed());
  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
          <Typography variant="h6" component="h1" sx={{ mr: 'auto' }}>
            Preview
          </Typography>
          <Button startIcon={<ReplayIcon />} onClick={() => setSeed(randomSeed())}>
            Restart
          </Button>
          <Button variant="contained" startIcon={<CloseIcon />} onClick={onClose}>
            Close
          </Button>
        </Toolbar>
      </AppBar>
      {open && test ? (
        <PreviewRun key={seed} test={test} seed={seed} onRestart={() => setSeed(randomSeed())} />
      ) : (
        <Container />
      )}
    </Dialog>
  );
}
