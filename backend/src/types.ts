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
