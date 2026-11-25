import { Component } from 'react';
import Button from '@mui/material/Button';
import ErrorState from './ErrorState.jsx';

/** Shows a friendly message instead of a blank page if something crashes. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const outdated = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message);
    return (
      <ErrorState
        title={outdated ? 'A new version is available' : 'Something went wrong'}
        message={
          outdated
            ? 'Reload the page to get the latest version. Anything you were typing is saved on this device.'
            : 'Reload the page to try again. Your drafts and answers are saved on this device.'
        }
      >
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </ErrorState>
    );
  }
}
