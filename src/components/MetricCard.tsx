import React from "react";
import { getMetricAnalysis, formatPercentageMetric } from "../utils/scoring";
import { ChartDataPoint } from "../types";

interface MetricCardProps {
  title: string;
  value: number | null;
  statusText?: string;
  changePct?: number | null;
  unit?: string;
  score: number | null;
  description?: string;
  icon?: string;
  tooltip?: string;
  chartData?: ChartDataPoint[];
  chartValueType?: "currency" | "percent" | "number";
  chartType?: "line" | "bar";
  referenceLineValue?: number;
  referenceLineLabel?: string;
  isExpanded?: boolean;
  onClick?: () => void;
  directionStrategy?: "higherIsBetter" | "lowerIsBetter";
  isInformational?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  statusText,
  unit = "",
  score,
  description,
  icon,
  tooltip,
  chartData,
  chartValueType = "currency",
  chartType = "line",
  referenceLineValue,
  referenceLineLabel,
  isExpanded = false,
  onClick,
  directionStrategy,
  isInformational = false,
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
      return formatPercentageMetric(val, true);
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

  const isAlreadyPercentage =
    title.toLowerCase().includes("roic") ||
    title.toLowerCase().includes("profitability") ||
    title.toLowerCase().includes("margin") ||
    title.toLowerCase().includes("consistency") ||
    title.toLowerCase().includes("conversion") ||
    title.toLowerCase().includes("stability");

  const formattedValue =
    typeof value === "number"
      ? unit === "%"
        ? formatPercentageMetric(value, isAlreadyPercentage).replace("%", "")
        : value % 1 !== 0
        ? value.toFixed(2)
        : value
      : value;

  // Render SVG Chart components
  const renderChart = () => {
    if (!chartData || chartData.length === 0) return null;

    const width = 400;
    const height = 120;
    const paddingLeft = 25;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 20;

    /**
     * FCF Consistency Zero-Baseline Bar Chart Renderer:
     * Visualizes historical annual Free Cash Flow to demonstrate:
     * 1. Positive cash generation frequency (green bars > $0 vs red bars <= $0)
     * 2. Cash flow volatility and stability across fiscal years
     * 3. Long-term operational consistency.
     */
    if (chartType === "bar") {
      const values = chartData.map(d => d.value);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      const yMin = Math.min(0, minVal);
      const yMax = Math.max(0, maxVal);
      const range = yMax - yMin;
      const adjustedMin = range === 0 ? yMin - 1 : yMin - range * 0.15;
      const adjustedMax = range === 0 ? yMax + 1 : yMax + range * 0.15;
      const plotHeight = height - paddingTop - paddingBottom;
      const plotWidth = width - paddingLeft - paddingRight;

      const getY = (val: number) =>
        height - paddingBottom - ((val - adjustedMin) / (adjustedMax - adjustedMin)) * plotHeight;

      const yZero = getY(0);
      const step = chartData.length > 0 ? plotWidth / chartData.length : plotWidth;
      const barWidth = Math.min(22, Math.max(8, step * 0.6));

      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          {/* Zero Baseline Reference Line */}
          <line
            x1={paddingLeft}
            y1={yZero}
            x2={width - paddingRight}
            y2={yZero}
            className="stroke-slate-300 dark:stroke-slate-600 stroke-1 stroke-dasharray-[3,3]"
            strokeDasharray="3,3"
          />

          {/* Zero Baseline $0 Label */}
          <text
            x={paddingLeft - 4}
            y={yZero + 3}
            textAnchor="end"
            className="text-[8px] font-bold fill-slate-400 dark:fill-slate-500"
          >
            $0
          </text>

          {/* Vertical Bars */}
          {chartData.map((item, i) => {
            const xCenter = paddingLeft + (i + 0.5) * step;
            const xLeft = xCenter - barWidth / 2;
            const yVal = getY(item.value);
            const isPositive = item.value > 0;
            const barY = isPositive ? yVal : yZero;
            const barH = Math.max(2, Math.abs(yVal - yZero));
            const barColor = isPositive ? "#10b981" : "#ef4444";
            const statusLabel = isPositive ? "Positive FCF" : "Cash Burn";

            return (
              <g key={i} className="group/bar cursor-pointer">
                {/* SVG Bar */}
                <rect
                  x={xLeft}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  rx={2}
                  fill={barColor}
                  className="transition-all duration-200 opacity-90 group-hover/bar:opacity-100 group-hover/bar:brightness-110"
                />

                {/* Fiscal Year Label */}
                <text
                  x={xCenter}
                  y={height - 4}
                  textAnchor="middle"
                  className="text-[9px] font-semibold fill-slate-400 dark:fill-slate-400"
                >
                  {item.label}
                </text>

                {/* Interactive Tooltip on Bar Hover */}
                <g className="opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200 pointer-events-none z-40">
                  <rect
                    x={Math.max(4, Math.min(width - 110, xCenter - 55))}
                    y={Math.max(2, barY - 32)}
                    width={110}
                    height={28}
                    rx={4}
                    className="fill-slate-900/95 dark:fill-slate-950/95 stroke-slate-700/80"
                  />
                  <text
                    x={Math.max(4, Math.min(width - 110, xCenter - 55)) + 55}
                    y={Math.max(2, barY - 32) + 12}
                    textAnchor="middle"
                    className="text-[9px] font-bold fill-white"
                  >
                    {item.label}: {formatChartValue(item.value)}
                  </text>
                  <text
                    x={Math.max(4, Math.min(width - 110, xCenter - 55)) + 55}
                    y={Math.max(2, barY - 32) + 23}
                    textAnchor="middle"
                    className={`text-[8px] font-semibold ${isPositive ? "fill-emerald-400" : "fill-red-400"}`}
                  >
                    ● {statusLabel}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      );
    }

    const values = chartData.map(d => d.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (referenceLineValue !== undefined) {
      minVal = Math.min(minVal, referenceLineValue);
      maxVal = Math.max(maxVal, referenceLineValue);
    }
    const range = maxVal - minVal;
    
    const adjustedMin = range === 0 ? minVal - 1 : minVal - range * 0.15;
    const adjustedMax = range === 0 ? maxVal + 1 : maxVal + range * 0.15;

    const plotHeight = height - paddingTop - paddingBottom;
    const plotWidth = width - paddingLeft - paddingRight;

    const points = chartData.map((item, i) => {
      const divisor = chartData.length > 1 ? chartData.length - 1 : 1;
      const x = paddingLeft + (i / divisor) * plotWidth;
      const val = item.value;
      const y = height - paddingBottom - ((val - adjustedMin) / (adjustedMax - adjustedMin)) * plotHeight;
      return {
        x,
        y,
        label: item.label,
        value: item.value,
        netIncome: item.netIncome,
        fcf: item.fcf,
        revenue: item.revenue,
        operatingIncome: item.operatingIncome,
      };
    });

    const yRef = referenceLineValue !== undefined
      ? height - paddingBottom - ((referenceLineValue - adjustedMin) / (adjustedMax - adjustedMin)) * plotHeight
      : null;

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

    const formatHelperCurrency = (v: number | undefined): string => {
      if (v === undefined || isNaN(v)) return "N/A";
      const isNeg = v < 0;
      const abs = Math.abs(v);
      if (abs >= 1e9) return (isNeg ? "-" : "") + "$" + (abs / 1e9).toFixed(2) + "B";
      if (abs >= 1e6) return (isNeg ? "-" : "") + "$" + (abs / 1e6).toFixed(2) + "M";
      return (isNeg ? "-" : "") + "$" + abs.toFixed(2);
    };

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

        {/* Reference Line */}
        {yRef !== null && yRef >= paddingTop - 5 && yRef <= height - paddingBottom + 5 && (
          <g>
            <line
              x1={paddingLeft}
              y1={yRef}
              x2={width - paddingRight}
              y2={yRef}
              className="stroke-amber-500/80 dark:stroke-amber-400/80 stroke-1 stroke-dasharray-[3,3]"
              strokeDasharray="3,3"
            />
            <text
              x={width - paddingRight}
              y={Math.max(paddingTop + 8, Math.min(height - paddingBottom - 4, yRef - 3))}
              textAnchor="end"
              className="text-[8px] font-bold fill-amber-600 dark:fill-amber-400"
            >
              {referenceLineLabel || `${referenceLineValue?.toFixed(0)}%`}
            </text>
          </g>
        )}

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

        {/* Dots, Node Labels, and Interactive Tooltips */}
        {points.map((p, i) => {
          const hasFCFDetails = p.netIncome !== undefined && p.fcf !== undefined;
          const hasMarginDetails = p.revenue !== undefined && p.operatingIncome !== undefined;

          return (
            <g key={i} className="group/node cursor-pointer">
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
                className="stroke-white dark:stroke-slate-800 stroke-[2px] group-hover/node:r-6 transition-all"
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

              {/* Enhanced Interactive Tooltip on Hover */}
              {(hasFCFDetails || hasMarginDetails) && (
                <g className="opacity-0 group-hover/node:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  <rect
                    x={Math.max(4, Math.min(width - 130, p.x - 65))}
                    y={Math.max(2, p.y - 48)}
                    width={130}
                    height={42}
                    rx={4}
                    className="fill-slate-900/95 dark:fill-slate-950/95 stroke-slate-700/80 shadow-md"
                  />
                  <text
                    x={Math.max(4, Math.min(width - 130, p.x - 65)) + 65}
                    y={Math.max(2, p.y - 48) + 12}
                    textAnchor="middle"
                    className="text-[9px] font-bold fill-white"
                  >
                    {p.label}: {formatChartValue(p.value)}
                  </text>
                  {hasFCFDetails && (
                    <>
                      <text
                        x={Math.max(4, Math.min(width - 130, p.x - 65)) + 65}
                        y={Math.max(2, p.y - 48) + 24}
                        textAnchor="middle"
                        className="text-[8px] font-medium fill-slate-300"
                      >
                        FCF: {formatHelperCurrency(p.fcf)} | Net Inc: {formatHelperCurrency(p.netIncome)}
                      </text>
                      <text
                        x={Math.max(4, Math.min(width - 130, p.x - 65)) + 65}
                        y={Math.max(2, p.y - 48) + 35}
                        textAnchor="middle"
                        className={`text-[8px] font-semibold ${p.value >= 100 ? "fill-emerald-400" : "fill-amber-400"}`}
                      >
                        ● {p.value >= 100 ? "High Quality (>=100%)" : "Lower Conversion (<100%)"}
                      </text>
                    </>
                  )}
                  {hasMarginDetails && (
                    <>
                      <text
                        x={Math.max(4, Math.min(width - 130, p.x - 65)) + 65}
                        y={Math.max(2, p.y - 48) + 24}
                        textAnchor="middle"
                        className="text-[8px] font-medium fill-slate-300"
                      >
                        Op Inc: {formatHelperCurrency(p.operatingIncome)}
                      </text>
                      <text
                        x={Math.max(4, Math.min(width - 130, p.x - 65)) + 65}
                        y={Math.max(2, p.y - 48) + 35}
                        textAnchor="middle"
                        className="text-[8px] font-medium fill-slate-300"
                      >
                        Rev: {formatHelperCurrency(p.revenue)}
                      </text>
                    </>
                  )}
                </g>
              )}
            </g>
          );
        })}
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
          ) : statusText ? (
            <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              {statusText}
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

        {isInformational && (
          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 rounded border border-slate-200/80 dark:border-slate-700/60 font-medium text-center">
            Informational Metric - Not included in Universal Score
          </div>
        )}
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
