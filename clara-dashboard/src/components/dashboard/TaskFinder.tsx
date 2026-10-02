"use client";

import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { matchTasks } from "@/lib/tasks";

export type TaskFinderItem = {
  goal: string;
  href: string;
  keywords: string;
  pageLabel: string;
};

type TaskFinderProps = {
  open: boolean;
  items: TaskFinderItem[];
  onClose: () => void;
};

const FOCUSABLE = 'input, a[href], button:not([disabled])';

/** Dialog "Saya mau ...": user mengetik tujuannya, Clara menunjuk halaman yang tepat. */
export function TaskFinder({ open, items, onClose }: TaskFinderProps) {
  // Dipasang ulang tiap dibuka, jadi kolom cari selalu mulai kosong.
  return open ? <TaskFinderDialog items={items} onClose={onClose} /> : null;
}

function TaskFinderDialog({ items, onClose }: Omit<TaskFinderProps, "open">) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const results = useMemo(() => matchTasks(items, query), [items, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    );
    const links = focusable.filter((node) => node.tagName === "A");
    const activeIndex = links.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      links[Math.min(activeIndex + 1, links.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (activeIndex <= 0) {
        inputRef.current?.focus();
      } else {
        links[activeIndex - 1]?.focus();
      }
    } else if (event.key === "Enter" && document.activeElement === inputRef.current) {
      event.preventDefault();
      links[0]?.click();
    } else if (event.key === "Tab" && focusable.length > 0) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 px-4 pt-[10vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="flex max-h-[76vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-clara-line bg-clara-overlay shadow-[var(--shadow-floating)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-clara-line-subtle px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-clara-ink">
            Kamu mau apa?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-clara-ink-2 hover:bg-clara-sunken hover:text-clara-ink"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <label htmlFor={`${titleId}-q`} className="sr-only">
            Ketik tujuanmu
          </label>
          <div className="relative">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-clara-ink-3"
            />
            <input
              id={`${titleId}-q`}
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Contoh: balas chat, follow-up, reset password"
              autoComplete="off"
              className="clara-input w-full"
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>
        </div>

        <ul className="clara-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {results.map((item) => (
            <li key={`${item.href}-${item.goal}`}>
              <Link
                href={item.href}
                onClick={onClose}
                className="flex min-h-11 flex-col gap-0.5 rounded-xl px-3 py-2.5 hover:bg-clara-sunken focus-visible:bg-clara-sunken sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="text-sm font-medium text-clara-ink">{item.goal}</span>
                <span className="shrink-0 text-xs text-clara-ink-3">Buka {item.pageLabel}</span>
              </Link>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-clara-ink-2">
              Belum ada yang cocok dengan &ldquo;{query}&rdquo;. Coba kata lain, misalnya
              &ldquo;balas&rdquo;, &ldquo;follow-up&rdquo;, atau &ldquo;password&rdquo;.
            </li>
          ) : null}
        </ul>

        <p className="hidden border-t border-clara-line-subtle px-4 py-2.5 text-xs text-clara-ink-3 sm:block">
          Tekan Ctrl+K (Cmd+K di Mac) kapan saja untuk membuka ini.
        </p>
      </div>
    </div>
  );
}
