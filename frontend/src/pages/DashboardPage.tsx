import { useEffect, useState } from 'react';
import { useWebSocket } from '../useWebSocket';
import { WhaleList } from '../components/WhaleList';
import { RecentTrades } from '../components/RecentTrades';
import { api } from '../api';

interface VolumeData {
  volume24h: number;
  marketCount: number;
}

export function DashboardPage() {
  const { whales, trades } = useWebSocket();
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVolume();
    // Refresh every 2 minutes
    const interval = setInterval(loadVolume, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadVolume = async () => {
    try {
      const data = await api.getPlatformVolume();
      setVolumeData(data);
    } catch (error) {
      console.error('Error loading volume:', error);
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
      {/* 24h Volume Card */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-8 border border-blue-700 shadow-lg">
          <h3 className="text-lg font-medium text-blue-200 mb-2">Polymarket Volume (24h)</h3>
          <p className="text-5xl font-bold text-white">
            {loading ? (
              <span className="text-gray-400">Loading...</span>
            ) : volumeData ? (
              formatVolume(volumeData.volume24h)
            ) : (
              <span className="text-gray-400">N/A</span>
            )}
          </p>
          <p className="text-sm text-blue-300 mt-2">
            {volumeData ? `Across ${volumeData.marketCount} active markets` : 'Total trading volume across all markets'}
          </p>
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
