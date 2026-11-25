import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { APP_NAME } from '../config.js';

const SECTIONS = [
  {
    title: 'No accounts',
    body: `${APP_NAME} has no sign-up and no passwords. Whoever creates a test gets a private results link; that link is the only way to see the results.`,
  },
  {
    title: 'What is stored on the server',
    body: 'Tests (title, questions, answers, settings) and responses: the name and optional extra field the test asks for, the answers given, the score, the time taken, and how many times the person left the test screen. To prevent abuse, IP addresses are stored only as a one-way scrambled code (never the address itself).',
  },
  {
    title: 'What is stored on your device',
    body: 'Your drafts, the private links of tests you created, answers while you take a test, and your last results. This lives in your browser and never leaves it unless you submit. Clearing your browser data removes it.',
  },
  {
    title: 'Automatic deletion',
    body: 'Every test and all its responses are deleted automatically when the test expires (7, 30 or 90 days, chosen by its creator, who can extend it). Creators can delete a test or a single response at any time. If you took a test and want your response removed, ask the person who shared it.',
  },
  {
    title: 'No tracking',
    body: 'No ads, no analytics cookies, no selling of data. Test and results pages are hidden from search engines.',
  },
];

export default function Privacy() {
  useEffect(() => {
    document.title = `Privacy · ${APP_NAME}`;
  }, []);
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Privacy
      </Typography>
      {SECTIONS.map((s) => (
        <Box key={s.title} component="section" sx={{ mb: 3 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
            {s.title}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>{s.body}</Typography>
        </Box>
      ))}
    </Container>
  );
}
