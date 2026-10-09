"use client";

import {
  faArrowLeft,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMemo, useRef, useState } from "react";

import { AccountFilterTabs } from "@/components/dashboard/AccountFilterTabs";
import {
  MarkdownView,
  markdownPreview,
} from "@/components/dashboard/MarkdownView";
import { Tag } from "@/components/dashboard/Tag";
import { formatDateTime } from "@/lib/format";
import {
  knowledgeTopic,
  parseKnowledgeTitle,
  type AccountFilter,
} from "@/lib/knowledge";
import type {
  KnowledgeUpdateProposalItem,
  ProductKnowledgeItem,
} from "@/types/dashboard";

type Props = {
  items: ProductKnowledgeItem[];
  proposals: KnowledgeUpdateProposalItem[];
};

const PROPOSAL_STATUS: Record<string, string> = {
  draft: "Konsep",
  pending_approval: "Menunggu superadmin",
  approved: "Disetujui",
  rejected: "Ditolak",
  published: "Sudah terbit",
};

type Entry = {
  item: ProductKnowledgeItem;
  name: string;
  account: "mini" | "reguler" | null;
  topic: { label: string; order: number };
};

function groupByTopic(
  entries: Entry[],
): Array<{ label: string; order: number; entries: Entry[] }> {
  const groups = new Map<
    string,
    { label: string; order: number; entries: Entry[] }
  >();

  for (const entry of entries) {
    const group = groups.get(entry.topic.label) ?? {
      ...entry.topic,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(entry.topic.label, group);
  }

  return [...groups.values()].sort((left, right) => left.order - right.order);
}

/**
 * Tampilan baca untuk Head: jawaban resmi yang sedang dipakai Clara, dikelompokkan per topik, dengan isi dokumen
 * yang dirender rapi. Entri yang tidak dipakai disimpan terpisah. Mengubah isi knowledge hanya bisa dilakukan Superadmin.
 */
export function KnowledgeReference({ items, proposals }: Props) {
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState<AccountFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileReading, setMobileReading] = useState(false);
  const browserRef = useRef<HTMLElement>(null);

  const entries = useMemo<Entry[]>(
    () =>
      items.map((item) => {
        const parsed = parseKnowledgeTitle(item.title);
        return {
          item,
          name: parsed.name,
          account: parsed.account,
          topic: knowledgeTopic(item.category),
        };
      }),
    [items],
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return entries.filter((entry) => {
      if (account !== "all" && entry.account !== account) {
        return false;
      }

      return (
        !normalized ||
        `${entry.name} ${entry.topic.label} ${entry.item.content}`
          .toLowerCase()
          .includes(normalized)
      );
    });
  }, [account, entries, query]);

  const activeEntries = visible.filter((entry) => entry.item.is_active);
  const inactiveEntries = visible.filter((entry) => !entry.item.is_active);
  const totalActive = entries.filter((entry) => entry.item.is_active).length;
  const selected =
    visible.find((entry) => entry.item.id === selectedId) ??
    activeEntries[0] ??
    inactiveEntries[0] ??
    null;

  function open(entry: Entry) {
    setSelectedId(entry.item.id);
    setMobileReading(true);
    requestAnimationFrame(() =>
      browserRef.current?.scrollIntoView({ block: "start" }),
    );
  }

  return (
    <div className="space-y-5">
      <section
        className="clara-card p-5 sm:p-6"
        aria-labelledby="knowledge-summary"
      >
        <h2
          id="knowledge-summary"
          className="text-xl font-bold clara-text-primary sm:text-2xl"
        >
          Clara memakai {totalActive} sumber jawaban resmi
        </h2>
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          Hanya sumber yang aktif yang dipakai Clara untuk menjawab customer.{" "}
          {entries.length - totalActive} entri lain disimpan tapi tidak dipakai.
          Halaman ini hanya untuk dibaca. Kalau ada jawaban yang perlu diubah,
          usulannya diajukan saat meninjau chat dan diputuskan oleh superadmin.
        </p>
      </section>

      <section
        ref={browserRef}
        className="clara-card scroll-mt-20 overflow-hidden rounded-2xl"
      >
        <div className="flex flex-col gap-3 border-b border-clara-line-subtle p-4">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Cari sumber jawaban</span>
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="clara-text-muted pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari judul, topik, atau isi (mis. menginap)"
              className="clara-input w-full"
              style={{ paddingLeft: "2.75rem" }}
            />
          </label>
          <AccountFilterTabs
            value={account}
            onChange={setAccount}
            titles={items.map((item) => item.title)}
          />
        </div>

        <div className="grid min-h-[560px] lg:h-[calc(100dvh-22rem)] lg:min-h-[520px] lg:grid-cols-[360px_minmax(0,1fr)]">
          <div
            className={`${mobileReading ? "hidden lg:block" : "block"} clara-scrollbar overflow-y-auto border-r border-clara-line-subtle bg-clara-surface p-3`}
          >
            {activeEntries.length === 0 && inactiveEntries.length === 0 ? (
              <p className="p-6 text-center text-sm clara-text-secondary">
                Tidak ada hasil. Coba kata kunci lain atau ganti jenis akun.
              </p>
            ) : null}

            {groupByTopic(activeEntries).map((group) => (
              <div key={group.label} className="mb-4">
                <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide clara-text-muted">
                  {group.label} ({group.entries.length})
                </h3>
                <ul className="space-y-1">
                  {group.entries.map((entry) => (
                    <li key={entry.item.id}>
                      <EntryButton
                        entry={entry}
                        selected={entry.item.id === selected?.item.id}
                        onOpen={open}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {inactiveEntries.length > 0 ? (
              <details className="rounded-xl border border-clara-line-subtle p-2">
                <summary className="clara-disclosure">
                  Tidak dipakai Clara ({inactiveEntries.length})
                </summary>
                <p className="px-2 pb-2 text-xs leading-5 clara-text-muted">
                  Instruksi internal, aturan gaya, dan entri lama yang disimpan
                  tapi tidak dipakai untuk menjawab customer.
                </p>
                {groupByTopic(inactiveEntries).map((group) => (
                  <div key={group.label} className="mb-3">
                    <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide clara-text-muted">
                      {group.label} ({group.entries.length})
                    </h3>
                    <ul className="space-y-1">
                      {group.entries.map((entry) => (
                        <li key={entry.item.id}>
                          <EntryButton
                            entry={entry}
                            selected={entry.item.id === selected?.item.id}
                            onOpen={open}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>
            ) : null}
          </div>

          <div
            className={`${mobileReading ? "block" : "hidden lg:block"} min-w-0 bg-clara-raised lg:overflow-hidden`}
          >
            {selected ? (
              <article
                className="clara-scrollbar h-full overflow-y-auto"
                aria-labelledby="knowledge-doc-title"
              >
                <header className="sticky top-0 z-10 border-b border-clara-line-subtle bg-clara-raised px-5 py-4 sm:px-6">
                  <div className="mb-3 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setMobileReading(false)}
                      className="clara-button clara-button-ghost"
                    >
                      <FontAwesomeIcon
                        icon={faArrowLeft}
                        className="mr-2 h-4 w-4"
                      />
                      Kembali ke daftar
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id="knowledge-doc-title"
                      className="text-xl font-bold clara-text-primary sm:text-2xl"
                    >
                      {selected.name}
                    </h2>
                    <Tag tone={selected.item.is_active ? "good" : "warn"}>
                      {selected.item.is_active
                        ? "Dipakai Clara"
                        : "Tidak dipakai"}
                    </Tag>
                    {selected.account ? (
                      <Tag>
                        {selected.account === "mini"
                          ? "Akun Mini"
                          : "Akun Reguler"}
                      </Tag>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs clara-text-muted">
                    {selected.topic.label} · diperbarui{" "}
                    {formatDateTime(selected.item.updated_at)}
                  </p>
                </header>
                <div className="px-5 py-6 sm:px-8 sm:py-8">
                  <MarkdownView content={selected.item.content} />
                </div>
              </article>
            ) : (
              <p className="p-6 text-sm clara-text-secondary">
                Pilih satu sumber di sebelah kiri untuk membacanya.
              </p>
            )}
          </div>
        </div>
      </section>

      <details className="clara-card-outline p-4 sm:p-5">
        <summary className="clara-disclosure text-base font-semibold clara-text-primary">
          Usulan perubahan yang sedang berjalan ({proposals.length})
        </summary>
        {proposals.length === 0 ? (
          <p className="mt-2 text-sm clara-text-secondary">
            Belum ada usulan dari hasil tinjau chat.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="rounded-xl border border-clara-line-subtle bg-clara-raised p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold clara-text-primary">
                    {proposal.title}
                  </p>
                  <Tag tone="info">
                    {PROPOSAL_STATUS[proposal.status] ?? proposal.status}
                  </Tag>
                </div>
                <p className="mt-1 text-xs clara-text-muted">
                  Diusulkan oleh {proposal.proposed_by_user_name ?? "-"} ·{" "}
                  {formatDateTime(proposal.updated_at)}
                </p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 clara-text-secondary">
                  {markdownPreview(proposal.proposed_content, 300)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function EntryButton({
  entry,
  selected,
  onOpen,
}: {
  entry: Entry;
  selected: boolean;
  onOpen: (entry: Entry) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      aria-current={selected ? "true" : undefined}
      className={`w-full rounded-xl p-3 text-left ${
        selected
          ? "bg-clara-sunken shadow-[inset_3px_0_0_var(--color-accent)]"
          : "hover:bg-clara-raised"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-5 clara-text-primary">
          {entry.name}
        </span>
        {entry.account ? (
          <span className="shrink-0 rounded-full border border-clara-line-subtle px-2 py-0.5 text-xs clara-text-secondary">
            {entry.account === "mini" ? "Mini" : "Reguler"}
          </span>
        ) : null}
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 clara-text-secondary">
        {markdownPreview(entry.item.content, 140)}
      </p>
    </button>
  );
}
