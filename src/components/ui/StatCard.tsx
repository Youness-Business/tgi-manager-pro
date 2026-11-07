import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  iconClassName: string;
  trend?: { label: string; positive: boolean };
};

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  iconClassName,
  trend,
}: StatCardProps) {
  return (
    <Card className="min-w-0 p-5 transition-shadow hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="mt-3 break-words font-display text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
            {value}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {trend ? (
          <span className={`text-xs font-semibold ${trend.positive ? "text-emerald-700" : "text-red-700"}`}>
            {trend.positive ? "↑" : "↓"} {trend.label}
          </span>
        ) : null}
        <p className="text-sm text-slate-600">{detail}</p>
      </div>
    </Card>
  );
}
