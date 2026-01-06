import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Trade, WhaleActivity, Alert, MarketStats } from './types';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string = './data/polymarket.db') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        market_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        side TEXT NOT NULL,
        size REAL NOT NULL,
        price REAL NOT NULL,
        outcome TEXT NOT NULL,
        trader_address TEXT,
        fee_rate_bps INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
      CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader_address);

      CREATE TABLE IF NOT EXISTS whale_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_address TEXT NOT NULL,
        market_id TEXT NOT NULL,
        market_question TEXT,
        total_volume REAL NOT NULL,
        trade_count INTEGER NOT NULL,
        first_seen INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        is_new_whale INTEGER DEFAULT 0,
        UNIQUE(trader_address, market_id)
      );

      CREATE INDEX IF NOT EXISTS idx_whale_trader ON whale_activity(trader_address);
      CREATE INDEX IF NOT EXISTS idx_whale_volume ON whale_activity(total_volume);

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        market_id TEXT,
        trader_address TEXT,
        amount REAL,
        timestamp INTEGER NOT NULL,
        read INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);

      CREATE TABLE IF NOT EXISTS market_stats (
        market_id TEXT PRIMARY KEY,
        question TEXT,
        total_volume_24h REAL,
        trade_count_24h INTEGER,
        unique_traders_24h INTEGER,
        avg_trade_size_24h REAL,
        price_change_24h REAL,
        largest_trade_24h REAL,
        last_updated INTEGER
      );
    `);
  }

  saveTrade(trade: Trade): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO trades
      (id, market_id, timestamp, side, size, price, outcome, trader_address, fee_rate_bps)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trade.id,
      trade.market_id,
      trade.timestamp,
      trade.side,
      trade.size,
      trade.price,
      trade.outcome,
      trade.trader_address || null,
      trade.fee_rate_bps || null
    );
  }

  saveTrades(trades: Trade[]): void {
    const insert = this.db.transaction((trades: Trade[]) => {
      for (const trade of trades) {
        this.saveTrade(trade);
      }
    });

    insert(trades);
  }

  updateWhaleActivity(activity: WhaleActivity): void {
    const stmt = this.db.prepare(`
      INSERT INTO whale_activity
      (trader_address, market_id, market_question, total_volume, trade_count, first_seen, last_activity, is_new_whale)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(trader_address, market_id) DO UPDATE SET
        total_volume = total_volume + excluded.total_volume,
        trade_count = trade_count + excluded.trade_count,
        last_activity = excluded.last_activity
    `);

    stmt.run(
      activity.trader_address,
      activity.market_id,
      activity.market_question,
      activity.total_volume,
      activity.trade_count,
      activity.first_seen,
      activity.last_activity,
      activity.is_new_whale ? 1 : 0
    );
  }

  createAlert(alert: Alert): void {
    const stmt = this.db.prepare(`
      INSERT INTO alerts (type, severity, message, market_id, trader_address, amount, timestamp, read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      alert.type,
      alert.severity,
      alert.message,
      alert.market_id || null,
      alert.trader_address || null,
      alert.amount || null,
      alert.timestamp,
      alert.read ? 1 : 0
    );
  }

  getRecentAlerts(limit: number = 50): Alert[] {
    const stmt = this.db.prepare(`
      SELECT * FROM alerts
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(limit).map((row: any) => ({
      ...row,
      read: Boolean(row.read),
    }));
  }

  getUnreadAlerts(): Alert[] {
    const stmt = this.db.prepare(`
      SELECT * FROM alerts
      WHERE read = 0
      ORDER BY timestamp DESC
    `);

    return stmt.all().map((row: any) => ({
      ...row,
      read: false,
    }));
  }

  markAlertAsRead(id: number): void {
    const stmt = this.db.prepare('UPDATE alerts SET read = 1 WHERE id = ?');
    stmt.run(id);
  }

  getWhaleActivity(limit: number = 100): WhaleActivity[] {
    const stmt = this.db.prepare(`
      SELECT * FROM whale_activity
      ORDER BY total_volume DESC
      LIMIT ?
    `);

    return stmt.all(limit).map((row: any) => ({
      ...row,
      is_new_whale: Boolean(row.is_new_whale),
    }));
  }

  getTraderActivity(address: string): WhaleActivity[] {
    const stmt = this.db.prepare(`
      SELECT * FROM whale_activity
      WHERE trader_address = ?
      ORDER BY last_activity DESC
    `);

    return stmt.all(address).map((row: any) => ({
      ...row,
      is_new_whale: Boolean(row.is_new_whale),
    }));
  }

  updateMarketStats(stats: MarketStats): void {
    const stmt = this.db.prepare(`
      INSERT INTO market_stats
      (market_id, question, total_volume_24h, trade_count_24h, unique_traders_24h,
       avg_trade_size_24h, price_change_24h, largest_trade_24h, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(market_id) DO UPDATE SET
        question = excluded.question,
        total_volume_24h = excluded.total_volume_24h,
        trade_count_24h = excluded.trade_count_24h,
        unique_traders_24h = excluded.unique_traders_24h,
        avg_trade_size_24h = excluded.avg_trade_size_24h,
        price_change_24h = excluded.price_change_24h,
        largest_trade_24h = excluded.largest_trade_24h,
        last_updated = strftime('%s', 'now')
    `);

    stmt.run(
      stats.market_id,
      stats.question,
      stats.total_volume_24h,
      stats.trade_count_24h,
      stats.unique_traders_24h,
      stats.avg_trade_size_24h,
      stats.price_change_24h,
      stats.largest_trade_24h
    );
  }

  getMarketStats(marketId?: string): MarketStats[] {
    if (marketId) {
      const stmt = this.db.prepare('SELECT * FROM market_stats WHERE market_id = ?');
      return stmt.all(marketId) as MarketStats[];
    } else {
      const stmt = this.db.prepare('SELECT * FROM market_stats ORDER BY total_volume_24h DESC');
      return stmt.all() as MarketStats[];
    }
  }

  getRecentTrades(limit: number = 100): Trade[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(limit) as Trade[];
  }

  close(): void {
    this.db.close();
  }
}
