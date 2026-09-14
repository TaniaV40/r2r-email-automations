import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Creates nodemailer transport instance based on environment configuration.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== 'false';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

/**
 * Core send email function with graceful logging if credentials missing.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; reason?: string }> {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || 'Tania Vorster - Series Media <taniavorster40.ai@gmail.com>';

  if (!transporter) {
    console.warn(`[Email Service] SMTP_USER or SMTP_PASS not configured. Skipping email dispatch to ${options.to}.`);
    return { success: false, reason: 'SMTP credentials not configured in environment' };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html
    });

    console.log(`[Email Service] Email sent successfully to ${options.to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Email Service] Failed to send email to ${options.to}:`, error.message || error);
    return { success: false, reason: error.message || String(error) };
  }
}

/**
 * Workflow 2: Send spreadsheet link notification email.
 */
export async function sendLinkEmail(overrideTo?: string) {
  const to = overrideTo || process.env.RECIPIENTS_WORKFLOW_2 || 'richard@r2rtennis.co.uk, alex@r2rtennis.co.uk';
  const sheetUrl = process.env.GOOGLE_SHEET_SHARE_URL || 'https://docs.google.com/spreadsheets/d/1iKNTgq7iLAyYDRAO6dOUn4H1Nso-N-wTrG-7btQYfOM/edit?usp=sharing';

  const subject = 'Updated R2R Order Sheet';
  const html = `
<p>Hi Richard & Alex,</p>
<p>Just a quick note to let you know the order spreadsheet has been updated with a new order.</p>
<p>You can access it using the link below:</p>

<p>
  <a href="${sheetUrl}"
     style="display:inline-block;padding:12px 18px;border-radius:6px;text-decoration:none;background:#1a73e8;color:#ffffff;">
    Open Order Spreadsheet
  </a>
</p>

<p style="word-break:break-all;">${sheetUrl}</p>

<p>If you’d like to download a copy, go to <strong>File → Download → Microsoft Excel</strong>.</p>
<p>Kind regards,<br><strong>Tania Vorster</strong><br>Series Media</p>
  `.trim();

  return sendEmail({ to, subject, html });
}

/**
 * Workflow 3: Send monthly order summary notification email.
 */
export async function sendMonthlySummaryEmail(overrideTo?: string) {
  const to = overrideTo || process.env.RECIPIENTS_WORKFLOW_3 || 'richard@r2rtennis.co.uk';
  const sheetUrl = process.env.GOOGLE_SHEET_SHARE_URL || 'https://docs.google.com/spreadsheets/d/1iKNTgq7iLAyYDRAO6dOUn4H1Nso-N-wTrG-7btQYfOM/edit?usp=sharing';

  const subject = 'Updated R2R Order Sheet';
  const html = `
<p>Hi Richard,</p>
<p>Just a quick note to let you know the summary of the Month's orders are ready. Please click on the tab sheet called 'Monthly summary' to see a summary of the different venues, but only on the first of each month will it be available. </p>
<p>You can access it using the link below:</p>

<p>
  <a href="${sheetUrl}"
     style="display:inline-block;padding:12px 18px;border-radius:6px;text-decoration:none;background:#1a73e8;color:#ffffff;">
    Open Order Spreadsheet
  </a>
</p>

<p style="word-break:break-all;">${sheetUrl}</p>

<p>If you’d like to download a copy, go to <strong>File → Download → Microsoft Excel</strong>.</p>
<p>Kind regards,<br><strong>Tania Vorster</strong><br>Series Media</p>
  `.trim();

  return sendEmail({ to, subject, html });
}
