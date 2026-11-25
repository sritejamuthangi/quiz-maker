import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { parseBlanks, textWithBlanks } from '@shared/blanks.js';
import { QUESTION_TYPE_LABELS } from '@shared/limits.js';
import { formatPercent, plural } from '../../lib/format.js';

function Bar({ label, count, total, correct }) {
  const pct = total ? (100 * count) / total : 0;
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, overflowWrap: 'anywhere' }}>
          {correct && <CheckCircleIcon color="success" sx={{ fontSize: 16 }} aria-label="Correct answer" />}
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0 }}>
          {count} ({Math.round(pct)}%)
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={correct ? 'success' : 'inherit'}
        sx={{ height: 8, borderRadius: 4, mt: 0.5, color: correct ? undefined : 'text.disabled' }}
      />
    </Box>
  );
}

function Details({ question, stats }) {
  if (question.type === 'single' || question.type === 'multiple') {
    const correct = question.type === 'single' ? [question.correct] : question.correct;
    return (
      <Stack spacing={1.25}>
        {question.options.map((o) => (
          <Bar key={o.id} label={o.text} count={stats.options?.[o.id] ?? 0} total={stats.served} correct={correct.includes(o.id)} />
        ))}
        {question.type === 'multiple' && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            People could pick several options, so the bars can add up to more than 100%.
          </Typography>
        )}
      </Stack>
    );
  }
  if (question.type === 'truefalse') {
    return (
      <Stack spacing={1.25}>
        <Bar label="True" count={stats.trueCount ?? 0} total={stats.served} correct={question.correct === true} />
        <Bar label="False" count={stats.falseCount ?? 0} total={stats.served} correct={question.correct === false} />
      </Stack>
    );
  }
  const { blanks } = parseBlanks(question.text);
  return (
    <Stack spacing={1.5}>
      {blanks.map((alternatives, i) => {
        const b = stats.blanks?.[i];
        return (
          <Box key={i}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Blank {i + 1}: {alternatives.join(' or ')} · {formatPercent(b?.percentCorrect)} correct
            </Typography>
            {b?.topWrong?.length > 0 && (
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center' }}>
                  Common wrong answers:
                </Typography>
                {b.topWrong.map((w) => (
                  <Chip key={w.answer} size="small" variant="outlined" color="error" label={`${w.answer} (${w.count})`} />
                ))}
              </Stack>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

export default function QuestionsTab({ test, stats, focusId }) {
  const statsById = new Map(stats.questions.map((s) => [s.id, s]));
  const focusRef = useRef(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusId]);

  return (
    <Stack spacing={2}>
      {test.questions.map((q, i) => {
        const s = statsById.get(q.id) ?? { served: 0, correct: 0 };
        const pct = s.percentCorrect;
        return (
          <Card key={q.id} ref={q.id === focusId ? focusRef : undefined} sx={{ borderRadius: 3, scrollMarginTop: 120 }}>
            <CardContent>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Q{i + 1}
                </Typography>
                <Chip size="small" label={QUESTION_TYPE_LABELS[q.type]} />
                <Chip size="small" variant="outlined" label={plural(q.points ?? 1, 'point')} />
              </Stack>
              <Typography sx={{ fontWeight: 600, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mb: 1.5 }}>
                {q.type === 'blank' ? textWithBlanks(q.text) : q.text}
              </Typography>
              {s.served > 0 ? (
                <>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatPercent(pct)} got it right
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {s.correct} of {s.served}
                      {s.served - s.answered > 0 ? ` · ${s.served - s.answered} skipped` : ''}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct ?? 0}
                    color={pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'error'}
                    sx={{ height: 10, borderRadius: 5, mb: 2 }}
                  />
                  <Details question={q} stats={s} />
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Nobody has answered this question yet.
                </Typography>
              )}
              {q.explanation && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, whiteSpace: 'pre-wrap' }}>
                  <strong>Explanation:</strong> {q.explanation}
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
