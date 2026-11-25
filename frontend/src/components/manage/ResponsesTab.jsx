import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import SearchIcon from '@mui/icons-material/Search';
import { formatDateTime, formatDuration, formatPercent } from '../../lib/format.js';

const SORTS = {
  newest: { label: 'Newest first', fn: (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt) },
  oldest: { label: 'Oldest first', fn: (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt) },
  high: { label: 'Highest score', fn: (a, b) => b.percent - a.percent },
  low: { label: 'Lowest score', fn: (a, b) => a.percent - b.percent },
  name: { label: 'Name (A–Z)', fn: (a, b) => (a.name || '').localeCompare(b.name || '') },
};

const normalizeName = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

function Flags({ response, duplicates }) {
  const dup = duplicates.get(normalizeName(response.name)) > 1 && response.name;
  return (
    <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
      {response.passed != null && (
        <Chip size="small" color={response.passed ? 'success' : 'error'} variant="outlined" label={response.passed ? 'Pass' : 'Fail'} />
      )}
      {dup && <Chip size="small" color="warning" label={`Same name ×${duplicates.get(normalizeName(response.name))}`} />}
      {response.overtime && <Chip size="small" color="warning" label="Overtime" />}
      {response.tabLeaves > 0 && (
        <Chip size="small" variant="outlined" label={`Left screen ×${response.tabLeaves}`} title="Times the person switched away from the test" />
      )}
    </Stack>
  );
}

export default function ResponsesTab({ responses, test, onOpen }) {
  const wide = useMediaQuery((theme) => theme.breakpoints.up('md'));
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const extraLabel = test.settings.extraFieldLabel;

  const duplicates = useMemo(() => {
    const counts = new Map();
    for (const r of responses) {
      const key = normalizeName(r.name);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [responses]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? responses.filter((r) => `${r.name} ${r.extra}`.toLowerCase().includes(q))
      : responses;
    return [...filtered].sort(SORTS[sort].fn);
  }, [responses, query, sort]);

  if (responses.length === 0) {
    return (
      <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 6 }}>
        No responses yet. They appear here as soon as people submit.
      </Typography>
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder={`Search by name${extraLabel ? ` or ${extraLabel.toLowerCase()}` : ''}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search responses' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField select size="small" label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ minWidth: 180 }}>
          {Object.entries(SORTS).map(([key, s]) => (
            <MenuItem key={key} value={key}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {visible.length === 0 && <Typography sx={{ color: 'text.secondary', py: 3 }}>No matches.</Typography>}

      {wide ? (
        <TableContainer component={Card} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                {extraLabel && <TableCell>{extraLabel}</TableCell>}
                <TableCell align="right">Score</TableCell>
                <TableCell align="right">%</TableCell>
                <TableCell align="right">Time</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Submitted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
                <TableRow
                  key={r.id}
                  hover
                  onClick={() => onOpen(r.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(r.id)}
                  tabIndex={0}
                  sx={{ cursor: 'pointer' }}
                  aria-label={`Open answers of ${r.name || 'unnamed'}`}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{r.name || '(no name)'}</TableCell>
                  {extraLabel && <TableCell>{r.extra}</TableCell>}
                  <TableCell align="right">
                    {r.score}/{r.maxScore}
                  </TableCell>
                  <TableCell align="right">{formatPercent(r.percent)}</TableCell>
                  <TableCell align="right">{formatDuration(r.durationSeconds)}</TableCell>
                  <TableCell>
                    <Flags response={r} duplicates={duplicates} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.submittedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Stack spacing={1}>
          {visible.map((r) => (
            <Card key={r.id} sx={{ borderRadius: 3 }}>
              <CardActionArea onClick={() => onOpen(r.id)} sx={{ p: 2 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                    {r.name || '(no name)'}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, flexShrink: 0 }}>
                    {r.score}/{r.maxScore} · {formatPercent(r.percent)}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                  {extraLabel && r.extra ? `${extraLabel}: ${r.extra} · ` : ''}
                  {formatDuration(r.durationSeconds)} · {formatDateTime(r.submittedAt)}
                </Typography>
                <Flags response={r} duplicates={duplicates} />
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
