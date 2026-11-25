import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { textWithBlanks } from '@shared/blanks.js';
import { QUESTION_TYPE_LABELS } from '@shared/limits.js';
import { readQuestionFile, rowsToQuestions } from '../../lib/importQuestions.js';
import { plural } from '../../lib/format.js';

export default function ImportDialog({ open, onClose, onImport, remaining }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [state, setState] = useState({ status: 'idle' });

  const reset = () => setState({ status: 'idle' });
  const close = () => {
    reset();
    onClose();
  };

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setState({ status: 'error', message: 'That file is larger than 5 MB. Please use a smaller file.' });
      return;
    }
    setState({ status: 'reading', fileName: file.name });
    try {
      const rows = await readQuestionFile(file);
      const { questions, errors } = rowsToQuestions(rows);
      setState({ status: 'ready', fileName: file.name, questions, errors });
    } catch (error) {
      setState({ status: 'error', message: error.message || "Couldn't read that file." });
    }
  }

  async function downloadTemplate(kind) {
    const excel = await import('../../lib/excel.js');
    if (kind === 'csv') excel.downloadTemplateCsv();
    else await excel.downloadTemplateXlsx();
  }

  const questions = state.questions ?? [];
  const accepted = questions.slice(0, Math.max(0, remaining));

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>Import questions from Excel or CSV</DialogTitle>
      <DialogContent dividers>
        <Typography component="ol" sx={{ pl: 2.5, mt: 0, '& li': { mb: 0.75 } }}>
          <li>Download the template. It has an example of every question type.</li>
          <li>
            Fill in one question per row. <strong>Correct</strong> is the letter of the right option (B, or A, C for
            checkboxes), True/False, or the word(s) for a blank marked ___ (several blanks: separate with ;).
          </li>
          <li>Upload the file here. Nothing is saved until you press Add.</li>
        </Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', my: 2 }}>
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadTemplate('xlsx')}>
            Template (.xlsx)
          </Button>
          <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => downloadTemplate('csv')}>
            Template (.csv)
          </Button>
        </Stack>
        <Button variant="contained" component="label" startIcon={<UploadFileIcon />} disabled={state.status === 'reading'}>
          Choose file
          <input
            type="file"
            hidden
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
          />
        </Button>

        {state.status === 'reading' && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 2 }}>
            <CircularProgress size={20} />
            <Typography>Reading {state.fileName}…</Typography>
          </Stack>
        )}
        {state.status === 'error' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {state.message}
          </Alert>
        )}
        {state.status === 'ready' && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={questions.length ? 'success' : 'warning'}>
              {questions.length
                ? `${plural(questions.length, 'question')} ready from ${state.fileName}.`
                : `No questions could be read from ${state.fileName}.`}
              {state.errors.length > 0 && ` ${plural(state.errors.length, 'row')} skipped (see below).`}
            </Alert>
            {questions.length > accepted.length && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                A test can have at most 100 questions, so only the first {accepted.length} will be added.
              </Alert>
            )}
            {state.errors.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="subtitle2">Skipped rows</Typography>
                <List dense disablePadding>
                  {state.errors.slice(0, 50).map((e) => (
                    <ListItem key={e.row} disableGutters>
                      <ListItemText primary={`Row ${e.row}: ${e.message}`} slotProps={{ primary: { color: 'error' } }} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            {accepted.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="subtitle2">Questions to add</Typography>
                <List dense disablePadding>
                  {accepted.slice(0, 100).map((q, i) => (
                    <ListItem key={q.id} disableGutters sx={{ gap: 1, alignItems: 'flex-start' }}>
                      <Chip size="small" label={QUESTION_TYPE_LABELS[q.type]} sx={{ mt: 0.5 }} />
                      <ListItemText primary={`${i + 1}. ${q.type === 'blank' ? textWithBlanks(q.text) : q.text}`} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          disabled={state.status !== 'ready' || accepted.length === 0}
          onClick={() => {
            onImport(accepted);
            close();
          }}
        >
          Add {accepted.length ? plural(accepted.length, 'question') : 'questions'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
