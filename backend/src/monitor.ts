import { PolymarketClient } from './polymarket-client';
import { DatabaseService } from './database';
import { Trade, WhaleActivity, Alert, MarketStats } from './types';
import { NotificationService } from './notification-service';

interface WalletAccumulator {
  totalVolume: number;
  tradeCount: number;
  trades: { market: string; amount: number; side: string; timestamp: number }[];
  firstSeen: number;
}

export class MonitorService {
  private client: PolymarketClient;
  private db: DatabaseService;
  private notifications: NotificationService;
  private whaleThreshold: number;
  private largeMovementThreshold: number;
  private unusualVolumeMultiplier: number;
  private knownWhales: Set<string>;
  
  // Cumulative tracking settings
  private cumulativeWhaleThreshold: number;
  private cumulativeTradeMin: number;
  private cumulativeWindowMs: number;
  
  // Track wallet activity within time window
  private walletAccumulators: Map<string, WalletAccumulator> = new Map();
  private alertedCumulativeWhales: Set<string> = new Set(); // Avoid duplicate alerts

  constructor(client: PolymarketClient, db: DatabaseService, notifications: NotificationService) {
    this.client = client;
    this.db = db;
    this.notifications = notifications;
    
    // Single trade thresholds
    this.whaleThreshold = parseFloat(process.env.WHALE_THRESHOLD || '10000');
    this.largeMovementThreshold = parseFloat(process.env.LARGE_MOVEMENT_THRESHOLD || '5000');
    this.unusualVolumeMultiplier = parseFloat(process.env.UNUSUAL_VOLUME_MULTIPLIER || '3');
    
    // Cumulative tracking (multiple smaller trades)
    this.cumulativeWhaleThreshold = parseFloat(process.env.CUMULATIVE_WHALE_THRESHOLD || '25000');
    this.cumulativeTradeMin = parseFloat(process.env.CUMULATIVE_TRADE_MIN || '2500');
    this.cumulativeWindowMs = parseFloat(process.env.CUMULATIVE_WINDOW_HOURS || '1') * 60 * 60 * 1000;
    
    this.knownWhales = new Set();
    this.loadKnownWhales();
    
    console.log(`🐋 Whale detection configured:`);
    console.log(`   Single trade whale: $${this.whaleThreshold.toLocaleString()}`);
    console.log(`   Large movement: $${this.largeMovementThreshold.toLocaleString()}`);
    console.log(`   Cumulative whale: $${this.cumulativeWhaleThreshold.toLocaleString()} from trades >= $${this.cumulativeTradeMin.toLocaleString()}`);
    console.log(`   Time window: ${this.cumulativeWindowMs / 3600000} hour(s)`);
  }

  private loadKnownWhales(): void {
    const whales = this.db.getWhaleActivity(1000);
    whales.forEach(whale => this.knownWhales.add(whale.trader_address));
    console.log(`Loaded ${this.knownWhales.size} known whales`);
  }

  async monitorMarkets(): Promise<void> {
    console.log('Starting market monitoring cycle...');

    try {
      // Clean up old wallet accumulators
      this.cleanupAccumulators();
      
      // Get all recent trades globally - this is more efficient
      const trades = await this.client.getAllRecentTrades(500);
      console.log(`Processing ${trades.length} recent trades...`);
      
      // Process all trades for whale activity
      const recentTrades = trades.filter(t =>
        Date.now() / 1000 - t.timestamp < 3600 // Last hour
      );
      
      for (const trade of recentTrades) {
        const question = (trade as any).title || 'Unknown Market';
        this.analyzeTradeForWhaleActivity(trade, question);
        this.analyzeTradeForLargeMovement(trade, question);
        this.trackCumulativeActivity(trade, question);
      }
      
      // Check for cumulative whales
      this.checkCumulativeWhales();

      // Also get markets for stats
      const markets = await this.client.getMarkets(100, true);
      console.log(`Monitoring ${markets.length} active markets`);

      await this.calculateMarketStats();
    } catch (error) {
      console.error('Error in monitoring cycle:', error);
    }
  }
  
  private cleanupAccumulators(): void {
    const now = Date.now();
    for (const [wallet, data] of this.walletAccumulators.entries()) {
      // Remove entries older than the window
      if (now - data.firstSeen > this.cumulativeWindowMs) {
        this.walletAccumulators.delete(wallet);
        this.alertedCumulativeWhales.delete(wallet);
      }
    }
  }
  
  private trackCumulativeActivity(trade: Trade, question: string): void {
    if (!trade.trader_address) return;
    
    const tradeValue = trade.size * trade.price;
    
    // Only track trades above minimum threshold
    if (tradeValue < this.cumulativeTradeMin) return;
    
    // Skip if this is already a single-trade whale (already alerted)
    if (tradeValue >= this.whaleThreshold) return;
    
    const wallet = trade.trader_address;
    const now = Date.now();
    
    if (!this.walletAccumulators.has(wallet)) {
      this.walletAccumulators.set(wallet, {
        totalVolume: 0,
        tradeCount: 0,
        trades: [],
        firstSeen: now,
      });
    }
    
    const accumulator = this.walletAccumulators.get(wallet)!;
    accumulator.totalVolume += tradeValue;
    accumulator.tradeCount += 1;
    accumulator.trades.push({
      market: question,
      amount: tradeValue,
      side: trade.side,
      timestamp: trade.timestamp,
    });
  }
  
  private checkCumulativeWhales(): void {
    for (const [wallet, data] of this.walletAccumulators.entries()) {
      // Skip if already alerted
      if (this.alertedCumulativeWhales.has(wallet)) continue;
      
      // Check if cumulative volume exceeds threshold
      if (data.totalVolume >= this.cumulativeWhaleThreshold && data.tradeCount >= 2) {
        this.alertedCumulativeWhales.add(wallet);
        
        // Build summary of their trades
        const tradeSummary = data.trades
          .slice(-5) // Last 5 trades
          .map(t => `$${t.amount.toFixed(0)} ${t.side}`)
          .join(', ');
        
        const uniqueMarkets = new Set(data.trades.map(t => t.market)).size;
        
        this.createAlert({
          type: 'CUMULATIVE_WHALE',
          severity: 'HIGH',
          message: `🐋 Cumulative whale detected! ${this.formatAddress(wallet)} made ${data.tradeCount} trades totaling $${data.totalVolume.toFixed(2)} across ${uniqueMarkets} market(s) in the last hour. Recent: ${tradeSummary}`,
          market_id: data.trades[data.trades.length - 1]?.market || 'multiple',
          trader_address: wallet,
          amount: data.totalVolume,
          timestamp: Date.now(),
          read: false,
        });
        
        // Add to known whales
        if (!this.knownWhales.has(wallet)) {
          this.knownWhales.add(wallet);
        }
      }
    }
  }

  private async monitorMarket(marketId: string, question: string): Promise<void> {
    try {
      const trades = await this.client.getTrades(marketId, 100);

      if (trades.length === 0) {
        return;
      }

      this.db.saveTrades(trades);

      const recentTrades = trades.filter(t =>
        Date.now() / 1000 - t.timestamp < 3600
      );

      for (const trade of recentTrades) {
        this.analyzeTradeForWhaleActivity(trade, question);
        this.analyzeTradeForLargeMovement(trade, question);
      }

      this.analyzeMarketForUnusualVolume(marketId, question, recentTrades);
    } catch (error) {
      console.error(`Error monitoring market ${marketId}:`, error);
    }
  }

  private analyzeTradeForWhaleActivity(trade: Trade, question: string): void {
    if (!trade.trader_address) return;

    const tradeValue = trade.size * trade.price;

    if (tradeValue < this.whaleThreshold) return;

    const isNewWhale = !this.knownWhales.has(trade.trader_address);

    const activity: WhaleActivity = {
      trader_address: trade.trader_address,
      market_id: trade.market_id,
      market_question: question,
      total_volume: tradeValue,
      trade_count: 1,
      first_seen: trade.timestamp,
      last_activity: trade.timestamp,
      is_new_whale: isNewWhale,
    };

    this.db.updateWhaleActivity(activity);

    if (isNewWhale) {
      this.knownWhales.add(trade.trader_address);
      this.createAlert({
        type: 'NEW_WHALE',
        severity: 'HIGH',
        message: `New whale detected! ${this.formatAddress(trade.trader_address)} made a $${tradeValue.toFixed(2)} ${trade.side} on "${question}"`,
        market_id: trade.market_id,
        trader_address: trade.trader_address,
        amount: tradeValue,
        timestamp: Date.now(),
        read: false,
      });
    } else {
      this.createAlert({
        type: 'WHALE',
        severity: 'MEDIUM',
        message: `Whale activity: ${this.formatAddress(trade.trader_address)} made a $${tradeValue.toFixed(2)} ${trade.side} on "${question}"`,
        market_id: trade.market_id,
        trader_address: trade.trader_address,
        amount: tradeValue,
        timestamp: Date.now(),
        read: false,
      });
    }
  }

  private analyzeTradeForLargeMovement(trade: Trade, question: string): void {
    const tradeValue = trade.size * trade.price;

    if (tradeValue >= this.largeMovementThreshold) {
      this.createAlert({
        type: 'LARGE_MOVEMENT',
        severity: tradeValue >= this.whaleThreshold ? 'HIGH' : 'MEDIUM',
        message: `Large ${trade.side}: $${tradeValue.toFixed(2)} on "${question}" at price ${trade.price}`,
        market_id: trade.market_id,
        trader_address: trade.trader_address,
        amount: tradeValue,
        timestamp: Date.now(),
        read: false,
      });
    }
  }

  private analyzeMarketForUnusualVolume(
    marketId: string,
    question: string,
    recentTrades: Trade[]
  ): void {
    if (recentTrades.length < 10) return;

    const hourVolume = recentTrades.reduce((sum, t) => sum + (t.size * t.price), 0);

    const stats = this.db.getMarketStats(marketId);
    if (stats.length === 0) return;

    const avgVolume = stats[0].total_volume_24h / 24;

    if (hourVolume > avgVolume * this.unusualVolumeMultiplier) {
      this.createAlert({
        type: 'UNUSUAL_VOLUME',
        severity: 'MEDIUM',
        message: `Unusual volume spike in "${question}": $${hourVolume.toFixed(2)} in last hour (${(hourVolume / avgVolume).toFixed(1)}x normal)`,
        market_id: marketId,
        amount: hourVolume,
        timestamp: Date.now(),
        read: false,
      });
    }
  }

  private async calculateMarketStats(): Promise<void> {
    console.log('Calculating market statistics...');

    const markets = await this.client.getMarkets(100, true);
    const oneDayAgo = Date.now() / 1000 - 86400;

    for (const market of markets) {
      try {
        const trades = await this.client.getTrades(market.id, 1000);
        const dayTrades = trades.filter(t => t.timestamp > oneDayAgo);

        if (dayTrades.length === 0) continue;

        const totalVolume = dayTrades.reduce((sum, t) => sum + (t.size * t.price), 0);
        const uniqueTraders = new Set(dayTrades.map(t => t.trader_address).filter(Boolean)).size;
        const avgTradeSize = totalVolume / dayTrades.length;
        const largestTrade = Math.max(...dayTrades.map(t => t.size * t.price));

        const oldestPrice = dayTrades[dayTrades.length - 1]?.price || 0;
        const newestPrice = dayTrades[0]?.price || 0;
        const priceChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;

        const stats: MarketStats = {
          market_id: market.id,
          question: market.question,
          total_volume_24h: totalVolume,
          trade_count_24h: dayTrades.length,
          unique_traders_24h: uniqueTraders,
          avg_trade_size_24h: avgTradeSize,
          price_change_24h: priceChange,
          largest_trade_24h: largestTrade,
        };

        this.db.updateMarketStats(stats);
        await this.sleep(300);
      } catch (error) {
        console.error(`Error calculating stats for market ${market.id}:`, error);
      }
    }

    console.log('Market statistics updated');
  }

  private createAlert(alert: Alert): void {
    this.db.createAlert(alert);
    console.log(`[${alert.severity}] ${alert.type}: ${alert.message}`);
    
    // Send notification for high severity alerts
    this.notifications.sendAlert(alert).catch(err => 
      console.error('Failed to send notification:', err)
    );
  }

  private formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
