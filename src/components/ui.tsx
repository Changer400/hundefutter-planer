import type { ReactNode } from "react";

type Tone =
  | "green"
  | "amber"
  | "purple"
  | "blue"
  | "pink"
  | "yellow"
  | "slate";

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-800/60 text-emerald-100 border-emerald-700",
  amber: "bg-amber-800/60 text-amber-100 border-amber-700",
  purple: "bg-purple-900/60 text-purple-100 border-purple-800",
  blue: "bg-blue-900/60 text-blue-100 border-blue-800",
  pink: "bg-pink-900/60 text-pink-100 border-pink-800",
  yellow: "bg-yellow-900/60 text-yellow-100 border-yellow-800",
  slate: "bg-slate-800/70 text-slate-100 border-slate-700",
};

export function Card({
  title,
  tone = "slate",
  children,
  subtitle,
}: {
  title: ReactNode;
  tone?: Tone;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 overflow-hidden shadow-lg">
      <header
        className={`px-4 py-3 border-b text-center font-semibold text-lg ${toneClasses[tone]}`}
      >
        {title}
      </header>
      {subtitle && (
        <div className="px-4 py-2 text-center text-xs italic text-slate-400 border-b border-slate-800 bg-slate-900/40">
          {subtitle}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block mb-3">
      <div className="text-sm font-semibold text-slate-200 mb-1">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  step,
  className,
}: {
  value: number | "";
  onChange: (v: number) => void;
  placeholder?: string;
  min?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      placeholder={placeholder}
      min={min}
      step={step}
      className={
        "w-full bg-emerald-950/50 border border-emerald-800 rounded px-3 py-2 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 " +
        (className ?? "")
      }
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={
        "w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 " +
        (className ?? "")
      }
    />
  );
}

export function DateInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        "w-full bg-emerald-950/50 border border-emerald-800 rounded px-3 py-2 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 " +
        (className ?? "")
      }
    />
  );
}

export function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-900 border border-purple-800 rounded px-3 py-2 text-purple-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500"
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={
        "w-full bg-emerald-950/50 border border-emerald-800 rounded px-3 py-2 text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 " +
        (className ?? "")
      }
    >
      {options.map((o) => (
        <option key={String(o.value)} value={o.value} className="bg-slate-900">
          {o.label as string}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-slate-500 bg-slate-900 accent-emerald-500"
      />
      {label}
    </label>
  );
}

export function Button({
  children,
  onClick,
  tone = "emerald",
  className,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "emerald" | "slate" | "purple" | "red";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const toneClasses = {
    emerald:
      "bg-emerald-700 hover:bg-emerald-600 border-emerald-600 text-emerald-50",
    slate: "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-50",
    purple:
      "bg-purple-700 hover:bg-purple-600 border-purple-600 text-purple-50",
    red: "bg-red-700 hover:bg-red-600 border-red-600 text-red-50",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        `inline-flex items-center gap-1 px-3 py-2 rounded border font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition ${toneClasses[tone]} ` +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}
