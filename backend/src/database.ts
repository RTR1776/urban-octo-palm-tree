import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Trade, WhaleActivity, Alert, MarketStats, PriceHistory, MarketMetrics, MarketCategory, MarketCorrelation } from './types';

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

      -- Analytics tables
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        interval TEXT NOT NULL,
        UNIQUE(market_id, timestamp, interval)
      );

      CREATE INDEX IF NOT EXISTS idx_price_history_market ON price_history(market_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_price_history_interval ON price_history(interval);

      CREATE TABLE IF NOT EXISTS market_metrics (
        market_id TEXT PRIMARY KEY,
        volatility_24h REAL,
        momentum_24h REAL,
        spread_pct REAL,
        depth_score REAL,
        sharpe_ratio REAL,
        volume_trend REAL,
        price_trend REAL,
        trader_count_24h INTEGER,
        updated_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_market_metrics_updated ON market_metrics(updated_at);

      CREATE TABLE IF NOT EXISTS market_categories (
        market_id TEXT NOT NULL,
        category TEXT NOT NULL,
        confidence REAL,
        PRIMARY KEY (market_id, category)
      );

      CREATE INDEX IF NOT EXISTS idx_market_categories_category ON market_categories(category);

      CREATE TABLE IF NOT EXISTS market_correlations (
        market_id_1 TEXT NOT NULL,
        market_id_2 TEXT NOT NULL,
        correlation REAL NOT NULL,
        lookback_hours INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (market_id_1, market_id_2)
      );

      CREATE INDEX IF NOT EXISTS idx_market_correlations_updated ON market_correlations(updated_at);
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

  // ========== Analytics Methods ==========

  /**
   * Store price history (OHLCV) data
   */
  storePriceHistory(priceHistory: PriceHistory[]): void {
    const insert = this.db.transaction((prices: PriceHistory[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO price_history
        (market_id, timestamp, open, high, low, close, volume, interval)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of prices) {
        stmt.run(
          p.market_id,
          p.timestamp,
          p.open,
          p.high,
          p.low,
          p.close,
          p.volume,
          p.interval
        );
      }
    });

    insert(priceHistory);
  }

  /**
   * Get price history for a market
   */
  getPriceHistory(
    marketId: string,
    interval: string,
    startTime?: number,
    endTime?: number,
    limit: number = 1000
  ): PriceHistory[] {
    let query = `
      SELECT * FROM price_history
      WHERE market_id = ? AND interval = ?
    `;
    const params: any[] = [marketId, interval];

    if (startTime) {
      query += ` AND timestamp >= ?`;
      params.push(startTime);
    }
    if (endTime) {
      query += ` AND timestamp <= ?`;
      params.push(endTime);
    }

    query += ` ORDER BY timestamp ASC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as PriceHistory[];
  }

  /**
   * Store or update market metrics
   */
  storeMarketMetrics(metrics: MarketMetrics): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO market_metrics
      (market_id, volatility_24h, momentum_24h, spread_pct, depth_score,
       sharpe_ratio, volume_trend, price_trend, trader_count_24h, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metrics.market_id,
      metrics.volatility_24h,
      metrics.momentum_24h,
      metrics.spread_pct,
      metrics.depth_score,
      metrics.sharpe_ratio,
      metrics.volume_trend,
      metrics.price_trend,
      metrics.trader_count_24h,
      metrics.updated_at
    );
  }

  /**
   * Get market metrics
   */
  getMarketMetrics(marketId: string): MarketMetrics | null {
    const stmt = this.db.prepare(`
      SELECT * FROM market_metrics WHERE market_id = ?
    `);
    return stmt.get(marketId) as MarketMetrics || null;
  }

  /**
   * Get all market metrics
   */
  getAllMarketMetrics(limit: number = 100): MarketMetrics[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_metrics
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as MarketMetrics[];
  }

  /**
   * Store market categories
   */
  storeMarketCategories(marketId: string, categories: Array<{ category: string; confidence: number }>): void {
    // First delete existing categories for this market
    const deleteStmt = this.db.prepare(`
      DELETE FROM market_categories WHERE market_id = ?
    `);
    deleteStmt.run(marketId);

    // Then insert new categories
    const insert = this.db.transaction((cats: Array<{ category: string; confidence: number }>) => {
      const stmt = this.db.prepare(`
        INSERT INTO market_categories (market_id, category, confidence)
        VALUES (?, ?, ?)
      `);

      for (const cat of cats) {
        stmt.run(marketId, cat.category, cat.confidence);
      }
    });

    insert(categories);
  }

  /**
   * Get categories for a market
   */
  getMarketCategories(marketId: string): MarketCategory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_categories
      WHERE market_id = ?
      ORDER BY confidence DESC
    `);
    return stmt.all(marketId) as MarketCategory[];
  }

  /**
   * Get markets by category
   */
  getMarketsByCategory(category: string, minConfidence: number = 0.5): string[] {
    const stmt = this.db.prepare(`
      SELECT market_id FROM market_categories
      WHERE category = ? AND confidence >= ?
      ORDER BY confidence DESC
    `);
    return (stmt.all(category, minConfidence) as any[]).map(row => row.market_id);
  }

  /**
   * Get all unique categories
   */
  getAllCategories(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT category FROM market_categories
      ORDER BY category
    `);
    return (stmt.all() as any[]).map(row => row.category);
  }

  /**
   * Store market correlation
   */
  storeMarketCorrelation(correlation: MarketCorrelation): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO market_correlations
      (market_id_1, market_id_2, correlation, lookback_hours, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      correlation.market_id_1,
      correlation.market_id_2,
      correlation.correlation,
      correlation.lookback_hours,
      correlation.updated_at
    );
  }

  /**
   * Get correlations for a market
   */
  getMarketCorrelations(marketId: string, minCorrelation: number = 0.5): MarketCorrelation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM market_correlations
      WHERE (market_id_1 = ? OR market_id_2 = ?)
        AND ABS(correlation) >= ?
      ORDER BY ABS(correlation) DESC
    `);
    return stmt.all(marketId, marketId, minCorrelation) as MarketCorrelation[];
  }

  /**
   * Get all active market IDs (markets with recent data)
   */
  getAllActiveMarketIds(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT market_id FROM price_history
      WHERE timestamp > ?
      LIMIT 1000
    `);
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    return (stmt.all(oneDayAgo) as any[]).map(row => row.market_id);
  }

  close(): void {
    this.db.close();
  }
}
