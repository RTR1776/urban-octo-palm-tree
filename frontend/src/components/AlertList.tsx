import { Alert } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  alerts: Alert[];
}

const MIN_ALERT_AMOUNT = 1000; // Filter out alerts below $1000

export function AlertList({ alerts }: Props) {
  // Filter out small alerts below the minimum threshold
  const filteredAlerts = alerts.filter(alert => !alert.amount || alert.amount >= MIN_ALERT_AMOUNT);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-900 border-red-700 text-red-100';
      case 'MEDIUM':
        return 'bg-yellow-900 border-yellow-700 text-yellow-100';
      case 'LOW':
        return 'bg-blue-900 border-blue-700 text-blue-100';
      default:
        return 'bg-gray-800 border-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'NEW_WHALE':
        return '🐋';
      case 'WHALE':
        return '🐳';
      case 'LARGE_MOVEMENT':
        return '📈';
      case 'UNUSUAL_VOLUME':
        return '⚡';
      default:
        return '📊';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Recent Alerts</h2>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">
            No alerts yet. Monitoring in progress...
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredAlerts.slice(0, 20).map((alert) => (
              <div
                key={alert.id}
                className={`px-6 py-4 ${getSeverityColor(alert.severity)} border-l-4 ${
                  alert.read ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start">
                  <span className="text-2xl mr-3">{getTypeIcon(alert.type)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <div className="flex items-center mt-2 text-xs text-gray-400">
                      <span>{formatDistanceToNow(alert.timestamp, { addSuffix: true })}</span>
                      {alert.amount && (
                        <span className="ml-4 font-semibold text-green-400">
                          ${alert.amount.toFixed(2)}
                        </span>
                      )}
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
