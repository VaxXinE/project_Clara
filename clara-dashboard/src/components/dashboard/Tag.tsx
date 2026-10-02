import { describe, type Tone, type VocabTable } from "@/lib/vocab";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-clara-line-subtle bg-clara-sunken text-clara-ink-2",
  good: "border-clara-success-line bg-clara-success-surface text-clara-success",
  warn: "border-clara-warning-line bg-clara-warning-surface text-clara-warning",
  danger: "border-clara-danger-line bg-clara-danger-surface text-clara-danger",
  info: "border-clara-info-line bg-clara-info-surface text-clara-info",
  gold: "border-clara-line bg-clara-wash text-clara-gold",
};

type TagProps = {
  tone?: Tone;
  title?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label status kecil. Satu bentuk dan satu set warna untuk seluruh dashboard. */
export function Tag({ tone = "neutral", title, className = "", children }: TagProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

type ValueTagProps = {
  table: VocabTable;
  value: string | null | undefined;
  className?: string;
};

/** Tag dari nilai backend: `<ValueTag table={TEMPERATURE} value="warm" />` tampil "Hangat". */
export function ValueTag({ table, value, className }: ValueTagProps) {
  const entry = describe(table, value);

  return (
    <Tag tone={entry.tone} title={entry.hint} className={className}>
      {entry.label}
    </Tag>
  );
}
