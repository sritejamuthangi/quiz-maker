import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ShareIcon from '@mui/icons-material/Share';
import { textWithBlanks } from '@shared/blanks.js';
import { formatDuration, formatPercent } from '../../lib/format.js';

function Stat({ label, value, hint }) {
  return (
    <Card sx={{ height: '100%', borderRadius: 3 }}>
      <CardContent>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="h5" component="p" sx={{ fontWeight: 800, mt: 0.5 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function Histogram({ bins }) {
  const max = Math.max(1, ...bins);
  return (
    <Box role="img" aria-label={`Score distribution: ${bins.map((n, i) => `${i * 10}–${i === 9 ? 100 : i * 10 + 9}%: ${n}`).join(', ')}`}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.5, sm: 1 }, height: 160 }}>
        {bins.map((count, i) => (
          <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {count || ''}
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: `${(count / max) * 85}%`,
                minHeight: count ? 4 : 0,
                bgcolor: i >= 5 ? 'primary.main' : 'secondary.main',
                opacity: count ? 1 : 0.15,
                borderRadius: '6px 6px 0 0',
              }}
            />
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, mt: 0.5 }}>
        {bins.map((_, i) => (
          <Typography key={i} variant="caption" sx={{ flex: 1, textAlign: 'center', color: 'text.secondary', fontSize: { xs: '0.6rem', sm: '0.7rem' } }}>
            {i * 10}
          </Typography>
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}>
        Score (%)
      </Typography>
    </Box>
  );
}

export default function SummaryTab({ test, stats, onShare, onShowQuestion }) {
  const s = stats.summary;
  if (s.responses === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6">No responses yet</Typography>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>
          Share the link. Results show up here automatically as people submit.
        </Typography>
        <Button variant="contained" startIcon={<ShareIcon />} onClick={onShare}>
          Share the test
        </Button>
      </Box>
    );
  }

  const questionsById = new Map(test.questions.map((q, i) => [q.id, { q, number: i + 1 }]));
  const hardest = stats.questions
    .filter((q) => q.served > 0)
    .sort((a, b) => a.percentCorrect - b.percentCorrect)
    .slice(0, 3);

  return (
    <Stack spacing={3}>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <Stat label="Responses" value={s.responses} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <Stat label="Average score" value={formatPercent(s.averagePercent)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <Stat label="Median score" value={formatPercent(s.medianPercent)} hint="Half scored above this" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <Stat label="Highest / lowest" value={`${formatPercent(s.highestPercent)} / ${formatPercent(s.lowestPercent)}`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <Stat label="Average time" value={formatDuration(s.averageDurationSeconds)} />
        </Grid>
        {s.passPercent != null && (
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Stat
              label={`Passed (≥ ${s.passPercent}%)`}
              value={`${s.passedCount} / ${s.responses}`}
              hint={formatPercent((100 * s.passedCount) / s.responses)}
            />
          </Grid>
        )}
      </Grid>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            Score distribution
          </Typography>
          <Histogram bins={s.histogram} />
        </CardContent>
      </Card>

      {hardest.length > 0 && (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              Hardest questions
            </Typography>
            <Stack spacing={1}>
              {hardest.map((h) => {
                const info = questionsById.get(h.id);
                const text = info.q.type === 'blank' ? textWithBlanks(info.q.text) : info.q.text;
                return (
                  <Button
                    key={h.id}
                    onClick={() => onShowQuestion(h.id)}
                    sx={{ justifyContent: 'space-between', textAlign: 'left', gap: 2 }}
                    color="inherit"
                  >
                    <Typography noWrap sx={{ minWidth: 0 }}>
                      Q{info.number}. {text}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: 'error.main', flexShrink: 0 }}>
                      {formatPercent(h.percentCorrect)} correct
                    </Typography>
                  </Button>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
