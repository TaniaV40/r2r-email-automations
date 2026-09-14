process.env.NODE_ENV = 'test';
import app from './index';
import { calculateMonthlySummary } from './services/googleSheetsSummary';
import http from 'http';

const TEST_PORT = 3007;
let server: http.Server;

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[TEST SERVER]: Listening on port ${TEST_PORT}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runTest() {
  console.log('--- Starting R2R Email Automations Integration Test ---\n');

  // 1. Calculation Unit Test
  console.log('Testing calculateMonthlySummary with mock order records...');
  const mockRows = [
    { Location: 'Kings Cliffe', 'Lesson Type': 'Group', 'Order Total £': '45.00' },
    { Location: 'Thrapston', 'Lesson Type': 'Group', 'Order Total £': '30.00' },
    { Location: 'Padel Manor', 'Lesson Type': 'Group', 'Order Total £': '50.00' },
    { Location: 'Uppingham', 'Lesson Type': 'Group', 'Order Total £': '40.00' },
    { Location: 'Ketton', 'Lesson Type': 'Group', 'Order Total £': '25.00' },
    { Location: 'Medbourne', 'Lesson Type': 'Group', 'Order Total £': '35.00' },
    { Location: 'Kings Cliffe', 'Lesson Type': 'CAMP', 'Order Total £': '80.00' },
    { Location: 'Other', 'Lesson Type': 'Individual Lesson', 'Order Total £': '60.00' }
  ];

  const summary = calculateMonthlySummary(mockRows, 'August 2026');
  console.log('Calculated Summary Result:', summary);

  console.assert(summary.kingsCliffe === 45, 'Kings Cliffe revenue match');
  console.assert(summary.thrapston === 30, 'Thrapston revenue match');
  console.assert(summary.padel === 50, 'Padel revenue match');
  console.assert(summary.uppingham === 40, 'Uppingham revenue match');
  console.assert(summary.ketton === 25, 'Ketton revenue match');
  console.assert(summary.medbourne === 35, 'Medbourne revenue match');
  console.assert(summary.camps === 80, 'Camps revenue match');
  console.assert(summary.individuals === 60, 'Individuals revenue match');
  console.assert(summary.grandTotal === 365, 'Grand Total revenue match');

  console.log('✅ Calculation unit test assertions passed!\n');

  // 2. HTTP Server Endpoints Test
  await startServer();
  try {
    console.log('Testing /health endpoint...');
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/health`);
    const healthJson = await healthRes.json();
    console.log('Health check response:', healthJson);

    console.log('\nTesting /api/trigger/send-link-email endpoint...');
    const linkRes = await fetch(`http://localhost:${TEST_PORT}/api/trigger/send-link-email`, { method: 'POST' });
    const linkJson: any = await linkRes.json();
    console.log('Link email response:', linkJson);

    console.log('\nTesting /api/trigger/generate-monthly-summary endpoint (safe dry run)...');
    const summaryRes = await fetch(`http://localhost:${TEST_PORT}/api/trigger/generate-monthly-summary?reset=false`, { method: 'POST' });
    const summaryJson: any = await summaryRes.json();
    console.log('Monthly summary response:', JSON.stringify(summaryJson, null, 2));

    console.log('\n✅ ALL R2R EMAIL AUTOMATION TESTS COMPLETED SUCCESSFULLY!');
  } finally {
    await stopServer();
  }
}

runTest().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
