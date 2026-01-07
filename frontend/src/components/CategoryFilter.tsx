import { useEffect, useState } from 'react';
import { Market } from '../types';
import { PriceChart } from './PriceChart';
import { LiquidityHeatmap } from './LiquidityHeatmap';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Common Polymarket categories/tags
const CATEGORIES = [
  { id: 'politics', name: 'Politics', emoji: '🗳️' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'crypto', name: 'Crypto', emoji: '₿' },
  { id: 'finance', name: 'Finance', emoji: '💰' },
  { id: 'pop-culture', name: 'Pop Culture', emoji: '🎬' },
  { id: 'science', name: 'Science', emoji: '🔬' },
  { id: 'business', name: 'Business', emoji: '📊' },
  { id: 'world', name: 'World', emoji: '🌍' },
];

export function CategoryFilter() {
  const [selectedCategory, setSelectedCategory] = useState<string>('politics');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'chart' | 'liquidity'>('list');

  useEffect(() => {
    loadCategoryMarkets();
  }, [selectedCategory]);

  const loadCategoryMarkets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/markets/by-tag/${selectedCategory}?limit=50`);
      const data = await response.json();
      setMarkets(data);
      
      // Auto-select first market for charts
      if (data.length > 0 && !selectedMarket) {
        setSelectedMarket(data[0]);
      }
    } catch (error) {
      console.error('Error loading category markets:', error);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      {/* Category Selector */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-bold mb-4">🏷️ Browse by Category</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`p-3 rounded-lg font-medium text-sm transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="mr-2">{category.emoji}</span>
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">View:</span>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📋 List
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📈 Charts
          </button>
          <button
            onClick={() => setViewMode('liquidity')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'liquidity'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📊 Liquidity
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-400">
          Loading markets...
        </div>
      ) : markets.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-400">
          No markets found for this category
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-bold mb-4">
                {CATEGORIES.find(c => c.id === selectedCategory)?.emoji}{' '}
                {CATEGORIES.find(c => c.id === selectedCategory)?.name} Markets ({markets.length})
              </h3>
              
              <div className="space-y-3">
                {markets.slice(0, 20).map(market => (
                  <div
                    key={market.id}
                    onClick={() => setSelectedMarket(market)}
                    className={`p-4 bg-gray-900 rounded-lg hover:bg-gray-850 transition-colors cursor-pointer ${
                      selectedMarket?.id === market.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 mr-4">
                        <h4 className="text-sm font-medium text-gray-200 line-clamp-2">
                          {market.question}
                        </h4>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
                          <span>
                            Volume: <span className="text-green-400 font-semibold">
                              {formatVolume(market.volume || 0)}
                            </span>
                          </span>
                          {market.liquidity && (
                            <span>
                              Liquidity: <span className="text-blue-400 font-semibold">
                                {formatVolume(market.liquidity)}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {market.tokens && market.tokens[0] && (
                          <div className="text-2xl font-bold text-blue-400">
                            {(market.tokens[0].price * 100).toFixed(0)}¢
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'chart' && selectedMarket && (
            <div className="space-y-6">
              <PriceChart
                marketId={selectedMarket.id}
                marketQuestion={selectedMarket.question}
                interval="1h"
                height={400}
              />
              
              {/* Market selector for charts */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Select Market to Chart:
                </label>
                <select
                  value={selectedMarket.id}
                  onChange={(e) => {
                    const market = markets.find(m => m.id === e.target.value);
                    if (market) setSelectedMarket(market);
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
                >
                  {markets.slice(0, 20).map(market => (
                    <option key={market.id} value={market.id}>
                      {market.question.slice(0, 100)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {viewMode === 'liquidity' && (
            <LiquidityHeatmap
              marketIds={markets.slice(0, 10).map(m => m.id)}
              markets={markets}
            />
          )}
        </>
      )}
    </div>
  );
}
