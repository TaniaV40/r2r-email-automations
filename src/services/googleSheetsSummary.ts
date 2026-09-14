import { google } from 'googleapis';

export interface MonthlySummaryResult {
  month: string;
  kingsCliffe: number;
  padel: number;
  thrapston: number;
  uppingham: number;
  ketton: number;
  medbourne: number;
  individuals: number;
  camps: number;
  grandTotal: number;
}

/**
 * Formats Google Service Account private key string safely.
 */
function getPrivateKey(): string | null {
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (!key) return null;
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

/**
 * Calculates monthly revenue summary from row data array matching n8n Workflow 3 logic.
 */
export function calculateMonthlySummary(rows: Array<Record<string, any>>, customMonthName?: string): MonthlySummaryResult {
  const summary = {
    'Kings Cliffe': 0,
    'Padel': 0,
    'Thrapston': 0,
    'Uppingham': 0,
    'Ketton': 0,
    'Medbourne': 0,
    'Individuals': 0,
    'CAMP': 0
  };

  for (const row of rows) {
    const getVal = (name: string): string => {
      const key = Object.keys(row).find(k => k.toLowerCase().includes(name.toLowerCase()));
      return key ? String(row[key]) : '';
    };

    const loc = getVal('Location');
    const type = getVal('Lesson Type');

    const priceKey = Object.keys(row).find(k => k.includes('Total') || k.includes('£'));
    const total = priceKey ? parseFloat(String(row[priceKey])) || 0 : 0;

    if (type.toLowerCase().includes('camp')) {
      summary['CAMP'] += total;
    } else if (loc.includes('Kings Cliffe')) {
      summary['Kings Cliffe'] += total;
    } else if (loc.includes('Thrapston')) {
      summary['Thrapston'] += total;
    } else if (loc.includes('Uppingham')) {
      summary['Uppingham'] += total;
    } else if (loc.includes('Ketton')) {
      summary['Ketton'] += total;
    } else if (loc.includes('Medbourne')) {
      summary['Medbourne'] += total;
    } else if (loc.includes('Padel') || loc.includes('Manor')) {
      summary['Padel'] += total;
    } else if (type.toLowerCase().includes('individual')) {
      summary['Individuals'] += total;
    }
  }

  const grandTotal = Object.values(summary).reduce((a, b) => a + b, 0);

  // Month calculation: Default to previous month (e.g. "August 2026" if run in September)
  let monthName = customMonthName;
  if (!monthName) {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  return {
    month: monthName,
    kingsCliffe: summary['Kings Cliffe'],
    padel: summary['Padel'],
    thrapston: summary['Thrapston'],
    uppingham: summary['Uppingham'],
    ketton: summary['Ketton'],
    medbourne: summary['Medbourne'],
    individuals: summary['Individuals'],
    camps: summary['CAMP'],
    grandTotal
  };
}

/**
 * Creates an archive sheet tab for the past month, copies master rows, and clears Master Sheet data rows.
 */
export async function archiveAndResetMasterSheet(
  sheets: any,
  spreadsheetId: string,
  masterSheetTab: string,
  rawRows: any[][],
  monthName: string
): Promise<boolean> {
  try {
    const archiveTabName = `Orders - ${monthName}`;
    console.log(`[Archive & Reset] Creating archive sheet '${archiveTabName}'...`);

    // 1. Create new sheet tab for month archive
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: archiveTabName
                }
              }
            }
          ]
        }
      });
      console.log(`[Archive & Reset] Sheet '${archiveTabName}' created successfully.`);
    } catch (err: any) {
      // If sheet tab already exists, log and proceed with overwriting/appending
      console.log(`[Archive & Reset] Note on creating tab '${archiveTabName}':`, err.message || err);
    }

    // 2. Copy raw Master Sheet rows to the archive tab
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${archiveTabName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rawRows
      }
    });

    console.log(`[Archive & Reset] Successfully archived ${rawRows.length} rows to '${archiveTabName}'.`);

    // 3. Clear data rows from Master Sheet (A2:Z10000), leaving Header Row 1 intact!
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${masterSheetTab}!A2:Z10000`
    });

    console.log(`[Archive & Reset] Master Sheet data rows cleared successfully. Ready for new month orders!`);
    return true;
  } catch (error: any) {
    console.error(`[Archive & Reset] Error archiving/resetting Master Sheet:`, error.message || error);
    return false;
  }
}

/**
 * Fetches all orders from Master Sheet, aggregates monthly revenue, appends summary row,
 * archives past month orders to a dedicated tab, and resets Master Sheet for the new month.
 */
export async function generateAndAppendMonthlySummary(
  resetMasterSheet: boolean = true
): Promise<{ success: boolean; summary?: MonthlySummaryResult; archived?: boolean; reason?: string }> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1iKNTgq7iLAyYDRAO6dOUn4H1Nso-N-wTrG-7btQYfOM';
  const masterSheetTab = process.env.GOOGLE_SHEET_MASTER_TAB || 'Master Sheet';
  const summarySheetTab = process.env.GOOGLE_SHEET_SUMMARY_TAB || 'Monthly Summary';

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    console.warn('[Monthly Summary] Google Sheets credentials not configured in environment.');
    return { success: false, reason: 'Google Sheets credentials missing' };
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Read all rows from Master Sheet
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${masterSheetTab}!A:M`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });

    const rawRows = getRes.data.values || [];
    if (rawRows.length < 2) {
      console.warn('[Monthly Summary] Master Sheet contains no data rows to aggregate.');
      return { success: false, reason: 'No data rows found in Master Sheet' };
    }

    const headers = rawRows[0].map((h: any) => String(h).trim());
    const dataRows: Array<Record<string, any>> = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const record: Record<string, any> = {};
      headers.forEach((header: string, colIdx: number) => {
        record[header] = row[colIdx] !== undefined ? row[colIdx] : '';
      });
      dataRows.push(record);
    }

    // 2. Calculate summary totals
    const summaryResult = calculateMonthlySummary(dataRows);

    // 3. Append row to Monthly Summary tab
    const values = [
      [
        summaryResult.month,
        summaryResult.kingsCliffe,
        summaryResult.padel,
        summaryResult.thrapston,
        summaryResult.uppingham,
        summaryResult.ketton,
        summaryResult.individuals,
        summaryResult.medbourne,
        summaryResult.camps,
        summaryResult.grandTotal
      ]
    ];

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${summarySheetTab}!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });

    console.log(`[Monthly Summary] Appended summary for ${summaryResult.month}. Range: ${appendRes.data.updates?.updatedRange}`);

    // 4. Archive Master Sheet to past month tab & clear Master Sheet for new month
    let archived = false;
    if (resetMasterSheet) {
      archived = await archiveAndResetMasterSheet(sheets, spreadsheetId, masterSheetTab, rawRows, summaryResult.month);
    }

    return { success: true, summary: summaryResult, archived };

  } catch (error: any) {
    console.error('[Monthly Summary] Failed to generate monthly summary:', error.message || error);
    return { success: false, reason: error.message || String(error) };
  }
}
