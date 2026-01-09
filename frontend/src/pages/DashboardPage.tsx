import { useEffect, useState } from 'react';
import { useWebSocket } from '../useWebSocket';
import { WhaleList } from '../components/WhaleList';
import { RecentTrades } from '../components/RecentTrades';
import { api } from '../api';

export function DashboardPage() {
  const { whales, trades } = useWebSocket();
  const [hourlyVolume, setHourlyVolume] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHourlyVolume();
    // Refresh every 2 minutes
    const interval = setInterval(loadHourlyVolume, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadHourlyVolume = async () => {
    try {
      const volume = await api.getHourlyVolume();
      setHourlyVolume(volume);
    } catch (error) {
      console.error('Error loading hourly volume:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  return (
    <>
      {/* Hourly Volume Card */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-8 border border-blue-700 shadow-lg">
          <h3 className="text-lg font-medium text-blue-200 mb-2">Polymarket Volume (Last Hour)</h3>
          <p className="text-5xl font-bold text-white">
            {loading ? (
              <span className="text-gray-400">Loading...</span>
            ) : hourlyVolume !== null ? (
              formatVolume(hourlyVolume)
            ) : (
              <span className="text-gray-400">N/A</span>
            )}
          </p>
          <p className="text-sm text-blue-300 mt-2">Total trading volume across all markets</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <WhaleList whales={whales} />
        </div>
        <div>
          <RecentTrades trades={trades} />
        </div>
      </div>
    </>
  );
}
