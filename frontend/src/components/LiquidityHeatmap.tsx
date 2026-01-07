import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface OrderbookDepth {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread: number;
  midPrice: number;
}

interface MarketLiquidity {
  id: string;
  question: string;
  depth?: OrderbookDepth;
  liquidityScore: number;
  spread: number;
}

interface Props {
  marketIds: string[];
  markets: Array<{ id: string; question: string }>;
}

export function LiquidityHeatmap({ marketIds, markets }: Props) {
  const [liquidityData, setLiquidityData] = useState<MarketLiquidity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (marketIds.length > 0) {
      loadLiquidityData();
    }
  }, [marketIds]);

  const loadLiquidityData = async () => {
    try {
      setLoading(true);
      
      // Fetch orderbook depth for each market (limit to first 10 for performance)
      const promises = marketIds.slice(0, 10).map(async (id) => {
        try {
          const market = markets.find(m => m.id === id);
          const response = await fetch(`${API_BASE}/markets/${id}/orderbook-depth`);
          
          if (!response.ok) {
            return {
              id,
              question: market?.question || 'Unknown',
              liquidityScore: 0,
              spread: 0,
            };
          }
          
          const depth: OrderbookDepth = await response.json();
          
          if (!depth) {
            return {
              id,
              question: market?.question || 'Unknown',
              liquidityScore: 0,
              spread: 0,
            };
          }
          
          // Calculate liquidity score based on depth near midpoint
          const bidDepth = depth.bids.slice(0, 5).reduce((sum, b) => sum + b.size, 0);
          const askDepth = depth.asks.slice(0, 5).reduce((sum, a) => sum + a.size, 0);
          const totalDepth = bidDepth + askDepth;
          
          return {
            id,
            question: market?.question || 'Unknown',
            depth,
            liquidityScore: totalDepth,
            spread: depth.spread * 100, // Convert to cents
          };
        } catch (error) {
          const market = markets.find(m => m.id === id);
          return {
            id,
            question: market?.question || 'Unknown',
            liquidityScore: 0,
            spread: 0,
          };
        }
      });
      
      const results = await Promise.all(promises);
      setLiquidityData(results.sort((a, b) => b.liquidityScore - a.liquidityScore));
    } catch (error) {
      console.error('Error loading liquidity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColorForScore = (score: number, maxScore: number) => {
    if (maxScore === 0) return 'bg-gray-700';
    const ratio = score / maxScore;
    
    if (ratio > 0.7) return 'bg-green-500';
    if (ratio > 0.4) return 'bg-yellow-500';
    if (ratio > 0.2) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getSpreadColor = (spread: number) => {
    if (spread < 1) return 'text-green-400';
    if (spread < 3) return 'text-yellow-400';
    if (spread < 5) return 'text-orange-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-bold mb-4">📊 Liquidity Heatmap</h3>
        <div className="text-center text-gray-400 py-8">Analyzing orderbook depth...</div>
      </div>
    );
  }

  if (liquidityData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-bold mb-4">📊 Liquidity Heatmap</h3>
        <div className="text-center text-gray-400 py-8">No liquidity data available</div>
      </div>
    );
  }

  const maxScore = Math.max(...liquidityData.map(m => m.liquidityScore));

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">📊 Liquidity Heatmap</h3>
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <span>Low</span>
          <div className="flex space-x-1">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <div className="w-4 h-4 bg-green-500 rounded"></div>
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="space-y-3">
        {liquidityData.map((market) => (
          <div key={market.id} className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-200 line-clamp-1 flex-1 mr-4">
                {market.question}
              </h4>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-xs text-gray-400">Spread</div>
                  <div className={`text-sm font-semibold ${getSpreadColor(market.spread)}`}>
                    {market.spread.toFixed(2)}¢
                  </div>
                </div>
                <div className={`w-16 h-16 rounded ${getColorForScore(market.liquidityScore, maxScore)} flex items-center justify-center`}>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-white">
                      {market.liquidityScore > 0 ? market.liquidityScore.toFixed(0) : 'N/A'}
                    </div>
                    <div className="text-xs text-white opacity-75">depth</div>
                  </div>
                </div>
              </div>
            </div>

            {market.depth && (
              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-700">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Top 5 Bids</div>
                  <div className="space-y-1">
                    {market.depth.bids.slice(0, 5).map((bid, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-green-400">{(bid.price * 100).toFixed(1)}¢</span>
                        <span className="text-gray-300">{bid.size.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Top 5 Asks</div>
                  <div className="space-y-1">
                    {market.depth.asks.slice(0, 5).map((ask, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-red-400">{(ask.price * 100).toFixed(1)}¢</span>
                        <span className="text-gray-300">{ask.size.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-400">
        <p>💡 Higher depth = more liquidity. Lower spread = better execution.</p>
      </div>
    </div>
  );
}
