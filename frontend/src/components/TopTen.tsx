import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type TabType = 'traders' | 'markets' | 'trades' | 'active' | 'closing' | 'movers';

interface TopTrader {
  address: string;
  volume: number;
  tradeCount: number;
}

interface TopTrade {
  trader_address: string;
  market_id: string;
  title: string;
  size: number;
  price: number;
  value: number;
  timestamp: number;
  side: string;
}

interface TopMarket {
  market_id: string;
  question: string;
  total_volume_24h: number;
  trade_count_24h: number;
}

interface MostActive {
  market_id: string;
  title: string;
  tradeCount: number;
  volume: number;
  lastPrice: number;
}

interface ClosingMarket {
  market_id: string;
  question: string;
  end_date: string;
  volume: number;
  price: number;
  hoursRemaining: number;
}

interface PriceMover {
  market_id: string;
  title: string;
  priceChange: number;
  currentPrice: number;
  volume: number;
  tradeCount: number;
}

export function TopTen() {
  const [activeTab, setActiveTab] = useState<TabType>('traders');
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [topMarkets, setTopMarkets] = useState<TopMarket[]>([]);
  const [topTrades, setTopTrades] = useState<TopTrade[]>([]);
  const [mostActive, setMostActive] = useState<MostActive[]>([]);
  const [closingMarkets, setClosingMarkets] = useState<ClosingMarket[]>([]);
  const [priceMovers, setPriceMovers] = useState<PriceMover[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [traders, markets, trades, active, closing, movers] = await Promise.all([
        fetch(`${API_BASE}/top/traders`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/top/markets`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/top/trades`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/top/most-active`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/top/closing-today`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/top/price-movers`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setTopTraders(traders);
      setTopMarkets(markets);
      setTopTrades(trades);
      setMostActive(active);
      setClosingMarkets(closing);
      setPriceMovers(movers);
    } catch (error) {
      console.error('Error loading top 10 data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const tabs: { id: TabType; label: string; emoji: string }[] = [
    { id: 'traders', label: 'Top Traders (24h)', emoji: '🐋' },
    { id: 'markets', label: 'Top Markets (24h)', emoji: '📊' },
    { id: 'trades', label: 'Largest Trades (24h)', emoji: '💰' },
    { id: 'active', label: 'Most Active (24h)', emoji: '🔥' },
    { id: 'closing', label: 'Closing Today', emoji: '⏰' },
    { id: 'movers', label: 'Price Movers (24h)', emoji: '📈' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="border-b border-gray-700 overflow-x-auto">
        <div className="flex space-x-1 px-4 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : (
          <>
            {/* Top Traders */}
            {activeTab === 'traders' && (
              <div className="space-y-3">
                {topTraders.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">No trader data available</div>
                ) : topTraders.map((trader, index) => (
                  <div key={trader.address} className="flex items-center justify-between p-3 bg-gray-900 rounded">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div>
                        <p className="font-mono text-sm">{formatAddress(trader.address)}</p>
                        <p className="text-xs text-gray-400">{trader.tradeCount || 0} trades</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">{formatVolume(trader.volume)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Top Markets */}
            {activeTab === 'markets' && (
              <div className="space-y-3">
                {topMarkets.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">No market data available</div>
                ) : topMarkets.map((market, index) => (
                  <div key={market.market_id} className="p-3 bg-gray-900 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div className="text-right">
                        <p className="font-bold text-green-400">{formatVolume(market.total_volume_24h)}</p>
                        <p className="text-xs text-gray-400">volume</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{market.question}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Largest Trades */}
            {activeTab === 'trades' && (
              <div className="space-y-3">
                {topTrades.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">No trade data available</div>
                ) : topTrades.map((trade, index) => (
                  <div key={index} className="p-3 bg-gray-900 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div className="text-right">
                        <p className="font-bold text-green-400">{formatVolume(trade.value)}</p>
                        <p className="text-xs text-gray-400">{formatTime(trade.timestamp)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-1 mb-2">{trade.title}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-gray-400 text-xs">{formatAddress(trade.trader_address)}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.side === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                      }`}>
                        {trade.side}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Most Active */}
            {activeTab === 'active' && (
              <div className="space-y-3">
                {mostActive.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">No activity data available</div>
                ) : mostActive.map((market, index) => (
                  <div key={market.market_id} className="p-3 bg-gray-900 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div className="text-right">
                        <p className="font-bold text-orange-400">{market.tradeCount} trades</p>
                        <p className="text-xs text-gray-400">{formatVolume(market.volume)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{market.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Last price: {(market.lastPrice * 100).toFixed(0)}¢
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Closing Today */}
            {activeTab === 'closing' && (
              <div className="space-y-3">
                {closingMarkets.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">No markets closing soon</div>
                ) : closingMarkets.map((market, index) => (
                  <div key={market.market_id} className="p-3 bg-gray-900 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div className="text-right">
                        <p className={`font-bold ${market.hoursRemaining < 6 ? 'text-red-400' : 'text-yellow-400'}`}>
                          {market.hoursRemaining < 1
                            ? `${Math.round(market.hoursRemaining * 60)}m left`
                            : `${market.hoursRemaining.toFixed(1)}h left`
                          }
                        </p>
                        <p className="text-xs text-gray-400">{(market.price * 100).toFixed(0)}¢</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{market.question}</p>
                    <p className="text-xs text-gray-500 mt-1">Volume: {formatVolume(market.volume)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Price Movers */}
            {activeTab === 'movers' && (
              <div className="space-y-3">
                {priceMovers.length === 0 ? (
                  <div className="text-center text-gray-400 py-4">No price movement data available</div>
                ) : priceMovers.map((mover, index) => (
                  <div key={mover.market_id} className="p-3 bg-gray-900 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div className="text-right">
                        <p className={`font-bold ${mover.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {mover.priceChange >= 0 ? '+' : ''}{mover.priceChange.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-400">{(mover.currentPrice * 100).toFixed(0)}¢</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{mover.title}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                      <span>{mover.tradeCount} trades</span>
                      <span>{formatVolume(mover.volume)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
