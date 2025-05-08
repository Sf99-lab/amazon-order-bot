import cron from 'node-cron';
import { runOrderAutomation } from './index.mjs';

//Run at 9:00 AM EST daily 
cron.schedule('0 9 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running Amazon order task...`);
  await runOrderAutomation();
}, {
  timezone: 'America/New_York'
});

// cron.schedule('*/5 * * * *', async () => {
//   console.log(`[${new Date().toISOString()}] Running Amazon order task...`);
//   await runOrderAutomation();
// });

console.log('Scheduler initialized. Task will run daily at 9 AM EST.');
