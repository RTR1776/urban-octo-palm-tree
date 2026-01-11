/**
 * Correlation Matrix Heatmap
 *
 * Displays correlation between top markets as a heatmap
 */

interface CorrelationData {
  markets: Array<{
    id: string;
    question: string;
  }>;
  matrix: number[][];
}

interface CorrelationHeatmapProps {
  data: CorrelationData | null;
  loading?: boolean;
  height?: number;
}

export function CorrelationHeatmap({ data, loading, height = 400 }: CorrelationHeatmapProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500 dark:text-gray-400">Loading correlation data...</p>
      </div>
    );
  }

  if (!data || !data.markets || data.markets.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500 dark:text-gray-400">No correlation data available</p>
      </div>
    );
  }

  const { markets, matrix } = data;
  const cellSize = Math.min(50, Math.floor((height - 100) / markets.length));

  // Get color for correlation value (-1 to 1)
  const getColor = (value: number): string => {
    if (value >= 0.7) return 'bg-green-600';
    if (value >= 0.5) return 'bg-green-500';
    if (value >= 0.3) return 'bg-green-400';
    if (value >= 0.1) return 'bg-green-300';
    if (value >= -0.1) return 'bg-gray-300 dark:bg-gray-600';
    if (value >= -0.3) return 'bg-red-300';
    if (value >= -0.5) return 'bg-red-400';
    if (value >= -0.7) return 'bg-red-500';
    return 'bg-red-600';
  };

  return (
    <div className="overflow-auto">
      <div className="inline-block min-w-full">
        {/* Legend */}
        <div className="mb-4 flex items-center gap-4 text-sm">
          <span className="text-gray-700 dark:text-gray-300 font-medium">Correlation:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Strong Positive (0.7+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Weak (-0.1 to 0.1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Strong Negative (-0.7+)</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="flex">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-end">
            <div style={{ height: cellSize }}></div>
            {markets.map((market, i) => (
              <div
                key={`y-${i}`}
                style={{ height: cellSize }}
                className="flex items-center pr-2"
              >
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                  {market.question.slice(0, 30)}...
                </span>
              </div>
            ))}
          </div>

          {/* Matrix and X-axis labels */}
          <div>
            {/* X-axis labels (rotated) */}
            <div className="flex" style={{ height: cellSize }}>
              {markets.map((market, i) => (
                <div
                  key={`x-${i}`}
                  style={{ width: cellSize }}
                  className="flex items-end justify-center pb-1"
                >
                  <span
                    className="text-xs text-gray-700 dark:text-gray-300 transform -rotate-45 origin-bottom-left truncate"
                    style={{ maxWidth: cellSize * 1.5 }}
                  >
                    {market.question.slice(0, 20)}...
                  </span>
                </div>
              ))}
            </div>

            {/* Matrix grid */}
            {matrix.map((row, i) => (
              <div key={`row-${i}`} className="flex">
                {row.map((value, j) => (
                  <div
                    key={`cell-${i}-${j}`}
                    style={{ width: cellSize, height: cellSize }}
                    className={`${getColor(value)} border border-gray-200 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}
                    title={`${markets[i].question} vs ${markets[j].question}: ${value.toFixed(2)}`}
                  >
                    <span className="text-xs font-medium text-white">
                      {value.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
