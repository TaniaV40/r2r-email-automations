# R2R Tennis Email Automations (Standalone Microservice)

This repository contains a standalone Node.js/TypeScript microservice that automates client email notifications and monthly order revenue calculations for R2R Tennis.

## Workflows Included

### 1. Workflow 2: Spreadsheet Link Email
- **Schedule:** Twice weekly (Mondays & Thursdays at 5:00 AM).
- **Endpoint:** `GET /api/cron/send-link-email`
- **Action:** Sends an HTML email to `richard@r2rtennis.co.uk` and `alex@r2rtennis.co.uk` with a direct link to open the order spreadsheet.

### 2. Workflow 3: Monthly Order Summary & Sheet Aggregator
- **Schedule:** Monthly (1st of each month at 1:00 AM).
- **Endpoint:** `GET /api/cron/generate-monthly-summary`
- **Action:** Reads all orders from `Master Sheet`, calculates revenue totals by venue (`Kings Cliffe`, `Padel`, `Thrapston`, `Uppingham`, `Ketton`, `Medbourne`, `Individuals`, `Camps`, and `GRAND TOTAL`), appends a summary row to the `Monthly Summary` tab, and emails `richard@r2rtennis.co.uk`.

---

## Configuration (`.env`)

Configure environment variables in `.env`:

```env
PORT=3002

# Google Sheets API Config
GOOGLE_SHEET_ID=1iKNTgq7iLAyYDRAO6dOUn4H1Nso-N-wTrG-7btQYfOM
GOOGLE_SHEET_MASTER_TAB=Master Sheet
GOOGLE_SHEET_SUMMARY_TAB=Monthly Summary
GOOGLE_SERVICE_ACCOUNT_EMAIL=r2r-sheets-bot@r2r-automations.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Email Delivery Config (SMTP / Gmail App Password or Resend)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM="Tania Vorster - Series Media <your-email@gmail.com>"
```

---

## Local Development & Testing

### 1. Install & Build
```bash
npm install
npm run build
```

### 2. Run Test Suite
```bash
npx ts-node src/test.ts
```

### 3. Start Local Server
```bash
npm start
```
Server runs at `http://localhost:3002`.

---

## Deployment (Vercel with Automated Crons)

This project contains `vercel.json` configured with native **Vercel Crons**:
1. Import this repository in [Vercel](https://vercel.com).
2. Set Environment Variables (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SMTP_USER`, `SMTP_PASS`).
3. Deploy! Vercel Crons will automatically trigger the emails and monthly summary calculations on schedule.
