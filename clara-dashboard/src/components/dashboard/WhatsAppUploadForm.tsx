"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { UploadConversationResponse } from "@/types/dashboard";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const CHANNEL_OPTIONS = [
  {
    value: "whatsapp",
    label: "WhatsApp TXT",
    endpoint: "/upload/whatsapp-txt",
    textEndpoint: "/upload/whatsapp-text",
  },
  {
    value: "telegram",
    label: "Telegram TXT",
    endpoint: "/upload/telegram-txt",
    textEndpoint: "/upload/telegram-text",
  },
] as const;

const INPUT_MODE_OPTIONS = [
  { value: "file", label: "Upload File" },
  { value: "paste", label: "Paste Chat" },
] as const;

export function WhatsAppUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedChannel, setSelectedChannel] =
    useState<(typeof CHANNEL_OPTIONS)[number]["value"]>("whatsapp");
  const [inputMode, setInputMode] =
    useState<(typeof INPUT_MODE_OPTIONS)[number]["value"]>("file");
  const [pastedText, setPastedText] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
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

    const channelConfig = CHANNEL_OPTIONS.find(
      (item) => item.value === selectedChannel
    );

    setIsUploading(true);

    try {
      let result: UploadConversationResponse;

      if (inputMode === "file") {
        if (!selectedFile) {
          setErrorMessage("Pilih file .txt terlebih dahulu.");
          setIsUploading(false);
          return;
        }

        const validationError = validateFile(selectedFile);
        if (validationError) {
          setErrorMessage(validationError);
          setIsUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        result = await apiFetch<UploadConversationResponse>(
          channelConfig?.endpoint ?? "/upload/whatsapp-txt",
          {
            method: "POST",
            body: formData,
          }
        );
      } else {
        if (pastedText.trim().length === 0) {
          setErrorMessage("Paste chat terlebih dahulu.");
          setIsUploading(false);
          return;
        }

        result = await apiFetch<UploadConversationResponse>(
          channelConfig?.textEndpoint ?? "/upload/whatsapp-text",
          {
            method: "POST",
            body: {
              raw_text: pastedText,
              title: conversationTitle.trim() || null,
            },
          }
        );
      }

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
      className="clara-card space-y-5 rounded-[30px] p-5 sm:p-6"
    >
      <div>
        <p className="clara-kicker">Chat Import</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
          Upload file WhatsApp
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload export `.txt` untuk membentuk conversation baru dan memulai
          analisis Clara dari data mentah yang lebih rapi.
        </p>
      </div>

      <div>
        <label
          htmlFor="whatsappFile"
          className="clara-label"
        >
          Input Mode
        </label>
        <select
          id="inputMode"
          value={inputMode}
          onChange={(event) => {
            setInputMode(
              event.target.value as (typeof INPUT_MODE_OPTIONS)[number]["value"]
            );
            setErrorMessage("");
          }}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
        >
          {INPUT_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {inputMode === "file" ? (
        <div>
          <label
            htmlFor="whatsappFile"
            className="text-sm font-semibold text-slate-900"
          >
            File Chat .txt
          </label>

        <input
          ref={fileInputRef}
          id="whatsappFile"
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileChange}
          className="clara-file-input mt-2 block"
        />

        <p className="clara-helper mt-2">
          Maksimal 5MB. Jangan upload file berisi data yang tidak boleh
          dianalisis.
        </p>
      </div>

      {selectedFile && (
        <div className="clara-card-soft rounded-[24px] p-4 text-sm text-slate-700">
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
        <p className="clara-alert clara-alert-danger">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={isUploading || !selectedFile}
        className="clara-button clara-button-primary"
      >
        {isUploading
          ? "Uploading..."
          : inputMode === "file"
            ? "Upload Chat"
            : "Proses Paste Chat"}
      </button>
    </form>
  );
}
