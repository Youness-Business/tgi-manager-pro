import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Gestion commerciale</p>
        <h1 className="mt-1 break-words font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 break-words text-sm text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex min-w-0 shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
