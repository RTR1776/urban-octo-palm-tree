import { WhaleActivity } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  whales: WhaleActivity[];
}

export function WhaleList({ whales }: Props) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const sortedWhales = [...whales].sort((a, b) => b.total_volume - a.total_volume);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-900 to-blue-900 px-6 py-4">
        <h2 className="text-xl font-bold text-white">🐋 Whale Activity</h2>
        <p className="text-sm text-cyan-300 mt-1">Large traders in action</p>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {sortedWhales.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">
            No whale activity detected yet...
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {sortedWhales.slice(0, 20).map((whale) => (
              <div key={`${whale.trader_address}-${whale.market_id}`} className="px-6 py-4 hover:bg-gray-750">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <code className="text-sm font-mono text-blue-400">
                        {formatAddress(whale.trader_address)}
                      </code>
                      {whale.is_new_whale && (
                        <span className="ml-2 px-2 py-1 text-xs font-semibold bg-yellow-900 text-yellow-200 rounded">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-300 line-clamp-2">
                      {whale.market_question}
                    </p>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
                      <span>
                        Volume: <span className="text-green-400 font-semibold">${whale.total_volume.toFixed(2)}</span>
                      </span>
                      <span>{whale.trade_count} trades</span>
                      <span>{formatDistanceToNow(whale.last_activity * 1000, { addSuffix: true })}</span>
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
