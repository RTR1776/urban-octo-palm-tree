import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';
import { PolymarketClient } from './polymarket-client';
import { KalshiClient } from './kalshi-client';
import { DatabaseService } from './database';
import { MonitorService } from './monitor';
import { EnhancedMonitorService } from './enhanced-monitor';
import { KalshiMonitorService } from './kalshi-monitor';
import { ApiServer } from './server';
import { NotificationService } from './notification-service';
import { AnalyticsJobs } from './jobs/analytics-jobs';

// Load environment variables - works for both dev (tsx) and production (compiled)
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config(); // Also try current directory

const PORT = parseInt(process.env.PORT || '3001');
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_SECONDS || '60');
const DB_PATH = process.env.DB_PATH || './data/polymarket.db';
const USE_ENHANCED_MONITOR = process.env.USE_ENHANCED_MONITOR !== 'false'; // Default to enhanced
const KALSHI_ENABLED = process.env.KALSHI_ENABLED === 'true';

async function main() {
  console.log('Starting Prediction Market Monitor...');
  console.log(`  - Polymarket: enabled`);
  console.log(`  - Kalshi: ${KALSHI_ENABLED ? 'enabled' : 'disabled'}`);

  // Initialize clients
  const polymarketClient = new PolymarketClient();
  const db = new DatabaseService(DB_PATH);
  const notifications = new NotificationService();

  // Initialize Kalshi client if enabled
  let kalshiClient: KalshiClient | undefined;
  let kalshiMonitor: KalshiMonitorService | undefined;

  if (KALSHI_ENABLED) {
    kalshiClient = new KalshiClient();
    // Try to authenticate (optional - works without auth for public data)
    await kalshiClient.authenticate();
  }

  // Start API server with both clients
  const server = new ApiServer(db, polymarketClient, kalshiClient);
  server.listen(PORT);

  // Get WebSocket server for real-time broadcasts
  const wsServer = server.getWebSocketServer();

  // Initialize Analytics Jobs
  console.log('📈 Initializing Analytics Jobs...');
  const analyticsJobs = new AnalyticsJobs(db, polymarketClient);
  analyticsJobs.start();

  // Run initial analytics data collection
  console.log('📊 Running initial analytics data collection...');
  await analyticsJobs.runAll().catch(error => {
    console.error('Error in initial analytics run:', error);
  });

  // Initialize Polymarket monitor
  let polymarketMonitor: MonitorService | EnhancedMonitorService;

  if (USE_ENHANCED_MONITOR) {
    console.log('📊 Using ENHANCED Polymarket monitor with severity scoring');
    polymarketMonitor = new EnhancedMonitorService(polymarketClient, db, notifications, wsServer);
  } else {
    console.log('📊 Using LEGACY Polymarket monitor');
    polymarketMonitor = new MonitorService(polymarketClient, db, notifications);
  }

  // Initialize Kalshi monitor if enabled
  if (KALSHI_ENABLED && kalshiClient) {
    console.log('📊 Initializing Kalshi monitor');
    kalshiMonitor = new KalshiMonitorService(kalshiClient, db, notifications, wsServer);
  }

  console.log(`Monitoring will run every ${CHECK_INTERVAL} seconds`);

  // Combined monitoring function
  const runMonitoring = async () => {
    // Run Polymarket monitoring
    await polymarketMonitor.monitorMarkets();

    // Run Kalshi monitoring if enabled
    if (kalshiMonitor && kalshiMonitor.isEnabled()) {
      await kalshiMonitor.monitorMarkets();
    }
  };

  // Initial run
  await runMonitoring();

  // Schedule recurring monitoring
  const cronExpression = `*/${CHECK_INTERVAL} * * * * *`;
  cron.schedule(cronExpression, async () => {
    console.log(`Running monitoring cycle at ${new Date().toISOString()}`);
    await runMonitoring();
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...');
    analyticsJobs.stop();
    if ('destroy' in polymarketMonitor) {
      (polymarketMonitor as EnhancedMonitorService).destroy();
    }
    if (kalshiMonitor) {
      kalshiMonitor.destroy();
    }
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
