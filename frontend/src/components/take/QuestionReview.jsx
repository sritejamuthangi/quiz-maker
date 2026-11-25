import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { plural } from '../../lib/format.js';

const tint = (color) => (theme) => alpha(theme.palette[color].main, theme.palette.mode === 'dark' ? 0.16 : 0.08);

function ChoiceReview({ question, item, showAnswers }) {
  const single = question.type === 'single';
  const chosenIds = single ? (item.answer ? [item.answer] : []) : (item.answer ?? []);
  const correctIds = showAnswers ? (single ? [item.correctAnswer] : item.correctAnswer) : [];

  return (
    <Stack spacing={1}>
      {question.options.map((option) => {
        const chosen = chosenIds.includes(option.id);
        const isCorrect = correctIds.includes(option.id);
        // Without the answer key, a wrong single choice is still known to be wrong.
        const wrongChoice = chosen && (showAnswers ? !isCorrect : single && !item.correct);
        const rightChoice = isCorrect || (chosen && !showAnswers && single && item.correct);
        const tone = rightChoice ? 'success' : wrongChoice ? 'error' : null;
        const Icon = single
          ? chosen
            ? RadioButtonCheckedIcon
            : RadioButtonUncheckedIcon
          : chosen
            ? CheckBoxIcon
            : CheckBoxOutlineBlankIcon;
        return (
          <Box
            key={option.id}
            sx={{
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
              p: 1.25,
              borderRadius: 2,
              border: 1,
              borderColor: tone ? `${tone}.main` : 'divider',
              bgcolor: tone ? tint(tone) : 'transparent',
            }}
          >
            <Icon fontSize="small" sx={{ mt: '2px', color: chosen ? 'text.primary' : 'text.disabled' }} aria-hidden />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{option.text}</Typography>
              {(chosen || isCorrect) && (
                <Stack direction="row" sx={{ gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                  {chosen && <Chip size="small" variant="outlined" label="Your answer" />}
                  {isCorrect && <Chip size="small" color="success" label="Correct answer" />}
                </Stack>
              )}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

function TrueFalseReview({ item, showAnswers }) {
  const label = (v) => (v === true ? 'True' : v === false ? 'False' : 'No answer');
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
      <Chip
        variant="outlined"
        color={item.answered ? (item.correct ? 'success' : 'error') : 'default'}
        label={`Your answer: ${label(item.answer)}`}
      />
      {showAnswers && <Chip color="success" label={`Correct answer: ${label(item.correctAnswer)}`} />}
    </Stack>
  );
}

function BlankReview({ question, item, showAnswers }) {
  const given = Array.isArray(item.answer) ? item.answer : [];
  return (
    <>
      <Box sx={{ lineHeight: 2.3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '1.05rem' }}>
        {question.segments.map((segment, i) => {
          if (segment.type === 'text') return <span key={i}>{segment.value}</span>;
          const ok = Boolean(item.blanks?.[segment.index]);
          const text = given[segment.index]?.trim();
          return (
            <Box
              key={i}
              component="span"
              sx={{
                px: 1,
                py: 0.25,
                mx: 0.25,
                borderRadius: 1,
                border: 1,
                fontWeight: 600,
                borderColor: ok ? 'success.main' : 'error.main',
                bgcolor: ok ? tint('success') : tint('error'),
              }}
            >
              {text || '(blank)'} {ok ? '✓' : '✗'}
            </Box>
          );
        })}
      </Box>
      {showAnswers && Array.isArray(item.correctAnswer) && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          <strong>Correct {item.correctAnswer.length > 1 ? 'answers' : 'answer'}:</strong>{' '}
          {item.correctAnswer
            .map((alternatives, i) => `${item.correctAnswer.length > 1 ? `${i + 1}) ` : ''}${alternatives.join(' or ')}`)
            .join('   ')}
        </Typography>
      )}
    </>
  );
}

/** How one question went: the person's answer, and (if allowed) the correct answer and explanation. */
export default function QuestionReview({ number, question, item, showAnswers }) {
  const status = item.correct ? 'correct' : item.answered ? 'wrong' : 'skipped';
  const chip = {
    correct: { label: 'Correct', color: 'success', icon: <CheckCircleIcon /> },
    wrong: { label: 'Incorrect', color: 'error', icon: <CancelIcon /> },
    skipped: { label: 'Not answered', color: 'default', icon: <RadioButtonUncheckedIcon /> },
  }[status];

  return (
    <Paper
      variant="outlined"
      component="article"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        borderLeft: 5,
        borderLeftColor: status === 'correct' ? 'success.main' : status === 'wrong' ? 'error.main' : 'divider',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="overline" sx={{ fontWeight: 700, lineHeight: 1.6 }}>
          Question {number}
        </Typography>
        <Chip size="small" color={chip.color} icon={chip.icon} label={chip.label} variant={status === 'skipped' ? 'outlined' : 'filled'} />
        <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
          {item.earned}/{plural(item.points, 'point')}
        </Typography>
      </Stack>

      {question.type !== 'blank' && (
        <Typography sx={{ fontWeight: 600, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mb: 1.5 }}>{question.text}</Typography>
      )}
      {(question.type === 'single' || question.type === 'multiple') && (
        <ChoiceReview question={question} item={item} showAnswers={showAnswers} />
      )}
      {question.type === 'truefalse' && <TrueFalseReview item={item} showAnswers={showAnswers} />}
      {question.type === 'blank' && <BlankReview question={question} item={item} showAnswers={showAnswers} />}

      {showAnswers && item.explanation && (
        <Alert severity={item.correct ? 'info' : 'warning'} icon={<LightbulbOutlinedIcon />} sx={{ mt: 2 }}>
          <AlertTitle>Explanation</AlertTitle>
          <Box sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.explanation}</Box>
        </Alert>
      )}
    </Paper>
  );
}
