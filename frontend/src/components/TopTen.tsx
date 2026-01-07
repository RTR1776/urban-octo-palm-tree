import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface TopTrader {
  address: string;
  volume: number;
}

interface TopTrade {
  trader_address: string;
  market_id: string;
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

export function TopTen() {
  const [activeTab, setActiveTab] = useState<'traders' | 'markets' | 'trades'>('traders');
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [topMarkets, setTopMarkets] = useState<TopMarket[]>([]);
  const [topTrades, setTopTrades] = useState<TopTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [traders, markets, trades] = await Promise.all([
        fetch(`${API_BASE}/top/traders`).then(r => r.json()),
        fetch(`${API_BASE}/top/markets`).then(r => r.json()),
        fetch(`${API_BASE}/top/trades`).then(r => r.json()),
      ]);
      setTopTraders(traders);
      setTopMarkets(markets);
      setTopTrades(trades);
    } catch (error) {
      console.error('Error loading top 10 data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="border-b border-gray-700">
        <div className="flex space-x-4 px-6">
          <button
            onClick={() => setActiveTab('traders')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'traders'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            🐋 Top Traders
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'markets'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            📊 Top Markets
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'trades'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            💰 Largest Trades
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : (
          <>
            {activeTab === 'traders' && (
              <div className="space-y-3">
                {topTraders.map((trader, index) => (
                  <div key={trader.address} className="flex items-center justify-between p-3 bg-gray-900 rounded">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div>
                        <p className="font-mono text-sm">{formatAddress(trader.address)}</p>
                        <p className="text-xs text-gray-400">Last 24h</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">${trader.volume.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'markets' && (
              <div className="space-y-3">
                {topMarkets.map((market, index) => (
                  <div key={market.market_id} className="p-3 bg-gray-900 rounded">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div className="text-right">
                        <p className="font-bold text-green-400">${market.total_volume_24h.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{market.trade_count_24h} trades</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{market.question}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'trades' && (
              <div className="space-y-3">
                {topTrades.map((trade, index) => (
                  <div key={index} className="p-3 bg-gray-900 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      <div className="text-right">
                        <p className="font-bold text-green-400">${trade.value.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{formatTime(trade.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-gray-300">{formatAddress(trade.trader_address)}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.side === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                      }`}>
                        {trade.side}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {trade.size.toFixed(2)} @ ${trade.price.toFixed(4)}
                    </p>
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
