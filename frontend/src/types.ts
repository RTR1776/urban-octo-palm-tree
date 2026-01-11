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
  title?: string;
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

export interface Alert {
  id?: number;
  type: 'WHALE' | 'LARGE_MOVEMENT' | 'UNUSUAL_VOLUME' | 'NEW_WHALE';
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

// ========== Analytics Types ==========

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
  volume_trend: number;
  price_trend: number;
  trader_count_24h: number;
  updated_at: number;
}

export interface MarketCategory {
  market_id: string;
  category: string;
  confidence: number;
}

export interface MarketCorrelation {
  market_id_1: string;
  market_id_2: string;
  correlation: number;
  lookback_hours: number;
  updated_at: number;
}

export interface CategoryStats {
  category: string;
  marketCount: number;
  totalVolume24h?: number;
  avgVolume24h?: number;
  totalLiquidity?: number;
  topMarket?: {
    id: string;
    question: string;
    volume: number;
  } | null;
}

export interface MarketComparison {
  market1: Market & { metrics: MarketMetrics };
  market2: Market & { metrics: MarketMetrics };
  correlation: number;
}

export interface MarketFilter {
  minVolume?: number;
  minLiquidity?: number;
  categories?: string[];
  excludeCategories?: string[];
}
