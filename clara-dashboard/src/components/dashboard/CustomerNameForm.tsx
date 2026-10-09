"use client";

import { useId, useState } from "react";

import { apiFetch } from "@/lib/api";
import { looksLikePhoneNumber } from "@/lib/customer";

type Props = {
  conversationId: string;
  /** Nama sekarang. Kalau berupa nomor telepon, formulir tampil sebagai ajakan memberi nama. */
  currentName: string;
  onSaved: () => Promise<void> | void;
};

/**
 * Memberi nama customer. Dipakai untuk nomor yang belum disimpan, dan untuk memperbaiki nama yang salah.
 * Nama yang disimpan dikunci: sinkronisasi chat berikutnya tidak menggantinya kembali ke nomor.
 */
export function CustomerNameForm({ conversationId, currentName, onSaved }: Props) {
  const inputId = useId();
  const isUnsavedNumber = looksLikePhoneNumber(currentName);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();

    if (trimmed.length < 2) {
      setErrorMessage("Nama minimal 2 huruf.");
      return;
    }
    if (looksLikePhoneNumber(trimmed)) {
      setErrorMessage("Isi nama orangnya, bukan nomor telepon.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await apiFetch(`/dashboard/sales/conversations/${conversationId}/customer-name`, {
        method: "PATCH",
        body: { name: trimmed },
      });
      setName("");
      await onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nama belum bisa disimpan. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor={inputId} className="clara-label">
        {isUnsavedNumber ? "Nama customer" : "Nama baru"}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder="Contoh: Budi Santoso"
          className="clara-input min-w-0 flex-1"
        />
        <button type="submit" disabled={isSaving || name.trim().length === 0} className="clara-button clara-button-primary shrink-0">
          {isSaving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-clara-warning">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );

  if (isUnsavedNumber) {
    return (
      <section aria-label="Beri nama customer" className="rounded-2xl border border-clara-warning-line bg-clara-warning-surface p-4">
        <p className="text-sm font-semibold clara-text-primary">Nomor ini belum diberi nama</p>
        <p className="mt-1 text-sm leading-6 clara-text-secondary">
          Customer baru yang belum disimpan di kontakmu hanya terlihat sebagai nomor. Beri nama supaya mudah dikenali.
          Nomornya tetap tersimpan.
        </p>
        <div className="mt-3">{form}</div>
      </section>
    );
  }

  return (
    <details className="rounded-2xl border border-clara-line-subtle p-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold clara-text-primary">Ubah nama customer</summary>
      <div className="mt-2">{form}</div>
    </details>
  );
}
