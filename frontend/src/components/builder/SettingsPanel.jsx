import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { EXPIRY_DAYS, LIMITS, RESULTS_VISIBILITY, RESULTS_VISIBILITY_LABELS } from '@shared/limits.js';
import { fromLocalInputValue, toLocalInputValue } from '../../lib/format.js';

function SwitchRow({ label, description, checked, onChange, children, disabled }) {
  return (
    <Box>
      <FormControlLabel
        control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />}
        label={
          <Box>
            <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
            {description && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {description}
              </Typography>
            )}
          </Box>
        }
        sx={{ alignItems: 'flex-start', m: 0, gap: 1, '& .MuiSwitch-root': { mt: -0.5 } }}
      />
      {children && <Box sx={{ pl: { xs: 0, sm: 7 }, pt: 1.5 }}>{children}</Box>}
    </Box>
  );
}

function NumberField({ label, value, onChange, min, max, error, suffix }) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      error={Boolean(error)}
      helperText={error || ' '}
      sx={{ width: { xs: '100%', sm: 240 } }}
      slotProps={{
        htmlInput: { min, max, step: 1, inputMode: 'numeric' },
        input: suffix ? { endAdornment: <Typography sx={{ color: 'text.secondary', ml: 1 }}>{suffix}</Typography> } : undefined,
      }}
    />
  );
}

function defaultCloseTime() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

export default function SettingsPanel({ settings, onChange, errors = {}, questionCount, expiryDays, onExpiryChange }) {
  const set = (patch) => onChange({ ...settings, ...patch });

  return (
    <Card component="section" aria-labelledby="settings-heading" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography id="settings-heading" variant="h6" component="h2" sx={{ mb: 2 }}>
          Settings
        </Typography>
        <Stack spacing={2.5} divider={<Divider flexItem />}>
          <SwitchRow
            label="Time limit"
            description="Answers are submitted automatically when time runs out."
            checked={settings.timeLimitMinutes != null}
            onChange={(on) => set({ timeLimitMinutes: on ? 30 : null })}
          >
            {settings.timeLimitMinutes != null && (
              <NumberField
                label="Minutes"
                value={settings.timeLimitMinutes}
                onChange={(v) => set({ timeLimitMinutes: v })}
                min={1}
                max={LIMITS.timeLimitMaxMinutes}
                error={errors.timeLimitMinutes}
                suffix="min"
              />
            )}
          </SwitchRow>

          <Box>
            <SwitchRow
              label="Ask for the person's name"
              description="Recommended, so you know who scored what."
              checked={settings.requireName}
              onChange={(on) => set({ requireName: on })}
            />
            <TextField
              label="Extra field (optional)"
              placeholder="e.g. Roll number, Class, Email"
              value={settings.extraFieldLabel ?? ''}
              onChange={(e) => set({ extraFieldLabel: e.target.value })}
              size="small"
              error={Boolean(errors.extraFieldLabel)}
              helperText={errors.extraFieldLabel || 'If you fill this in, people must answer it before starting.'}
              sx={{ mt: 2, width: { xs: '100%', sm: 360 } }}
              slotProps={{ htmlInput: { maxLength: LIMITS.extraLabelMax } }}
            />
          </Box>

          <SwitchRow
            label="Shuffle question order"
            description="Each person sees the questions in a different order."
            checked={settings.shuffleQuestions}
            onChange={(on) => set({ shuffleQuestions: on })}
          />
          <SwitchRow
            label="Shuffle answer options"
            description="Options of multiple choice and checkbox questions appear in a random order."
            checked={settings.shuffleOptions}
            onChange={(on) => set({ shuffleOptions: on })}
          />
          <SwitchRow
            label="Random questions per person"
            description={`Each person gets a different random set from your ${questionCount} question${questionCount === 1 ? '' : 's'}. Makes copying answers harder.`}
            checked={settings.questionsPerAttempt != null}
            onChange={(on) =>
              set({ questionsPerAttempt: on ? Math.max(1, Math.min(10, questionCount > 1 ? questionCount - 1 : 1)) : null })
            }
          >
            {settings.questionsPerAttempt != null && (
              <NumberField
                label={`Questions per person (out of ${questionCount})`}
                value={settings.questionsPerAttempt}
                onChange={(v) => set({ questionsPerAttempt: v })}
                min={1}
                max={LIMITS.questionsMax}
                error={errors.questionsPerAttempt}
              />
            )}
          </SwitchRow>

          <TextField
            select
            label="After submitting, people see"
            value={settings.resultsVisibility}
            onChange={(e) => set({ resultsVisibility: e.target.value })}
            size="small"
            sx={{ width: { xs: '100%', sm: 420 } }}
          >
            {RESULTS_VISIBILITY.map((v) => (
              <MenuItem key={v} value={v}>
                {RESULTS_VISIBILITY_LABELS[v]}
              </MenuItem>
            ))}
          </TextField>

          <SwitchRow
            label="Pass mark"
            description="Shows Passed / Not passed on the result and in your spreadsheet."
            checked={settings.passPercent != null}
            onChange={(on) => set({ passPercent: on ? 40 : null })}
          >
            {settings.passPercent != null && (
              <NumberField
                label="Pass mark"
                value={settings.passPercent}
                onChange={(v) => set({ passPercent: v })}
                min={1}
                max={100}
                error={errors.passPercent}
                suffix="%"
              />
            )}
          </SwitchRow>

          <SwitchRow
            label="Allow retakes"
            description="If off, a phone or computer that already submitted shows its result instead of a new attempt."
            checked={settings.allowRetakes}
            onChange={(on) => set({ allowRetakes: on })}
          />

          <SwitchRow
            label="Stop accepting responses at a set time"
            description="People who already started can still finish and submit."
            checked={Boolean(settings.closesAt)}
            onChange={(on) => set({ closesAt: on ? defaultCloseTime() : null })}
          >
            {settings.closesAt && (
              <TextField
                type="datetime-local"
                label="Closes at"
                size="small"
                value={toLocalInputValue(settings.closesAt)}
                onChange={(e) => set({ closesAt: fromLocalInputValue(e.target.value) })}
                error={Boolean(errors.closesAt)}
                helperText={errors.closesAt || 'Your local time'}
                sx={{ width: { xs: '100%', sm: 260 } }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          </SwitchRow>

          {onExpiryChange && (
            <TextField
              select
              label="Delete the test and its results after"
              value={expiryDays}
              onChange={(e) => onExpiryChange(Number(e.target.value))}
              size="small"
              helperText="Download your results before then. You can extend it later from the results page."
              sx={{ width: { xs: '100%', sm: 420 } }}
            >
              {EXPIRY_DAYS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d} days
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
