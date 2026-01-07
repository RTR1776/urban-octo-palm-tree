import { useEffect, useState } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface PricePoint {
  t: number;  // timestamp
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

interface Props {
  marketId: string;
  marketQuestion: string;
  interval?: '1m' | '5m' | '1h' | '1d';
  height?: number;
}

export function PriceChart({ marketId, marketQuestion, interval = '1h', height = 300 }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPriceHistory();
  }, [marketId, interval]);

  const loadPriceHistory = async () => {
    try {
      setLoading(true);
      setError(false);
      
      const endTs = Math.floor(Date.now() / 1000);
      const startTs = endTs - (24 * 60 * 60); // Last 24 hours
      
      const response = await fetch(
        `${API_BASE}/markets/${marketId}/price-history?interval=${interval}&startTs=${startTs}&endTs=${endTs}`
      );
      
      if (!response.ok) {
        console.warn('Price history API not available');
        throw new Error('Failed to fetch');
      }
      
      const priceData: PricePoint[] = await response.json();
      
      if (!Array.isArray(priceData)) {
        throw new Error('Invalid data format');
      }
      
      // Transform for chart
      const chartData = priceData.map(point => ({
        time: new Date(point.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: point.c * 100, // Convert to cents
        volume: point.v,
        timestamp: point.t,
      }));
      
      setData(chartData);
    } catch (error) {
      console.error('Error loading price history:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Price Chart (24h)</h3>
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="text-gray-500">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Price Chart (24h)</h3>
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="text-gray-500">No price data available</div>
        </div>
      </div>
    );
  }

  const priceChange = data.length > 1 
    ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100 
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Price Chart (24h)</h3>
          <p className="text-xs text-gray-500 line-clamp-1 mt-1">{marketQuestion}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-400">
            {data[data.length - 1]?.price.toFixed(1)}¢
          </div>
          <div className={`text-sm font-semibold ${
            priceChange >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            stroke="#9CA3AF"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#9CA3AF"
            tick={{ fontSize: 11 }}
            domain={[0, 100]}
            label={{ value: '¢', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              fontSize: '12px'
            }}
            labelStyle={{ color: '#9CA3AF' }}
            formatter={(value: any) => [`${value.toFixed(2)}¢`, 'Price']}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#60A5FA" 
            strokeWidth={2}
            fill="url(#colorPrice)"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <div>Interval: {interval}</div>
        <div>{data.length} data points</div>
      </div>
    </div>
  );
}
