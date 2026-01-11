export interface Market {
  id: string;
  question: string;
  description: string;
  end_date: string;
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  outcomes: string[];
  tokens: Token[];
}

export interface Token {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface Trade {
  id: string;
  market_id: string;
  timestamp: number;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  outcome: string;
  trader_address?: string;
  fee_rate_bps?: number;
  title?: string; // Market title from Data API
}

export interface WhaleActivity {
  id?: number;
  trader_address: string;
  market_id: string;
  market_question: string;
  total_volume: number;
  trade_count: number;
  first_seen: number;
  last_activity: number;
  is_new_whale: boolean;
}

export type AlertType = 
  | 'WHALE' 
  | 'LARGE_MOVEMENT' 
  | 'UNUSUAL_VOLUME' 
  | 'NEW_WHALE'
  | 'CUMULATIVE_WHALE'
  | 'LARGE_TRADE'
  | 'WHALE_TRADE'
  | 'STACKING'
  | 'COORDINATED_CLUSTER'
  | 'PRICE_IMPACT'
  | 'BOOK_WALKED'
  | 'REVERSION';

export interface Alert {
  id?: number;
  type: AlertType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  market_id?: string;
  trader_address?: string;
  amount?: number;
  timestamp: number;
  read: boolean;
}

export interface MarketStats {
  market_id: string;
  question: string;
  total_volume_24h: number;
  trade_count_24h: number;
  unique_traders_24h: number;
  avg_trade_size_24h: number;
  price_change_24h: number;
  largest_trade_24h: number;
}

export interface OrderBookData {
  market: string;
  asset_id: string;
  hash: string;
  timestamp: number;
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface BookLevel {
  price: string;
  size: string;
}

// ========== Analytics Types ==========

export interface PricePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceHistory {
  id?: number;
  market_id: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

export interface MarketMetrics {
  market_id: string;
  volatility_24h: number;
  momentum_24h: number;
  spread_pct: number;
  depth_score: number;
  sharpe_ratio: number;
  volume_trend: number; // Positive = increasing, negative = decreasing
  price_trend: number; // Slope of price over 24h
  trader_count_24h: number;
  updated_at: number;
}

export interface MarketCategory {
  market_id: string;
  category: string;
  confidence: number; // 0-1 score for auto-tagging
}

export interface MarketCorrelation {
  market_id_1: string;
  market_id_2: string;
  correlation: number; // -1 to 1
  lookback_hours: number;
  updated_at: number;
}

export interface CategoryStats {
  category: string;
  market_count: number;
  total_volume_24h: number;
  avg_volume_24h: number;
  total_liquidity: number;
  top_market_id: string;
  top_market_question: string;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface MarketFilter {
  minVolume24h?: number;
  minLiquidity?: number;
  minTradeSize?: number;
  excludeCategories?: string[];
  activeOnly?: boolean;
  minTraderCount?: number;
  categories?: string[];
  maxEndDate?: number; // Unix timestamp
  minEndDate?: number; // Unix timestamp
}
