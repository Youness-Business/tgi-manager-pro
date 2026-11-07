"use client";

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
    >
      {loading ? <Spinner size="sm" label="Chargement" /> : leadingIcon}
      {children}
      {!loading ? trailingIcon : null}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function Field({ id, label, hint, error, required, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}{required ? <span className="ml-1 text-red-700" aria-hidden="true">*</span> : null}
      </label>
      {hint ? <p id={hintId} className="text-xs leading-5 text-slate-600">{hint}</p> : null}
      {children}
      {error ? <p id={errorId} role="alert" className="text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

const controlClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:bg-slate-50 disabled:text-slate-500";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} min-h-24 py-3 ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 ${className}`}>
      <input {...props} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" />
      {label}
    </label>
  );
}

export function Spinner({
  size = "md",
  label = "Chargement…",
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const sizes = { sm: 14, md: 19, lg: 26 } as const;
  return (
    <span role="status" aria-label={label} className="inline-flex items-center justify-center">
      <LoaderCircle size={sizes[size]} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200/80 motion-reduce:animate-none ${className}`} />;
}

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" } as const;
  return (
    <span
      aria-label={name}
      role="img"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-bold text-blue-800 ${dimensions[size]}`}
      style={src ? { backgroundImage: `url("${src}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
    >
      {src ? <span className="sr-only">{name}</span> : name.trim().slice(0, 1).toLocaleUpperCase("fr")}
    </span>
  );
}

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
}) {
  const classes = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-sky-100 text-sky-800",
    brand: "bg-blue-100 text-blue-800",
  } as const;
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes[variant]}`}>{children}</span>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="group relative inline-flex" title={label}>{children}<span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus-within:block">{label}</span></span>;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function KpiCard({
  title,
  value,
  detail,
  icon,
  trend,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-shadow hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</span>
      </div>
      <p className="mt-4 break-words font-display text-2xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-[1.75rem]">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {trend ? <span className={`font-semibold ${trend.positive ? "text-emerald-700" : "text-red-700"}`}>{trend.positive ? "↑" : "↓"} {trend.value}</span> : null}
        <span className="text-slate-500">{detail}</span>
      </div>
    </section>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <button type="button" aria-label="Page précédente" disabled={page <= 1} onClick={() => onChange(page - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button>
      <span aria-live="polite" className="text-xs text-slate-600">Page {page} / {pageCount}</span>
      <button type="button" aria-label="Page suivante" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button>
    </nav>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
          {index ? <span aria-hidden="true" className="text-slate-300">/</span> : null}
          {item.href ? <a href={item.href} className="truncate hover:text-blue-700">{item.label}</a> : <span aria-current="page" className="truncate font-medium text-slate-800">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

export function Dropdown({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const setOpenAndRestore = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenAndRestore(false);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpenAndRestore]);
  return (
    <DropdownContext.Provider value={{ open, setOpen: setOpenAndRestore }}>
      <div ref={rootRef} className="relative inline-flex">
        <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">{label}<ChevronDown size={15} aria-hidden="true" /></button>
        {open ? <div role="menu" className="absolute right-0 top-full z-40 mt-2 min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated">{children}</div> : null}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownItem({
  children,
  onSelect,
}: {
  children: ReactNode;
  onSelect: () => void;
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error("DropdownItem doit être utilisé dans Dropdown.");
  return <button type="button" role="menuitem" onClick={() => { onSelect(); context.setOpen(false); }} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">{children}</button>;
}

export function Tabs({
  tabs,
  selected,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  selected: string;
  onChange: (id: string) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }
  return <div role="tablist" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">{tabs.map((tab, index) => <button key={tab.id} ref={(element) => { refs.current[index] = element; }} type="button" role="tab" aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={(event) => onKeyDown(event, index)} className={`min-h-9 rounded-lg px-3 text-sm font-medium transition-colors ${selected === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{tab.label}</button>)}</div>;
}

export function ToastMessage({
  title,
  message,
  onClose,
}: {
  title: string;
  message?: string;
  onClose: () => void;
}) {
  return (
    <div role="status" className="flex w-full max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-elevated">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check size={16} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{title}</span>{message ? <span className="mt-1 block text-xs text-slate-600">{message}</span> : null}</span>
      <button type="button" aria-label="Fermer la notification" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={15} aria-hidden="true" /></button>
    </div>
  );
}
