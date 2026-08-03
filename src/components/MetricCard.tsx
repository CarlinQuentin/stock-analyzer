import React from "react";
import { getMetricAnalysis } from "../utils/scoring";

interface ChartDataPoint {
  label: string;
  value: number;
}

interface MetricCardProps {
  title: string;
  value: number | null;
  unit?: string;
  score: number | null;
  description?: string;
  icon?: string;
  tooltip?: string;
  chartData?: ChartDataPoint[];
  chartValueType?: "currency" | "percent" | "number";
  isExpanded?: boolean;
  onClick?: () => void;
  directionStrategy?: "higherIsBetter" | "lowerIsBetter";
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit = "",
  score,
  description,
  icon,
  tooltip,
  chartData,
  chartValueType = "currency",
  isExpanded = false,
  onClick,
  directionStrategy,
}) => {
  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    if (score >= 85) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/50";
    if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50";
    if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50";
    return "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50";
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return "bg-slate-400 dark:bg-slate-500";
    if (score >= 85) return "bg-green-600 dark:bg-green-500";
    if (score >= 70) return "bg-blue-600 dark:bg-blue-500";
    if (score >= 50) return "bg-amber-600 dark:bg-amber-500";
    return "bg-red-600 dark:bg-red-500";
  };

  const getScoreHexColor = (score: number | null) => {
    if (score === null) return "#94a3b8"; // slate-400
    if (score >= 85) return "#10b981"; // green-500
    if (score >= 70) return "#3b82f6"; // blue-500
    if (score >= 50) return "#f59e0b"; // amber-500
    return "#ef4444"; // red-500
  };

  const formatChartValue = (val: number): string => {
    if (chartValueType === "percent") {
      return `${val.toFixed(1)}%`;
    }
    if (chartValueType === "number") {
      return val.toFixed(2);
    }
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    let text = "";
    if (absVal >= 1e9) {
      text = `${(absVal / 1e9).toFixed(1)}B`;
    } else if (absVal >= 1e6) {
      text = `${(absVal / 1e6).toFixed(1)}M`;
    } else {
      text = absVal.toFixed(2);
    }
    return (isNegative ? "-" : "") + "$" + text;
  };

  const formattedValue =
    typeof value === "number"
      ? unit === "%"
        ? (value * 100).toFixed(2)
        : value % 1 !== 0
        ? value.toFixed(2)
        : value
      : value;

  // Render SVG Chart components
  const renderChart = () => {
    if (!chartData || chartData.length === 0) return null;

    const width = 400;
    const height = 120;
    const paddingLeft = 20;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 20;

    const values = chartData.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    
    const adjustedMin = range === 0 ? minVal - 1 : minVal - range * 0.15;
    const adjustedMax = range === 0 ? maxVal + 1 : maxVal + range * 0.15;

    const points = chartData.map((item, i) => {
      const divisor = chartData.length > 1 ? chartData.length - 1 : 1;
      const x = paddingLeft + (i / divisor) * (width - paddingLeft - paddingRight);
      const val = item.value;
      const y = height - paddingBottom - ((val - adjustedMin) / (adjustedMax - adjustedMin)) * (height - paddingTop - paddingBottom);
      return { x, y, label: item.label, value: item.value };
    });

    const getTrendColorHex = (
      data: ChartDataPoint[],
      strategy: "higherIsBetter" | "lowerIsBetter",
      defaultHex: string
    ): string => {
      if (data.length < 2) return defaultHex;
      const firstVal = data[0].value;
      const lastVal = data[data.length - 1].value;
      if (lastVal === firstVal) return "#94a3b8"; // Neutral slate
      const isImprovement = strategy === "lowerIsBetter" 
        ? lastVal < firstVal 
        : lastVal > firstVal;
      return isImprovement ? "#10b981" : "#ef4444"; // Green vs Red
    };

    const defaultColorHex = getScoreHexColor(score);
    const colorHex = directionStrategy && chartData
      ? getTrendColorHex(chartData, directionStrategy, defaultColorHex)
      : defaultColorHex;
    const gradId = `chart-grad-${title.replace(/\s+/g, "")}`;

    let linePath = "";
    let areaPath = "";

    if (points.length > 1) {
      linePath = `M ${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`;
      areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} L ${points[0].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} Z`;
    }

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorHex} stopOpacity="0.25" />
            <stop offset="100%" stopColor={colorHex} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Gridlines */}
        <line 
          x1={paddingLeft} 
          y1={height - paddingBottom} 
          x2={width - paddingRight} 
          y2={height - paddingBottom} 
          className="stroke-slate-200 dark:stroke-slate-700/80 stroke-1 stroke-dasharray-[3,3]"
          strokeDasharray="3,3"
        />
        <line 
          x1={paddingLeft} 
          y1={paddingTop} 
          x2={width - paddingRight} 
          y2={paddingTop} 
          className="stroke-slate-200/50 dark:stroke-slate-700/40 stroke-1 stroke-dasharray-[3,3]"
          strokeDasharray="3,3"
        />

        {/* Filled Area */}
        {points.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Line */}
        {points.length > 1 && (
          <path 
            d={linePath} 
            fill="none" 
            stroke={colorHex} 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        )}

        {/* Dots and Labels */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Direct Value Label above the dot */}
            <text 
              x={p.x} 
              y={p.y - 7} 
              textAnchor="middle" 
              className="text-[9px] font-bold fill-slate-700 dark:fill-slate-200"
            >
              {formatChartValue(p.value)}
            </text>
            
            {/* Dot */}
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="4" 
              fill={colorHex} 
              className="stroke-white dark:stroke-slate-800 stroke-[2px]"
            />
            
            {/* Year Label below the plot area */}
            <text 
              x={p.x} 
              y={height - 4} 
              textAnchor="middle" 
              className="text-[9px] font-semibold fill-slate-400 dark:fill-slate-400"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-slate-200 dark:border-slate-700 hover:shadow-lg flex flex-col justify-between ${
        onClick 
          ? "cursor-pointer hover:border-blue-500/80 dark:hover:border-blue-500/80 active:scale-[0.99] transition-all duration-200" 
          : "transition-all duration-300"
      }`}
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {title}
              </h3>
              {tooltip && (
                <div className="relative group/tooltip inline-block">
                  <span
                    aria-label={tooltip}
                    className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help transition-colors duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
                      <path d="M11 10h2v6h-2zm0-4h2v2h-2z" />
                    </svg>
                  </span>
                  
                  {/* Premium Custom Tooltip */}
                  <div className="absolute bottom-full left-0 md:left-1/2 md:-translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-sm text-xs text-slate-200 dark:text-slate-200 shadow-xl border border-slate-800/80 dark:border-slate-800/50 pointer-events-none opacity-0 scale-95 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-200 origin-bottom z-30 font-normal normal-case tracking-normal text-left">
                    <p className="leading-relaxed">{tooltip}</p>
                    {/* Caret */}
                    <div className="absolute top-full left-3 md:left-1/2 md:-translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-950/95"></div>
                  </div>
                </div>
              )}
            </div>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
            )}
          </div>
          {icon && <span className="text-2xl">{icon}</span>}
        </div>

        <div className="mb-4">
          {value !== null ? (
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {formattedValue}
              {unit && (
                <span className="text-xl text-slate-600 dark:text-slate-400 ml-1">{unit}</span>
              )}
            </p>
          ) : (
            <p className="text-lg text-slate-500 dark:text-slate-400 italic">Data not available</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {getMetricAnalysis(score)}
          </span>
          <div
            className={`px-3 py-1 rounded-full text-sm font-bold border ${getScoreColor(score)}`}
          >
            {score !== null ? score : "N/A"}
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getScoreBg(score)}`}
            style={{ width: `${score !== null ? Math.min(score, 100) : 0}%` }}
          ></div>
        </div>
      </div>

      {chartData && chartData.length > 0 && isExpanded && (
        <div className="w-full mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Annual Trend
            </span>
            {chartData.length < 10 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded">
                Fewer than 10 years available
              </span>
            )}
          </div>
          <div className="w-full h-32 bg-slate-50/50 dark:bg-slate-900/20 rounded-lg p-2 border border-slate-100/50 dark:border-slate-700/30">
            {renderChart()}
          </div>
        </div>
      )}
    </div>
  );
};
