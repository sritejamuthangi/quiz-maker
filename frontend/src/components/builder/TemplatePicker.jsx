import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import DescriptionIcon from '@mui/icons-material/Description';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { TEMPLATES } from '@shared/templates.js';

const ICONS = { practice: SchoolOutlinedIcon, exam: TimerOutlinedIcon, blank: DescriptionIcon };

export default function TemplatePicker({ onPick, onImport }) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
      <Typography variant="h4" component="h1">
        Create a test
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>
        Pick a starting point. You can change every setting before publishing.
      </Typography>
      <Grid container spacing={2}>
        {TEMPLATES.map((template) => {
          const Icon = ICONS[template.id] ?? DescriptionIcon;
          return (
            <Grid key={template.id} size={{ xs: 12, sm: 4 }}>
              <Card sx={{ height: '100%', borderRadius: 3 }}>
                <CardActionArea
                  onClick={() => onPick(template.id)}
                  sx={{ height: '100%', p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 1 }}
                >
                  <Icon color="primary" sx={{ fontSize: 36 }} aria-hidden />
                  <Typography variant="h6" component="h2">
                    {template.label}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {template.description}
                  </Typography>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      <Button startIcon={<UploadFileIcon />} onClick={onImport} sx={{ mt: 3 }}>
        Or start by importing questions from Excel / CSV
      </Button>
    </Container>
  );
}
