/**
 * Enhanced Types for Advanced Alert System
 */

// Scored event with full context
export interface ScoredEvent {
  id: string;
  timestamp: number;
  type: EventType;
  score: number;
  tier: 'critical' | 'high' | 'medium' | 'low';
  
  // Score breakdown for debugging/display
  scoreBreakdown: {
    absoluteSize: number;
    volumeRatio: number;
    medianMultiple: number;
    depthRatio: number;
    priceImpact: number;
    walkedBook: number;
    reversion: number;
    walletBehavior: number;
    coordination: number;
  };
  
  // Context
  market: MarketContext;
  trade?: TradeContext;
  wallet?: WalletContext;
  cluster?: ClusterContext;
  priceImpact?: PriceImpactContext;
  
  // Generated message
  message: string;
  shortMessage: string;
}

export type EventType = 
  | 'LARGE_TRADE'
  | 'WHALE_TRADE'
  | 'NEW_WHALE'
  | 'STACKING'
  | 'COORDINATED_CLUSTER'
  | 'PRICE_IMPACT'
  | 'BOOK_WALKED'
  | 'REVERSION'
  | 'CUMULATIVE_WHALE';

export interface MarketContext {
  id: string;
  question: string;
  currentPrice: number;
  volume24h: number;
  medianTradeSize: number;
  recentDepthProxy: number;
}

export interface TradeContext {
  id: string;
  size: number;
  price: number;
  side: 'BUY' | 'SELL';
  timestamp: number;
  valueUsd: number;
}

export interface WalletContext {
  address: string;
  isNew: boolean;
  isKnownWhale: boolean;
  recentTradeCount: number;
  recentVolume: number;
  firstSeen?: number;
}

export interface ClusterContext {
  wallets: string[];
  totalVolume: number;
  tradeCount: number;
  dominantSide: 'BUY' | 'SELL' | 'MIXED';
  windowMs: number;
  markets: string[];
}

export interface PriceImpactContext {
  priceBefore: number;
  priceAfter: number;
  deltaPercent: number;
  levelsWalked: number;
  reversionDetected: boolean;
  reversionPercent?: number;
  reversionTimeMs?: number;
}

// Market metrics for rolling calculations
export interface MarketMetrics {
  marketId: string;
  
  // Volume tracking
  volume24h: number;
  volumeLastHour: number;
  
  // Trade size distribution
  tradeSizes: number[];           // Recent trade sizes for median
  medianTradeSize: number;
  avgTradeSize: number;
  
  // Depth proxy (sum of recent trade volume as liquidity proxy)
  recentDepthProxy: number;
  depthProxyUpdatedAt: number;
  
  // Price tracking
  prices: { price: number; timestamp: number }[];
  currentPrice: number;
  priceHigh24h: number;
  priceLow24h: number;
  
  // Metadata
  lastUpdated: number;
  tradeCount24h: number;
}

// Cooldown tracking
export interface CooldownEntry {
  key: string;                    // market:wallet or market:cluster
  lastAlertTime: number;
  lastScore: number;
  alertCount: number;
  windowStart: number;
}

// Cluster tracking
export interface PendingCluster {
  marketId: string;
  side: 'BUY' | 'SELL';
  startTime: number;
  trades: {
    wallet: string;
    size: number;
    price: number;
    timestamp: number;
  }[];
  totalVolume: number;
  uniqueWallets: Set<string>;
}

// Digest bucket
export interface DigestBucket {
  events: ScoredEvent[];
  startTime: number;
  scheduledSendTime: number;
}

// Reversion tracking
export interface ReversionWatch {
  tradeId: string;
  marketId: string;
  originalPrice: number;
  tradePrice: number;
  movePercent: number;
  side: 'BUY' | 'SELL';
  timestamp: number;
  checkTimes: number[];           // Unix timestamps to check
  resolved: boolean;
}

// State store interface (can be Redis or in-memory)
export interface StateStore {
  // Market metrics
  getMarketMetrics(marketId: string): Promise<MarketMetrics | null>;
  setMarketMetrics(marketId: string, metrics: MarketMetrics): Promise<void>;
  
  // Cooldowns
  getCooldown(key: string): Promise<CooldownEntry | null>;
  setCooldown(key: string, entry: CooldownEntry): Promise<void>;
  deleteCooldown(key: string): Promise<void>;
  
  // Clusters
  getPendingClusters(marketId: string): Promise<PendingCluster[]>;
  setPendingCluster(cluster: PendingCluster): Promise<void>;
  deletePendingCluster(marketId: string, side: string, startTime: number): Promise<void>;
  
  // Reversion watches
  getReversionWatches(): Promise<ReversionWatch[]>;
  addReversionWatch(watch: ReversionWatch): Promise<void>;
  removeReversionWatch(tradeId: string): Promise<void>;
  
  // Digest
  getDigestBucket(): Promise<DigestBucket | null>;
  setDigestBucket(bucket: DigestBucket): Promise<void>;
  clearDigestBucket(): Promise<void>;
  
  // Known wallets
  isKnownWhale(address: string): Promise<boolean>;
  addKnownWhale(address: string): Promise<void>;
  getWalletFirstSeen(address: string): Promise<number | null>;
  setWalletFirstSeen(address: string, timestamp: number): Promise<void>;
}
