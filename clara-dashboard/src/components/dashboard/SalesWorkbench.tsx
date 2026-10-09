"use client";

import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

import { SalesInboxList } from "@/components/dashboard/SalesInboxList";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { PAGE_NAMES } from "@/lib/labels";
import type { CurrentUser } from "@/types/dashboard";

type Props = {
  currentUser: CurrentUser | null;
  /** Percakapan yang sedang dibuka. Kosong berarti belum ada yang dipilih. */
  selectedId: string | null;
  /** Judul untuk breadcrumb. Pakai nama customer saat sebuah chat terbuka. */
  title?: string;
  refreshToken?: number;
  children?: React.ReactNode;
};

/**
 * Halaman kerja Sales seperti WhatsApp Web: daftar chat di kiri, isi chat di kanan.
 * Di layar kecil hanya satu sisi yang tampil: daftar kalau belum memilih chat, isi chat kalau sudah.
 */
export function SalesWorkbench({
  currentUser,
  selectedId,
  title = PAGE_NAMES.inbox,
  refreshToken = 0,
  children,
}: Props) {
  return (
    <WorkspaceShell bare currentUser={currentUser} title={title} description="">
      <div className="flex h-[calc(100dvh-7rem)] min-h-[34rem] flex-col overflow-hidden rounded-2xl border border-clara-line bg-clara-surface">
        <p
          role="note"
          data-testid="send-disclaimer"
          className="flex shrink-0 items-start gap-2 border-b border-clara-line-subtle bg-clara-info-surface px-4 py-2 text-xs leading-5 text-clara-info sm:text-sm"
        >
          <FontAwesomeIcon
            icon={faCircleInfo}
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            <span className="font-semibold">
              Halaman ini tidak bisa mengirim pesan ke customer.
            </span>{" "}
            Untuk membalas, buka web chat-nya (WhatsApp Web, Instagram DM, atau
            TikTok DM) lalu gunakan Clara Extension.
          </span>
        </p>

        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="Daftar chat"
            data-onboarding-id="sales-inbox-filters"
            className={`${
              selectedId ? "hidden lg:flex" : "flex"
            } min-h-0 w-full min-w-0 flex-col border-clara-line-subtle lg:w-[320px] lg:shrink-0 lg:border-r xl:w-[340px]`}
          >
            <SalesInboxList
              selectedId={selectedId}
              refreshToken={refreshToken}
            />
          </aside>

          <section
            aria-label="Percakapan"
            className={`${selectedId ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-1 flex-col`}
          >
            {children ?? <NothingSelected />}
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export function NothingSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-bold clara-text-primary">
        Pilih chat untuk dibuka
      </h1>
      <p className="max-w-sm text-sm leading-6 clara-text-secondary">
        Klik salah satu customer di daftar sebelah kiri. Clara membantu membaca
        chat dan menyusun jawabannya. Untuk mengirim, pakai Clara Extension di
        web chat-nya.
      </p>
      <Link href="/upload" className="clara-button clara-button-secondary">
        {PAGE_NAMES.intake}
      </Link>
    </div>
  );
}
