"use client";

import { useEffect, useId, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type {
  LeadDealItem,
  LeadDealUpsertRequest,
  LeadListItem,
  LeadUpdateRequest,
} from "@/types/dashboard";

const LOST_REASONS = [
  "Biaya atau harga dirasa terlalu mahal",
  "Customer tidak membalas lagi",
  "Customer memilih penyedia lain",
  "Customer belum siap atau menunda keputusan",
  "Alasan lain",
] as const;

type Props = {
  lead: LeadListItem;
  outcome: "won" | "lost";
  onClose: () => void;
  /** Dipanggil setelah tahap berubah, supaya daftar memuat ulang. Dialog tertutup sendiri kalau semuanya berhasil. */
  onDone: () => Promise<void>;
};

/**
 * Konfirmasi sebelum sebuah lead ditandai berhasil atau batal. Tahap saja tidak cukup: laporan KPI memakai data deal,
 * jadi dialog ini sekaligus mencatat nilai deal (berhasil) atau alasan batal.
 */
export function CloseLeadDialog({ lead, outcome, onClose, onDone }: Props) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const [existingDeal, setExistingDeal] = useState<LeadDealItem | null>(null);
  const [expectedValue, setExpectedValue] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [partialFailure, setPartialFailure] = useState(false);
  const isWon = outcome === "won";

  // Isi nilai deal yang sudah ada supaya Sales tidak mengetik ulang. Kalau gagal dimuat, formulir tetap bisa dipakai.
  useEffect(() => {
    let isCancelled = false;

    async function loadDeal() {
      try {
        const deal = await apiFetch<LeadDealItem | null>(
          `/leads/${lead.id}/deal`,
        );
        if (isCancelled || !deal) {
          return;
        }
        setExistingDeal(deal);
        if (isWon) {
          setExpectedValue(
            deal.expected_value ? String(deal.expected_value) : "",
          );
          setDepositAmount(
            deal.deposit_amount ? String(deal.deposit_amount) : "",
          );
        }
      } catch {
        // Belum ada data deal, atau gagal dimuat.
      }
    }

    void loadDeal();

    return () => {
      isCancelled = true;
    };
  }, [isWon, lead.id]);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isWon && !reason) {
      setErrorMessage("Pilih alasannya dulu.");
      return;
    }

    setIsBusy(true);
    setErrorMessage("");

    try {
      const stagePayload: LeadUpdateRequest = { current_stage: outcome };
      await apiFetch(`/leads/${lead.id}`, {
        method: "PATCH",
        body: stagePayload,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tahap belum bisa diubah. Coba lagi.",
      );
      setIsBusy(false);
      return;
    }

    const existingNotes = existingDeal?.notes?.trim() ?? "";
    const trimmedNote = note.trim();
    const dealPayload: LeadDealUpsertRequest = { status: outcome };

    if (isWon) {
      if (expectedValue) dealPayload.expected_value = Number(expectedValue);
      if (depositAmount) dealPayload.deposit_amount = Number(depositAmount);
      if (trimmedNote)
        dealPayload.notes = existingNotes
          ? `${trimmedNote}\n${existingNotes}`
          : trimmedNote;
    } else {
      const lostText = `Alasan batal: ${reason}${trimmedNote ? `. ${trimmedNote}` : ""}`;
      dealPayload.notes = existingNotes
        ? `${lostText}\n${existingNotes}`
        : lostText;
    }

    try {
      await apiFetch(`/leads/${lead.id}/deal`, {
        method: "PUT",
        body: dealPayload,
      });
      await onDone();
      onClose();
    } catch (error) {
      // Tahap sudah berubah. Daftar dimuat ulang supaya tampilannya jujur, dan Sales diberi tahu apa yang belum tersimpan.
      setPartialFailure(true);
      setErrorMessage(
        `Tahap sudah diubah, tapi data deal belum tersimpan${error instanceof Error ? ` (${error.message})` : ""}. Buka lead untuk melengkapinya.`,
      );
      await onDone().catch(() => undefined);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-clara-line bg-clara-surface p-5 shadow-[var(--shadow-floating)]"
      >
        <h2 id={titleId} className="text-lg font-bold clara-text-primary">
          {isWon ? "Tandai deal berhasil?" : "Tandai lead ini batal?"}
        </h2>
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          <span className="font-semibold clara-text-primary">
            {lead.display_name}
          </span>
          {isWon
            ? " akan dipindah ke Deal berhasil. Isi nilai dealnya supaya laporan KPI cocok."
            : " akan dipindah ke arsip. Jadwal follow-up-nya dibersihkan, dan alasannya dicatat supaya manager bisa membacanya."}
        </p>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-4 space-y-4"
        >
          {isWon ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${titleId}-value`} className="clara-label">
                  Nilai deal (boleh dikosongkan)
                </label>
                <input
                  id={`${titleId}-value`}
                  ref={firstFieldRef}
                  type="number"
                  min="0"
                  step="1000"
                  inputMode="numeric"
                  value={expectedValue}
                  onChange={(event) => setExpectedValue(event.target.value)}
                  disabled={isBusy}
                  className="clara-input mt-2 w-full"
                />
              </div>
              <div>
                <label htmlFor={`${titleId}-deposit`} className="clara-label">
                  Setoran awal (boleh dikosongkan)
                </label>
                <input
                  id={`${titleId}-deposit`}
                  type="number"
                  min="0"
                  step="1000"
                  inputMode="numeric"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  disabled={isBusy}
                  className="clara-input mt-2 w-full"
                />
              </div>
            </div>
          ) : (
            <fieldset className="space-y-2">
              <legend className="clara-label mb-2">
                Kenapa lead ini batal?
              </legend>
              {LOST_REASONS.map((option, index) => (
                <label
                  key={option}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                    reason === option
                      ? "border-clara-gold bg-clara-wash"
                      : "border-clara-line-subtle bg-clara-sunken hover:border-clara-line"
                  }`}
                >
                  <input
                    ref={index === 0 ? firstFieldRef : undefined}
                    type="radio"
                    name="lost-reason"
                    value={option}
                    checked={reason === option}
                    onChange={() => {
                      setReason(option);
                      setErrorMessage("");
                    }}
                    disabled={isBusy}
                    className="h-4 w-4"
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          )}

          <div>
            <label htmlFor={`${titleId}-note`} className="clara-label">
              Catatan (boleh dikosongkan)
            </label>
            <input
              id={`${titleId}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isBusy}
              placeholder={
                isWon
                  ? "Contoh: deposit pertama sudah masuk"
                  : "Contoh: minta dihubungi lagi bulan depan"
              }
              className="clara-input mt-2 w-full"
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="clara-alert clara-alert-danger">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="clara-button clara-button-ghost"
            >
              {partialFailure ? "Tutup" : "Batal, jangan ubah"}
            </button>
            {partialFailure ? null : (
              <button
                type="submit"
                disabled={isBusy}
                className="clara-button clara-button-primary"
              >
                {isBusy
                  ? "Menyimpan..."
                  : isWon
                    ? "Ya, deal berhasil"
                    : "Ya, tandai batal"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
