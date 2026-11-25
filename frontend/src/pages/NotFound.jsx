import { Link as RouterLink } from 'react-router';
import Button from '@mui/material/Button';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import ErrorState from '../components/ErrorState.jsx';

export default function NotFound() {
  return (
    <ErrorState icon={HelpOutlinedIcon} title="Page not found" message="The link may be incomplete. Check that you copied all of it.">
      <Button variant="contained" component={RouterLink} to="/">
        Go to the home page
      </Button>
    </ErrorState>
  );
}
