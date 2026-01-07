import { useWebSocket } from '../useWebSocket';
import { AlertList } from '../components/AlertList';
import { WhaleList } from '../components/WhaleList';
import { RecentTrades } from '../components/RecentTrades';

export function DashboardPage() {
  const { alerts, whales, trades } = useWebSocket();

  const unreadCount = alerts.filter((a) => !a.read).length;
  const newWhales = whales.filter((w) => w.is_new_whale).length;

  return (
    <>
      {/* Summary Cards */}
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <AlertList alerts={alerts} />
        </div>
        <div>
          <WhaleList whales={whales} />
        </div>
      </div>

      <div className="mt-8">
        <RecentTrades trades={trades} />
      </div>
    </>
  );
}
