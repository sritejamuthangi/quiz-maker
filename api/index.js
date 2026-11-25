// Vercel serverless entry point: every /api/* request is routed here (see vercel.json).
import { createApp } from '../backend/app.js';

let handler;
try {
  handler = createApp();
} catch (error) {
  // Most likely a missing environment variable. Respond with a clear message instead of crashing.
  console.error('[api] failed to start:', error?.message);
  handler = (req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(
      JSON.stringify({
        error: 'The server is not configured correctly. Check the environment variables in Vercel.',
        code: 'misconfigured',
      }),
    );
  };
}

export default handler;
