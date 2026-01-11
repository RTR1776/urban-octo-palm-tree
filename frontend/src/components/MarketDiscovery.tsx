import { useEffect, useState } from 'react';
import { Market } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface HotMarket extends Market {
  momentum?: number;
  priceChange?: number;
  volumeChange?: number;
}

const formatVolume = (volume: number) => {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
};

const formatTimeUntil = (endDate: string) => {
  const now = Date.now();
  const end = new Date(endDate).getTime();
  const diff = end - now;
  
  if (diff < 0) return 'Closed';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / (1000 * 60))}m`;
};

export function MarketDiscovery() {
  const [activeTab, setActiveTab] = useState<'hot' | 'new' | 'closing' | 'volume'>('hot');
  const [hotMarkets, setHotMarkets] = useState<HotMarket[]>([]);
  const [newMarkets, setNewMarkets] = useState<Market[]>([]);
  const [closingMarkets, setClosingMarkets] = useState<Market[]>([]);
  const [volumeLeaders, setVolumeLeaders] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const [hot, fresh, closing, volume] = await Promise.all([
        fetch(`${API_BASE}/markets/hot?limit=10`).then(r => {
          if (!r.ok) throw new Error(`Hot markets: ${r.status}`);
          return r.json();
        }).catch((e) => { console.error(e); return []; }),
        fetch(`${API_BASE}/markets/new?limit=10`).then(r => {
          if (!r.ok) throw new Error(`New markets: ${r.status}`);
          return r.json();
        }).catch((e) => { console.error(e); return []; }),
        fetch(`${API_BASE}/markets/closing-soon?hours=24&limit=10`).then(r => {
          if (!r.ok) throw new Error(`Closing markets: ${r.status}`);
          return r.json();
        }).catch((e) => { console.error(e); return []; }),
        fetch(`${API_BASE}/markets/volume-leaders?limit=10`).then(r => {
          if (!r.ok) throw new Error(`Volume leaders: ${r.status}`);
          return r.json();
        }).catch((e) => { console.error(e); return []; }),
      ]);
      
      setHotMarkets(hot || []);
      setNewMarkets(fresh || []);
      setClosingMarkets(closing || []);
      setVolumeLeaders(volume || []);
      
      // If all arrays are empty, might be a connection issue
      if (!hot?.length && !fresh?.length && !closing?.length && !volume?.length) {
        setError(`Backend API may not be configured. Using: ${API_BASE}`);
      }
    } catch (error) {
      console.error('Error loading market discovery data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load markets');
      // Set empty arrays on error
      setHotMarkets([]);
      setNewMarkets([]);
      setClosingMarkets([]);
      setVolumeLeaders([]);
    } finally {
      setLoading(false);
    }
  };

  const renderMarketCard = (market: Market | HotMarket, index: number, showExtra?: 'momentum' | 'time' | 'volume') => (
    <div key={market.id} className="flex items-start gap-3 p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors border border-gray-700/50">
      <div className="flex-shrink-0 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
        <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-200 line-clamp-2 leading-tight">
          {market.question}
        </h3>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="text-gray-400">
            Vol: <span className="text-green-400 font-semibold">{formatVolume(market.volume || 0)}</span>
          </span>
          {showExtra === 'momentum' && 'momentum' in market && market.momentum !== undefined && (
            <span className="text-gray-400">
              🔥 <span className="text-orange-400 font-semibold">{(market.momentum / 100).toFixed(0)}</span>
            </span>
          )}
          {showExtra === 'time' && market.end_date && (
            <span className="text-gray-400">
              ⏰ <span className="text-yellow-400 font-semibold">{formatTimeUntil(market.end_date)}</span>
            </span>
          )}
          {market.liquidity && market.liquidity > 0 && (
            <span className="text-gray-400">
              Liq: <span className="text-blue-400 font-semibold">{formatVolume(market.liquidity)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-orange-900 to-red-900 px-6 py-4">
        <h2 className="text-xl font-bold text-white">🔍 Market Discovery</h2>
        <p className="text-sm text-orange-300 mt-1">Explore trending and upcoming markets</p>
      </div>
      
      <div className="border-b border-gray-700">
        <div className="flex space-x-4 px-6">
          <button
            onClick={() => setActiveTab('hot')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'hot'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            🔥 Hot Markets
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'new'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            ✨ New Markets
          </button>
          <button
            onClick={() => setActiveTab('closing')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'closing'
                ? 'border-yellow-500 text-yellow-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            ⏰ Closing Soon
          </button>
          <button
            onClick={() => setActiveTab('volume')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'volume'
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            📊 Top Volume
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading markets...</div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-yellow-400 mb-2">⚠️ {error}</div>
            <div className="text-xs text-gray-500">Check that VITE_API_URL is set correctly in Vercel</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {activeTab === 'hot' && hotMarkets.map((m, i) => renderMarketCard(m, i, 'momentum'))}
            {activeTab === 'new' && newMarkets.map((m, i) => renderMarketCard(m, i))}
            {activeTab === 'closing' && closingMarkets.map((m, i) => renderMarketCard(m, i, 'time'))}
            {activeTab === 'volume' && volumeLeaders.map((m, i) => renderMarketCard(m, i, 'volume'))}
            
            {((activeTab === 'hot' && hotMarkets.length === 0) ||
              (activeTab === 'new' && newMarkets.length === 0) ||
              (activeTab === 'closing' && closingMarkets.length === 0) ||
              (activeTab === 'volume' && volumeLeaders.length === 0)) && (
              <div className="text-center text-gray-400 py-4">
                No markets available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
