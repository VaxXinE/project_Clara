"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { UploadWhatsAppResponse } from "@/types/dashboard";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function WhatsAppUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function validateFile(file: File): string | null {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      return "File harus berformat .txt";
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "Ukuran file maksimal 5MB";
    }

    return null;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateFile(file);

    if (validationError) {
      setSelectedFile(null);
      setErrorMessage(validationError);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!selectedFile) {
      setErrorMessage("Pilih file .txt terlebih dahulu.");
      return;
    }

    const validationError = validateFile(selectedFile);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setIsUploading(true);

    try {
      const result = await apiFetch<UploadWhatsAppResponse>(
        "/upload/whatsapp-txt",
        {
          method: "POST",
          body: formData,
        }
      );

      router.push(`/dashboard/sales/conversations/${result.conversation_id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Upload gagal."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleUpload}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <label
          htmlFor="whatsappFile"
          className="text-sm font-semibold text-slate-900"
        >
          File WhatsApp .txt
        </label>

        <input
          ref={fileInputRef}
          id="whatsappFile"
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileChange}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />

        <p className="mt-2 text-xs text-slate-500">
          Maksimal 5MB. Jangan upload file berisi data yang tidak boleh
          dianalisis.
        </p>
      </div>

      {selectedFile && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Selected:</span> {selectedFile.name}
          </p>
          <p>
            <span className="font-semibold">Size:</span>{" "}
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
      )}

      {errorMessage && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isUploading || !selectedFile}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? "Uploading..." : "Upload Chat"}
      </button>
    </form>
  );
}