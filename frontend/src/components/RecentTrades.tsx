import { Trade } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  trades: Trade[];
}

export function RecentTrades({ trades }: Props) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-900 to-green-900 px-6 py-4">
        <h2 className="text-xl font-bold text-white">💰 Recent Trades</h2>
        <p className="text-sm text-emerald-300 mt-1">Live trading activity ($500+)</p>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">
            No recent trades...
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {trades.slice(0, 20).map((trade) => (
              <div key={trade.id} className="px-6 py-4 hover:bg-gray-750">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {trade.title && (
                      <p className="text-sm text-gray-300 mb-2 line-clamp-1">
                        {trade.title}
                      </p>
                    )}
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          trade.side === 'BUY'
                            ? 'bg-green-900 text-green-200'
                            : 'bg-red-900 text-red-200'
                        }`}
                      >
                        {trade.side}
                      </span>
                      <span className="text-sm font-medium">{trade.outcome}</span>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
                      <span>
                        Size: <span className="text-white font-semibold">{trade.size.toFixed(2)}</span>
                      </span>
                      <span>
                        Price: <span className="text-white font-semibold">${trade.price.toFixed(4)}</span>
                      </span>
                      <span>
                        Value: <span className="text-green-400 font-semibold">${(trade.size * trade.price).toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDistanceToNow(trade.timestamp * 1000, { addSuffix: true })}
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
