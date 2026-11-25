import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { parseBlanks } from '@shared/blanks.js';
import { LIMITS, QUESTION_TYPES, QUESTION_TYPE_LABELS } from '@shared/limits.js';
import { changeType, newOption } from '../../lib/draft.js';

const LETTERS = 'ABCDEF';

function IconAction({ title, onClick, disabled, children }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton onClick={onClick} disabled={disabled} aria-label={title} size="small">
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function ChoiceOptions({ question, set, errors, locked }) {
  const single = question.type === 'single';
  const optionErrors = errors.options ?? {};
  const isCorrect = (id) => (single ? question.correct === id : question.correct.includes(id));

  const toggleCorrect = (id, checked) => {
    if (single) set({ correct: id });
    else set({ correct: checked ? [...question.correct, id] : question.correct.filter((c) => c !== id) });
  };
  const removeOption = (id) =>
    set({
      options: question.options.filter((o) => o.id !== id),
      correct: single ? (question.correct === id ? '' : question.correct) : question.correct.filter((c) => c !== id),
    });

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {single ? 'Options: select the one correct answer.' : 'Options: tick every correct answer.'}
      </Typography>
      <Stack spacing={1}>
        {question.options.map((option, i) => {
          const letter = LETTERS[i] ?? String(i + 1);
          const Control = single ? Radio : Checkbox;
          return (
            <Stack key={option.id} direction="row" sx={{ alignItems: 'flex-start', gap: 0.5 }}>
              <Control
                checked={isCorrect(option.id)}
                onChange={(e) => toggleCorrect(option.id, e.target.checked)}
                disabled={locked}
                color="success"
                slotProps={{ input: { 'aria-label': `Option ${letter} is correct` } }}
                sx={{ mt: 0.25 }}
              />
              <TextField
                value={option.text}
                onChange={(e) =>
                  set({ options: question.options.map((o) => (o.id === option.id ? { ...o, text: e.target.value } : o)) })
                }
                placeholder={`Option ${letter}`}
                size="small"
                fullWidth
                multiline
                maxRows={4}
                error={Boolean(optionErrors[option.id])}
                helperText={optionErrors[option.id]}
                slotProps={{ htmlInput: { maxLength: LIMITS.optionTextMax, 'aria-label': `Option ${letter}` } }}
              />
              <IconAction
                title={`Remove option ${letter}`}
                onClick={() => removeOption(option.id)}
                disabled={locked || question.options.length <= LIMITS.optionsMin}
              >
                <CloseIcon fontSize="small" />
              </IconAction>
            </Stack>
          );
        })}
      </Stack>
      <Button
        startIcon={<AddIcon />}
        size="small"
        onClick={() => set({ options: [...question.options, newOption()] })}
        disabled={locked || question.options.length >= LIMITS.optionsMax}
        sx={{ mt: 1 }}
      >
        Add option
      </Button>
      {(errors.correct || errors.optionsList) && (
        <FormHelperText error sx={{ mt: 0.5 }}>
          {errors.correct || errors.optionsList}
        </FormHelperText>
      )}
    </Box>
  );
}

function TrueFalseAnswer({ question, set, errors, locked }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Correct answer:
      </Typography>
      <Stack direction="row" spacing={1}>
        {[true, false].map((value) => (
          <Button
            key={String(value)}
            variant={question.correct === value ? 'contained' : 'outlined'}
            color={question.correct === value ? 'success' : 'inherit'}
            onClick={() => set({ correct: value })}
            disabled={locked}
            aria-pressed={question.correct === value}
            sx={{ minWidth: 110 }}
          >
            {value ? 'True' : 'False'}
          </Button>
        ))}
      </Stack>
      {errors.correct && (
        <FormHelperText error sx={{ mt: 0.5 }}>
          {errors.correct}
        </FormHelperText>
      )}
    </Box>
  );
}

function BlankPreview({ question }) {
  const parsed = useMemo(() => parseBlanks(question.text), [question.text]);
  if (parsed.error || parsed.blanks.length === 0) return null;
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
        PEOPLE WILL SEE
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 2 }}>
        {parsed.segments.map((s, i) =>
          s.type === 'text' ? (
            <span key={i}>{s.value}</span>
          ) : (
            <Box key={i} component="span" sx={{ display: 'inline-block', minWidth: 60, borderBottom: 2, borderColor: 'primary.main', mx: 0.5 }}>
              &nbsp;
            </Box>
          ),
        )}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
        {parsed.blanks.map((alternatives, i) => (
          <Chip key={i} size="small" color="success" variant="outlined" label={`Blank ${i + 1}: ${alternatives.join(' or ')}`} />
        ))}
      </Stack>
    </Box>
  );
}

export default function QuestionEditor({ question, index, total, errors = {}, locked, onChange, onRemove, onMove, onDuplicate }) {
  const set = (patch) => onChange({ ...question, ...patch });
  const hasErrors = Object.keys(errors).some((k) => (k === 'options' ? Object.keys(errors.options).length > 0 : Boolean(errors[k])));
  const isBlank = question.type === 'blank';

  return (
    <Card component="section" aria-label={`Question ${index + 1}`} data-has-error={hasErrors || undefined} sx={{ borderRadius: 3, borderColor: hasErrors ? 'error.main' : undefined }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 800, mr: 'auto' }}>
            Question {index + 1}
          </Typography>
          <IconAction title="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUpwardIcon fontSize="small" />
          </IconAction>
          <IconAction title="Move down" onClick={() => onMove(1)} disabled={index === total - 1}>
            <ArrowDownwardIcon fontSize="small" />
          </IconAction>
          <IconAction title="Duplicate question" onClick={onDuplicate} disabled={locked || total >= LIMITS.questionsMax}>
            <ContentCopyIcon fontSize="small" />
          </IconAction>
          <IconAction title="Delete question" onClick={onRemove} disabled={locked}>
            <DeleteOutlinedIcon fontSize="small" />
          </IconAction>
        </Stack>

        <TextField
          select
          label="Type"
          size="small"
          value={question.type}
          onChange={(e) => onChange(changeType(question, e.target.value))}
          disabled={locked}
          sx={{ mb: 2, minWidth: { xs: '100%', sm: 240 } }}
        >
          {QUESTION_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {QUESTION_TYPE_LABELS[type]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label={isBlank ? 'Sentence with [answers] in brackets' : question.type === 'truefalse' ? 'Statement' : 'Question'}
          placeholder={isBlank ? 'The capital of France is [Paris].' : question.type === 'truefalse' ? 'The Earth orbits the Sun.' : 'What is…?'}
          value={question.text}
          onChange={(e) => set({ text: e.target.value })}
          multiline
          minRows={2}
          maxRows={10}
          fullWidth
          error={Boolean(errors.text)}
          helperText={
            errors.text ||
            (isBlank
              ? 'Put each answer in square brackets. Separate accepted alternatives with |, e.g. [colour|color].'
              : ' ')
          }
          slotProps={{ htmlInput: { maxLength: LIMITS.questionTextMax } }}
        />

        {(question.type === 'single' || question.type === 'multiple') && (
          <ChoiceOptions question={question} set={set} errors={errors} locked={locked} />
        )}
        {question.type === 'truefalse' && <TrueFalseAnswer question={question} set={set} errors={errors} locked={locked} />}
        {isBlank && (
          <>
            <BlankPreview question={question} />
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Switch checked={Boolean(question.caseSensitive)} onChange={(e) => set({ caseSensitive: e.target.checked })} disabled={locked} />}
              label="Capital letters must match exactly"
            />
          </>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2.5 }}>
          <TextField
            label="Explanation (optional)"
            placeholder="Why is this the right answer? Shown after submitting."
            value={question.explanation ?? ''}
            onChange={(e) => set({ explanation: e.target.value })}
            multiline
            minRows={1}
            maxRows={8}
            fullWidth
            error={Boolean(errors.explanation)}
            helperText={errors.explanation || 'Helps people learn from mistakes.'}
            slotProps={{ htmlInput: { maxLength: LIMITS.explanationMax } }}
          />
          <TextField
            label="Points"
            type="number"
            value={question.points ?? ''}
            onChange={(e) => set({ points: e.target.value === '' ? '' : Number(e.target.value) })}
            disabled={locked}
            error={Boolean(errors.points)}
            helperText={errors.points || ' '}
            sx={{ width: { xs: '100%', sm: 120 }, flexShrink: 0 }}
            slotProps={{ htmlInput: { min: LIMITS.pointsMin, max: LIMITS.pointsMax, step: 1, inputMode: 'numeric' } }}
          />
        </Stack>
        {errors.general && <FormHelperText error>{errors.general}</FormHelperText>}
      </CardContent>
    </Card>
  );
}
