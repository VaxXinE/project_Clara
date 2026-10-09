"use client";

import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ChatAvatar } from "@/components/dashboard/ChatAvatar";
import { CustomerNameForm } from "@/components/dashboard/CustomerNameForm";
import { customerLabel } from "@/lib/customer";
import { Tag, ValueTag } from "@/components/dashboard/Tag";
import { apiFetch } from "@/lib/api";
import { formatClock, formatDayLabel, formatRelativeTime } from "@/lib/format";
import { QUICK_SCHEDULES } from "@/lib/schedule";
import {
  ACCOUNT_CATEGORY,
  DEAL_STATUS,
  STAGE,
  TEMPERATURE,
  labelOf,
} from "@/lib/vocab";
import type { LeadDetail, LeadUpdateRequest } from "@/types/dashboard";

function isPast(value: string): boolean {
  return new Date(value).getTime() <= Date.now();
}

type Props = {
  title: string;
  conversationId: string;
  /** Dipanggil setelah nama customer disimpan, supaya halaman memuat ulang nama baru. */
  onRenamed: () => Promise<void> | void;
  channelLabel: string;
  leadId: string | null;
  customerProfileId: string | null;
  onClose: () => void;
};

/**
 * Info customer di samping chat, seperti "Info kontak" di WhatsApp Web. Sales bisa melihat posisi lead dan mengatur
 * jadwal follow-up tanpa meninggalkan chat. Halaman lead lengkap tetap ada lewat tombol di bawah.
 */
export function ContactInfoPanel({
  title,
  conversationId,
  onRenamed,
  channelLabel,
  leadId,
  customerProfileId,
  onClose,
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(leadId));
  const [errorMessage, setErrorMessage] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!leadId) {
      return;
    }

    let isCancelled = false;

    async function loadLead() {
      try {
        const data = await apiFetch<LeadDetail>(`/leads/${leadId}`);
        if (!isCancelled) {
          setLead(data);
          setErrorMessage("");
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Info lead belum bisa dimuat.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLead();

    return () => {
      isCancelled = true;
    };
  }, [leadId]);

  async function handleSchedule(date: Date | null) {
    if (!leadId) {
      return;
    }

    setIsScheduling(true);
    setErrorMessage("");
    setNotice("");

    try {
      const payload: LeadUpdateRequest = {
        next_follow_up_at: date ? date.toISOString() : null,
      };
      const updated = await apiFetch<LeadDetail>(`/leads/${leadId}`, {
        method: "PATCH",
        body: payload,
      });
      setLead(updated);
      setNotice(
        date
          ? `Jadwal tersimpan: ${formatDayLabel(date.toISOString())}, ${formatClock(date.toISOString())}.`
          : "Jadwal follow-up dihapus.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Jadwal belum bisa disimpan. Coba lagi.",
      );
    } finally {
      setIsScheduling(false);
    }
  }

  const followUpAt = lead?.next_follow_up_at ?? null;
  const isOverdue = followUpAt ? isPast(followUpAt) : false;
  const isClosed =
    lead?.current_stage === "won" || lead?.current_stage === "lost";

  return (
    <aside
      aria-label={`Info ${title}`}
      className="clara-scrollbar absolute inset-y-0 right-0 z-30 flex w-full flex-col overflow-y-auto border-l border-clara-line bg-clara-surface shadow-[var(--shadow-floating)] sm:w-[23rem]"
    >
      <div className="flex items-start gap-3 border-b border-clara-line-subtle p-4">
        <ChatAvatar title={title} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-base font-bold clara-text-primary">
            {customerLabel(title).text}
          </h2>
          <p className="text-xs clara-text-muted">{channelLabel}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Tutup info customer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-clara-line hover:bg-clara-sunken"
        >
          <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-4">
        <CustomerNameForm conversationId={conversationId} currentName={title} onSaved={onRenamed} />

        {!leadId ? (
          <p className="text-sm leading-6 clara-text-secondary">
            Chat ini belum terhubung ke lead. Lead dibuat otomatis setelah Clara
            membaca chatnya. Klik{" "}
            <span className="font-semibold clara-text-primary">
              Baca dan susun jawaban
            </span>{" "}
            di panel balas.
          </p>
        ) : null}

        {leadId && isLoading ? (
          <p role="status" className="text-sm clara-text-secondary">
            Memuat info lead...
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="clara-alert clara-alert-danger">
            {errorMessage}
          </p>
        ) : null}

        {lead ? (
          <>
            <div className="flex flex-wrap gap-2">
              {lead.current_stage !== "unknown" ? (
                <ValueTag table={STAGE} value={lead.current_stage} />
              ) : null}
              {lead.lead_temperature !== "unknown" ? (
                <ValueTag table={TEMPERATURE} value={lead.lead_temperature} />
              ) : null}
              {lead.account_category && lead.account_category !== "unknown" ? (
                <Tag>{labelOf(ACCOUNT_CATEGORY, lead.account_category)}</Tag>
              ) : null}
              {lead.deal?.status ? (
                <ValueTag table={DEAL_STATUS} value={lead.deal.status} />
              ) : null}
            </div>

            {isClosed ? null : (
              <section aria-labelledby="contact-followup" className="space-y-2">
                <h3
                  id="contact-followup"
                  className="text-sm font-semibold clara-text-primary"
                >
                  Follow-up berikutnya
                </h3>
                <p
                  className={`text-sm ${isOverdue ? "font-semibold text-clara-danger" : followUpAt ? "clara-text-secondary" : "font-semibold text-clara-warning"}`}
                >
                  {followUpAt
                    ? `${isOverdue ? "Terlambat, seharusnya " : ""}${formatDayLabel(followUpAt)}, ${formatClock(followUpAt)}`
                    : "Belum dijadwalkan"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_SCHEDULES.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      disabled={isScheduling}
                      onClick={() => void handleSchedule(option.date())}
                      className="clara-button clara-button-secondary"
                    >
                      {option.shortLabel}
                    </button>
                  ))}
                  {followUpAt ? (
                    <button
                      type="button"
                      disabled={isScheduling}
                      onClick={() => void handleSchedule(null)}
                      className="clara-button clara-button-ghost"
                    >
                      Hapus jadwal
                    </button>
                  ) : null}
                </div>
                {notice ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="clara-alert clara-alert-success"
                  >
                    {notice}{" "}
                    <Link href="/follow-up" className="font-semibold underline">
                      Lihat di Tindak Lanjut
                    </Link>
                  </p>
                ) : null}
              </section>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs clara-text-muted">Pemilik</dt>
                <dd className="mt-0.5 clara-text-primary">
                  {lead.assigned_user_name ?? "Belum ada"}
                </dd>
              </div>
              <div>
                <dt className="text-xs clara-text-muted">Terakhir dihubungi</dt>
                <dd className="mt-0.5 clara-text-primary">
                  {formatRelativeTime(lead.last_contact_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs clara-text-muted">Jumlah percakapan</dt>
                <dd className="mt-0.5 clara-text-primary">
                  {lead.conversation_count}
                </dd>
              </div>
              <div>
                <dt className="text-xs clara-text-muted">Catatan hari ini</dt>
                <dd className="mt-0.5 clara-text-primary">
                  {lead.discipline_summary.logs_today_count}
                </dd>
              </div>
            </dl>

            <section aria-labelledby="contact-summary" className="space-y-1">
              <h3
                id="contact-summary"
                className="text-sm font-semibold clara-text-primary"
              >
                Ringkasan lead
              </h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 clara-text-secondary">
                {lead.summary ??
                  "Belum ada ringkasan. Klik Baca dan susun jawaban supaya Clara membuatnya."}
              </p>
            </section>

            {lead.notes ? (
              <section aria-labelledby="contact-notes" className="space-y-1">
                <h3
                  id="contact-notes"
                  className="text-sm font-semibold clara-text-primary"
                >
                  Catatan internal
                </h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 clara-text-secondary">
                  {lead.notes}
                </p>
              </section>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-clara-line-subtle pt-4">
          {leadId ? (
            <Link
              href={`/crm/${leadId}`}
              className="clara-button clara-button-primary justify-center"
            >
              Buka lead lengkap
            </Link>
          ) : null}
          {customerProfileId ? (
            <Link
              href={`/customers/${customerProfileId}`}
              className="clara-button clara-button-secondary justify-center"
            >
              Profil customer
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
