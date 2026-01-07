import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';
import { PolymarketClient } from './polymarket-client';
import { DatabaseService } from './database';
import { MonitorService } from './monitor';
import { EnhancedMonitorService } from './enhanced-monitor';
import { ApiServer } from './server';
import { NotificationService } from './notification-service';

// Load environment variables - works for both dev (tsx) and production (compiled)
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config(); // Also try current directory

const PORT = parseInt(process.env.PORT || '3001');
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_SECONDS || '60');
const DB_PATH = process.env.DB_PATH || './data/polymarket.db';
const USE_ENHANCED_MONITOR = process.env.USE_ENHANCED_MONITOR !== 'false'; // Default to enhanced

async function main() {
  console.log('Starting Polymarket Monitor...');

  const client = new PolymarketClient();
  const db = new DatabaseService(DB_PATH);
  const notifications = new NotificationService();
  
  // Start API server first to get WebSocket server
  const server = new ApiServer(db, client);
  server.listen(PORT);
  
  // Get WebSocket server for real-time broadcasts
  const wsServer = server.getWebSocketServer();
  
  // Use enhanced monitor by default (set USE_ENHANCED_MONITOR=false to use legacy)
  let monitor: MonitorService | EnhancedMonitorService;
  
  if (USE_ENHANCED_MONITOR) {
    console.log('📊 Using ENHANCED monitor with severity scoring + WebSocket broadcasts');
    monitor = new EnhancedMonitorService(client, db, notifications, wsServer);
  } else {
    console.log('📊 Using LEGACY monitor');
    monitor = new MonitorService(client, db, notifications);
  }

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
    if ('destroy' in monitor) {
      (monitor as EnhancedMonitorService).destroy();
    }
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down...');
    if ('destroy' in monitor) {
      (monitor as EnhancedMonitorService).destroy();
    }
    db.close();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
