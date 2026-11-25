import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import InputBase from '@mui/material/InputBase';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';

/** A whole option is one big tap target. */
function OptionCard({ selected, disabled, ...props }) {
  return (
    <FormControlLabel
      {...props}
      disabled={disabled}
      sx={{
        m: 0,
        pl: 0.5,
        pr: 2,
        py: 0.5,
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        bgcolor: selected ? 'action.selected' : 'background.paper',
        alignItems: 'flex-start',
        transition: 'border-color .15s, background-color .15s',
        '&:hover': {
          borderColor: disabled ? (selected ? 'primary.main' : 'divider') : selected ? 'primary.main' : 'text.secondary',
        },
        '&.Mui-disabled': { cursor: 'default' },
        '& .MuiFormControlLabel-label': { pt: '9px', pb: '7px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '1rem' },
      }}
    />
  );
}

function SingleChoice({ question, value, onChange, disabled, labelledBy }) {
  return (
    <RadioGroup aria-labelledby={labelledBy} value={value ?? ''} onChange={(e) => onChange(e.target.value)} sx={{ gap: 1.25 }}>
      {question.options.map((option) => (
        <OptionCard
          key={option.id}
          value={option.id}
          selected={value === option.id}
          disabled={disabled}
          control={<Radio disabled={disabled} />}
          label={option.text}
        />
      ))}
    </RadioGroup>
  );
}

function MultipleChoice({ question, value, onChange, disabled, labelledBy }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <FormGroup role="group" aria-labelledby={labelledBy} sx={{ gap: 1.25 }}>
      {question.options.map((option) => {
        const checked = selected.includes(option.id);
        return (
          <OptionCard
            key={option.id}
            selected={checked}
            disabled={disabled}
            label={option.text}
            control={
              <Checkbox
                checked={checked}
                disabled={disabled}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))
                }
              />
            }
          />
        );
      })}
    </FormGroup>
  );
}

function TrueFalse({ value, onChange, disabled, labelledBy }) {
  const current = value === true ? 'true' : value === false ? 'false' : '';
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={current}
      onChange={(e) => onChange(e.target.value === 'true')}
      sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}
    >
      <OptionCard value="true" selected={current === 'true'} disabled={disabled} control={<Radio disabled={disabled} />} label="True" />
      <OptionCard value="false" selected={current === 'false'} disabled={disabled} control={<Radio disabled={disabled} />} label="False" />
    </RadioGroup>
  );
}

function Blanks({ question, value, onChange, disabled }) {
  const answers = Array.isArray(value) ? value : [];
  const update = (index, text) => {
    const next = Array.from({ length: question.blankCount }, (_, i) => answers[i] ?? '');
    next[index] = text;
    onChange(next);
  };
  return (
    <Box sx={{ fontSize: { xs: '1.1rem', sm: '1.2rem' }, lineHeight: 2.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {question.segments.map((segment, i) =>
        segment.type === 'text' ? (
          <span key={i}>{segment.value}</span>
        ) : (
          <InputBase
            key={i}
            value={answers[segment.index] ?? ''}
            onChange={(e) => update(segment.index, e.target.value)}
            disabled={disabled}
            placeholder={question.blankCount > 1 ? `blank ${segment.index + 1}` : 'your answer'}
            slotProps={{
              input: {
                'aria-label': `Blank ${segment.index + 1} of ${question.blankCount}`,
                maxLength: 100,
                autoCapitalize: 'none',
                autoCorrect: 'off',
                autoComplete: 'off',
                spellCheck: false,
                enterKeyHint: 'next',
              },
            }}
            sx={{
              mx: 0.5,
              px: 1,
              fontSize: 'inherit',
              width: `${Math.min(30, Math.max(9, (answers[segment.index]?.length ?? 0) + 3))}ch`,
              maxWidth: '100%',
              verticalAlign: 'baseline',
              borderBottom: 2,
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
              borderRadius: '6px 6px 0 0',
              '& input': { py: 0.25 },
            }}
          />
        ),
      )}
    </Box>
  );
}

/** Answer input for one question, in its public form (no answers). */
export default function QuestionInput({ question, value, onChange, disabled = false, labelledBy }) {
  const props = { question, value, onChange, disabled, labelledBy };
  switch (question.type) {
    case 'single':
      return <SingleChoice {...props} />;
    case 'multiple':
      return <MultipleChoice {...props} />;
    case 'truefalse':
      return <TrueFalse {...props} />;
    case 'blank':
      return <Blanks {...props} />;
    default:
      return null;
  }
}

export const QUESTION_HINTS = {
  single: 'Choose one answer',
  multiple: 'Choose all that apply',
  truefalse: 'True or false?',
  blank: 'Fill in the blank',
};
