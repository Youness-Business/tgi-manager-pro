"use client";

import { Search, X } from "lucide-react";

type SearchInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function SearchInput({
  id,
  label,
  value,
  placeholder,
  onChange,
}: SearchInputProps) {
  return (
    <div className="w-full min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
        />
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-500 transition-colors hover:border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        {value ? (
          <button
            type="button"
            aria-label={`Effacer ${label.toLocaleLowerCase("fr")}`}
            onClick={() => onChange("")}
            className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
