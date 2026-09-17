import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { sendLinkEmail, sendMonthlySummaryEmail } from './services/email';
import { generateAndAppendMonthlySummary } from './services/googleSheetsSummary';

dotenv.config();

const app = express();
app.use(express.json());

// Normalize Vercel serverless function path rewrites
app.use((req, _res, next) => {
  if (req.url.startsWith('/src/index.ts')) {
    req.url = req.url.replace('/src/index.ts', '') || '/';
  }
  next();
});

const PORT = process.env.PORT || 3002;

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'r2r-email-automations', timestamp: new Date().toISOString() });
});

// Root Status Page
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'R2R Tennis Email Automations & Monthly Summary Microservice',
    status: 'running',
    endpoints: {
      health: '/health',
      sendLinkEmail: '/api/cron/send-link-email',
      generateMonthlySummary: '/api/cron/generate-monthly-summary'
    }
  });
});

/**
 * Middleware / Check for optional CRON_SECRET for security
 */
function verifyCronAuth(req: Request, res: Response, next: () => void) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${secret}` && req.headers['x-cron-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized cron request' });
    }
  }
  next();
}

/**
 * Workflow 2: Send Spreadsheet Link Email (Twice Weekly: Mon & Thu 5am)
 */
async function handleSendLinkEmail(req: Request, res: Response) {
  try {
    const overrideTo = req.query.to as string || req.body?.to;
    console.log('[Workflow 2] Triggering Spreadsheet Link Email to:', overrideTo || 'default recipients');

    const result = await sendLinkEmail(overrideTo);
    return res.status(result.success ? 200 : 500).json({
      workflow: 'Workflow 2 (Spreadsheet Link Email)',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (err: any) {
    console.error('[Workflow 2] Error:', err.message || err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

app.get('/api/cron/send-link-email', verifyCronAuth, handleSendLinkEmail);
app.post('/api/cron/send-link-email', verifyCronAuth, handleSendLinkEmail);
app.post('/api/trigger/send-link-email', handleSendLinkEmail);

/**
 * Workflow 3: Monthly Order Summary Generator & Notification Email (Monthly: 1st of month 1am)
 * Automatically archives past month orders to a new tab and clears Master Sheet for the new month.
 */
async function handleGenerateMonthlySummary(req: Request, res: Response) {
  try {
    const overrideTo = req.query.to as string || req.body?.to;
    const reset = req.query.reset !== 'false';
    console.log(`[Workflow 3] Triggering Monthly Summary Generation (Reset Master Sheet: ${reset})...`);

    // 1. Read sheet, calculate venue totals, append to Monthly Summary tab, archive past month, and clear Master Sheet
    const sheetsResult = await generateAndAppendMonthlySummary(reset);

    // 2. Send notification email to client
    const emailResult = await sendMonthlySummaryEmail(overrideTo);

    return res.status(sheetsResult.success ? 200 : 500).json({
      workflow: 'Workflow 3 (Monthly Summary & Email)',
      timestamp: new Date().toISOString(),
      sheets: sheetsResult,
      email: emailResult
    });
  } catch (err: any) {
    console.error('[Workflow 3] Error:', err.message || err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

app.get('/api/cron/generate-monthly-summary', verifyCronAuth, handleGenerateMonthlySummary);
app.post('/api/cron/generate-monthly-summary', verifyCronAuth, handleGenerateMonthlySummary);
app.post('/api/trigger/generate-monthly-summary', handleGenerateMonthlySummary);

// Listen when executed directly (not in Vercel serverless environment)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`R2R Email Automations listening on port ${PORT}`);
  });
}

export default app;
