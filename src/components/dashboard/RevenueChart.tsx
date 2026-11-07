import type { MonthlyRevenue } from "@/lib/stats";
import { formatMoney } from "@/lib/formatMoney";

type RevenueChartProps = {
  months: MonthlyRevenue[];
};

const chartWidth = 600;
const chartHeight = 220;
const chartTop = 18;
const chartBottom = 165;
const chartPlotHeight = chartBottom - chartTop;

export function RevenueChart({ months }: RevenueChartProps) {
  const maxAmount = Math.max(...months.map((month) => month.amount), 1);
  const barWidth = 48;
  const gap = (chartWidth - months.length * barWidth) / (months.length + 1);

  return (
    <div className="w-full min-w-0 px-3 pb-3">
      <p className="mb-2 text-sm text-slate-600">Chiffre d’affaires HT</p>
      {months.every((month) => month.amount === 0) ? (
        <p className="flex min-h-48 items-center justify-center text-sm text-slate-600">
          Aucune facture payée sur les six derniers mois.
        </p>
      ) : (
        <svg
          role="img"
          aria-label="Chiffre d’affaires hors taxes des six derniers mois"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="block h-auto w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
        >
          <line
            x1="0"
            y1={chartBottom}
            x2={chartWidth}
            y2={chartBottom}
            stroke="#CBD5E1"
            strokeWidth="1"
          />
          {months.map((month, index) => {
            const x = gap + index * (barWidth + gap);
            const height = Math.max(
              month.amount === 0 ? 0 : 4,
              (month.amount / maxAmount) * chartPlotHeight,
            );
            const y = chartBottom - height;

            return (
              <g key={month.key}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="6"
                  fill={month.amount > 0 ? "#2563EB" : "#E2E8F0"}
                  aria-label={`${month.label} : ${formatMoney(month.amount)}`}
                />
                {month.amount > 0 ? (
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(y - 8, 12)}
                    textAnchor="middle"
                    className="fill-slate-600"
                    fontSize="11"
                  >
                    {new Intl.NumberFormat("fr-MA", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(month.amount)}
                  </text>
                ) : null}
                <text
                  x={x + barWidth / 2}
                  y={chartBottom + 24}
                  textAnchor="middle"
                  className="fill-slate-600"
                  fontSize="12"
                >
                  {month.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
