import { getScoreCategory } from "../utils/scoring";

interface ScoreGaugeProps {
  score: number;
}

export const ScoreGauge = ({ score }: ScoreGaugeProps) => {
  const category = getScoreCategory(score);
  const colorMap: { [key: string]: string } = {
    green: "from-green-500 to-emerald-600",
    blue: "from-blue-500 to-blue-600",
    yellow: "from-amber-500 to-amber-600",
    red: "from-red-500 to-red-600",
  };

  const gradientClass = colorMap[category.color] || "from-gray-500 to-gray-600";

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
      <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
        Overall Quality Score
      </h2>

      <div className="flex flex-col items-center">
        <div className="relative w-48 h-48 mb-6">
          {/* Gauge background */}
          <svg className="w-full h-full" viewBox="0 0 200 200">
            {/* Track */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Score fill */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              style={{
                strokeDasharray: `${(score / 100) * 251.2} 251.2`,
              }}
            />

            <defs>
              <linearGradient
                id="scoreGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-slate-900">{score}</div>
            <div className="text-lg text-slate-600">/100</div>
          </div>
        </div>

        {/* Category badge */}
        <div
          className={`text-center py-2 px-6 rounded-full font-semibold text-white mb-4 bg-gradient-to-r ${gradientClass}`}
        >
          {category.label}
        </div>

        {/* Description */}
        <div className="text-center max-w-md">
          <p className="text-slate-600 text-sm mb-3">
            {score >= 85
              ? "This company demonstrates excellent fundamentals with strong growth, profitability, and financial health."
              : score >= 70
                ? "This company shows good fundamentals with solid growth and reasonable debt levels."
                : score >= 50
                  ? "This company shows average fundamentals with mixed metrics across categories."
                  : "This company shows weak fundamentals with concerns across key metrics."}
          </p>
        </div>
      </div>

      {/* Scale reference */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-center">
          <div>
            <div className="text-red-600">Poor</div>
            <div className="text-slate-400">0-50</div>
          </div>
          <div>
            <div className="text-amber-600">Average</div>
            <div className="text-slate-400">50-70</div>
          </div>
          <div>
            <div className="text-blue-600">Good</div>
            <div className="text-slate-400">70-85</div>
          </div>
          <div>
            <div className="text-green-600">Excellent</div>
            <div className="text-slate-400">85-100</div>
          </div>
        </div>
      </div>
    </div>
  );
};
