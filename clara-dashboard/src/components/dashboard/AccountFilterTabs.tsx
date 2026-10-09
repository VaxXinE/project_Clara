"use client";

import { matchesAccount, type AccountFilter } from "@/lib/knowledge";

const OPTIONS: Array<{ value: AccountFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "mini", label: "Akun Mini" },
  { value: "reguler", label: "Akun Reguler" },
];

type Props = {
  value: AccountFilter;
  onChange: (value: AccountFilter) => void;
  titles: string[];
};

/** Pilihan jenis akun yang selalu terlihat, lengkap dengan jumlah dokumen di tiap pilihan. */
export function AccountFilterTabs({ value, onChange, titles }: Props) {
  return (
    <div role="group" aria-label="Jenis akun" className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        const count = titles.filter((title) =>
          matchesAccount(title, option.value),
        ).length;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              selected
                ? "border-clara-gold bg-clara-sunken clara-text-primary"
                : "border-clara-line-subtle clara-text-secondary hover:bg-clara-raised"
            }`}
          >
            {option.label}{" "}
            <span className="tabular-nums clara-text-muted">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
