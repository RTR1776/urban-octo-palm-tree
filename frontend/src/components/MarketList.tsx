import { MarketStats } from '../types';

interface Props {
  stats: MarketStats[];
  loading: boolean;
}

export function MarketList({ stats, loading }: Props) {
  const sortedStats = [...stats].sort((a, b) => b.total_volume_24h - a.total_volume_24h);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Top Markets (24h)</h2>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-400">
            Loading market stats...
          </div>
        ) : sortedStats.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">
            No market stats available yet...
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {sortedStats.slice(0, 20).map((stat) => (
              <div key={stat.market_id} className="px-6 py-4 hover:bg-gray-750">
                <div>
                  <h3 className="text-sm font-medium line-clamp-2">{stat.question}</h3>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-gray-400">Volume: </span>
                      <span className="text-green-400 font-semibold">
                        ${stat.total_volume_24h.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Trades: </span>
                      <span className="text-white font-semibold">{stat.trade_count_24h}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Traders: </span>
                      <span className="text-white font-semibold">{stat.unique_traders_24h}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Price Δ: </span>
                      <span
                        className={`font-semibold ${
                          stat.price_change_24h >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {stat.price_change_24h >= 0 ? '+' : ''}
                        {stat.price_change_24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
