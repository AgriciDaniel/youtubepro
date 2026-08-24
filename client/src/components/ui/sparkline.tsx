interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: string;
  showEndDot?: boolean;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  className = "",
  color,
  showEndDot = true,
}: SparklineProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const isUpTrend = data[data.length - 1] > data[0];

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor = color || (isUpTrend ? "#22c55e" : "#ef4444");

  return (
    <div className={`${className}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-sm"
        />
        {showEndDot && (
          <circle
            cx={width}
            cy={height - ((data[data.length - 1] - min) / range) * (height - 4)}
            r="2"
            fill={strokeColor}
          />
        )}
      </svg>
    </div>
  );
}

interface TrendIndicatorProps {
  value: number;
  previousValue: number;
  className?: string;
}

export function TrendIndicator({
  value,
  previousValue,
  className = "",
}: TrendIndicatorProps) {
  const change = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;
  const isUp = change >= 0;

  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${
        isUp ? "text-green-500" : "text-red-500"
      } ${className}`}
    >
      {isUp ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
    </span>
  );
}
