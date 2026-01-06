import dotenv from 'dotenv';
import cron from 'node-cron';
import { PolymarketClient } from './polymarket-client';
import { DatabaseService } from './database';
import { MonitorService } from './monitor';
import { ApiServer } from './server';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001');
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_SECONDS || '60');
const DB_PATH = process.env.DB_PATH || './data/polymarket.db';

async function main() {
  console.log('Starting Polymarket Monitor...');

  const client = new PolymarketClient();
  const db = new DatabaseService(DB_PATH);
  const monitor = new MonitorService(client, db);
  const server = new ApiServer(db, client);

  server.listen(PORT);

  console.log(`Monitoring will run every ${CHECK_INTERVAL} seconds`);

  const runMonitoring = async () => {
    await monitor.monitorMarkets();
  };

  await runMonitoring();

  const cronExpression = `*/${CHECK_INTERVAL} * * * * *`;
  cron.schedule(cronExpression, async () => {
    console.log(`Running monitoring cycle at ${new Date().toISOString()}`);
    await runMonitoring();
  });

  process.on('SIGINT', () => {
    console.log('Shutting down...');
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down...');
    db.close();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
