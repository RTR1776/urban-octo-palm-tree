/**
 * Cluster Detector
 * Identifies coordinated trading behavior across multiple wallets
 */

import { AlertConfig } from '../config/alert-config';
import { StateStore, PendingCluster, ClusterContext } from '../types/alert-types';
import { Trade } from '../types';

export interface ClusterEvent {
  detected: boolean;
  cluster?: ClusterContext;
  isNewCluster: boolean;
}

export class ClusterDetector {
  private store: StateStore;
  private alertedClusters: Map<string, number> = new Map(); // cluster signature -> timestamp

  constructor(store: StateStore) {
    this.store = store;
  }

  /**
   * Process a trade and check if it forms or extends a cluster
   */
  async processTrade(trade: Trade, marketQuestion: string): Promise<ClusterEvent> {
    const marketId = trade.market_id;
    const wallet = trade.trader_address;
    const side = trade.side as 'BUY' | 'SELL';
    const tradeValue = trade.size * trade.price;
    const now = Date.now();

    if (!wallet) {
      return { detected: false, isNewCluster: false };
    }

    // Get existing pending clusters for this market
    const pendingClusters = await this.store.getPendingClusters(marketId);
    
    // Find a cluster we can join (same side, within time window)
    let cluster = pendingClusters.find(
      c => c.side === side && 
           now - c.startTime < AlertConfig.clustering.windowMs
    );

    const isNewCluster = !cluster;

    if (!cluster) {
      // Start new cluster
      cluster = {
        marketId,
        side,
        startTime: now,
        trades: [],
        totalVolume: 0,
        uniqueWallets: new Set(),
      };
    }

    // Add trade to cluster (convert Set for storage)
    cluster.trades.push({
      wallet,
      size: trade.size,
      price: trade.price,
      timestamp: trade.timestamp,
    });
    cluster.totalVolume += tradeValue;
    cluster.uniqueWallets.add(wallet);

    // Save updated cluster
    await this.store.setPendingCluster({
      ...cluster,
      uniqueWallets: new Set(cluster.uniqueWallets), // Ensure it's a Set
    });

    // Check if cluster meets threshold
    const walletCount = cluster.uniqueWallets.size;
    const meetsWalletThreshold = walletCount >= AlertConfig.clustering.minWallets;
    const meetsVolumeThreshold = cluster.totalVolume >= AlertConfig.clustering.minTotalVolume;

    if (meetsWalletThreshold && meetsVolumeThreshold) {
      // Check cooldown
      const clusterSignature = this.getClusterSignature(cluster);
      const lastAlerted = this.alertedClusters.get(clusterSignature);
      
      if (lastAlerted && now - lastAlerted < AlertConfig.clustering.cooldownMs) {
        // Still in cooldown, don't re-alert
        return { detected: false, isNewCluster: false };
      }

      // Record this alert
      this.alertedClusters.set(clusterSignature, now);

      // Clean old signatures
      this.cleanOldSignatures();

      // Build cluster context
      const clusterContext: ClusterContext = {
        wallets: Array.from(cluster.uniqueWallets),
        totalVolume: cluster.totalVolume,
        tradeCount: cluster.trades.length,
        dominantSide: this.getDominantSide(cluster),
        windowMs: now - cluster.startTime,
        markets: [marketQuestion],
      };

      return {
        detected: true,
        cluster: clusterContext,
        isNewCluster,
      };
    }

    return { detected: false, isNewCluster };
  }

  /**
   * Get cluster signature for deduplication
   */
  private getClusterSignature(cluster: PendingCluster): string {
    const wallets = Array.from(cluster.uniqueWallets).sort().join(',');
    return `${cluster.marketId}:${cluster.side}:${wallets}`;
  }

  /**
   * Determine dominant side of cluster
   */
  private getDominantSide(cluster: PendingCluster): 'BUY' | 'SELL' | 'MIXED' {
    // All trades in a pending cluster are same side by construction
    return cluster.side;
  }

  /**
   * Clean old cluster signatures
   */
  private cleanOldSignatures(): void {
    const now = Date.now();
    const maxAge = AlertConfig.clustering.cooldownMs * 2;

    for (const [sig, timestamp] of this.alertedClusters.entries()) {
      if (now - timestamp > maxAge) {
        this.alertedClusters.delete(sig);
      }
    }
  }

  /**
   * Analyze cross-market coordination
   * (Called periodically to find wallets trading multiple markets simultaneously)
   */
  async detectCrossMarketClusters(
    recentTrades: Trade[],
    windowMs: number = 60000
  ): Promise<ClusterContext[]> {
    const now = Date.now();
    const cutoff = now - windowMs;

    // Group trades by wallet
    const walletTrades = new Map<string, Trade[]>();
    
    for (const trade of recentTrades) {
      if (!trade.trader_address) continue;
      if (trade.timestamp * 1000 < cutoff) continue;

      const wallet = trade.trader_address;
      if (!walletTrades.has(wallet)) {
        walletTrades.set(wallet, []);
      }
      walletTrades.get(wallet)!.push(trade);
    }

    // Find wallets trading multiple markets
    const multiMarketWallets: string[] = [];
    
    for (const [wallet, trades] of walletTrades.entries()) {
      const uniqueMarkets = new Set(trades.map(t => t.market_id));
      if (uniqueMarkets.size >= 2) {
        multiMarketWallets.push(wallet);
      }
    }

    // If multiple wallets are trading multiple markets, that's interesting
    if (multiMarketWallets.length >= 2) {
      const allTrades = multiMarketWallets.flatMap(w => walletTrades.get(w)!);
      const totalVolume = allTrades.reduce((sum, t) => sum + t.size * t.price, 0);
      const markets = [...new Set(allTrades.map(t => t.market_id))];

      // Determine dominant side
      const buys = allTrades.filter(t => t.side === 'BUY').length;
      const sells = allTrades.filter(t => t.side === 'SELL').length;
      const dominantSide = buys > sells * 1.5 ? 'BUY' : 
                          sells > buys * 1.5 ? 'SELL' : 'MIXED';

      return [{
        wallets: multiMarketWallets,
        totalVolume,
        tradeCount: allTrades.length,
        dominantSide,
        windowMs,
        markets,
      }];
    }

    return [];
  }
}
