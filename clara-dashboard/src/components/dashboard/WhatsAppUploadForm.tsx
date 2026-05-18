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
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <label
          htmlFor="channelType"
          className="text-sm font-semibold text-slate-900"
        >
          Channel
        </label>
        <select
          id="channelType"
          value={selectedChannel}
          onChange={(event) => {
            setSelectedChannel(
              event.target.value as (typeof CHANNEL_OPTIONS)[number]["value"]
            );
          }}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
        >
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="inputMode"
          className="text-sm font-semibold text-slate-900"
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
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />

          <p className="mt-2 text-xs text-slate-500">
            Maksimal 5MB. Pilih channel yang sesuai sebelum upload supaya parser
            Clara memakai format yang benar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="conversationTitle"
              className="text-sm font-semibold text-slate-900"
            >
              Judul Conversation (opsional)
            </label>
            <input
              id="conversationTitle"
              type="text"
              value={conversationTitle}
              onChange={(event) => {
                setConversationTitle(event.target.value);
              }}
              placeholder="Contoh: Chat Leoni Telegram"
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
            />
          </div>
          <div>
            <label
              htmlFor="pastedText"
              className="text-sm font-semibold text-slate-900"
            >
              Paste Chat
            </label>
            <textarea
              id="pastedText"
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
              }}
              placeholder="Paste export chat di sini..."
              className="mt-2 min-h-[220px] w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
            />
            <p className="mt-2 text-xs text-slate-500">
              Cocok untuk user yang tidak ingin menyimpan file .txt dulu.
            </p>
          </div>
        </div>
      )}

      {inputMode === "file" && selectedFile && (
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
        disabled={
          isUploading ||
          (inputMode === "file" ? !selectedFile : pastedText.trim().length === 0)
        }
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
