import { useEffect, useState } from 'react';
import { useWebSocket } from '../useWebSocket';
import { api } from '../api';
import { AlertList } from './AlertList';
import { WhaleList } from './WhaleList';
import { MarketList } from './MarketList';
import { RecentTrades } from './RecentTrades';
import { TopTen } from './TopTen';
import { NotificationSettings } from './NotificationSettings';
import { MarketStats } from '../types';

export function Dashboard() {
  const { connected, alerts, whales, trades } = useWebSocket();
  const [stats, setStats] = useState<MarketStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = alerts.filter((a) => !a.read).length;
  const newWhales = whales.filter((w) => w.is_new_whale).length;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-white">🐋 Polymarket Whale Monitor</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                {showSettings ? '📊 Dashboard' : '⚙️ Settings'}
              </button>
              <div className={`flex items-center ${connected ? 'text-green-400' : 'text-red-400'}`}>
                <div className={`h-2 w-2 rounded-full mr-2 ${connected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                {connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showSettings ? (
          <NotificationSettings />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-sm font-medium text-gray-400">Unread Alerts</h3>
                <p className="text-3xl font-bold mt-2">{unreadCount}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-sm font-medium text-gray-400">Active Whales</h3>
                <p className="text-3xl font-bold mt-2">{whales.length}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-sm font-medium text-gray-400">New Whales (24h)</h3>
                <p className="text-3xl font-bold mt-2 text-yellow-400">{newWhales}</p>
              </div>
            </div>

            <div className="mb-8">
              <TopTen />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <AlertList alerts={alerts} />
              </div>
              <div>
                <WhaleList whales={whales} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <RecentTrades trades={trades} />
              </div>
              <div>
                <MarketList stats={stats} loading={loading} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
