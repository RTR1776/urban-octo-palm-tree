/**
 * Price History Chart Component
 *
 * Displays OHLCV price data as a line/area chart
 */

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PriceHistory } from '../../types';
import { format } from 'date-fns';

interface PriceHistoryChartProps {
  data: PriceHistory[];
  height?: number;
  showVolume?: boolean;
  chartType?: 'line' | 'area' | 'candle';
}

export function PriceHistoryChart({
  data,
  height = 400,
  showVolume = true,
  chartType = 'area',
}: PriceHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg"
        style={{ height }}
      >
        <p className="text-gray-500">No price data available</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((point) => ({
    ...point,
    timestamp: point.timestamp * 1000, // Convert to milliseconds
    displayTime: format(new Date(point.timestamp * 1000), 'MMM d HH:mm'),
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium mb-2">{data.displayTime}</p>
          <div className="space-y-1 text-sm">
            {chartType === 'candle' && (
              <>
                <p className="text-gray-600 dark:text-gray-400">
                  Open: <span className="font-medium">${data.open.toFixed(2)}</span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  High: <span className="font-medium">${data.high.toFixed(2)}</span>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Low: <span className="font-medium">${data.low.toFixed(2)}</span>
                </p>
              </>
            )}
            <p className="text-gray-600 dark:text-gray-400">
              Close: <span className="font-medium text-blue-600 dark:text-blue-400">${data.close.toFixed(2)}</span>
            </p>
            {showVolume && (
              <p className="text-gray-600 dark:text-gray-400">
                Volume: <span className="font-medium">${data.volume.toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="displayTime"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis
          yAxisId="price"
          domain={['dataMin', 'dataMax']}
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
        />
        {showVolume && (
          <YAxis
            yAxisId="volume"
            orientation="right"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            label={{ value: 'Volume ($)', angle: 90, position: 'insideRight' }}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        {/* Volume bars */}
        {showVolume && (
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="#3b82f6"
            opacity={0.2}
            name="Volume"
          />
        )}

        {/* Price visualization based on type */}
        {chartType === 'line' && (
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Price"
          />
        )}

        {chartType === 'area' && (
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="#3b82f6"
            fillOpacity={0.1}
            name="Price"
          />
        )}

        {chartType === 'candle' && (
          <>
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="high"
              stroke="#22c55e"
              strokeWidth={1}
              dot={false}
              name="High"
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="low"
              stroke="#ef4444"
              strokeWidth={1}
              dot={false}
              name="Low"
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Close"
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
