import { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { useWebSocket } from '../useWebSocket';
import { api } from '../api';
import { AlertList } from './AlertList';
import { WhaleList } from './WhaleList';
import { MarketList } from './MarketList';
import { RecentTrades } from './RecentTrades';
import { TopTen } from './TopTen';
import { MarketDiscovery } from './MarketDiscovery';
import { CategoryFilter } from './CategoryFilter';
import { NotificationSettings } from './NotificationSettings';
import { MarketStats, Alert } from '../types';

// Error boundary to prevent new features from crashing the app
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Gracefully hide the component
    }
    return this.props.children;
  }
}

// Helper to derive stats from alerts when market stats aren't available
function deriveStatsFromAlerts(alerts: Alert[]): MarketStats[] {
  const marketMap = new Map<string, {
    question: string;
    volume: number;
    count: number;
  }>();

  // Aggregate alert data by market
  alerts.forEach(alert => {
    if (!alert.market_id) return;
    
    const existing = marketMap.get(alert.market_id);
    const volume = alert.amount || 0;
    
    if (existing) {
      existing.volume += volume;
      existing.count += 1;
    } else {
      // Extract market question from message if available
      const question = alert.message.split(':')[0] || 'Unknown Market';
      marketMap.set(alert.market_id, {
        question,
        volume,
        count: 1,
      });
    }
  });

  // Convert to MarketStats format
  return Array.from(marketMap.entries())
    .map(([market_id, data]) => ({
      market_id,
      question: data.question,
      total_volume_24h: data.volume,
      trade_count_24h: data.count,
      unique_traders_24h: 0,
      avg_trade_size_24h: data.count > 0 ? data.volume / data.count : 0,
      price_change_24h: 0,
      largest_trade_24h: 0,
    }))
    .sort((a, b) => b.total_volume_24h - a.total_volume_24h)
    .slice(0, 10);
}

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

  // Derive stats from alerts if stats are empty
  const derivedStats = stats.length > 0 ? stats : deriveStatsFromAlerts(alerts);

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

            {/* New features - gracefully degrade if APIs not available */}
            <div className="mb-8">
              <ErrorBoundary>
                <MarketDiscovery />
              </ErrorBoundary>
            </div>

            <div className="mb-8">
              <ErrorBoundary>
                <CategoryFilter />
              </ErrorBoundary>
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
                <MarketList stats={derivedStats} loading={loading} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
